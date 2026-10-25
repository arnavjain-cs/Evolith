import pytest
from fastapi.testclient import TestClient
from modelforge.app import create_app
from modelforge.config import Settings


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(Settings(mode="demo", data_dir=tmp_path))) as client:
        yield client


def model(client, **kwargs):
    result = client.post('/api/workspace/models', json={"name": "Builder / main", "weights": {"coding": .8, "writing": .2}, **kwargs})
    assert result.status_code == 201, result.text
    return result.json()


def agent(client, **kwargs):
    result = client.post('/api/workspace/agents', json={
        "name": "Policy assistant", "goal": "Answer from policy notes", "instructions": "Cite evidence. State uncertainty.",
        "model_id": model(client)['id'], "tools": ["knowledge_search", "text_metrics"],
        "knowledge": "Refunds are available for 30 days.\nEscalations go to a human reviewer.", **kwargs})
    assert result.status_code == 201, result.text
    return result.json()


def test_model_branch_lineage_and_studio_registration(client):
    parent = model(client)
    same = client.post('/api/workspace/models', json={"name": "Unchanged branch", "parent_id": parent['id']}).json()
    assert same['recipe_id'] == parent['recipe_id'] and same['branch_kind'] == 'recipe_reference'
    child = model(client, name="Writer branch", parent_id=parent['id'], weights={"coding": .2, "writing": .8})
    assert child['parent_id'] == parent['id'] and child['recipe_id'] != parent['recipe_id']
    assert child['recipe']['mode'] == 'demo' and not child['recipe']['artifact_available']
    assert client.app.state.service.store.get('managed_model', parent['id']) == parent
    registered = client.post('/api/workspace/models', json={"name": "Saved studio recipe", "recipe_id": parent['recipe_id']}).json()
    assert registered['recipe_id'] == parent['recipe_id']


def test_blueprints_independent_agent_branches_and_optimistic_versions(client):
    original = agent(client)
    branch = client.post(f"/api/workspace/agents/{original['id']}/branch", json={"name": "Policy / experiment"}).json()
    assert branch['parent_id'] == original['id'] and branch['parent_version'] == 1 and branch['version'] == 1
    fields = {k: original[k] for k in ('name','goal','instructions','model_id','tools','knowledge','max_new_tokens','temperature','capture_content','blueprint_id')}
    update = client.post(f"/api/workspace/agents/{original['id']}/save", json={**fields,"name":"Policy v2","expected_version":1})
    assert update.status_code == 200 and update.json()['version'] == 2
    assert client.post(f"/api/workspace/agents/{original['id']}/save", json={**fields,"expected_version":1}).status_code == 409
    versions = client.get(f"/api/workspace/agents/{original['id']}/versions").json()
    assert [v['version'] for v in versions] == [2,1] and versions[1]['name'] == original['name']
    assert client.app.state.service.store.get('agent', branch['id'])['name'] == branch['name']
    bp = client.post(f"/api/workspace/agents/{original['id']}/blueprint", json={"name":"Reusable support"}).json()
    assert bp['source_version'] == 2 and bp['tools'] == fields['tools'] and 'model_id' not in bp
    cloned = client.post('/api/workspace/agents', json={**fields,"blueprint_id":bp['id']}).json()
    assert cloned['id'] != original['id'] and cloned['blueprint_id'] == bp['id']


def test_run_executes_tools_pins_config_and_reports_demo_provenance(client, monkeypatch):
    saved = agent(client)
    service = client.app.state.service
    original = service.engine.generate
    seen = {}
    def observe(recipe, request):
        seen.update(system=request.system_prompt, prompt=request.prompt, recipe=recipe['id'])
        return original(recipe, request)
    monkeypatch.setattr(service.engine, 'generate', observe)
    run = client.post(f"/api/workspace/agents/{saved['id']}/run", json={"task":"What is the refunds policy?", "expected_version":1}).json()
    assert run['status'] == 'completed' and run['agent_version'] == 1
    assert run['mode'] == 'demo' and run['provenance'] == 'canned_rehearsal_text'
    assert run['metrics']['output_tokens'] is None
    assert [x['step'] for x in run['trace']] == ['knowledge_search','text_metrics','model_response']
    assert '[Line 1] Refunds are available for 30 days.' in run['trace'][0]['detail']
    assert 'Words: 5' in run['trace'][1]['detail']
    assert saved['instructions'] in seen['system'] and saved['goal'] in seen['system']
    assert 'Read-only tool context' in seen['prompt'] and '30 days' in seen['prompt']
    assert seen['recipe'] == run['recipe_id']
    assert client.get('/api/workspace').json()['runs'][0]['id'] == run['id']


def test_paused_stale_unknown_tools_and_invalid_models_rejected(client):
    saved = agent(client)
    path = f"/api/workspace/agents/{saved['id']}"
    assert client.post(path+'/run', json={"task":"Hello","expected_version":2}).status_code == 409
    assert client.post(path+'/state', json={"status":"paused"}).status_code == 200
    assert client.post(path+'/run', json={"task":"Hello","expected_version":1}).status_code == 409
    assert client.post(path+'/state', json={"status":"ready"}).status_code == 200
    assert client.post('/api/workspace/agents', json={"name":"X","goal":"Y","instructions":"Z","model_id":saved['model_id'],"tools":["slack"]}).status_code == 422
    assert client.post('/api/workspace/agents', json={"name":"X","goal":"Y","instructions":"Z","model_id":"missing"}).status_code == 404
    assert client.post('/api/workspace/models', json={"name":"   ","weights":{}}).status_code == 422
    assert client.post('/api/workspace/models', json={"name":"Both", "recipe_id":"abc", "weights":{}}).status_code == 400


def test_metadata_only_run_does_not_persist_content_or_engine_prompt(client):
    saved = agent(client, capture_content=False)
    run = client.post(f"/api/workspace/agents/{saved['id']}/run", json={"task":"Private refunds question 123", "expected_version":1}).json()
    assert run['output'] and run['task'] is None
    overview = client.get('/api/workspace').json()
    record = next(r for r in overview['runs'] if r['id'] == run['id'])
    assert record['output'] is None and record['task'] is None
    assert all('123' not in step['detail'] for step in record['trace'])
    assert client.get('/api/history').json()['runs'] == []


def test_failures_recorded_without_silent_fallback(client, monkeypatch):
    saved = agent(client, capture_content=False)
    def fail(*args):
        raise RuntimeError('private-input-456')
    monkeypatch.setattr(client.app.state.service.engine, 'generate', fail)
    run = client.post(f"/api/workspace/agents/{saved['id']}/run", json={"task":"private-input-456", "expected_version":1}).json()
    assert run['status'] == 'failed' and run['output'] is None
    assert run['trace'][-1]['status'] == 'failed' and 'private-input-456' not in str(run)


def test_workspace_persists_restart_and_requires_api_key(tmp_path):
    settings = Settings(mode='demo', data_dir=tmp_path)
    with TestClient(create_app(settings)) as first:
        saved = agent(first)
        running = {"id":"interrupted-run", "status":"running", "created_at":"2026-10-25T00:00:00Z"}
        first.app.state.service.store.put('agent_run', running)
    with TestClient(create_app(settings)) as second:
        overview = second.get('/api/workspace').json()
        assert any(x['id'] == saved['id'] for x in overview['agents'])
        assert next(r for r in overview['runs'] if r['id'] == running['id'])['status'] == 'interrupted'
    with TestClient(create_app(Settings(mode='demo', data_dir=tmp_path, api_key='private-key'))) as protected:
        assert protected.get('/api/workspace').status_code == 401
        assert protected.get('/api/workspace', headers={'X-API-Key':'private-key'}).status_code == 200
        assert protected.post('/api/workspace/models', json={"name":"Unauthorized","weights":{}}).status_code == 401
