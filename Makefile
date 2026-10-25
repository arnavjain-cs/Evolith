.PHONY: setup build serve dev test ml-test ui-test lint
setup:
	python3 -m venv .venv
	.venv/bin/python -m pip install -e '.[dev]'
	cd frontend && npm ci
build:
	cd frontend && npm run build
serve:
	.venv/bin/python -m uvicorn modelforge.app:app --host 127.0.0.1 --port 8000 --workers 1
dev:
	cd frontend && npm run dev
test:
	.venv/bin/python -m pytest -m 'not ml' -q
ml-test:
	.venv/bin/python -m pip install -e '.[ml,dev]'
	.venv/bin/python -m pytest -q
ui-test:
	cd frontend && npx playwright install chromium && npm run test:e2e
lint:
	.venv/bin/python -m ruff check backend training scripts tests
	cd frontend && npm run build
