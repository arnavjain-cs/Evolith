"""Actual offline PEFT and generation checks on a tiny randomly initialized Qwen.
No downloaded weights, GPU, or claimed specialist quality are needed.
"""
import json

import numpy as np
import pytest
from modelforge.config import Settings
from modelforge.schemas import GenerateRequest
from modelforge.service import Service
from safetensors.numpy import load_file

torch = pytest.importorskip("torch")
transformers = pytest.importorskip("transformers")
peft = pytest.importorskip("peft")

pytestmark = pytest.mark.ml


def tiny_project(tmp_path):
    from tokenizers import Tokenizer
    from tokenizers.models import WordLevel
    from tokenizers.pre_tokenizers import Whitespace

    torch.manual_seed(5)
    torch.set_num_threads(1)
    base_path = tmp_path / "tiny-base"
    config = transformers.Qwen2Config(vocab_size=32, hidden_size=16, intermediate_size=32,
                                      num_hidden_layers=1, num_attention_heads=2, num_key_value_heads=1,
                                      max_position_embeddings=256, eos_token_id=2, pad_token_id=0)
    model = transformers.Qwen2ForCausalLM(config)
    model.save_pretrained(base_path)
    tokenizer = Tokenizer(WordLevel({"<pad>": 0, "<unk>": 1, "<eos>": 2, "user": 3, "assistant": 4, "hello": 5, "world": 6}, unk_token="<unk>"))
    tokenizer.pre_tokenizer = Whitespace()
    wrapped = transformers.PreTrainedTokenizerFast(tokenizer_object=tokenizer, pad_token="<pad>", unk_token="<unk>", eos_token="<eos>")
    wrapped.chat_template = "{% for message in messages %}{{ message['role'] + ' ' + message['content'] + ' ' }}{% if message['role'] == 'assistant' %}{{ eos_token + ' ' }}{% endif %}{% endfor %}{% if add_generation_prompt %}{{ 'assistant ' }}{% endif %}"
    wrapped.save_pretrained(base_path)
    settings = Settings(mode="live", data_dir=tmp_path / "state", base_model=str(base_path), device="cpu")
    for i, path in enumerate(settings.adapter_paths.values()):
        base = transformers.Qwen2ForCausalLM.from_pretrained(base_path)
        adapter = peft.get_peft_model(base, peft.LoraConfig(r=2, lora_alpha=4, target_modules=["q_proj", "v_proj"], task_type="CAUSAL_LM", revision="a" * 40))
        with torch.no_grad():
            for name, param in adapter.named_parameters():
                if "lora_" in name:
                    param.copy_(torch.randn_like(param) * .05 * (i + 1))
        adapter.peft_config["default"].base_model_name_or_path = str(base_path)
        adapter.save_pretrained(path)
    return settings


def test_peft_logits_match_explicit_weighted_delta(tmp_path):
    settings = tiny_project(tmp_path)
    service = Service(settings)
    try:
        recipe = service.merger.create({"coding": .3, "writing": .7})
        merged = peft.PeftModel.from_pretrained(transformers.Qwen2ForCausalLM.from_pretrained(settings.base_model), service.merger.path(recipe)).eval()
        explicit = transformers.Qwen2ForCausalLM.from_pretrained(settings.base_model).eval()
        with torch.no_grad():
            for skill, path in settings.adapter_paths.items():
                tensors = load_file(str(path / "adapter_model.safetensors"))
                for target in ("q_proj", "v_proj"):
                    prefix = f"base_model.model.model.layers.0.self_attn.{target}"
                    delta = tensors[prefix + ".lora_B.weight"] @ tensors[prefix + ".lora_A.weight"]
                    getattr(explicit.model.layers[0].self_attn, target).weight.add_(torch.from_numpy(delta) * recipe["weights"][skill] * 2)
            ids = torch.tensor([[3, 5, 4]])
            np.testing.assert_allclose(merged(ids).logits.numpy(), explicit(ids).logits.numpy(), rtol=2e-4, atol=2e-5)
        req = GenerateRequest(recipe_id=recipe["id"], prompt="hello world", max_new_tokens=16)
        output = service.generate(req)
        assert output["provenance"] == "model_generated" and output["metrics"]["output_tokens"] > 0
        assert output["metrics"]["tokens_per_second"] > 0
        # Exercise replacement, disabling, and re-enabling the resident adapter.
        for weights in ({"coding": 1, "writing": 0}, {"coding": 0, "writing": 0}, {"coding": .3, "writing": .7}):
            chosen = service.merger.create(weights)
            assert service.generate(req.model_copy(update={"recipe_id": chosen["id"]}))["mode"] == "live"
        service.engine.resident_revision = "b" * 40
        with pytest.raises(ValueError, match="different base checkpoint"):
            service.generate(req)
    finally:
        service.close()


def test_response_only_mask_and_one_training_step(tmp_path):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "training"))
    from train import encode_example, parser, train

    settings = tiny_project(tmp_path)
    tokenizer = transformers.AutoTokenizer.from_pretrained(settings.base_model)
    record = {"messages": [{"role": "user", "content": "hello"}, {"role": "assistant", "content": "world"}]}
    encoded = encode_example(tokenizer, record, 64)
    assert encoded["labels"][:3] == [-100, -100, -100]
    assert any(x != -100 for x in encoded["labels"])
    assert encode_example(tokenizer, record, 1) is None
    data = tmp_path / "data"
    data.mkdir()
    for split in ("train", "validation"):
        (data / f"coding_{split}.jsonl").write_text(json.dumps(record) + "\n")
    args = parser().parse_args(["--skill", "coding", "--base-model", settings.base_model, "--revision", "a" * 40,
                                "--data", str(data), "--output", str(tmp_path / "trained"), "--steps", "1",
                                "--batch-size", "1", "--accumulation", "1", "--max-length", "64"])
    manifest = train(args)
    assert manifest["train_metrics"]["train_steps_per_second"] > 0
    assert (tmp_path / "trained/coding/adapter_model.safetensors").exists()


def test_live_benchmark_records_real_metrics_and_provenance(tmp_path):
    import time

    from modelforge.schemas import JobRequest

    service = Service(tiny_project(tmp_path))
    try:
        recipe = service.merger.create({"coding": .6, "writing": .4})
        job = service.submit(JobRequest(kind="benchmark", recipe_id=recipe["id"], prompt="fixed suite", max_new_tokens=16))
        deadline = time.monotonic() + 30
        while job["status"] in {"queued", "running"} and time.monotonic() < deadline:
            time.sleep(.02)
            job = service.store.get("job", job["id"])
        assert job["status"] == "completed", job["error"]
        assert job["completed"] == 24
        assert all(row["provenance"] == "model_generated" and row["metrics"]["output_tokens"] > 0 for row in job["rows"])
        assert all(isinstance(row["score"], (int, float)) and row["model"]["source_sha256"] for row in job["rows"])
        assert len(job["summary"]) == 4
    finally:
        service.close()
