import json
from pathlib import Path

import numpy as np
import pytest
from modelforge.config import Settings
from modelforge.service import Service
from safetensors.numpy import save_file

REVISION = "a" * 40
MODULE = "base_model.model.model.layers.0.self_attn.q_proj"


def make_adapter(path: Path, rank=2, alpha=4, seed=1, base="Qwen/Qwen2.5-0.5B-Instruct", module=MODULE):
    path.mkdir(parents=True, exist_ok=True)
    config = {"peft_type": "LORA", "task_type": "CAUSAL_LM", "base_model_name_or_path": base,
              "revision": REVISION, "r": rank, "lora_alpha": alpha, "target_modules": ["q_proj"],
              "lora_dropout": 0, "bias": "none", "inference_mode": True}
    (path / "adapter_config.json").write_text(json.dumps(config))
    rng = np.random.default_rng(seed)
    tensors = {module + ".lora_A.weight": rng.normal(size=(rank, 8)).astype("float32"),
               module + ".lora_B.weight": rng.normal(size=(6, rank)).astype("float32")}
    save_file(tensors, str(path / "adapter_model.safetensors"))
    return tensors


@pytest.fixture
def live(tmp_path):
    config = Settings(mode="live", data_dir=tmp_path)
    make_adapter(config.coding_path, rank=2, alpha=4)
    make_adapter(config.writing_path, rank=3, alpha=9, seed=2)
    service = Service(config)
    yield service
    service.close()


@pytest.fixture
def demo(tmp_path):
    service = Service(Settings(mode="demo", data_dir=tmp_path))
    yield service
    service.close()
