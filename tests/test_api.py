import json
import time

import pytest
from fastapi.testclient import TestClient
from modelforge.app import create_app
from modelforge.config import Settings
from modelforge.engine import DEFAULT_PROMPT


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(Settings(mode="demo", data_dir=tmp_path))) as client:
        yield client


def recipe(client):
    response = client.post("/api/merge", json={"weights": {"coding": .8, "writing": .2}})
    assert response.status_code == 200
    return response.json()


def wait(client, job_id):
    for _ in range(100):
        job = client.get(f"/api/jobs/{job_id}").json()
        if job["status"] not in {"queued", "running"}:
            return job
        time.sleep(.01)
    raise AssertionError("Job did not finish")


def test_demo_is_unambiguous(client):
    status = client.get("/api/status").json()
    assert status["mode"] == "demo" and not any(status["capabilities"].values())
    selected = recipe(client)
    assert selected["method"] == "rehearsal_only" and not selected["artifact_available"]
    run = client.post("/api/generate", json={"recipe_id": selected["id"], "prompt": DEFAULT_PROMPT}).json()
    assert run["provenance"] == "canned_rehearsal_text" and run["metrics"]["tokens_per_second"] is None
    assert "def normalize" in run["text"]
    assert client.get(f"/api/recipes/{selected['id']}/download").status_code == 409


def test_custom_demo_prompt_is_not_answered(client):
    result = client.post("/api/generate", json={"recipe_id": recipe(client)["id"], "prompt": "Custom unfamiliar request"}).json()
    assert "no canned response" in result["text"]


@pytest.mark.parametrize("kind,total", [("compare", 4), ("benchmark", 24)])
def test_jobs_and_exports(client, kind, total):
    response = client.post("/api/jobs", json={"kind": kind, "recipe_id": recipe(client)["id"], "prompt": DEFAULT_PROMPT})
    assert response.status_code == 202
    job = wait(client, response.json()["id"])
    assert job["status"] == "completed" and len(job["rows"]) == total
    assert len(job["summary"]) == 4
    assert all(r["score"] is None for r in job["rows"])
    assert client.get(f"/api/jobs/{job['id']}/export?format=csv").headers["content-type"].startswith("text/csv")
    assert client.get(f"/api/jobs/{job['id']}/export?format=json").json()["id"] == job["id"]
    assert client.get("/api/history").json()["jobs"][0]["id"] == job["id"]


def test_validation_and_not_found(client):
    assert client.post("/api/merge", json={"weights": {"coding": -1, "writing": .2}}).status_code == 422
    assert client.post("/api/merge", json={"weights": {"coding": .5, "writing": .2, "other": 1}}).status_code == 422
    assert client.post("/api/generate", json={"recipe_id": "abc", "prompt": ""}).status_code == 422
    assert client.post("/api/generate", json={"recipe_id": "abc", "prompt": "hello"}).status_code == 404
    assert client.get("/api/jobs/missing").status_code == 404


def test_api_key_and_cors(tmp_path):
    with TestClient(create_app(Settings(mode="demo", data_dir=tmp_path, api_key="test-secret"))) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/api/status").status_code == 401
        assert client.get("/api/status", headers={"X-API-Key": "test-secret"}).status_code == 200
        response = client.options("/api/merge", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "X-API-Key,Content-Type"})
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_live_missing_adapters_never_falls_back(tmp_path):
    with TestClient(create_app(Settings(mode="live", data_dir=tmp_path))) as client:
        assert not client.get("/api/status").json()["ready"]
        assert client.post("/api/merge", json={}).status_code == 409


def test_download_real_tensors(live):
    import io
    import zipfile

    with TestClient(create_app(live.settings)) as client:
        selected = recipe(client)
        response = client.get(f"/api/recipes/{selected['id']}/download")
        assert response.status_code == 200
        archive = zipfile.ZipFile(io.BytesIO(response.content))
        assert "adapter_model.safetensors" in archive.namelist()
        assert json.loads(archive.read("manifest.json"))["sources"] == selected["sources"]


def test_job_cancel_between_generations(client, monkeypatch):
    service = client.app.state.service
    original = service.engine.generate
    def slow(*args):
        time.sleep(.04)
        return original(*args)
    monkeypatch.setattr(service.engine, "generate", slow)
    job = client.post("/api/jobs", json={"kind": "benchmark", "recipe_id": recipe(client)["id"], "prompt": "x"}).json()
    assert client.post(f"/api/jobs/{job['id']}/cancel").json()["cancel_requested"]
    assert wait(client, job["id"])["status"] == "cancelled"


def test_four_skill_recipe_compare_and_benchmark(client):
    status = client.get("/api/status").json()
    assert status["available_skills"] == ["coding", "humor", "thinking", "writing"]
    selected = client.post("/api/merge", json={"weights": {"coding": .4, "humor": .15, "thinking": .3, "writing": .15}}).json()
    assert len(selected["weights"]) == 4
    run = client.post("/api/generate", json={"recipe_id": selected["id"], "prompt": DEFAULT_PROMPT}).json()
    assert run["provenance"] == "canned_rehearsal_text" and "Plan:" in run["text"]
    for kind, total in [("compare", 6), ("benchmark", 36)]:
        job = client.post("/api/jobs", json={"kind": kind, "recipe_id": selected["id"], "prompt": DEFAULT_PROMPT}).json()
        completed = wait(client, job["id"])
        assert completed["status"] == "completed" and completed["total"] == total
        assert len(completed["summary"]) == 6
        assert {"Humor specialist", "Thinking specialist"}.issubset({row["variant"] for row in completed["rows"]})
        assert all(row["score"] is None for row in completed["rows"])


@pytest.mark.parametrize("skill", ["humor", "thinking"])
def test_extra_skill_validation(client, skill):
    assert client.post("/api/merge", json={"weights": {"coding": .5, "writing": .5, skill: -1}}).status_code == 422
