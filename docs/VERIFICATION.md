# Delivery verification · updated 2026-10-24

The backend suite was run on October 23; the home-page and studio browser checks were run on October 24. Actual checks were performed on macOS ARM64, Python 3.12.15, Node 22.20.0, and installed Chrome driven by Playwright. Package versions are recorded in `tested-versions.json`. The project was tested from a clean Python environment with ML dependencies installed.

| Check | Observed result |
|---|---|
| Complete Python suite with `HF_HUB_OFFLINE=1` | **37 passed**, one Starlette/httpx test-client deprecation warning |
| Exact concatenation algebra | Matches the explicit weighted sum, including unequal ranks and zero-weight cases |
| Actual PEFT integration | Tiny random Qwen logits agree with explicit delta-weight addition |
| Real generation | Tiny Qwen generated tokens; positive measured token throughput; baseline/specialist/blend switching exercised |
| Real fine-tuning | One actual response-only Trainer step and validation; adapter safetensors saved |
| Full live benchmark machinery | 24 actual tiny-model generations, numeric rubric checks, measured metrics and source provenance |
| API and persistence | Authentication, CORS, schema limits, missing adapters, exports, job cancellation, cache invalidation, concurrent publication and restart recovery pass |
| Frontend production build | TypeScript and Vite pass; initial home JavaScript approximately 78 KB gzip; the studio is a separate lazy chunk of approximately 48 KB gzip |
| Browser suite | **8 passed**: reversible scroll choreography, neural signal motion/slider/reduced-motion behavior, blend-to-studio navigation, home accessibility and throttled mobile interaction, plus the studio workflow, downloads, comparison, 24-generation demo benchmark, history, keyboard sliders, native dialog focus return, light/dark appearance, explicit error display |
| Automated accessibility | axe scans returned zero violations for the tested light/dark home page, mobile home, light studio, dark studio, mobile dark studio and completed benchmark views; includes WCAG 2 A/AA and 2.1 AA tags |
| Mobile layout | 390-pixel viewport passes horizontal-overflow check; reviewed full-page screenshot |
| Theme checks | 177 definitions, 173 references; no unresolved CSS tokens; no literal colors/px/ms outside the theme layer |
| Home performance lab | Mobile 390 × 844, 4× CPU slowdown, cold browser cache and 1.6 Mbps/150 ms connection: LCP 2,160 ms, CLS 0, scroll frame p95 17.8 ms. One local sample, not field data or a full INP measurement. |
| Python lint | Ruff passes |
| Colab notebook structure | Both notebooks are valid JSON; all 10 Python code cells parse successfully |
| Portable ZIP | Extracted to a fresh directory; bundled frontend, recipe creation and rehearsal generation pass; no local secrets, dependencies or runtime history included |

The browser checks found a footer contrast issue and a hidden file-input overflow during development. Both were corrected and the final suite passed. Accessibility scans run after the theme reaches its final colors, using reduced motion, so transition frames are not mistaken for the stable theme.

## What was not verified here

- A full fine-tune of Qwen2.5-0.5B on Colab, a Colab GPU runtime, or measured performance on T4/L4/A100. There was no CUDA GPU in this environment.
- Learned coding/writing specialization, improved quality, an accuracy gain, or a training-time/speedup claim. Tiny random-model tests establish integration correctness only.
- An actual Google Drive mount, Google Colab upload/widget session, public GPU deployment, HTTPS reverse proxy, or multi-user operation. The notebook cells use standard Colab APIs, but their cloud environment was not executed here.
- Docker image execution or optional generated-code Docker tests; Docker is not installed on the verification host.
- Every possible browser, screen reader, UI state, third-party adapter type or WCAG criterion. Automated axe checks are not a full accessibility certification.

The design-code skill's referenced support files and named verification scripts were absent from the installed skill directory. The project therefore includes its own executable token checks and Playwright/axe tests, plus actual screenshot review; no output is claimed from those unavailable skill scripts.

## Reproduce the local checks

```bash
python -m pip install -e '.[ml,dev]'
HF_HUB_OFFLINE=1 python -m pytest -q
python -m ruff check backend training scripts tests
python scripts/check_theme.py
cd frontend
npm ci
npm run build
npx playwright install chromium
MODELFORGE_PYTHON=../.venv/bin/python npm run test:e2e
```

Set `PLAYWRIGHT_CHROME=1` to use an installed Chrome instead of Playwright's downloaded Chromium. The browser config starts a demo API if one is not already running. For a clean reproduction, stop other servers on port 8000 first. Full Qwen training and CUDA performance remain a separate validation step on your chosen GPU.
