import json
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pytest
from conftest import MODULE, make_adapter
from modelforge.merge import CompatibilityError, effective_weights, validate_pair
from safetensors.numpy import load_file, save_file


@pytest.mark.parametrize("weights,normalize", [({"coding": .2, "writing": .8}, True), ({"coding": 1, "writing": 1}, False), ({"coding": 0, "writing": 1}, True)])
def test_exact_delta_without_cross_terms(live, weights, normalize):
    recipe = live.merger.create(weights, normalize)
    result = load_file(str(live.merger.path(recipe) / "adapter_model.safetensors"))
    delta = result[MODULE + ".lora_B.weight"] @ result[MODULE + ".lora_A.weight"]
    expected = np.zeros_like(delta)
    for skill, path in live.settings.adapter_paths.items():
        tensors = load_file(str(path / "adapter_model.safetensors"))
        cfg = json.loads((path / "adapter_config.json").read_text())
        expected += recipe["weights"][skill] * cfg["lora_alpha"] / cfg["r"] * (tensors[MODULE + ".lora_B.weight"] @ tensors[MODULE + ".lora_A.weight"])
    np.testing.assert_allclose(delta, expected, rtol=2e-6, atol=2e-6)
    config = json.loads((live.merger.path(recipe) / "adapter_config.json").read_text())
    assert config["lora_alpha"] == config["r"] == recipe["rank"]


def test_zero_and_cache(live):
    zero = live.merger.create({"coding": 0, "writing": 0})
    assert zero["rank"] == 0 and live.merger.path(zero) is None
    first = live.merger.create({"coding": .5, "writing": .5})
    assert not first["cache_hit"]
    second = live.merger.create({"coding": 1, "writing": 1})
    assert second["id"] == first["id"] and second["cache_hit"]
    assert second["rank"] == 5


def test_cache_invalidated_by_source_content(live):
    first = live.merger.create({"coding": 1, "writing": 0})
    file = live.settings.coding_path / "adapter_model.safetensors"
    tensors = load_file(str(file))
    tensors[MODULE + ".lora_B.weight"] *= 2
    save_file(tensors, str(file))
    second = live.merger.create({"coding": 1, "writing": 0})
    assert first["id"] != second["id"]


@pytest.mark.parametrize("change", [{"revision": "main"}, {"revision": "b" * 40}, {"base_model_name_or_path": "other"}, {"target_modules": ["v_proj"]}, {"use_dora": True}, {"use_rslora": True}, {"bias": "all"}, {"rank_pattern": {"x": 2}}, {"r": 7}, {"modules_to_save": ["lm_head"]}])
def test_incompatible_rejected(live, change):
    file = live.settings.writing_path / "adapter_config.json"
    config = json.loads(file.read_text())
    config.update(change)
    file.write_text(json.dumps(config))
    with pytest.raises(CompatibilityError):
        live.merger.create({"coding": .5, "writing": .5})


def test_nonfinite_and_missing_tensor_rejected(live):
    file = live.settings.coding_path / "adapter_model.safetensors"
    tensors = load_file(str(file))
    tensors[MODULE + ".lora_B.weight"][0, 0] = np.nan
    save_file(tensors, str(file))
    with pytest.raises(CompatibilityError, match="nonfinite"):
        validate_pair(live.settings.adapter_paths, live.settings.base_model, None)


def test_shape_mismatch_rejected(live):
    file = live.settings.writing_path / "adapter_model.safetensors"
    tensors = load_file(str(file))
    tensors[MODULE + ".lora_B.weight"] = np.ones((7, 3), dtype=np.float32)
    save_file(tensors, str(file))
    with pytest.raises(CompatibilityError, match="input/output shapes"):
        live.merger.create({"coding": .5, "writing": .5})


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -1, 1.1])
def test_invalid_weight(value):
    with pytest.raises(CompatibilityError):
        effective_weights({"coding": value, "writing": .5}, True)


def test_concurrent_merge_is_atomic(live):
    with ThreadPoolExecutor(max_workers=4) as pool:
        recipes = list(pool.map(lambda _: live.merger.create({"coding": .3, "writing": .7}), range(8)))
    assert len({r["id"] for r in recipes}) == 1
    assert sum(not r["cache_hit"] for r in recipes) == 1
    assert (live.merger.path(recipes[0]) / "manifest.json").exists()


def test_four_specialists_merge_exactly(live):
    make_adapter(live.settings.humor_path, rank=2, alpha=6, seed=3)
    make_adapter(live.settings.thinking_path, rank=4, alpha=8, seed=4)
    recipe = live.merger.create({"coding": .4, "humor": .15, "thinking": .3, "writing": .15})
    result = load_file(str(live.merger.path(recipe) / "adapter_model.safetensors"))
    delta = result[MODULE + ".lora_B.weight"] @ result[MODULE + ".lora_A.weight"]
    expected = np.zeros_like(delta)
    for skill, path in live.settings.adapter_paths.items():
        tensors = load_file(str(path / "adapter_model.safetensors"))
        config = json.loads((path / "adapter_config.json").read_text())
        expected += recipe["weights"][skill] * config["lora_alpha"] / config["r"] * (tensors[MODULE + ".lora_B.weight"] @ tensors[MODULE + ".lora_A.weight"])
    np.testing.assert_allclose(delta, expected, rtol=2e-6, atol=2e-6)
    assert recipe["rank"] == 11 and len(recipe["sources"]) == 4


def test_missing_extra_skill_is_never_substituted(live):
    with pytest.raises(CompatibilityError, match="humor"):
        live.merger.create({"coding": .4, "writing": .4, "humor": .2, "thinking": 0})


def test_extra_specialist_compatibility_is_checked(live):
    make_adapter(live.settings.thinking_path, base="different-base")
    with pytest.raises(CompatibilityError, match="base model"):
        live.merger.create({"coding": .4, "writing": .4, "thinking": .2})
