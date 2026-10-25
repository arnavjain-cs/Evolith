"""Supervised, response-only LoRA fine-tuning; one base snapshot for both skills."""
import argparse
import hashlib
import json
import time
from pathlib import Path


def encode_example(tokenizer, record, max_length):
    messages = record["messages"]
    if len(messages) < 2 or messages[-1]["role"] != "assistant":
        raise ValueError("Each example must end with an assistant response.")
    prefix = tokenizer.apply_chat_template(messages[:-1], tokenize=True, add_generation_prompt=True)
    full = tokenizer.apply_chat_template(messages, tokenize=True, add_generation_prompt=False)
    if full[:len(prefix)] != prefix:
        raise ValueError("Chat template prefix differs from the full conversation. Cannot safely mask labels.")
    tokens = full[:max_length]
    labels = [-100] * min(len(prefix), len(tokens)) + tokens[len(prefix):]
    if not any(label != -100 for label in labels):
        return None
    return {"input_ids": tokens, "attention_mask": [1] * len(tokens), "labels": labels}


def train(args):
    import torch
    from huggingface_hub import HfApi
    from peft import LoraConfig, get_peft_model
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        DataCollatorForSeq2Seq,
        Trainer,
        TrainingArguments,
        set_seed,
    )

    if not 1 <= args.rank <= 128:
        raise ValueError("Rank must be between 1 and 128.")
    set_seed(args.seed)
    # Resolve main once, record the immutable revision, and pass it to every download.
    revision_file = args.output / "base_revision.json"
    args.output.mkdir(parents=True, exist_ok=True)
    if revision_file.exists():
        previous = json.loads(revision_file.read_text())
        if previous["base_model"] != args.base_model:
            raise ValueError("Output directory already belongs to a different base model.")
        revision = previous["revision"]
        if args.revision and args.revision != revision:
            raise ValueError("Requested revision differs from the existing training project.")
    else:
        revision = args.revision or HfApi().model_info(args.base_model).sha
        revision_file.write_text(json.dumps({"base_model": args.base_model, "revision": revision}, indent=2))
    if not revision or len(revision) != 40 or any(c not in "0123456789abcdef" for c in revision):
        raise ValueError("Pass an immutable 40-character lowercase hexadecimal base commit.")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        print("CPU training selected. Use a Colab GPU for the full starter run.")
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, revision=revision, trust_remote_code=False)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    skill_dir = args.output / args.skill
    if (skill_dir / "adapter_model.safetensors").exists() and not args.resume:
        raise ValueError("Adapter already exists. Choose a new output directory or use --resume checkpoint-path.")
    paths = [args.data / f"{args.skill}_{part}.jsonl" for part in ("train", "validation")]
    datasets = []
    for path in paths:
        records = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
        encoded = [encode_example(tokenizer, row, args.max_length) for row in records]
        encoded = [row for row in encoded if row is not None]
        if not encoded:
            raise ValueError(f"No response tokens in {path}; increase --max-length or shorten your examples.")
        datasets.append(encoded)
    dtype = torch.float16 if device == "cuda" else torch.float32
    base = AutoModelForCausalLM.from_pretrained(args.base_model, revision=revision, torch_dtype=dtype, trust_remote_code=False)
    base.config.use_cache = False
    model = get_peft_model(base, LoraConfig(
        r=args.rank, lora_alpha=2 * args.rank, lora_dropout=0.05,
        target_modules=["q_proj", "v_proj"], bias="none", task_type="CAUSAL_LM", revision=revision,
    ))
    model.print_trainable_parameters()
    settings = TrainingArguments(
        output_dir=str(skill_dir / "checkpoints"), max_steps=args.steps,
        per_device_train_batch_size=args.batch_size, per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.accumulation, learning_rate=args.learning_rate,
        warmup_ratio=0.05, lr_scheduler_type="cosine", logging_steps=5,
        save_steps=max(1, args.steps // 2), eval_steps=max(1, args.steps // 2), eval_strategy="steps",
        save_total_limit=2, report_to="none", seed=args.seed, data_seed=args.seed,
        fp16=device == "cuda", bf16=False, optim="adamw_torch", remove_unused_columns=False,
        use_cpu=device == "cpu", dataloader_pin_memory=device == "cuda",
        gradient_checkpointing=device == "cuda", gradient_checkpointing_kwargs={"use_reentrant": False},
    )
    trainer = Trainer(model=model, args=settings, train_dataset=datasets[0], eval_dataset=datasets[1],
                      data_collator=DataCollatorForSeq2Seq(tokenizer, model=model, padding=True, label_pad_token_id=-100))
    started = time.perf_counter()
    result = trainer.train(resume_from_checkpoint=args.resume)
    evaluation = trainer.evaluate()
    # Safetensors NumPy loader intentionally expects float16/32, not BF16.
    model.to(dtype=torch.float32)
    model.peft_config["default"].base_model_name_or_path = args.base_model
    model.peft_config["default"].revision = revision
    model.save_pretrained(skill_dir, safe_serialization=True)
    manifest = {"skill": args.skill, "base_model": args.base_model, "revision": revision,
                "rank": args.rank, "target_modules": ["q_proj", "v_proj"], "seed": args.seed,
                "steps": args.steps, "training_seconds": round(time.perf_counter() - started, 2),
                "device": device, "train_metrics": result.metrics, "validation": evaluation,
                "arguments": {k: str(v) if isinstance(v, Path) else v for k, v in vars(args).items()},
                "data_sha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}
    (skill_dir / "training_manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps(manifest, indent=2))
    return manifest


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--skill", choices=["coding", "humor", "thinking", "writing"], required=True)
    p.add_argument("--base-model", default="Qwen/Qwen2.5-0.5B-Instruct")
    p.add_argument("--revision", help="Immutable base commit; resolved once if omitted")
    p.add_argument("--data", type=Path, default=Path("data"))
    p.add_argument("--output", type=Path, default=Path("artifacts/adapters"))
    p.add_argument("--steps", type=int, default=100)
    p.add_argument("--rank", type=int, default=8)
    p.add_argument("--max-length", type=int, default=384)
    p.add_argument("--batch-size", type=int, default=2)
    p.add_argument("--accumulation", type=int, default=8)
    p.add_argument("--learning-rate", type=float, default=2e-4)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--resume", default=None, help="Trainer checkpoint directory, including optimizer state")
    return p


if __name__ == "__main__":
    train(parser().parse_args())
