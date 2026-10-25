"""Optional functional checks, explicitly isolated from the API and host Python.

Requires Docker and a locally available python:3.11-slim image. Docker is an
additional isolation boundary, not a guarantee against malicious container escapes.
"""
import argparse
import json
import subprocess
import uuid
from pathlib import Path

from modelforge.benchmark import extract_code

TESTS = {
    "code-clamp": "assert clamp(5,0,3)==3\nassert clamp(-2,0,3)==0\nassert clamp(2,0,3)==2",
    "code-unique": "assert unique([1,2,1,3,2])==[1,2,3]\nassert unique([])==[]\nassert unique(['b','a','b'])==['b','a']",
    "code-palindrome": "assert is_palindrome('A man, a plan, a canal: Panama')\nassert not is_palindrome('hello')\nassert is_palindrome('')",
}


def evaluate(text, tests):
    program = extract_code(text) + "\n" + tests + "\nprint('TESTS_PASSED')"
    container_name = "modelforge-check-" + uuid.uuid4().hex
    command = ["docker", "run", "--name", container_name, "--rm", "--network=none", "--read-only", "--memory=128m", "--cpus=0.5",
               "--pids-limit=32", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--user=65534:65534",
               "--tmpfs=/tmp:rw,noexec,nosuid,size=8m", "-i", "python:3.11-slim", "python", "-I", "-"]
    try:
        result = subprocess.run(command, input=program, text=True, capture_output=True, timeout=15, check=False)
    finally:
        # Killing the Docker client alone does not necessarily stop the container.
        subprocess.run(["docker", "rm", "-f", container_name], capture_output=True, timeout=10, check=False)
    # Exit status is authoritative for ordinary failures; this is not an adversarial judge.
    return {"passed": result.returncode == 0 and "TESTS_PASSED" in result.stdout, "exit_code": result.returncode,
            "stderr": result.stderr[-2000:]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("report", type=Path)
    parser.add_argument("--output", type=Path, default=Path("artifacts/functional-checks.json"))
    args = parser.parse_args()
    report = json.loads(args.report.read_text())
    if report.get("mode") != "live":
        raise SystemExit("Refusing to score rehearsal responses as model results.")
    rows = []
    for row in report["rows"]:
        if row["task_id"] in TESTS:
            try:
                result = evaluate(row["text"], TESTS[row["task_id"]])
            except subprocess.TimeoutExpired:
                result = {"passed": False, "error": "Container timeout"}
            rows.append({"variant": row["variant"], "task_id": row["task_id"], **result})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"suite": "three tiny functional checks, not HumanEval", "rows": rows}, indent=2))
    print(json.dumps(rows, indent=2))
