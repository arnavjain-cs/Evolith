"""Generate original starter examples; no external dataset download or license ambiguity.

These tiny synthetic datasets demonstrate the pipeline, not strong specialization.
Held-out benchmark prompts are separate from these templates.
"""
import argparse
import hashlib
import json
import random
from pathlib import Path


def messages(prompt, answer):
    return {"messages": [{"role": "user", "content": prompt}, {"role": "assistant", "content": answer}]}


def build():
    coding, humor, thinking, writing = [], [], [], []
    for factor in range(2, 32):
        coding.append(messages(f"Write a Python function multiply_by_{factor}(numbers) that multiplies every input number by {factor}. Include a short complexity note.",
                               f"```python\ndef multiply_by_{factor}(numbers):\n    return [number * {factor} for number in numbers]\n```\n\nTime: O(n). Extra space: O(n). An empty list returns an empty list."))
        coding.append(messages(f"Write a Python function divisible_by_{factor}(numbers) that keeps only integers divisible by {factor}. Include an example.",
                               f"```python\ndef divisible_by_{factor}(numbers):\n    return [number for number in numbers if number % {factor} == 0]\n```\n\nExample: divisible_by_{factor}([{factor}, {factor + 1}, {factor * 2}]) returns [{factor}, {factor * 2}]. Time: O(n)."))
        coding.append(messages(f"Write a Python function sum_above_{factor}(numbers) that sums values strictly greater than {factor}.",
                               f"```python\ndef sum_above_{factor}(numbers):\n    return sum(number for number in numbers if number > {factor})\n```\n\nThe strict comparison excludes {factor}. Empty input returns 0. Time: O(n), auxiliary space: O(1)."))
    concepts = [
        ("a cache", "a small shelf beside your desk", "keeps frequently used information close by so you can retrieve it quickly"),
        ("version control", "a notebook that remembers every revision", "records changes so a team can compare ideas and restore an earlier version"),
        ("an API", "a menu at a restaurant", "lists the requests a program accepts and the information it returns"),
        ("encryption", "a locked envelope", "protects information so only someone with the right key can read it"),
        ("a queue", "a line at a café", "handles items in the order they arrive"),
        ("a backup", "a spare key kept somewhere safe", "gives you another copy to use when the original is lost"),
        ("a software test", "a rehearsal before a performance", "checks expected behavior before people depend on it"),
        ("a variable", "a labeled box", "gives a name to a value so a program can use it later"),
        ("a loop", "a repeating practice routine", "repeats a set of instructions for each item or until a condition changes"),
        ("a neural network", "a team of adjustable filters", "learns patterns by changing how signals pass between its parts"),
    ]
    for concept, analogy, purpose in concepts:
        for audience in ("a curious beginner", "a new teammate", "a student"):
            writing.append(messages(f"Explain {concept} to {audience} using a concrete analogy. Be concise and avoid hype.",
                                    f"Think of {concept} as {analogy}. It {purpose}. The analogy gives you a starting point; the details depend on how the system is built. Start with a small example, then explore what happens when the input changes."))
    for activity in ("design review", "team workshop", "planning session", "product walkthrough", "project retrospective",
                     "research discussion", "pairing session", "writing workshop", "community meetup", "practice demo"):
        for day in ("Tuesday", "Wednesday", "Thursday"):
            writing.append(messages(f"Write a warm invitation to a {activity} on {day}. Ask attendees to bring one question. Keep it clear and brief.",
                                    f"Join us for a {activity} on {day}. We’ll share what we’re working on, explore a few ideas, and leave room for discussion. Bring one question you’d like the group to think about. Looking forward to hearing your perspective."))
            writing.append(messages(f"Write a friendly follow-up after a {activity}. Thank the team and ask them to add comments by {day}.",
                                    f"Thanks for making time for the {activity}. Your feedback helped clarify our next steps. Please add any remaining comments to the shared document by {day}. I’ll gather the suggestions and send an updated version afterward. Let me know if you need more time."))
    # Original, deliberately small starter corpora. These demonstrate training,
    # not proven humor quality or general reasoning improvements.
    for subject, setup, punchline in [
        ("a cache", "My cache has a great memory", "until it decides the past has expired"),
        ("a queue", "My task queue is extremely polite", "it lets every new problem stand in line"),
        ("a backup", "I made a backup of my backup", "now my safety net has a safety net"),
        ("a variable", "I called my variable final", "it has changed three times since lunch"),
        ("a meeting", "Our meeting had a clear agenda", "finding the agenda"),
        ("a test", "My tests all passed", "then a user tried the app"),
        ("a deadline", "I like deadlines", "they make such a dramatic entrance"),
        ("a model", "I asked the model for a short answer", "it began with a brief history of brevity"),
        ("a notebook", "My notebook is perfectly organized", "in a system only yesterday-me understands"),
        ("a build", "The build finally turned green", "even the terminal needed a moment to celebrate"),
    ]:
        for tone in ("gentle", "dry", "playful"):
            humor.append(messages(f"Write a short, {tone} joke about {subject}. Keep it friendly and avoid targeting people.",
                                  f"{setup}—{punchline}."))
    for count in range(3, 23):
        thinking.append(messages(f"A team has {count} tasks and completes 2 per hour. Estimate the minimum hours and explain your assumptions briefly.",
                                 f"At a constant rate with no interruptions, the team needs {count / 2:g} hours. If work is scheduled only in whole-hour blocks, allow {(count + 1) // 2} blocks. Check whether setup time and dependencies change that estimate."))
        thinking.append(messages(f"Plan a small project with {count} tasks. Give a concise approach that checks assumptions and dependencies.",
                                 f"1. Define the result and acceptance checks.\n2. List the {count} tasks and mark dependencies.\n3. Prioritize the smallest complete user flow.\n4. Test edge cases before expanding scope.\n5. Revisit the plan when evidence changes.\nValidate estimates with a small trial; a plan is an assumption, not a guarantee."))
    return {"coding": coding, "humor": humor, "thinking": thinking, "writing": writing}


def prepare(output, seed=42):
    output.mkdir(parents=True, exist_ok=True)
    manifest = {"license": "CC0-1.0", "source": "Original deterministic templates in training/prepare_data.py",
                "warning": "Pipeline starter data, not a validated specialist training corpus.", "seed": seed, "files": {}}
    for skill, rows in build().items():
        random.Random(seed).shuffle(rows)
        split = max(1, len(rows) // 10)
        for name, records in (("validation", rows[:split]), ("train", rows[split:])):
            data = "".join(json.dumps(row) + "\n" for row in records)
            filename = f"{skill}_{name}.jsonl"
            (output / filename).write_text(data)
            manifest["files"][filename] = {"examples": len(records), "sha256": hashlib.sha256(data.encode()).hexdigest()}
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("data"))
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    print(json.dumps(prepare(args.output, args.seed), indent=2))
