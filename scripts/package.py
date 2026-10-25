"""Create a portable source + built frontend ZIP, without local state or secrets."""
import argparse
import hashlib
import os
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {"node_modules", ".venv", "__pycache__", ".git", ".pytest_cache", ".ruff_cache", "test-results", "playwright-report", ".vercel"}


def package(destination):
    count = 0
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        for directory, dirs, files in os.walk(ROOT, followlinks=False):
            dirs[:] = sorted(d for d in dirs if d not in SKIP and not d.endswith(".egg-info"))
            for name in sorted(files):
                path = Path(directory) / name
                relative = path.relative_to(ROOT)
                if path.resolve() == destination:
                    continue
                if path.is_symlink() or (name.startswith(".env") and name != ".env.example") or name == ".DS_Store" or name.endswith((".pyc", ".tsbuildinfo")):
                    continue
                if relative.parts[0] == "artifacts" and name != ".gitkeep":
                    continue
                archive.write(path, Path("modelforge") / relative)
                count += 1
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    destination.with_suffix(".zip.sha256").write_text(f"{digest}  {destination.name}\n")
    print(f"Packaged {count} files, {destination.stat().st_size:,} bytes: {destination}")
    print(f"SHA-256: {digest}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT.parent / "modelforge.zip")
    args = parser.parse_args()
    package(args.output.resolve())
