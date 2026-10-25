"""Exact concatenation: B' A' = sum_i w_i (alpha_i/r_i) B_i A_i.

Never average A and B independently: that creates unwanted cross terms.
Only plain, uniform-rank LoRA on identical linear target modules is supported.
"""
import hashlib
import json
import math
import shutil
import tempfile
import threading
import time
from pathlib import Path

import numpy as np
from safetensors.numpy import load_file, save_file

from .store import now


class CompatibilityError(ValueError):
    pass


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def effective_weights(weights: dict, normalize: bool):
    if (not {"coding", "writing"}.issubset(weights) or
            not set(weights).issubset({"coding", "humor", "thinking", "writing"}) or
            any(not math.isfinite(v) or not 0 <= v <= 1 for v in weights.values())):
        raise CompatibilityError("Weights must be finite numbers between zero and one for coding, humor, thinking and writing.")
    total = sum(weights.values())
    return {key: value / total if normalize and total else value for key, value in weights.items()}


def read_adapter(path: Path):
    if not (path / "adapter_config.json").is_file() or not (path / "adapter_model.safetensors").is_file():
        raise CompatibilityError(f"Adapter missing at {path.name}. Train or copy both specialists first.")
    config = json.loads((path / "adapter_config.json").read_text())
    if config.get("peft_type") != "LORA" or config.get("task_type") != "CAUSAL_LM":
        raise CompatibilityError("Only causal-language-model LoRA adapters are supported.")
    if config.get("bias", "none") != "none":
        raise CompatibilityError("Adapters with trained biases cannot be composed by this merger.")
    for flag in ("use_dora", "use_rslora", "fan_in_fan_out", "lora_bias", "modules_to_save", "rank_pattern",
                 "alpha_pattern", "target_parameters", "layer_replication", "trainable_token_indices",
                 "alora_invocation_tokens", "use_qalora"):
        if config.get(flag):
            raise CompatibilityError(f"Unsupported adapter option: {flag}. Use the supplied training script.")
    rank = config.get("r")
    alpha = config.get("lora_alpha")
    if not isinstance(rank, int) or isinstance(rank, bool) or not 1 <= rank <= 128:
        raise CompatibilityError("Source rank must be an integer from 1 to 128.")
    if not isinstance(alpha, (int, float)) or not math.isfinite(alpha) or alpha <= 0:
        raise CompatibilityError("Invalid LoRA alpha.")
    tensor_path = path / "adapter_model.safetensors"
    if tensor_path.stat().st_size > 256 * 1024**2:
        raise CompatibilityError("Adapter exceeds the 256 MiB workbench limit.")
    try:
        tensors = load_file(str(tensor_path))
    except Exception as exc:
        raise CompatibilityError("Cannot read safetensors. Save adapters as float32 or float16 (not bfloat16).") from exc
    if not tensors:
        raise CompatibilityError("Adapter contains no tensors.")
    modules = {}
    for key, value in tensors.items():
        suffix = next((s for s in (".lora_A.weight", ".lora_B.weight") if key.endswith(s)), None)
        if not suffix or value.ndim != 2 or value.dtype.kind != "f" or not np.isfinite(value).all():
            raise CompatibilityError(f"Unsupported, nonfinite, or non-matrix tensor: {key}")
        converted = value.astype(np.float32)
        if not np.isfinite(converted).all():
            raise CompatibilityError(f"Tensor cannot be represented as finite float32: {key}")
        modules.setdefault(key[:-len(suffix)], {})[suffix[6]] = converted
    for name, pair in modules.items():
        if set(pair) != {"A", "B"} or pair["A"].shape[0] != rank or pair["B"].shape[1] != rank:
            raise CompatibilityError(f"Rank or A/B pair mismatch: {name}")
    digest = hashlib.sha256((path / "adapter_config.json").read_bytes() + tensor_path.read_bytes()).hexdigest()
    return config, modules, digest


def validate_pair(paths: dict, base_model: str, revision: str | None):
    loaded = {name: read_adapter(path) for name, path in paths.items()}
    if not {"coding", "writing"}.issubset(loaded):
        raise CompatibilityError("The coding and writing foundation specialists must be supplied.")
    a, am, _ = loaded["coding"]
    for config, bm, _ in loaded.values():
        if config.get("base_model_name_or_path") != base_model:
            raise CompatibilityError("Adapter base model differs from MODELFORGE_BASE_MODEL.")
        rev = config.get("revision")
        if not isinstance(rev, str) or len(rev) != 40 or any(c not in "0123456789abcdef" for c in rev):
            raise CompatibilityError("Adapters must record the same immutable 40-character base commit in revision.")
        if revision and rev != revision:
            raise CompatibilityError("Adapter revision differs from MODELFORGE_BASE_REVISION.")
        for key in ("revision", "target_modules", "layers_to_transform", "layers_pattern", "exclude_modules"):
            x, y = a.get(key), config.get(key)
            if isinstance(x, list):
                x = sorted(x)
            if isinstance(y, list):
                y = sorted(y)
            if x != y:
                raise CompatibilityError(f"Adapters disagree on {key}.")
        if set(am) != set(bm):
            raise CompatibilityError("Adapters must target exactly the same module keys.")
        for name in am:
            if am[name]["A"].shape[1] != bm[name]["A"].shape[1] or am[name]["B"].shape[0] != bm[name]["B"].shape[0]:
                raise CompatibilityError(f"Incompatible input/output shapes: {name}")
    return loaded


class Merger:
    def __init__(self, settings, store):
        self.settings, self.store = settings, store
        self.lock = threading.RLock()
        self.cache = settings.data_dir / "merges"
        self.cache.mkdir(exist_ok=True)

    def create(self, weights: dict, normalize: bool = True):
        started = time.perf_counter()
        effective = effective_weights(weights, normalize)
        with self.lock:
            loaded = validate_pair(self.settings.adapter_paths, self.settings.base_model, self.settings.base_revision) if self.settings.mode == "live" else None
            if loaded:
                missing = [name for name, weight in effective.items() if weight > 0 and name not in loaded]
                if missing:
                    raise CompatibilityError(f"Train or provide the {', '.join(missing)} adapter before using that skill in live mode.")
            source_hashes = {name: item[2] for name, item in loaded.items()} if loaded else {}
            revision = loaded["coding"][0]["revision"] if loaded else None
            identity = {"version": 1, "mode": self.settings.mode, "weights": effective,
                        "base_model": self.settings.base_model, "revision": revision, "sources": source_hashes}
            recipe_id = hashlib.sha256(canonical(identity).encode()).hexdigest()[:24]
            output = self.cache / recipe_id
            cached = self.store.get("recipe", recipe_id)
            artifact = bool(sum(effective.values()) and loaded)
            cache_hit = cached is not None and (not artifact or (output / "adapter_model.safetensors").exists())
            rank = 0
            if loaded:
                rank = sum(item[0]["r"] for name, item in loaded.items() if effective.get(name, 0) > 0)
            if artifact and not cache_hit:
                merged = {}
                for module in loaded["coding"][1]:
                    active = [(name, item) for name, item in loaded.items() if effective.get(name, 0) > 0]
                    merged[module + ".lora_A.weight"] = np.concatenate([item[1][module]["A"] for _, item in active], axis=0)
                    merged[module + ".lora_B.weight"] = np.concatenate([
                        item[1][module]["B"] * (effective[name] * item[0]["lora_alpha"] / item[0]["r"])
                        for name, item in active], axis=1)
                if any(not np.isfinite(tensor).all() for tensor in merged.values()):
                    raise CompatibilityError("Adapter scaling overflowed float32; reduce the source alpha or tensor magnitudes.")
                config = dict(loaded["coding"][0])
                config.update(r=rank, lora_alpha=rank, lora_dropout=0, inference_mode=True,
                              init_lora_weights=True, revision=revision)
                # Publish the directory atomically; downloads never observe half-written weights.
                staging = Path(tempfile.mkdtemp(prefix="merge-", dir=self.cache))
                try:
                    save_file(merged, str(staging / "adapter_model.safetensors"))
                    (staging / "adapter_config.json").write_text(json.dumps(config, indent=2))
                    (staging / "manifest.json").write_text(json.dumps(identity, indent=2))
                    if output.exists():
                        shutil.rmtree(output)
                    staging.rename(output)
                finally:
                    if staging.exists():
                        shutil.rmtree(staging)
            recipe = {"id": recipe_id, "created_at": cached["created_at"] if cached else now(),
                      **identity, "requested_weights": weights, "normalize": normalize, "rank": rank,
                      "cache_hit": cache_hit, "merge_ms": round((time.perf_counter() - started) * 1000, 3),
                      "artifact_available": artifact, "method": "exact_concatenation" if loaded else "rehearsal_only",
                      "provenance": "real_adapter_tensors" if loaded else "demo_no_model_loaded"}
            return self.store.put("recipe", recipe)

    def path(self, recipe):
        if recipe["artifact_available"]:
            path = self.cache / recipe["id"]
            if not (path / "adapter_model.safetensors").exists():
                raise CompatibilityError("Cached adapter was removed. Forge this recipe again.")
            return path
        return None
