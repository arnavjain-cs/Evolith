# Evolith agent workspace

Evolith makes the repeated parts of building an agent reusable: a pinned custom model, objective, instructions, allowlisted tools, model settings, and run monitoring. This is a working single-workspace prototype for the enterprise-agent sponsor brief. It is not a production enterprise service.

## Open it

Run the existing project with `./scripts/run.sh`, then open **http://localhost:8000/#agents**. The **Agents** link on the homepage and **Agent workspace** link in the model studio open the same page. The homepage description is at **/#agent-platform**.

The existing manual installation and Colab instructions still apply. New records use the same SQLite database under `MODELFORGE_DATA_DIR`; no new dependency or paid API is required. Keep the API at **one worker**, as the existing generation queue and new workspace use process-local locks.

## A complete demo in two minutes

1. Open **Blueprints**, then choose **Support copilot → Use blueprint**.
2. Give the agent a name. Choose a saved model or click **Create starter model**.
3. Add notes, for example: `Refunds are available for 30 days. Exceptions require human review.`
4. Inspect the objective, instructions, read-only tools, output-token cap, temperature, and content-retention choice. Click **Create agent**.
5. Run `What is the refunds policy?`. **Run monitor** shows the matching source line, actual text-analysis counts, the selected model recipe, configuration version, status, and step timings.
6. In rehearsal mode the model response is explicitly canned. Use the existing live Colab backend for real generation with the saved instructions. No model quality, throughput, or enterprise reliability numbers are invented.
7. Return to the agent. Edit its configuration to create v2, inspect **Version history**, or use a past version as a new draft. **Pause agent** blocks new runs; it does not cancel an already running request.
8. **Branch agent** creates an independent configuration with its parent and source version. **Save as blueprint** keeps the reusable setup and source model hints. Select it in Blueprints to create another independent agent.
9. Open **Model library**, branch a saved model, adjust skill weights, and save it. The parent stays unchanged. **From your studio** registers existing merge recipes.
10. Export a setup, blueprint, or run trace as JSON. Exported setups are inspectable configuration documents; they are not one-click hosted deployments or importable model weights.

## How it meets the brief

| Repeated setup | Working prototype behavior |
| --- | --- |
| Configuring models | Saved model registry, studio recipe registration, weighted recipe branches, lineage, pinned model per agent, temperature and output caps |
| Connecting tools | Two functional allowlisted read-only tools; tool selection is saved in the setup and reused through blueprints |
| Writing instructions | Separate objective and model system instructions; versioned configuration snapshots with stale-edit protection |
| Adding monitoring | Durable run status, version/recipe references, step traces, elapsed orchestration timings, errors, output retention controls, and activity events |
| Reusing setup | Three starter blueprints, custom blueprints from agents, independent agent branches, JSON exports |
| Enterprise-oriented control | Existing optional shared API-key protection applies to all workspace endpoints; explicit sandbox status, pause/resume, bounded inputs, and no external writes |

## Functional boundaries

- **Real in both runtime modes:** SQLite persistence, model/agent lineage, blueprints, instructions/configuration storage, atomic version snapshots, optimistic version checks, pause/resume, two local tools, run traces, exports, and activity records. A server restart preserves configuration and marks in-flight agent runs interrupted.
- **Live model mode:** Weighted merging uses the existing compatible-adapter implementation. Agent inference passes saved instructions as the system message and tool results as context to the existing model engine. Live errors remain failed runs; there is no silent rehearsal fallback.
- **Rehearsal mode:** Recipes reference demo coefficients and have no trained adapter artifacts. Tools still execute, but model responses are canned fixtures; they do not validate instruction following or task success. Displayed run durations measure actual local orchestration, not model inference. Model token metrics remain unavailable.
- **Tools:** `knowledge_search` ranks saved note lines by word overlap, returning up to four numbered matching lines. It is a basic lexical search, not vector RAG. `text_metrics` counts task words, characters and lines. Every enabled tool runs once before generation; the model does not autonomously choose tools or perform multi-step planning.
- **Branches:** An unchanged model branch references the existing recipe. Changed coefficients create a new merge recipe (real adapter tensors only in live mode). This does not copy the base checkpoint, train new weights, or prove improvement. Agent branching copies configuration, not model weights.
- **Content retention:** Turning it off omits task, output and tool content from durable agent-run records; the response is shown once in the requesting page. Status, timings, IDs and provenance remain. Agent instructions, objectives and knowledge notes are still stored as configuration. It does not erase earlier records or the separate studio history.
- **Planned enterprise work:** SSO/OIDC, RBAC, multi-tenant isolation, managed secrets, external Slack/Salesforce connectors, production deployment, scalable jobs, budgets/rate limits, human-approval workflows for write tools, encrypted storage, and tamper-evident audit retention. Connector tiles are disabled and labeled planned. Current activity records are ordinary SQLite records, not compliance-grade immutable audit logs.
- **Planned Evolve research:** Autonomous inspection, creation, evaluation and selection of child models remains a clearly labeled research vision; this page does not implement it or claim AGI.

## API

All endpoints below inherit the existing `X-API-Key` dependency when `MODELFORGE_API_KEY` is configured. Configure an authenticated live backend in the model studio’s connection settings; this page uses the same session connection. The prototype has one workspace and no per-user roles.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/workspace` | Models, agents, blueprints, latest 100 runs/events, tool catalog, runtime mode |
| POST | `/api/workspace/models` | Register a recipe or create a weighted model; optional `parent_id` |
| POST | `/api/workspace/agents` | Create an agent bound to a saved model |
| POST | `/api/workspace/agents/{id}/save` | Save a new config version; requires current `expected_version` |
| POST | `/api/workspace/agents/{id}/branch` | Independent copy with parent/version lineage |
| POST | `/api/workspace/agents/{id}/state` | Set `ready` or `paused` |
| POST | `/api/workspace/agents/{id}/blueprint` | Save portable reusable setup plus model hints |
| GET | `/api/workspace/agents/{id}/versions` | Inspect insert-only version snapshots |
| POST | `/api/workspace/agents/{id}/run` | Execute a synchronous sandbox task pinned to `expected_version` |

The workspace returns up to 500 models, agents and custom blueprints. Larger registries need pagination before production use. Only one agent run is accepted at a time in this process; active runs can be inspected by refreshing the monitor from another client. Generation is serialized by the existing model engine.

## Verification

```bash
python -m pytest tests/test_agents.py tests/test_api.py -q
python scripts/check_theme.py
cd frontend
npm run build
PLAYWRIGHT_CHROME=1 MODELFORGE_PYTHON=../.venv/bin/python npm run test:e2e
```

Browser tests cover blueprint creation, real tool results, traces, pause/resume, agent and model branches, persistence after reload, configuration versions, JSON export, homepage navigation, reduced motion, accessibility, and desktop/mobile light/dark layouts. Set `EVOLITH_TEST_PORT` and `MODELFORGE_TEST_DATA_DIR` to use an isolated local test workspace. If Chrome is unavailable, install Playwright Chromium and omit `PLAYWRIGHT_CHROME=1`.
