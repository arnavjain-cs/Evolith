import csv
import hmac
import io
import json
import zipfile
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from .benchmark import RUBRIC, SUITE
from .config import ROOT, Settings
from .engine import DEFAULT_PROMPT
from .merge import CompatibilityError, validate_pair
from .schemas import PRESETS, GenerateRequest, JobRequest, MergeRequest
from .service import Service
from .agents import AgentWorkspace, AgentCreate, AgentUpdate, ModelCreate, Named, AgentState, AgentTask


def create_app(settings: Settings | None = None):
    config = settings or Settings()
    service = Service(config)
    workspace = AgentWorkspace(service)

    @asynccontextmanager
    async def lifespan(app):
        yield
        service.close()

    app = FastAPI(title="Evolith", version="1.0.0", lifespan=lifespan)
    app.state.service = service
    app.add_middleware(CORSMiddleware, allow_origins=config.origins, allow_credentials=False,
                       allow_methods=["GET", "POST"], allow_headers=["Content-Type", "X-API-Key"])

    def authorize(x_api_key: str = Header(default="")):
        if config.api_key and not hmac.compare_digest(x_api_key, config.api_key):
            raise HTTPException(401, "Missing or incorrect X-API-Key.")

    @app.exception_handler(CompatibilityError)
    async def compatibility_error(request, exc):
        return JSONResponse(status_code=409, content={"detail": str(exc), "mode": config.mode})

    @app.exception_handler(KeyError)
    async def missing_error(request, exc):
        return JSONResponse(status_code=404, content={"detail": str(exc).strip("'")})

    @app.exception_handler(ValueError)
    async def value_error(request, exc):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.get("/api/health")
    def health():
        return {"ok": True, "mode": config.mode, "version": "1.0.0"}

    api = APIRouter(prefix="/api", dependencies=[Depends(authorize)])

    @api.get("/status")
    def status():
        error = None
        adapters = []
        if config.mode == "live":
            try:
                loaded = validate_pair(config.adapter_paths, config.base_model, config.base_revision)
                adapters = [{"skill": name, "rank": value[0]["r"], "alpha": value[0]["lora_alpha"],
                             "revision": value[0]["revision"], "sha256": value[2], "modules": len(value[1])}
                            for name, value in loaded.items()]
            except (ValueError, OSError) as exc:
                error = str(exc)
        return {"mode": config.mode, "base_model": config.base_model, "ready": error is None,
                "model_loaded": service.engine.model is not None, "adapters": adapters, "error": error,
                "available_skills": ["coding", "humor", "thinking", "writing"] if config.mode == "demo" else list(config.adapter_paths),
                "capabilities": {"tensor_merge": config.mode == "live", "model_inference": config.mode == "live",
                                 "adapter_export": config.mode == "live", "benchmark_scores": config.mode == "live"},
                "default_prompt": DEFAULT_PROMPT,
                "notice": "Live mode never silently falls back. Errors remain errors." if config.mode == "live" else
                          "Rehearsal only: canned outputs, no trained weights, no model inference or benchmark scores."}

    @api.get("/presets")
    def presets():
        return PRESETS

    @api.get("/benchmarks/suite")
    def suite():
        return {"tasks": SUITE, "rubric": RUBRIC, "version": 1}

    @api.post("/warmup")
    def warmup():
        try:
            return service.engine.warmup()
        except (ImportError, OSError, RuntimeError) as exc:
            raise HTTPException(503, f"Model warmup failed: {exc}. Check ML dependencies, device memory and model access.") from exc

    @api.post("/merge")
    def merge(request: MergeRequest):
        return service.merger.create(request.weights.model_dump(), request.normalize)

    @api.get("/recipes/{recipe_id}")
    def recipe(recipe_id: str):
        return service.recipe(recipe_id)

    @api.get("/recipes/{recipe_id}/download")
    def download(recipe_id: str):
        selected = service.recipe(recipe_id)
        if not selected["artifact_available"]:
            raise HTTPException(409, "No adapter file exists for rehearsal or a zero-weight baseline. Export the recipe JSON instead.")
        path = service.merger.path(selected)
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            for name in ("adapter_config.json", "adapter_model.safetensors", "manifest.json"):
                archive.write(path / name, name)
            archive.writestr("recipe.json", json.dumps(selected, indent=2))
        return Response(buffer.getvalue(), media_type="application/zip",
                        headers={"Content-Disposition": f'attachment; filename="evolith-{recipe_id}.zip"'})

    @api.post("/generate")
    def generate(request: GenerateRequest):
        try:
            return service.generate(request)
        except (ImportError, OSError, RuntimeError) as exc:
            raise HTTPException(503, f"Inference failed: {exc}. No demo fallback was used.") from exc

    @api.post("/jobs", status_code=202)
    def submit(request: JobRequest):
        try:
            return service.submit(request)
        except RuntimeError as exc:
            raise HTTPException(429, str(exc)) from exc

    @api.get("/jobs/{job_id}")
    def job(job_id: str):
        result = service.store.get("job", job_id)
        if result is None:
            raise KeyError("Job not found.")
        return result

    @api.post("/jobs/{job_id}/cancel")
    def cancel(job_id: str):
        return service.cancel(job_id)

    @api.get("/jobs/{job_id}/export")
    def export_job(job_id: str, format: str = Query(default="json", pattern="^(json|csv)$")):
        result = job(job_id)
        if format == "json":
            return Response(json.dumps(result, indent=2), media_type="application/json",
                            headers={"Content-Disposition": f'attachment; filename="evolith-{job_id}.json"'})
        output = io.StringIO()
        fields = ["variant", "task_id", "skill", "mode", "score", "generation_ms", "tokens_per_second", "text"]
        writer = csv.DictWriter(output, fieldnames=fields)
        writer.writeheader()
        for row in result["rows"]:
            record = {key: row.get(key, row["metrics"].get(key)) for key in fields}
            # Prevent formula execution when opening downloaded CSV in a spreadsheet.
            for key, value in record.items():
                if isinstance(value, str) and value[:1] in {"=", "+", "-", "@", "\t", "\r"}:
                    record[key] = "'" + value
            writer.writerow(record)
        return Response(output.getvalue(), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="evolith-{job_id}.csv"'})

    @api.get("/history")
    def history():
        return {"recipes": service.store.list("recipe"), "runs": service.store.list("run"), "jobs": service.store.list("job", 15)}

    @api.get("/workspace")
    def agent_workspace():
        return workspace.overview()

    @api.post("/workspace/models", status_code=201)
    def register_model(request: ModelCreate):
        return workspace.model(request)

    @api.post("/workspace/agents", status_code=201)
    def create_agent(request: AgentCreate):
        return workspace.create(request)

    @api.post("/workspace/agents/{agent_id}/save")
    def save_agent(agent_id: str, request: AgentUpdate):
        return workspace.update(agent_id, request)

    @api.post("/workspace/agents/{agent_id}/branch", status_code=201)
    def branch_agent(agent_id: str, request: Named):
        return workspace.branch(agent_id, request)

    @api.post("/workspace/agents/{agent_id}/state")
    def agent_state(agent_id: str, request: AgentState):
        return workspace.state(agent_id, request)

    @api.post("/workspace/agents/{agent_id}/blueprint", status_code=201)
    def save_blueprint(agent_id: str, request: Named):
        return workspace.blueprint(agent_id, request)

    @api.get("/workspace/agents/{agent_id}/versions")
    def agent_versions(agent_id: str):
        return workspace.versions(agent_id)

    @api.post("/workspace/agents/{agent_id}/run")
    def run_agent(agent_id: str, request: AgentTask):
        return workspace.run(agent_id, request)

    app.include_router(api)
    if (ROOT / "frontend/dist").is_dir():
        app.mount("/", StaticFiles(directory=ROOT / "frontend/dist", html=True), name="frontend")
    return app


app = create_app()
