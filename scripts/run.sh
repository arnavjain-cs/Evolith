#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"
PYTHON_BIN="${MODELFORGE_PYTHON:-python3}"
if [[ ! -d .venv ]]; then "$PYTHON_BIN" -m venv .venv; fi
.venv/bin/python -m pip install -e '.[dev]'
if [[ ! -d frontend/node_modules ]]; then (cd frontend && npm ci --no-audit --no-fund); fi
(cd frontend && npm run build)
printf '\nEvolith is ready at http://localhost:8000\n'
exec .venv/bin/python -m uvicorn modelforge.app:app --host "${MODELFORGE_HOST:-127.0.0.1}" --port "${PORT:-8000}" --workers 1
