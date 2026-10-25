"""Regenerate the two self-contained Colab notebooks using only stdlib."""
import json
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def md(source):
    return {"cell_type": "markdown", "metadata": {}, "source": textwrap.dedent(source).strip() + "\n"}


def code(source):
    return {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [],
            "source": textwrap.dedent(source).strip() + "\n"}


UPLOAD = code('''
    from google.colab import files
    from pathlib import Path
    import io, os, sys, zipfile, subprocess

    uploaded = files.upload()  # Upload modelforge.zip from this delivery.
    if len(uploaded) != 1:
        raise ValueError("Upload exactly one project ZIP.")
    project_root = Path("/content")
    with zipfile.ZipFile(io.BytesIO(next(iter(uploaded.values())))) as archive:
        for member in archive.infolist():
            destination = (project_root / member.filename).resolve()
            if not destination.is_relative_to(project_root):
                raise ValueError("Unsafe archive path")
        archive.extractall(project_root)
    PROJECT = Path("/content/modelforge")
    if not (PROJECT / "pyproject.toml").exists():
        raise ValueError("ZIP must contain modelforge/pyproject.toml")
    os.chdir(PROJECT)
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-e", ".[ml,dev]", "ipywidgets"], check=True)
    sys.path.insert(0, str(PROJECT / "backend"))
    import torch
    print("PyTorch:", torch.__version__, "GPU:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU")
    if not torch.cuda.is_available():
        raise RuntimeError("Select Runtime > Change runtime type > GPU, then rerun the notebook.")
''')


def write(name, cells):
    document = {"nbformat": 4, "nbformat_minor": 5, "metadata": {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3.11"}, "colab": {"provenance": []},
        "accelerator": "GPU"}, "cells": [{"id": f"cell-{i:03}", **cell} for i, cell in enumerate(cells)]}
    path = ROOT / "notebooks" / name
    path.write_text(json.dumps(document, indent=2))
    print(path)


def main():
    write("01_train_specialists.ipynb", [
        md('''
        # ModelForge · Train specialists offline
        Run this before the live demo. Select a GPU in **Runtime → Change runtime type**.
        Both LoRA adapters are fine-tuned from the same pinned Qwen checkpoint.
        This is not foundation-model pretraining. Starter examples demonstrate the pipeline;
        they do not guarantee visible specialization. Colab Pro hardware and session time vary.
        Save everything important to Drive and download a backup before judging.
        '''),
        md("## 1. Upload the project ZIP and install dependencies"), UPLOAD,
        md("## 2. Mount Drive and choose a training budget\nStart with two steps to check the pipeline; then increase STEPS and rerun in a fresh output directory."),
        code('''
        from google.colab import drive
        drive.mount("/content/drive")
        OUTPUT = Path("/content/drive/MyDrive/ModelForge/adapters")
        OUTPUT.mkdir(parents=True, exist_ok=True)
        BASE_MODEL = "Qwen/Qwen2.5-0.5B-Instruct"
        STEPS = 100
        RANK = 8
        MAX_LENGTH = 384
        subprocess.run([sys.executable, "training/prepare_data.py", "--output", "data"], check=True)
        print("Adapters and optimizer checkpoints will persist at", OUTPUT)
        '''),
        md("## 3. Train coding, then writing\nEach starts from the same foundation, not from the other specialist. Measured training time and validation loss are recorded. Run cells separately to inspect progress."),
        code('''
        import time
        started = time.perf_counter()
        subprocess.run([sys.executable, "training/train.py", "--skill", "coding", "--base-model", BASE_MODEL,
                        "--output", str(OUTPUT), "--steps", str(STEPS), "--rank", str(RANK),
                        "--max-length", str(MAX_LENGTH)], check=True)
        print("Coding elapsed minutes:", round((time.perf_counter() - started) / 60, 2))
        '''),
        code('''
        started = time.perf_counter()
        subprocess.run([sys.executable, "training/train.py", "--skill", "writing", "--base-model", BASE_MODEL,
                        "--output", str(OUTPUT), "--steps", str(STEPS), "--rank", str(RANK),
                        "--max-length", str(MAX_LENGTH)], check=True)
        print("Writing elapsed minutes:", round((time.perf_counter() - started) / 60, 2))
        '''),
        md("## Optional: train Humor and Thinking\nUse the same pinned foundation. Starter examples demonstrate the pipeline and do not establish skill quality."),
        code('''
        for skill in ("humor", "thinking"):
            subprocess.run([sys.executable, "training/train.py", "--skill", skill, "--base-model", BASE_MODEL,
                            "--output", str(OUTPUT), "--steps", str(STEPS), "--rank", str(RANK),
                            "--max-length", str(MAX_LENGTH)], check=True)
        '''),
        md("## 4. Validate compatibility and download a backup"),
        code('''
        import json, shutil
        from modelforge.merge import validate_pair
        loaded = validate_pair({skill: OUTPUT / skill for skill in ("coding", "humor", "thinking", "writing") if (OUTPUT / skill / "adapter_model.safetensors").exists()}, BASE_MODEL, None)
        print(json.dumps({k: {"rank": v[0]["r"], "revision": v[0]["revision"], "sha256": v[2]} for k,v in loaded.items()}, indent=2))
        archive_path = shutil.make_archive("/content/modelforge-trained-adapters", "zip", OUTPUT)
        files.download(archive_path)
        '''),
        md('''
        ## Resume after interruption
        Find the newest `checkpoint-N` under the skill's `checkpoints` directory, then use
        `python training/train.py --skill coding --output /content/drive/MyDrive/ModelForge/adapters --steps 200 --resume PATH_TO_CHECKPOINT`.
        Keep the same model, rank, sequence length and training data when resuming optimizer state.
        Next open **02_live_lab.ipynb**. Do not claim skill improvement from loss alone; compare on held-out tasks.
        '''),
    ])
    write("02_live_lab.ipynb", [
        md('''
        # ModelForge · Live adapter lab
        Interactive sliders, exact tensor composition, real model inference, and comparisons in your GPU notebook.
        There is no public tunnel. Upload the project ZIP, load the saved specialists, warm once, then show the judge.
        No training occurs when a slider moves. An unavailable GPU is an error, never a canned response.
        '''),
        md("## 1. Upload project and install"), UPLOAD,
        md("## 2. Restore trained adapters from Drive to local storage"),
        code('''
        from google.colab import drive
        import shutil
        drive.mount("/content/drive")
        SAVED = Path("/content/drive/MyDrive/ModelForge/adapters")
        LOCAL = PROJECT / "artifacts/adapters"
        for skill in ("coding", "humor", "thinking", "writing"):
            if skill in {"humor", "thinking"} and not (SAVED / skill / "adapter_model.safetensors").exists():
                continue
            if not (SAVED / skill / "adapter_model.safetensors").exists():
                raise FileNotFoundError("Train both specialists with notebook 01 first.")
            (LOCAL / skill).mkdir(parents=True, exist_ok=True)
            for filename in ("adapter_config.json", "adapter_model.safetensors", "training_manifest.json"):
                if (SAVED / skill / filename).exists():
                    shutil.copy2(SAVED / skill / filename, LOCAL / skill / filename)
        os.environ["MODELFORGE_MODE"] = "live"
        os.environ["MODELFORGE_DATA_DIR"] = str(PROJECT / "artifacts")
        from modelforge.config import Settings
        from modelforge.service import Service, comparison_variants
        from modelforge.schemas import GenerateRequest, JobRequest
        from modelforge.engine import DEFAULT_PROMPT
        service = Service(Settings(mode="live"))
        print(service.engine.warmup())
        '''),
        md("## 3. Live sliders and generation\nCoefficients are not guaranteed percentages of a skill. Normalization is optional; all zero means the base model. The same backend is used by the React studio."),
        code('''
        import ipywidgets as widgets
        from IPython.display import display, Markdown, clear_output
        import json
        coding = widgets.FloatSlider(value=.65, min=0, max=1, step=.05, description="Coding")
        writing = widgets.FloatSlider(value=.35, min=0, max=1, step=.05, description="Writing")
        humor = widgets.FloatSlider(value=0, min=0, max=1, step=.05, description="Humor", disabled="humor" not in service.settings.adapter_paths)
        thinking = widgets.FloatSlider(value=0, min=0, max=1, step=.05, description="Thinking", disabled="thinking" not in service.settings.adapter_paths)
        normalize = widgets.Checkbox(value=True, description="Normalize coefficients")
        prompt = widgets.Textarea(value=DEFAULT_PROMPT, layout=widgets.Layout(width="100%", height="100px"))
        forge_button = widgets.Button(description="Forge + generate", button_style="primary")
        compare_button = widgets.Button(description="Compare specialists")
        output = widgets.Output()
        latest = {}

        def selected_recipe():
            recipe = service.merger.create({"coding": coding.value, "humor": humor.value, "thinking": thinking.value, "writing": writing.value}, normalize.value)
            latest["recipe"] = recipe
            return recipe

        def generate_one(_):
            forge_button.disabled = compare_button.disabled = True
            with output:
                clear_output(wait=True)
                try:
                    recipe = selected_recipe()
                    print("REAL TENSOR MERGE:", recipe["weights"], "rank", recipe["rank"], "merge ms", recipe["merge_ms"])
                    result = service.generate(GenerateRequest(recipe_id=recipe["id"], prompt=prompt.value, max_new_tokens=256))
                    latest["result"] = result
                    display(Markdown(result["text"]))
                    print(json.dumps(result["metrics"], indent=2))
                except Exception as error:
                    print("Live error (no fallback):", error)
                finally:
                    forge_button.disabled = compare_button.disabled = False

        def compare_all(_):
            forge_button.disabled = compare_button.disabled = True
            with output:
                clear_output(wait=True)
                try:
                    blend = selected_recipe()
                    for name, weights in comparison_variants(blend):
                        recipe = blend if weights is None else service.merger.create(weights)
                        result = service.generate(GenerateRequest(recipe_id=recipe["id"], prompt=prompt.value, max_new_tokens=192))
                        display(Markdown("### " + name + "\\n" + result["text"]))
                        print(result["metrics"])
                except Exception as error:
                    print("Live error (no fallback):", error)
                finally:
                    forge_button.disabled = compare_button.disabled = False

        forge_button.on_click(generate_one)
        compare_button.on_click(compare_all)
        display(widgets.VBox([coding, humor, thinking, writing, normalize, prompt, widgets.HBox([forge_button, compare_button]), output]))
        '''),
        md("## 4. Optional full benchmark\nRuns 24 generations with the original pair, or up to 36 with both extra specialists active. This may take minutes. Scores are structural/instruction checks, not functional coding correctness or holistic writing quality. Stop via `service.cancel(job['id'])` after the current generation."),
        code('''
        import time
        recipe = selected_recipe()
        job = service.submit(JobRequest(kind="benchmark", recipe_id=recipe["id"], prompt="fixed benchmark suite", max_new_tokens=192, temperature=0, seed=42))
        while job["status"] in {"queued", "running"}:
            print(f"{job['completed']}/{job['total']}", end=" → ", flush=True)
            time.sleep(2)
            job = service.store.get("job", job["id"])
        print(job["status"], job["error"])
        print(json.dumps(job["summary"], indent=2))
        report = PROJECT / "artifacts/live-benchmark.json"
        report.write_text(json.dumps(job, indent=2))
        files.download(str(report))
        '''),
        md("## 5. Download the real merged adapter and recipe"),
        code('''
        recipe = latest.get("recipe") or selected_recipe()
        adapter_path = service.merger.path(recipe)
        recipe_file = PROJECT / "artifacts/live-recipe.json"
        recipe_file.write_text(json.dumps(recipe, indent=2))
        files.download(str(recipe_file))
        if adapter_path:
            archive_path = shutil.make_archive("/content/modelforge-live-adapter", "zip", adapter_path)
            files.download(archive_path)
        else:
            print("Baseline selected: no adapter tensors to export.")
        '''),
        md("To use the polished studio with a dedicated HTTPS GPU backend, follow `docs/DEPLOYMENT.md`. Save reports and training manifests before the runtime ends. Release runtime resources when finished."),
    ])


if __name__ == "__main__":
    main()
