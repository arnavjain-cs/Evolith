import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(os.getenv("MODELFORGE_PROJECT_ROOT", str(Path(__file__).resolve().parents[2])))
load_dotenv(ROOT / ".env")


@dataclass
class Settings:
    mode: str = field(default_factory=lambda: os.getenv("MODELFORGE_MODE", "demo"))
    data_dir: Path = field(default_factory=lambda: Path(os.getenv("MODELFORGE_DATA_DIR", str(ROOT / "artifacts"))))
    base_model: str = field(default_factory=lambda: os.getenv("MODELFORGE_BASE_MODEL", "Qwen/Qwen2.5-0.5B-Instruct"))
    base_revision: str | None = field(default_factory=lambda: os.getenv("MODELFORGE_BASE_REVISION") or None)
    device: str = field(default_factory=lambda: os.getenv("MODELFORGE_DEVICE", "auto"))
    api_key: str = field(default_factory=lambda: os.getenv("MODELFORGE_API_KEY", ""))
    origins: list[str] = field(default_factory=lambda: os.getenv(
        "MODELFORGE_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(","))
    coding_path: Path | None = None
    writing_path: Path | None = None
    humor_path: Path | None = None
    thinking_path: Path | None = None

    def __post_init__(self):
        if self.mode not in {"demo", "live"}:
            raise ValueError("MODELFORGE_MODE must be demo or live")
        self.data_dir = self.data_dir.resolve()
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.coding_path = Path(self.coding_path or os.getenv(
            "MODELFORGE_CODING_ADAPTER", str(self.data_dir / "adapters/coding")
        )).resolve()
        self.writing_path = Path(self.writing_path or os.getenv(
            "MODELFORGE_WRITING_ADAPTER", str(self.data_dir / "adapters/writing")
        )).resolve()
        for skill in ("humor", "thinking"):
            path = getattr(self, f"{skill}_path") or os.getenv(
                f"MODELFORGE_{skill.upper()}_ADAPTER", str(self.data_dir / f"adapters/{skill}")
            )
            setattr(self, f"{skill}_path", Path(path).resolve())

    @property
    def adapter_paths(self):
        paths = {"coding": self.coding_path, "writing": self.writing_path}
        # Existing two-adapter installations continue to work. Extra skills become
        # available only when their actual adapter directories have been supplied.
        for skill in ("humor", "thinking"):
            path = getattr(self, f"{skill}_path")
            if path.is_dir():
                paths[skill] = path
        return paths
