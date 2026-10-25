# Benchmark methodology

This is a lightweight hackathon instrument, not a scientific evaluation suite.

Four variants are evaluated sequentially: base model with adapters disabled, coding-only adapter at coefficient 1, writing-only at coefficient 1, and the selected blend. All use the same resident base checkpoint, same fixed system prompt, max output tokens, temperature, and seed. Generation order is fixed and not randomized, so thermal/caching effects may bias throughput comparisons. Warm the base once before a measured run. A sampling seed helps repeatability on the same hardware but does not guarantee cross-device identity.

The six prompts are stored in `backend/modelforge/benchmark.py` and are not included in the starter training examples. Template-generated validation examples remain similar to training templates; validation loss is useful for pipeline checks, not broad generalization claims.

Each coding task earns one equally weighted point for parseable Python, the requested top-level function name and arity, and no import statements. These static checks do not execute code and cannot establish correctness. Each writing task earns one point for requested word range, all required terms, and absence of all forbidden terms. Scores are the percentage of checks passed, then averaged across the completed tasks for each skill. These checks measure structure and instruction following, not usefulness, factuality, tone, or prose quality.

The charts always show the rubric label. Rehearsal jobs return null scores, null model timings, and canned text. A UI interaction is not a model benchmark.

Live timings use wall time around `model.generate` with CUDA synchronization when CUDA is available. They exclude cold load, tokenization, merge, adapter switching, and HTTP latency. Adapter switching and merge timings are separately recorded. Output token count includes any generated special/end token in the returned sequence. Throughput is returned generated token count divided by generation seconds. Table throughput is an unweighted arithmetic mean over completed task rates, not aggregate tokens divided by aggregate time. Empty or partial results are not directly comparable to full runs.

Reports store prompt, output, mode, recipe, settings, source hashes, checks and timing. Keep the adapter training manifest and recipe export alongside the benchmark report. A valid experiment can show no improvement or regression; keep that evidence.

## Optional functional coding checks

`scripts/evaluate_code_docker.py` evaluates three tiny assertion sets, using containers with no network, a read-only filesystem, non-root user, no capabilities, CPU/memory/process limits, and a timeout. It never evaluates generated code in the web server's Python process. Requires Docker and the `python:3.11-slim` image. These checks are intentionally small, and a malicious answer can target their judging logic. Container isolation is not a guarantee against host vulnerabilities. Do not use this as an internet-facing arbitrary-code runner.

For a stronger project follow-up, add a larger held-out corpus, randomized/blinded human writing ratings, isolated coding unit tests, multiple seeds, confidence intervals, and a Pareto sweep of coefficients. No unmeasured speedup, accuracy gain, or energy/cost savings is claimed in this delivery.
