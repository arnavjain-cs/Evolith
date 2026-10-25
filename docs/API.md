# API

Interactive schema: `http://localhost:8000/docs`. JSON requests use `Content-Type: application/json`. If configured, include `X-API-Key` for every route except `/api/health`.

| Method | Path | Result |
|---|---|---|
| GET | `/api/health` | Process health, version, runtime mode |
| GET | `/api/status` | Adapter readiness, mode, capabilities, source hashes |
| GET | `/api/presets` | Named coefficient presets |
| POST | `/api/warmup` | Download/load base checkpoint once in live mode |
| POST | `/api/merge` | Validate/merge, persist recipe, return ID |
| GET | `/api/recipes/{id}` | Recipe and provenance |
| GET | `/api/recipes/{id}/download` | Real adapter ZIP; 409 for demo/zero baseline |
| POST | `/api/generate` | Generate once; persist output and metrics |
| POST | `/api/jobs` | Start `compare` or `benchmark`; returns 202 |
| GET | `/api/jobs/{id}` | Status, progress, intermediate outputs and averages |
| POST | `/api/jobs/{id}/cancel` | Stop after current generation |
| GET | `/api/jobs/{id}/export?format=json` | Complete report including settings and outputs |
| GET | `/api/jobs/{id}/export?format=csv` | Flattened results, spreadsheet formula prefixes escaped |
| GET | `/api/benchmarks/suite` | Prompts and transparent rubric |
| GET | `/api/history` | Recent recipes, runs and jobs |

```bash
curl -s http://localhost:8000/api/merge \
  -H 'Content-Type: application/json' \
  -d '{"weights":{"coding":0.7,"writing":0.3},"normalize":true}'

curl -s http://localhost:8000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"recipe_id":"PASTE_ID","prompt":"Explain LoRA adapters.","max_new_tokens":128,"temperature":0,"seed":42}'
```

Merge inputs are coefficients `[0,1]`, with optional normalization. All-zero is valid and selects the baseline. Generation accepts 16–768 new tokens, temperature 0–1.5, nonnegative 32-bit seed, and up to 6,000 prompt characters. Live tokenization enforces 2,048 input tokens. Unknown fields are rejected. The benchmark UI caps generation at 192 tokens per task.

Job body uses the same generation schema plus `"kind":"compare"` or `"kind":"benchmark"`. Every variant receives the same system prompt and generation settings. The benchmark uses the fixed suite prompts rather than the supplied custom prompt. A benchmark is 24 generations; comparison is four. Poll until status is `completed`, `cancelled`, `failed`, or `interrupted`. Intermediate averages include only completed tasks.

Errors: 400 invalid runtime request, 401 incorrect key, 404 unknown record, 409 incompatible/missing adapter, 422 schema validation, 429 full background queue, 503 failed warmup/inference. No error enables rehearsal automatically.
