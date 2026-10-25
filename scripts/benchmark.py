"""Run the exact API benchmark suite from a terminal and save evidence."""
import argparse
import json
import time
from pathlib import Path

import httpx

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--url", default="http://127.0.0.1:8000")
    p.add_argument("--api-key", default="")
    p.add_argument("--coding", type=float, default=0.5)
    p.add_argument("--writing", type=float, default=0.5)
    p.add_argument("--humor", type=float, default=0)
    p.add_argument("--thinking", type=float, default=0)
    p.add_argument("--output", type=Path, default=Path("artifacts/benchmark.json"))
    args = p.parse_args()
    with httpx.Client(base_url=args.url, headers={"X-API-Key": args.api_key}, timeout=600) as client:
        r = client.post("/api/merge", json={"weights": {"coding": args.coding, "humor": args.humor, "thinking": args.thinking, "writing": args.writing}})
        r.raise_for_status()
        r = client.post("/api/jobs", json={"kind": "benchmark", "recipe_id": r.json()["id"], "prompt": "benchmark",
                                             "max_new_tokens": 192, "temperature": 0, "seed": 42})
        r.raise_for_status()
        job = r.json()
        while job["status"] in {"queued", "running"}:
            print(f"{job['status']}: {job['completed']}/{job['total']}", flush=True)
            time.sleep(2)
            r = client.get(f"/api/jobs/{job['id']}")
            r.raise_for_status()
            job = r.json()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(job, indent=2))
        print(json.dumps({"status": job["status"], "summary": job["summary"], "error": job["error"]}, indent=2))
        if job["status"] != "completed":
            raise SystemExit(1)
