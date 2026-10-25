import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROME ? { channel: "chrome" } : {},
);
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await client.send("Network.enable");
  await client.send("Network.setCacheDisabled", { cacheDisabled: true });
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 200000,
    uploadThroughput: 93750,
  });
  await page.addInitScript(() => {
    window.__forgeLab = { lcp: null, cls: 0, interactions: [] };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        window.__forgeLab.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (!entry.hadRecentInput) window.__forgeLab.cls += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (entry.interactionId)
          window.__forgeLab.interactions.push(entry.duration);
    }).observe({ type: "event", durationThreshold: 16, buffered: true });
  });
  await page.goto(
    process.env.MODELFORGE_PREVIEW_URL || "http://127.0.0.1:8000",
    { waitUntil: "networkidle" },
  );
  const load = await page.evaluate(() => ({
    lcp_ms: window.__forgeLab.lcp,
    cls: window.__forgeLab.cls,
  }));
  const frames = await page.evaluate(async () => {
    const story = document.querySelector(".scroll-story");
    const times = [];
    let previous = performance.now();
    for (let i = 0; i < 60; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const now = performance.now();
      times.push(now - previous);
      previous = now;
      window.scrollTo({
        top: (i / 60) * 0.65 * (story.offsetHeight - innerHeight),
        behavior: "instant",
      });
    }
    return times.slice(2).sort((a, b) => a - b);
  });
  await page.locator("#home-coding").focus();
  await page.keyboard.press("ArrowRight");
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const interaction = await page.evaluate(() =>
    window.__forgeLab.interactions.length
      ? Math.max(...window.__forgeLab.interactions)
      : null,
  );
  const report = {
    scope:
      "Local lab sample, not field Core Web Vitals or a Lighthouse score. Interaction sample is one slider keypress, not a full INP measurement.",
    viewport: "390 × 844",
    cpu_slowdown: 4,
    network: "150 ms latency, 1.6 Mbps download, cold browser cache",
    ...load,
    worst_sampled_interaction_ms: interaction,
    scroll_frame_p50_ms: Number(
      frames[Math.floor(frames.length * 0.5)].toFixed(2),
    ),
    scroll_frame_p95_ms: Number(
      frames[Math.floor(frames.length * 0.95)].toFixed(2),
    ),
    browser: browser.version(),
  };
  const output =
    process.env.MODELFORGE_PERF_OUTPUT || "test-results/home-performance.json";
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
