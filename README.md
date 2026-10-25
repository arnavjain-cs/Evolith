# Evolith

**Train specialists once. Blend compatible LoRA updates live. Compare the evidence.**

A complete local hackathon workbench: React/TypeScript studio, FastAPI backend, exact adapter composition, real Transformers inference, comparison jobs, lightweight benchmarks, Colab notebooks, training scripts, exports, and tests.

![Evolith animated home page](docs/home-preview.png)

The home page introduces Evolith through a scroll-linked, layered model core. **Enter the studio** opens the working app; `/#studio` links directly to it. See [home-page motion and controls](docs/HOME.md).

## Agent workspace

Open **http://localhost:8000/#agents** to create agents from reusable blueprints, bind custom model recipes, branch models and agents, version instructions, configure read-only tools, and inspect actual run traces. Saved configurations, lineage, tools, and monitoring work in the prototype; rehearsal model responses remain explicitly canned. Enterprise identity, team permissions, external connectors, tenant isolation, and production deployment are planned. See the [complete agent workspace guide and sponsor demo](docs/AGENT_WORKSPACE.md).

## GitHub and Vercel

Push this folder’s contents to your repository. In Vercel choose **Root Directory: `frontend`**, **Vite**, **Build: `npm run build`**, **Output: `dist`**. Set `VITE_API_URL` to your separately hosted HTTPS Python backend; never put an API key in a `VITE_` variable. See the [complete GitHub and Vercel guide](docs/VERCEL.md).

## Run the rehearsal app

Requires Python 3.11+ (3.11/3.12 recommended), Node 20.19+ or 22+, npm, and internet for the initial dependency install. No GPU, Hugging Face account, paid API, or model download is needed for rehearsal.

```bash
cd modelforge
chmod +x scripts/run.sh
./scripts/run.sh
```

Open **http://localhost:8000** and select **Enter the studio**. The script creates `.venv`, installs Python dependencies, builds the frontend, and serves everything from one process. On Windows use the manual commands below with `.venv\Scripts\python`.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
cd frontend
npm ci
npm run build
cd ..
python -m uvicorn modelforge.app:app --host 127.0.0.1 --port 8000 --workers 1
```

For frontend development, run the backend and `cd frontend && npm run dev` in separate terminals. Vite forwards `/api` to port 8000.

## What is real, and what is a fallback?

| Feature | Rehearsal (`demo`, default) | Live (`live`) |
|---|---|---|
| Sliders, presets, recipes, history, export JSON | Working | Working |
| Merge | Recipe calculation only; no tensors created | Actual weighted LoRA tensor composition |
| Output | Hand-written fixtures for three sample prompts | Actual base checkpoint plus merged adapter |
| Arbitrary prompts | Explains that no canned answer exists | Model generation |
| Comparisons | Four explicitly labeled fixtures | Same prompt/settings across four real variants |
| Benchmark job | Exercises the full UI/API; scores and timings stay empty | Measured generation timings plus transparent heuristic rubrics |
| Adapter ZIP | Disabled | Real PEFT adapter files and provenance |

**Live errors never silently fall back to demo.** No trained specialist checkpoints are bundled. The included data is a small original synthetic starter corpus, not evidence of skill gains. Training and evaluation are required before claiming improvement.

## Train the actual specialists

The default shared base is `Qwen/Qwen2.5-0.5B-Instruct`. Both specialists start from the **same immutable checkpoint**, not two unrelated full models. This is adapter fine-tuning, not pretraining from random weights.

The easiest GPU path is [01_train_specialists.ipynb](notebooks/01_train_specialists.ipynb) in Google Colab. Upload the project ZIP when prompted, select a GPU, mount Drive, then run the cells. Or use:

```bash
source .venv/bin/activate
python -m pip install -e '.[ml,dev]'
python training/prepare_data.py --output data
python training/train.py --skill coding --steps 100
python training/train.py --skill writing --steps 100
```

The first command resolves the base revision once into `artifacts/adapters/base_revision.json`; the second specialist reuses it. Each adapter records the revision, data hashes, training arguments, seed, loss, and measured training duration. Only assistant response tokens contribute to the loss. Use your own higher-quality `messages` JSONL data to improve specialization; keep held-out benchmarks separate.

Resume interrupted fine-tuning with the full Trainer checkpoint:

```bash
python training/train.py --skill coding --steps 200 \
  --resume artifacts/adapters/coding/checkpoints/checkpoint-100
```

Start with `--steps 2 --batch-size 1 --accumulation 1` for a pipeline smoke test. Then run enough training to evaluate real behavior. GPU type, sequence length, batch size, and model size determine elapsed time. We have not measured a full Qwen training run on Colab here; there is no promised training or generation time.

## Switch to live

After both trained adapter directories exist:

```bash
MODELFORGE_MODE=live python -m uvicorn modelforge.app:app \
  --host 127.0.0.1 --port 8000 --workers 1
```

Or copy `.env.example` to `.env` and change `MODELFORGE_MODE=live`. Click **Field guide → Warm backend** before presenting. The resident base stays loaded; subsequent blends only create/load small adapter files. The first generation can download the base if it is not already cached.

[02_live_lab.ipynb](notebooks/02_live_lab.ipynb) provides a direct Colab widget with sliders, real merging, generation, baseline/specialist comparison, benchmarks, and download. It needs no public tunnel. For the polished frontend against a GPU host, see [deployment](docs/DEPLOYMENT.md).

## Included features

- Cinematic home page with a scroll-linked 3D-style core, reversible expansion and recombination, parallax typography, staggered section reveals, an interactive neural-network blend control with a studio handoff, and a reduced-motion reading layout.
- Responsive studio, light/dark appearance, keyboard sliders, reduced-motion support, native accessible connection dialog, Markdown/code rendering, copy output.
- Independent coding/writing coefficients; optional normalization; zero/zero uses the base model; four presets; recipe import/export and restore.
- Exact concatenation handles different source ranks without SVD approximation or A/B cross terms. Source hashes invalidate cached blends. Atomic artifact publication and serialized inference protect the shared model state.
- Same-base/revision/module/shape checks; rejection of unsupported bias, DoRA, RS-LoRA, nonfinite tensors, rank/alpha patterns, added trainable modules, and oversized adapters.
- Four-way comparison; a 24-generation benchmark job; progress, cancellation between generations, bounded queue, persisted results and interrupted-job recovery.
- Real token counts, generation time, adapter-switch time, throughput, seed and temperature; coding/writing charts and report export to JSON/CSV.
- SQLite activity log; actual PEFT adapter ZIP download with config and content-hash provenance.
- API key protection, explicit CORS allowlist, no remote code execution, no arbitrary model-file upload endpoint, no generated-code execution inside the API.
- Original starter training/validation data, response-only loss, checkpoint resume, Colab workflows, Docker deployment, CI, API and tensor tests, browser/a11y checks, offline tiny-model training/inference tests.

## Verify

```bash
source .venv/bin/activate
python -m pytest -m 'not ml' -q
python -m pip install -e '.[ml,dev]'
python -m pytest -q
python -m ruff check backend training scripts tests
cd frontend
npm run build
npx playwright install chromium
MODELFORGE_PYTHON=../.venv/bin/python npm run test:e2e
```

The ML tests instantiate a tiny random Qwen locally, compare actual PEFT logits against explicitly added delta weights, generate tokens, switch adapters, and fine-tune for one step. They do **not** prove Qwen specialist quality or Colab performance. See [verification](docs/VERIFICATION.md) for the checks actually run during delivery.

## Benchmark and export from the command line

```bash
python scripts/benchmark.py --coding 0.6 --writing 0.4 --output artifacts/report.json
MODELFORGE_MODE=live python scripts/merge_adapter.py --coding 0.6 --writing 0.4
```

The default rubric checks Python syntax/signatures/imports and writing word count/required/forbidden terms. **A wrong implementation can pass the coding structural rubric.** It is not HumanEval, not a writing-quality judge, and not proof that the blend is better. No fake scores are supplied. Timing excludes model cold load and reports adapter switching separately. Greedy runs use temperature 0; seeded sampling is best-effort reproducible, not bit-identical across devices.

Optional functional tests run generated Python in resource-limited Docker containers, outside the API:

```bash
docker pull python:3.11-slim
python scripts/evaluate_code_docker.py artifacts/report.json
```

This tiny suite is not a security boundary suitable for adversarial public submissions. Review its scope in [benchmark methodology](docs/BENCHMARKS.md).

## Project map

```text
backend/modelforge/   API, merger, inference, jobs, rubrics, persistence
frontend/            React + TypeScript studio and browser tests
training/            Starter data generator and real LoRA Trainer
data/                Original train/validation JSONL plus hashes
notebooks/           Offline training and interactive live Colab workflows
scripts/             One-command run, CLI benchmarks, merge, isolated evaluation
tests/               API, compatibility, algebra, offline ML integration
docs/                Architecture, deployment, API, demo script, limitations
artifacts/           Local checkpoints, merged adapters, SQLite and reports
```

## Technical boundaries

A slider controls the size of an adapter update; it is not a measured percentage of a skill. Combining useful specialists can degrade either skill. The project cannot merge arbitrary architectures, different tokenizers/vocabularies, proprietary models, or independently trained unrelated full checkpoints. Concatenation increases adapter rank and can add inference overhead. This workbench supports uniform-rank plain LoRA on the same linear modules, saved as float16/float32 safetensors; other formats are rejected rather than guessed.

The app is a single-user hackathon service, not multi-tenant production infrastructure. Run **one Uvicorn worker**. Prompts and responses are stored locally in SQLite; do not treat it as an ephemeral/private-history interface. Cached blends and history accumulate under `artifacts`; archive/remove them with the server stopped when appropriate.

## References and licenses

Implementation follows the exact delta composition described in [Hugging Face’s concatenation method](https://huggingface.co/blog/peft_merging) and the [PEFT merging guide](https://huggingface.co/docs/peft/developer_guides/model_merging). The [Qwen model card](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct) provides the checkpoint’s Apache 2.0 license and usage guidance. Colab resources and GPU availability are variable, including paid tiers; see the [official Colab FAQ](https://research.google.com/colaboratory/faq.html).

Project code: MIT. Original starter examples: CC0-1.0. Third-party dependencies and downloaded model weights retain their own licenses. No external dataset or model weights are redistributed in this project ZIP.


## Four skill controls

The homepage and studio now offer **Coding, Humor, Thinking and Writing** independently. Presets include The inventor, The comedian and The strategist. Old coding/writing recipes import with the extra skills off. Normalization applies to the sum of all four coefficients. Comparisons include each active extra specialist: up to six variants and 36 benchmark generations. The benchmark still measures the existing coding-structure and writing-instruction checks; it does not score humor or general reasoning.

`training/prepare_data.py` creates starter data for all four skills. Run the existing trainer with `--skill humor` or `--skill thinking`, using the same pinned base as the other adapters. The first Colab notebook includes an optional cell to train these two extra adapters; the live notebook exposes all four sliders. The starter data demonstrates the pipeline, not validated skill quality.

Live mode automatically discovers `artifacts/adapters/humor` and `artifacts/adapters/thinking`, or accepts `MODELFORGE_HUMOR_ADAPTER` and `MODELFORGE_THINKING_ADAPTER`. Until those trained adapters exist, their live sliders are disabled and requests with positive missing weights fail clearly. Real four-adapter exact concatenation is supported and tested against the sum of the source tensor deltas. Rehearsal mode supports all four controls with clearly labeled canned output.


## Evolith branding and Evolve vision

The website, studio, browser titles, core artwork and public API copy use the Evolith name. Existing Python module names, environment variables, storage keys and model-artifact paths remain compatible.

The homepage’s **Evolve** section describes a planned research loop: inspect model capabilities and adapter weights, propose task-specific child models, evaluate them against a baseline, select a validated candidate and perform the task. This is website content only. Autonomous adaptation, child-model search and self-directed training have not been implemented, and the website does not claim achieved AGI.
