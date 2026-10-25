import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def now():
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self, path: Path):
        self.path = path
        with self.connection() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT, created TEXT, payload TEXT, PRIMARY KEY(kind,id))")
            # In-flight requests cannot survive a process restart. Preserve evidence, mark interrupted.
            for row in db.execute("SELECT id,payload FROM records WHERE kind='job'").fetchall():
                item = json.loads(row[1])
                if item["status"] in {"queued", "running"}:
                    item.update(status="interrupted", error="Server restarted. Submit this job again.")
                    db.execute("UPDATE records SET payload=? WHERE kind='job' AND id=?", (json.dumps(item), row[0]))

    def connection(self):
        return sqlite3.connect(self.path, timeout=30)

    def put(self, kind: str, item: dict):
        with self.connection() as db:
            db.execute("INSERT INTO records VALUES (?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload",
                       (kind, item["id"], item.get("created_at", now()), json.dumps(item, allow_nan=False)))
        return item

    def get(self, kind: str, item_id: str):
        with self.connection() as db:
            row = db.execute("SELECT payload FROM records WHERE kind=? AND id=?", (kind, item_id)).fetchone()
        return json.loads(row[0]) if row else None

    def list(self, kind: str, limit: int = 30):
        with self.connection() as db:
            rows = db.execute("SELECT payload FROM records WHERE kind=? ORDER BY created DESC LIMIT ?", (kind, limit)).fetchall()
        return [json.loads(row[0]) for row in rows]
