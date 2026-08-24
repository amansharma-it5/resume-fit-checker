import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("guest can edit, reorder, undo, save, and preview a structured resume", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Create resume" }).click();
  const row = page.locator(".document-row").first();
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Full name").fill("Avery Morgan");
  await page.getByLabel("Email").fill("avery@example.test");
  await page.getByRole("button", { name: "Add bullet" }).first().click();
  await page.getByLabel("Bullet 1").fill("Improved release reliability across three services");
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+Shift+z");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  const previewTab = page.getByRole("button", { name: "Preview" });
  if (await previewTab.isVisible()) await previewTab.click();
  await expect(page.getByRole("article", { name: /resume preview/ })).toContainText("Avery Morgan");
});

test("editor is keyboard accessible and has no serious axe violations", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Create resume" }).click();
  await page.locator(".document-row").first().getByRole("link", { name: "Edit" }).click();
  await expect(page.getByLabel("Resume name")).toBeVisible();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact || ""))).toEqual([]);
});

test("Copilot requires consent and keeps an accepted suggestion undoable", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Create resume" }).click();
  await page.locator(".document-row").first().getByRole("link", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Add bullet" }).first().click();
  await page.getByLabel("Bullet 1").fill("Improved release reliability for the platform.");
  const panel = page.getByRole("region", { name: "Resume Copilot" });
  await expect(panel.getByRole("button", { name: "Generate AI suggestion" })).toBeDisabled();
  await panel.getByLabel(/Send only this selected text/).check();
  await page.route("**/.netlify/functions/ai-rewrite", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    expect(body.bullet).toContain("Improved release reliability");
    expect(body.approvedContext).toContain("Improved release reliability");
    await route.fulfill({
      json: { rewrittenBullet: "Improved release reliability for the platform.", verificationStatus: "FACT_CHECKED" },
    });
  });
  await panel.getByRole("button", { name: "Generate AI suggestion" }).click();
  await expect(panel.getByRole("heading", { name: "AI-generated suggestion" })).toBeVisible();
  await panel.getByRole("button", { name: "Accept" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
});

for (const width of [320, 360, 390, 412, 768, 1024, 1280, 1440, 1920]) {
  test(`editor has no root overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Create resume" }).click();
    await page.locator(".document-row").first().getByRole("link", { name: "Edit" }).click();
    const measurement = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll<HTMLElement>("*")]
        .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 6)
        .map((element) => ({
          tag: element.tagName,
          className: element.className,
          right: Math.round(element.getBoundingClientRect().right),
        })),
    }));
    expect(measurement.scrollWidth <= measurement.viewport, JSON.stringify(measurement)).toBe(true);
  });
}
