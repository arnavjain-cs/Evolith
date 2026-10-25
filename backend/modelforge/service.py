import threading
import uuid
from concurrent.futures import ThreadPoolExecutor

from .benchmark import RUBRIC, SUITE, aggregate, evaluate
from .engine import Engine
from .merge import Merger
from .schemas import GenerateRequest
from .store import Store, now

VARIANTS = [("Base model", {"coding": 0, "writing": 0}), ("Coding specialist", {"coding": 1, "writing": 0}),
            ("Writing specialist", {"coding": 0, "writing": 1}), ("Your blend", None)]


def comparison_variants(recipe):
    variants = list(VARIANTS[:2])
    for skill in ("humor", "thinking"):
        if recipe["weights"].get(skill, 0) > 0:
            variants.append((f"{skill.title()} specialist", {"coding": 0, "writing": 0, skill: 1}))
    return variants + VARIANTS[2:]


class Service:
    def __init__(self, settings):
        self.settings = settings
        self.store = Store(settings.data_dir / "modelforge.sqlite")
        self.merger = Merger(settings, self.store)
        self.engine = Engine(settings, self.merger)
        self.pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="modelforge")
        self.guard = threading.Lock()
        self.cancel_events = {}

    def recipe(self, recipe_id):
        recipe = self.store.get("recipe", recipe_id)
        if not recipe:
            raise KeyError("Recipe not found. Forge a model first.")
        if recipe["mode"] != self.settings.mode:
            raise ValueError("Recipe belongs to a different runtime mode. Forge it again.")
        if recipe["base_model"] != self.settings.base_model:
            raise ValueError("Recipe belongs to a different base model. Forge it again.")
        return recipe

    def generate(self, request):
        recipe = self.recipe(request.recipe_id)
        result = {"id": uuid.uuid4().hex, "created_at": now(), "recipe_id": recipe["id"],
                  "prompt": request.prompt, "settings": request.model_dump(exclude={"prompt", "recipe_id"}),
                  "model": {"base_model": recipe["base_model"], "revision": recipe["revision"],
                            "source_sha256": recipe["sources"], "weights": recipe["weights"], "method": recipe["method"]},
                  **self.engine.generate(recipe, request)}
        return self.store.put("run", result)

    def submit(self, request):
        selected = self.recipe(request.recipe_id)
        with self.guard:
            if len(self.cancel_events) >= 3:
                raise RuntimeError("Queue is full. Wait for a job to finish.")
            job_id = uuid.uuid4().hex
            event = threading.Event()
            self.cancel_events[job_id] = event
            total = len(comparison_variants(selected)) * (len(SUITE) if request.kind == "benchmark" else 1)
            job = {"id": job_id, "created_at": now(), "kind": request.kind, "status": "queued", "completed": 0,
                   "total": total, "mode": self.settings.mode, "recipe_id": request.recipe_id,
                   "rows": [], "summary": [], "rubric": RUBRIC if request.kind == "benchmark" else None,
                   "request": request.model_dump(), "error": None}
            self.store.put("job", job)
            self.pool.submit(self._run, job, request, event)
            return job

    def cancel(self, job_id):
        with self.guard:
            event = self.cancel_events.get(job_id)
            if event:
                event.set()
        return {"cancel_requested": event is not None, "message": "Cancellation takes effect after the current generation."}

    def _run(self, job, request, event):
        try:
            job["status"] = "running"
            self.store.put("job", job)
            selected = self.recipe(request.recipe_id)
            for variant, weights in comparison_variants(selected):
                recipe = self.merger.create(weights) if weights is not None else selected
                tasks = SUITE if request.kind == "benchmark" else [{"id": "custom", "name": "Your prompt", "prompt": request.prompt}]
                for task in tasks:
                    if event.is_set():
                        job["status"] = "cancelled"
                        return
                    generation = GenerateRequest(**{**request.model_dump(exclude={"kind"}), "recipe_id": recipe["id"], "prompt": task["prompt"]})
                    result = self.generate(generation)
                    score = evaluate(task, result["text"]) if request.kind == "benchmark" and self.settings.mode == "live" else {"score": None, "checks": {}}
                    job["rows"].append({**result, **score, "variant": variant, "task_id": task["id"],
                                        "task_name": task["name"], "skill": task.get("skill"), "weights": recipe["weights"]})
                    job["completed"] += 1
                    job["summary"] = aggregate(job["rows"])
                    self.store.put("job", job)
            job["status"] = "completed"
        except Exception as exc:
            job.update(status="failed", error=str(exc))
        finally:
            job["finished_at"] = now()
            self.store.put("job", job)
            with self.guard:
                self.cancel_events.pop(job["id"], None)

    def close(self):
        with self.guard:
            for event in self.cancel_events.values():
                event.set()
        self.pool.shutdown(wait=True, cancel_futures=True)
