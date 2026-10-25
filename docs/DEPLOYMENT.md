# Deployment and Colab

## Recommended hackathon workflow

1. Before the event, run `01_train_specialists.ipynb` on a Colab GPU. Save both adapters and full resume checkpoints to Drive. Both share the base revision file.
2. Download a copy of the adapters. Keep a local project ZIP and a rehearsal installation ready.
3. Before judging, open `02_live_lab.ipynb`, mount Drive, copy the small adapter files to runtime-local storage, and warm the base checkpoint once.
4. Use the direct notebook widgets for a tunnel-free interactive demo, or use a dedicated GPU backend for the polished React studio.
5. Rehearse the same prompt and benchmark on that actual hardware. Record real results and show rehearsal mode honestly if the GPU session is unavailable.

Colab Pro may provide more compute availability, but does not guarantee a specific GPU or session duration. Do not promise fixed training time or a millisecond end-to-end demo. Tensor merging is much smaller than fine-tuning, but cold downloads, loading and generation can dominate the experience. The notebook includes elapsed timing so you can measure rather than assume.

## Direct Colab widget

The live notebook uses the same `Service`, `Merger`, and `Engine` as the backend. Its sliders perform real concatenation and inference in the active notebook. This avoids public web serving and does not expose an API key. Read Colab's current terms before using runtimes for public web-service workloads.

## Polished frontend with a remote GPU

Use a Linux GPU VM or managed GPU service that supports an interactive Python web server. Install an appropriate CUDA-enabled PyTorch build for that machine, then the project ML extras. Place the trained adapters under `artifacts/adapters` or configure absolute paths.

```bash
python -m pip install -e '.[ml,dev]'
export MODELFORGE_MODE=live
export MODELFORGE_API_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
export MODELFORGE_ORIGINS=https://your-frontend.example.com,http://localhost:8000
python -m uvicorn modelforge.app:app --host 0.0.0.0 --port 8000 --workers 1
```

Terminate HTTPS at your host/reverse proxy. In **Connection settings** enter the HTTPS backend URL and API key. Never place the key in a URL, commit it, or embed it in the frontend bundle. The frontend keeps it in the current tab's session storage. CORS is an allowlist, not authentication. Health is public; other API routes require the configured key. Docs are public API descriptions and contain no key.

Serve the built frontend and backend from the same host whenever possible. A local frontend can connect to an HTTPS remote backend if its origin is allowed. An HTTPS frontend cannot call an insecure HTTP remote endpoint in most browsers.

The small 0.5B default avoids quantization dependencies and favors a manageable GPU memory footprint. Live CUDA uses float16; CPU uses float32. For larger models, reduce sequence/output lengths or choose more memory. This implementation does not use automatic CPU offload, multi-GPU sharding, or 4-bit quantization.

## Docker rehearsal

```bash
docker compose up --build
```

Open http://localhost:8000. The volume retains history. The Dockerfile serves the actual compiled frontend and uses a non-root user. Docker execution was not assumed available during delivery; see the verification report.

## Docker on a GPU machine

```bash
docker build --build-arg INSTALL_ML=1 -t modelforge:gpu .
docker run --rm --gpus all -p 127.0.0.1:8000:8000 \
  --env-file .env -e MODELFORGE_MODE=live \
  -v "$PWD/artifacts:/data" modelforge:gpu
```

Requires NVIDIA drivers, NVIDIA Container Toolkit, and a CUDA-capable PyTorch wheel compatible with the host. The generic Python image is intentionally simple; confirm `torch.cuda.is_available()` in your image before presenting. Make the mounted directory writable by container UID 10001. Do not increase Uvicorn workers: every worker would load a separate base model and job queue.

## Static frontend hosting

`cd frontend && npm ci && npm run build` produces `frontend/dist`. Deploy that directory to a static host, then connect to your HTTPS GPU API in settings. The API remains necessary even in demo mode. Hosting a UI alone does not run Python or merge adapters.

## Troubleshooting

| Symptom | Action |
|---|---|
| Backend unavailable | Start Uvicorn; test `/api/health`; check backend URL and CORS origin. |
| 401 | Enter the current backend API key in Connection settings. |
| Missing adapter | Run both training steps or copy the two adapter directories to configured paths. |
| Incompatible revision | Retrain from one shared revision. Do not edit metadata to disguise different checkpoints. |
| Unsupported BF16 safetensors | Save the adapter's parameters as float32, as the supplied training script does. |
| CUDA out of memory | Stop other GPU workloads; lower output length/batch/sequence length; restart after changing the model. |
| Slow first request | Warm the checkpoint before judging. Initial downloads and model loading are separate from generation timing. |
| Sliders seem ineffective | Adapter deltas may be too weak or tasks too similar. Improve data, train sufficiently, and compare held-out behavior. Do not fabricate improvements. |
| Job interrupted | A server restart stops in-flight jobs. Submit again; completed rows remain in history. |
| Port 8000 busy | Stop the existing server, or set `PORT` for the run script and adjust the frontend backend URL. |
| Python binary/package problems | Use a fresh Python 3.11/3.12 environment and reinstall from the lock snapshot or project extras. |
