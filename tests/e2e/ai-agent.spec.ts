import { expect, test, type Page } from "@playwright/test";

async function openTargetedEditor(page: Page) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Try a sample resume" }).click();
  await page.getByRole("button", { name: "Create sample resume" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Avery Morgan");
  await page.goto("/targets");
  const baseResume = page.getByLabel("Base resume");
  await expect(baseResume.locator("option")).toHaveCount(2);
  const resumeValue = await baseResume
    .locator("option")
    .evaluateAll((options) => options.find((option) => option.value)?.value);
  await baseResume.selectOption(resumeValue || "");
  await page.getByLabel("Company name").fill("Example Agent Systems");
  await page.getByLabel("Role title").fill("Platform Engineer");
  await page
    .getByLabel("Job description")
    .fill("Required Qualifications\n- TypeScript\n- Kubernetes\nPreferred Qualifications\n- React");
  await page.getByRole("button", { name: "Create tailored workspace" }).click();
  await page.getByRole("button", { name: "Create target" }).click();
  await page.getByRole("link", { name: "Run local ATS in tailored resume" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Avery Morgan");
  await page.getByRole("textbox", { name: /^Summary/ }).fill("Built TypeScript services for internal teams.");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI Resume Agent" })).toBeVisible();
}

test("guided agent builds a local plan and delegates only to existing workflows", async ({ page }) => {
  const providerCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/ai/")) providerCalls.push(request.url());
  });
  await openTargetedEditor(page);
  await page.getByRole("button", { name: "Review improvement plan" }).click();
  await expect(page.getByRole("heading", { name: "Priority improvements" })).toBeVisible();
  await expect(page.getByText(/Kubernetes is not supported by current resume evidence/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Review gap" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Draft improvement" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review tailoring" })).toBeVisible();
  await expect(page.getByText("No Gemini request was made.")).toBeVisible();
  expect(providerCalls).toEqual([]);
  await page.getByRole("button", { name: "Review gap" }).first().click();
  await expect(page.getByText("Local ATS review opened. Scores remain deterministic and local.")).toBeVisible();
});

test("guided agent preserves stale-plan safety and responsive containment", async ({ page }) => {
  await openTargetedEditor(page);
  await page.getByRole("button", { name: "Review improvement plan" }).click();
  await page.getByLabel("Full name").fill("Avery Morgan Updated");
  await expect(page.getByText("Your resume or target changed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Re-run Local ATS" })).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1180, 1280, 1366, 1440, 1572, 1573, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      `width ${width}`,
    ).toBe(true);
  }
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".resume-agent-panel")).not.toBeVisible();
});
