import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.goto("/#studio");
  await expect(page.getByText("Rehearsal mode", { exact: true })).toBeVisible();
});

test("forge, generate, compare, benchmark, restore and export a recipe", async ({
  page,
}) => {
  await page.getByRole("button", { name: "The builder", exact: true }).click();
  await expect(page.getByLabel("Coding", { exact: false }).first()).toHaveValue(
    "80",
  );
  await page.getByRole("button", { name: "Forge rehearsal recipe" }).click();
  await expect(
    page.getByText("Recipe ready · no tensors merged"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Adapter ZIP" }),
  ).toBeDisabled();
  const file = page.waitForEvent("download");
  await page.getByRole("button", { name: "Recipe", exact: true }).click();
  expect((await file).suggestedFilename()).toMatch(/evolith-.*\.json/);
  await page.getByRole("button", { name: "Preview response" }).click();
  await expect(page.getByText("CANNED REHEARSAL OUTPUT")).toBeVisible();
  await expect(page.locator("pre").first()).toContainText("def normalize");
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your blend", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Benchmarks", exact: true }).click();
  await page.getByRole("button", { name: "Run benchmark" }).click();
  await expect(page.getByText("24 / 24 · completed")).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("cell", { name: "—", exact: true })).toHaveCount(
    12,
  );
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole("button", { name: "Activity log", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Every recipe has a story." }),
  ).toBeVisible();
});

test("keyboard sliders, dark mode, dialog and mobile stay accessible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const slider = page.locator("#coding-slider");
  await slider.focus();
  const previous = Number(await slider.inputValue());
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveValue(String(previous + 1));
  await page.getByRole("button", { name: "Connection settings" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Connection settings" }),
  ).toBeFocused();
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole("button", { name: "Dark appearance" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "The storyteller", exact: true }),
  ).toHaveCSS("background-color", "rgb(32, 41, 35)");
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({
    path: "test-results/mobile-dark.png",
    fullPage: true,
  });
});

test("desktop visual and explicit backend failure", async ({ page }) => {
  await page.screenshot({
    path: "test-results/studio-desktop.png",
    fullPage: true,
  });
  await page.route("**/api/generate", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        detail: "GPU unavailable. No demo fallback was used.",
      }),
    }),
  );
  await page.getByRole("button", { name: "Preview response" }).click();
  await expect(page.getByRole("alert")).toContainText("GPU unavailable");
});

test("four-skill preset persists into six-way comparison and benchmark", async ({ page }) => {
  await page.getByRole("button", { name: "The inventor", exact: true }).click();
  for (const [id, value] of Object.entries({ coding: "40", humor: "15", thinking: "30", writing: "15" })) {
    await expect(page.locator(`#${id}-slider`)).toHaveValue(value);
  }
  await page.getByRole("button", { name: "Forge rehearsal recipe" }).click();
  await expect(page.getByText("Recipe ready · no tensors merged")).toBeVisible();
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.getByText("6 / 6 · completed")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Humor specialist", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thinking specialist", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Benchmarks", exact: true }).click();
  await page.getByRole("button", { name: "Run benchmark" }).click();
  await expect(page.getByText("36 / 36 · completed")).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(7);
});

test("live status refresh preserves the newly forged recipe", async ({ page }) => {
  // Only backend metadata is simulated here; this checks UI state synchronization.
  await page.route("**/api/status", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ json: { ...await response.json(), mode: "live", available_skills: ["coding", "humor", "thinking", "writing"] } });
  });
  await page.route("**/api/merge", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ json: { ...await response.json(), mode: "live", rank: 11, artifact_available: true, method: "exact_concatenation" } });
  });
  await page.reload();
  await page.getByRole("button", { name: "The inventor", exact: true }).click();
  await page.getByRole("button", { name: "Forge model", exact: true }).click();
  await expect(page.getByRole("button", { name: "Adapter ZIP", exact: true })).toBeEnabled();
  await expect(page.locator("#humor-slider")).toHaveValue("15");
  await expect(page.locator("#thinking-slider")).toHaveValue("30");
});
