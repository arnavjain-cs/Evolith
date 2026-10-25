# Three-minute judging walkthrough

**Before judges arrive:** save adapters to Drive, copy them into the active GPU runtime, warm the base, and run your selected example. Keep a clearly labeled rehearsal installation available. Do not begin a 24-generation benchmark unless there is time to finish it.

1. **Foundation (20 seconds).** “We reuse one open-weight foundation model. We fine-tune small coding and writing adapters ahead of time, rather than train a foundation from scratch.” Show the base ID and live badge.
2. **Compose (30 seconds).** Ask a judge to move the sliders. “These coefficients scale learned weight updates, not a promised percentage of a skill.” Forge the adapter. Show actual rank and merge timing.
3. **Generate (45 seconds).** Use a real prompt you rehearsed, then let the judge modify it. The live inference path uses the same system prompt for every variant. Show output, actual token count, and generation time.
4. **Compare (45 seconds).** Run the base, coding specialist, writing specialist, and blend on the same prompt. Discuss observable differences, including regressions. Do not describe canned rehearsal differences as learned behavior.
5. **Evidence (25 seconds).** Open a completed live benchmark report. Explain that syntax/signature checks and word-count compliance are lightweight proxies. Show the raw outputs and checks behind the chart.
6. **Takeaway (15 seconds).** Export the actual adapter ZIP and recipe. “We can reproduce this combination without repeating the fine-tuning. The experiment tells us whether it is useful.”

If the GPU session fails: switch to the app's explicit demo configuration, point out the rehearsal notice, and demonstrate the interaction flow. Explain that its hand-written outputs are not benchmark evidence. Keep previously exported real reports labeled with their original runtime and date.
