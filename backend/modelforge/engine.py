import contextlib
import threading
import time

DEFAULT_PROMPT = "Write a Python function that normalizes a list of numbers to sum to one. Handle an empty list and a zero total. Explain the approach clearly."
SYSTEM_PROMPT = "You are a helpful assistant. Follow the user's instructions precisely. Be clear and accurate."


class Engine:
    def __init__(self, settings, merger):
        self.settings, self.merger = settings, merger
        self.lock = threading.RLock()
        self.model = self.tokenizer = None
        self.loaded_recipe = None
        self.resident_revision = None
        self.load_ms = None

    def warmup(self):
        with self.lock:
            if self.settings.mode == "demo":
                return {"loaded": False, "mode": "demo", "message": "Rehearsal uses canned text; no model is loaded."}
            if self.model is None:
                import torch
                from peft import PeftModel
                from transformers import AutoModelForCausalLM, AutoTokenizer

                from .merge import validate_pair

                started = time.perf_counter()
                loaded = validate_pair(self.settings.adapter_paths, self.settings.base_model, self.settings.base_revision)
                revision = loaded["coding"][0]["revision"]
                device = self.settings.device
                if device == "auto":
                    device = "cuda" if torch.cuda.is_available() else "cpu"
                dtype = torch.float16 if device.startswith("cuda") else torch.float32
                tokenizer = AutoTokenizer.from_pretrained(self.settings.base_model, revision=revision, trust_remote_code=False)
                base = AutoModelForCausalLM.from_pretrained(
                    self.settings.base_model, revision=revision, torch_dtype=dtype, trust_remote_code=False
                ).to(device)
                # One resident base; an immutable source adapter keeps PEFT's wrapper in place.
                model = PeftModel.from_pretrained(base, str(self.settings.coding_path), adapter_name="source", is_trainable=False)
                model.eval()
                self.model, self.tokenizer = model, tokenizer
                self.resident_revision = revision
                self.load_ms = round((time.perf_counter() - started) * 1000, 2)
            return {"loaded": True, "mode": "live", "device": str(self.model.device), "load_ms": self.load_ms}

    def generate(self, recipe, request):
        with self.lock:
            if recipe["mode"] != self.settings.mode:
                raise ValueError("This recipe belongs to another runtime mode. Forge it again.")
            if self.settings.mode == "demo":
                return self._demo(recipe, request.prompt)
            self.warmup()
            import torch

            if recipe["base_model"] != self.settings.base_model or recipe["revision"] != self.resident_revision:
                raise ValueError("This recipe uses a different base checkpoint from the resident model. Restart the backend and forge again.")

            started = time.perf_counter()
            path = self.merger.path(recipe)
            if path and self.loaded_recipe != recipe["id"]:
                if "blend" in self.model.peft_config:
                    self.model.set_adapter("source")
                    self.model.delete_adapter("blend")
                self.model.load_adapter(str(path), adapter_name="blend", is_trainable=False)
                self.loaded_recipe = recipe["id"]
            if path:
                self.model.set_adapter("blend")
            switch_ms = (time.perf_counter() - started) * 1000
            text = self.tokenizer.apply_chat_template(
                [{"role": "system", "content": getattr(request, "system_prompt", SYSTEM_PROMPT)}, {"role": "user", "content": request.prompt}],
                tokenize=False, add_generation_prompt=True,
            )
            inputs = self.tokenizer(text, return_tensors="pt", return_token_type_ids=False).to(self.model.device)
            input_tokens = inputs.input_ids.shape[-1]
            if input_tokens > 2048:
                raise ValueError("Prompt exceeds the live 2,048-token limit. Shorten it.")
            args = {"max_new_tokens": request.max_new_tokens, "do_sample": request.temperature > 0,
                    "pad_token_id": self.tokenizer.eos_token_id, "use_cache": True}
            if request.temperature > 0:
                args.update(temperature=request.temperature, top_p=0.95)
            torch.manual_seed(request.seed)
            if torch.cuda.is_available():
                torch.cuda.manual_seed_all(request.seed)
                torch.cuda.synchronize()
            generation_start = time.perf_counter()
            with torch.inference_mode(), self.model.disable_adapter() if path is None else contextlib.nullcontext():
                outputs = self.model.generate(**inputs, **args)
            if torch.cuda.is_available():
                torch.cuda.synchronize()
            seconds = time.perf_counter() - generation_start
            tokens = outputs[0, input_tokens:]
            return {"text": self.tokenizer.decode(tokens, skip_special_tokens=True), "mode": "live",
                    "provenance": "model_generated", "metrics": {
                        "input_tokens": input_tokens, "output_tokens": len(tokens),
                        "generation_ms": round(seconds * 1000, 2), "adapter_switch_ms": round(switch_ms, 2),
                        "tokens_per_second": round(len(tokens) / max(seconds, 1e-9), 2),
                        "device": str(self.model.device), "seed": request.seed,
                        "temperature": request.temperature, "timing_scope": "generation_only; excludes cold load, merge and adapter switch",
                    }}

    def _demo(self, recipe, prompt):
        coding, writing = recipe["weights"]["coding"], recipe["weights"]["writing"]
        humor = recipe["weights"].get("humor", 0)
        thinking = recipe["weights"].get("thinking", 0)
        code = ('def normalize(numbers):\n'
                '    if not numbers:\n'
                '        return []\n'
                '    total = sum(numbers)\n'
                '    if total == 0:\n'
                '        raise ValueError("Cannot normalize a zero total")\n'
                '    return [number / total for number in numbers]')
        if "launch" in prompt.lower() or "announcement" in prompt.lower():
            text = "Meet Evolith. One foundation. Coding, humor, thinking and writing—your combination. Move the sliders, compare outputs, and keep the recipe that works for you."
            if coding > writing:
                text += "\n\nWorkflow: choose weights → concatenate LoRA updates → generate → evaluate."
        elif "lora" in prompt.lower():
            text = "A LoRA adapter is a small set of learned updates to a model. Think of the base model as a musician and each adapter as a new practice routine. Evolith blends compatible routines by adding their weighted updates. Skill quality still needs to be evaluated."
            if coding > writing:
                text += "\n\nΔW = w_c (α_c/r_c) B_c A_c + w_w (α_w/r_w) B_w A_w."
        elif prompt == DEFAULT_PROMPT:
            text = "```python\n" + code + "\n```"
            if writing >= coding and writing > 0:
                text = "Give every number its share of the total. An empty list stays empty; a zero total has no defined normalization, so we raise an error.\n\n" + text
                text += "\n\nFor [2, 3, 5], the result is [0.2, 0.3, 0.5]. Negative inputs are allowed when their total is nonzero."
            elif coding == writing == 0:
                text += "\n\nDivide each element by the sum."
            else:
                text += "\n\nTime: O(n). Extra space: O(n). Empty input returns []; a zero total raises ValueError."
        elif "funny" in prompt.lower() or "joke" in prompt.lower():
            text = "My AI has four sliders. I turned humor up and productivity down. Somehow it still called that an optimization."
        elif "plan" in prompt.lower() and "hackathon" in prompt.lower():
            text = "1. Define one user problem.\n2. Build the smallest working flow.\n3. Test the real behavior and record limits.\n4. Prepare a short demo with a reliable fallback.\n5. Leave time to rehearse and fix the rough edges."
        else:
            text = "Rehearsal mode has no language model. This custom prompt has no canned response. Use a sample prompt to rehearse the interface, or connect the live Colab backend to generate an answer."
        if "no canned response" not in text:
            if thinking > 0:
                text = "Plan: clarify the goal → choose a method → check edge cases → verify the result.\n\n" + text
            if humor > 0:
                text += "\n\nA little personality, without turning the whole answer into a stand-up set."
        return {"text": text, "mode": "demo", "provenance": "canned_rehearsal_text", "metrics": {
            "input_tokens": None, "output_tokens": None, "generation_ms": None,
            "adapter_switch_ms": None, "tokens_per_second": None, "device": "No model loaded",
            "timing_scope": "not measured: no model inference took place",
        }}
