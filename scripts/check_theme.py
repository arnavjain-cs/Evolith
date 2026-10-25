"""Project-local token checks. Browser axe checks remain the accessibility gate."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
css = (ROOT / "frontend/src/theme.css").read_text()
source = "\n".join(p.read_text() for p in (ROOT / "frontend/src").glob("*.ts*"))
extra_css = "\n".join(p.read_text() for p in (ROOT / "frontend/src").glob("*.css") if p.name != "theme.css")
defined = set(re.findall(r"(--[\w-]+)\s*:", css + extra_css)) | set(re.findall(r"['\"](--[\w-]+)['\"]\s*:", source))
used = set(re.findall(r"var\((--[\w-]+)", css + extra_css))
missing = sorted(used - defined)
assert not missing, f"Undefined theme references: {missing}"
styles = css[re.search(r"(?m)^\*\s*\{", css).start():] + extra_css
hardcoded = re.findall(r"#[a-fA-F0-9]{3,8}\b|\b\d+(?:px|ms)\b", styles)
assert not hardcoded, f"Literal colors/px/ms outside token layer: {hardcoded}"
assert "prefers-reduced-motion" in css
assert '[data-theme="dark"]' in css
print(f"Theme checks passed: {len(defined)} definitions, {len(used)} references, no undefined tokens or literal colors/px/ms outside token layer.")
