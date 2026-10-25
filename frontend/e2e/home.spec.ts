import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function scrollToProgress(
  page: import("@playwright/test").Page,
  progress: number,
) {
  await page.evaluate((p) => {
    const story = document.querySelector<HTMLElement>(".scroll-story")!;
    window.scrollTo({
      top: p * (story.offsetHeight - innerHeight),
      behavior: "instant",
    });
  }, progress);
  await expect
    .poll(() =>
      page
        .locator(".scroll-story")
        .evaluate((element) =>
          Number(
            (element as HTMLElement).style.getPropertyValue("--story-progress"),
          ),
        ),
    )
    .toBeCloseTo(progress, 2);
}

test("scroll explodes, rotates and recombines the core reversibly", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "by your design.",
  );
  const original = await page
    .locator(".scroll-story .slab-5")
    .evaluate((element) => getComputedStyle(element).transform);
  await scrollToProgress(page, 0.48);
  await expect
    .poll(() =>
      page
        .locator(".scroll-story")
        .evaluate((element) =>
          Number((element as HTMLElement).style.getPropertyValue("--explode")),
        ),
    )
    .toBeGreaterThan(0.98);
  const expanded = await page
    .locator(".scroll-story .slab-5")
    .evaluate((element) => getComputedStyle(element).transform);
  expect(expanded).not.toBe(original);
  await page.screenshot({ path: "test-results/home-expanded.png" });
  await scrollToProgress(page, 0.85);
  await expect
    .poll(() =>
      page
        .locator(".scroll-story")
        .evaluate((element) =>
          Number((element as HTMLElement).style.getPropertyValue("--explode")),
        ),
    )
    .toBeLessThan(0.02);
  await scrollToProgress(page, 0);
  await expect
    .poll(() =>
      page
        .locator(".scroll-story")
        .evaluate((element) =>
          Number(
            (element as HTMLElement).style.getPropertyValue("--hero-opacity"),
          ),
        ),
    )
    .toBeGreaterThan(0.99);
  await page.screenshot({ path: "test-results/home-desktop.png" });
});

test("home blend opens the working studio and the brand returns home", async ({
  page,
}) => {
  await page.goto("/#your-blend");
  const slider = page.getByRole("slider", { name: "Coding", exact: true });
  await slider.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveValue("50");
  await page.getByRole("button", { name: "Try this combination" }).click();
  await expect(page).toHaveURL(/#studio$/);
  await expect(page.locator("#coding-slider")).toHaveValue("50");
  await expect(page.locator("#writing-slider")).toHaveValue("20");
  await page
    .getByRole("link", { name: "Evolith home", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "by your design.",
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("neural blend animates signals, responds to weights and respects reduced motion", async ({
  page,
}) => {
  await page.goto("/#your-blend");
  const network = page.locator(".neural-blend");
  await expect(network).toHaveAttribute("data-animating", "true");
  await expect(network.locator(".nn-neuron")).toHaveCount(22);
  await expect(network.locator("animateMotion")).toHaveCount(8);
  await expect(page.locator(".blend-visual .forge-core")).toHaveCount(0);
  await expect(page.locator(".scroll-story .forge-core")).toHaveCount(1);
  const x = await network
    .locator(".nn-signal circle")
    .first()
    .evaluate((e) => (e as SVGCircleElement).getCTM()!.e);
  await page.waitForFunction(
    (x) =>
      Math.abs(
        (
          document.querySelector(".nn-signal circle") as SVGCircleElement
        ).getCTM()!.e - x,
      ) > 0.5,
    x,
  );
  const slider = page.getByRole("slider", { name: "Coding", exact: true });
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(network).toHaveAttribute("data-coding", "0");
  await expect(network.locator(".nn-signal.nn-coding").first()).toHaveAttribute(
    "opacity",
    "0",
  );
  await page.keyboard.press("End");
  await expect(network).toHaveAttribute("data-coding", "100");
  await expect(page.getByRole("slider", { name: "Writing", exact: true })).toHaveValue("20");
  await expect(page.getByRole("slider", { name: "Humor", exact: true })).toHaveValue("10");
  await expect(page.getByRole("slider", { name: "Thinking", exact: true })).toHaveValue("25");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(network.locator("animateMotion")).toHaveCount(0);
  await expect(network.locator(".nn-neuron")).toHaveCount(22);
});

test("reduced-motion home is accessible in light, dark and mobile layouts", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".story-sticky")).toHaveCSS("position", "relative");
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole("button", { name: "Switch to dark appearance" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({ path: "test-results/home-reduced-motion.png" });
});

test("mobile animation fits the page and stays responsive", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto("/");
  await scrollToProgress(page, 0.48);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const chapter = await page.locator(".chapter-two").boundingBox();
  expect(chapter!.y).toBeGreaterThan(80);
  await page.screenshot({ path: "test-results/home-mobile-expanded.png" });
  await page
    .getByRole("link", { name: "Enter the studio", exact: true })
    .first()
    .click();
  await expect(page.locator("#coding-slider")).toBeVisible();
});
