"""Transparent lightweight rubrics. No model output is executed by the API."""
import ast
import re
from statistics import mean

SUITE = [
    {"id": "code-clamp", "skill": "coding", "name": "Clamp a value",
     "prompt": "Return only a Python function clamp(value, low, high) that clamps value between inclusive low and high. Use no imports.", "function": "clamp", "args": 3},
    {"id": "code-unique", "skill": "coding", "name": "Stable deduplication",
     "prompt": "Return only a Python function unique(items) that removes duplicates from a list of hashable items, preserving their order. Use no imports.", "function": "unique", "args": 1},
    {"id": "code-palindrome", "skill": "coding", "name": "Palindrome checker",
     "prompt": "Return only a Python function is_palindrome(text) that ignores letter case and non-alphanumeric characters. Use no imports.", "function": "is_palindrome", "args": 1},
    {"id": "write-plain", "skill": "writing", "name": "Plain language",
     "prompt": "Explain a database index to a beginner in 35 to 70 words. Include the words book and faster. Avoid the words leverage, paradigm, and synergize.", "min_words": 35, "max_words": 70, "required": ["book", "faster"], "forbidden": ["leverage", "paradigm", "synergize"]},
    {"id": "write-launch", "skill": "writing", "name": "Launch copy",
     "prompt": "Write a launch announcement for a note-taking app named Leaf in 25 to 55 words. Include Leaf and notes. Avoid revolutionary, game-changing, and ultimate.", "min_words": 25, "max_words": 55, "required": ["leaf", "notes"], "forbidden": ["revolutionary", "game-changing", "ultimate"]},
    {"id": "write-email", "skill": "writing", "name": "Clear next steps",
     "prompt": "Write a friendly email in 30 to 65 words asking a teammate to review a draft by Friday. Include draft and Friday. Avoid ASAP and urgent.", "min_words": 30, "max_words": 65, "required": ["draft", "friday"], "forbidden": ["asap", "urgent"]},
]
RUBRIC = "Coding: syntax, named function/signature, no import statements. Writing: word count, required terms, forbidden terms. These are structural/instruction-following proxies, not functional correctness or holistic writing quality."


def extract_code(text):
    match = re.search(r"```(?:python|py)?\s*\n(.*?)```", text, re.S)
    return match.group(1) if match else text.strip()


def evaluate(task, text):
    if task["skill"] == "coding":
        try:
            tree = ast.parse(extract_code(text))
            functions = [n for n in tree.body if isinstance(n, ast.FunctionDef)]
            checks = {
                "Valid Python syntax": True,
                "Requested function and signature": any(n.name == task["function"] and len(n.args.args) == task["args"] for n in functions),
                "No import statements": not any(isinstance(n, (ast.Import, ast.ImportFrom)) for n in ast.walk(tree)),
            }
        except (SyntaxError, ValueError):
            checks = {"Valid Python syntax": False, "Requested function and signature": False, "No import statements": False}
    else:
        words = re.findall(r"\b[\w'-]+\b", text.lower())
        word_set = set(words)
        checks = {
            "Within requested word count": task["min_words"] <= len(words) <= task["max_words"],
            "Includes all required terms": all(x in word_set for x in task["required"]),
            "Avoids forbidden terms": all(x not in text.lower() for x in task["forbidden"]),
        }
    return {"score": round(100 * mean(checks.values()), 1), "checks": checks}


def aggregate(rows):
    variants = list(dict.fromkeys(row["variant"] for row in rows))
    result = []
    for variant in variants:
        group = [row for row in rows if row["variant"] == variant]
        entry = {"variant": variant, "tasks": len(group)}
        for skill in ("coding", "writing"):
            scores = [r["score"] for r in group if r.get("skill") == skill and r.get("score") is not None]
            entry[skill] = round(mean(scores), 1) if scores else None
        speeds = [r["metrics"]["tokens_per_second"] for r in group if r["metrics"].get("tokens_per_second") is not None]
        entry["tokens_per_second"] = round(mean(speeds), 2) if speeds else None
        result.append(entry)
    return result
