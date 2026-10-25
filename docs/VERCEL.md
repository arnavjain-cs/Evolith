# GitHub and Vercel

Upload the contents of this project folder as the root of your GitHub repository. The folder may still be named `modelforge`; the product is Evolith. Internal Python module names and environment variables remain `modelforge` / `MODELFORGE_*` for compatibility.

```text
Your GitHub repository
├── frontend/      # React/Vite website and model + agent workspaces
├── backend/       # FastAPI, LoRA merge/inference, agent records and runs
├── training/      # Offline adapter training scripts
├── notebooks/     # Colab training and live-lab notebooks
├── tests/         # Backend tests
├── scripts/       # Run, package, benchmark and verification tools
├── docs/          # Guides
├── pyproject.toml
└── README.md
```

## Push to GitHub

Create an empty GitHub repository called `evolith`, then run these commands **inside this project folder**. Replace the remote URL with your own repository URL:

```bash
git init
git add .
git commit -m "Build Evolith model studio and reusable agent workspace"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/evolith.git
git push -u origin main
```

The included `.gitignore` omits virtual environments, `node_modules`, generated build output, local databases/adapters, test artifacts, Vercel state, and environment overrides. Example environment files remain tracked. The deliverable ZIP includes a built frontend for local use, but Git should rebuild it from source. The ZIP does not include your local saved agents, model checkpoints, or session credentials.

## Deploy the frontend to Vercel

1. In Vercel, import your GitHub repository.
2. Set **Root Directory** to `frontend`.
3. Choose the **Vite** framework preset. The included `frontend/vercel.json` specifies the build settings:

| Setting | Value |
| --- | --- |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |

4. If the backend is already hosted, add the public environment variable `VITE_API_URL`, for example `https://your-api.example.com`. Use the backend origin without `/api`. Do not add any API key to `VITE_` variables: they are bundled into public JavaScript.
5. Deploy. Vite reads the URL at build time, so redeploy after changing it. Per-tab connection settings in the model studio override the build default.
6. The homepage works as a static page. The studio and agent workspace need the Python backend even in rehearsal mode. Without one, they report an unavailable backend instead of pretending to save or run agents.

Routing uses URL fragments (`/#studio`, `/#agents`, `/#evolve`), so no catch-all rewrite is needed. Do not rewrite `/api` to `index.html`.

## Host the Python backend separately

The current backend needs a persistent filesystem for SQLite, one long-running API worker, and GPU-capable compute for live ML inference. Keep it on a Python/container host with a persistent disk (and GPU for live mode). This version is not packaged as stateless Vercel Functions.

From the project root on that host:

```bash
python -m pip install -e '.[dev]'
# Set these using the host's environment/secrets settings:
# MODELFORGE_MODE=demo
# MODELFORGE_DATA_DIR=/persistent/evolith
# MODELFORGE_API_KEY=<private shared key>
# MODELFORGE_ORIGINS=https://YOUR_PROJECT.vercel.app
python -m uvicorn modelforge.app:app --app-dir backend --host 0.0.0.0 --port 8000 --workers 1
```

The host must provide HTTPS and route its public origin to this process. For live inference, install `.[ml,dev]`, supply trained compatible adapters, and set `MODELFORGE_MODE=live`; follow [DEPLOYMENT.md](DEPLOYMENT.md). Colab notebooks support preparation and a direct live demo; temporary notebook sessions are not a durable enterprise backend.

Set `MODELFORGE_ORIGINS` to your actual Vercel production origin. Add separate preview origins explicitly when testing them. Restart the backend after changing its environment. Store `MODELFORGE_DATA_DIR` on a persistent writable disk to keep agents, blueprints, history and models across restarts.

If API-key protection is enabled, open **Model studio → Connection settings** on the deployed site, enter the HTTPS backend origin and private API key, then open **Agent workspace**. The shared connection is held in that tab's session storage. This prototype does not yet implement user accounts or team roles.

Check `https://YOUR_BACKEND/api/health`, then create a model and agent from the deployed site. Reload to verify that the backend saved the records. A CPU backend in demo mode runs the workspace, tools, and canned rehearsal; it does not provide real ML responses.

## Reference documentation

- [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Vite environment variables](https://vite.dev/guide/env-and-mode)
- [Vercel function constraints](https://vercel.com/docs/functions/limitations)
