from modelforge.benchmark import SUITE, evaluate, extract_code
from modelforge.store import Store


def test_structural_rubric_does_not_claim_correctness():
    # A semantically wrong function can pass this structural proxy. Keep this limitation explicit.
    assert evaluate(SUITE[0], "def clamp(value, low, high):\n    return None")["score"] == 100
    assert evaluate(SUITE[0], "not python at all!")["score"] == 0
    assert not evaluate(SUITE[0], "import os\ndef clamp(value, low, high): return 0")["checks"]["No import statements"]


def test_writing_rules_and_code_extraction():
    result = evaluate(SUITE[3], "A book can make lookup faster. " * 7)
    assert result["score"] == 100
    assert not evaluate(SUITE[3], "A book helps you leverage faster lookup.")["checks"]["Avoids forbidden terms"]
    assert extract_code("Example:\n```python\ndef x(): pass\n```") == "def x(): pass\n"


def test_restart_marks_inflight_jobs_interrupted(tmp_path):
    path = tmp_path / "state.db"
    Store(path).put("job", {"id": "test", "status": "running"})
    assert Store(path).get("job", "test")["status"] == "interrupted"
