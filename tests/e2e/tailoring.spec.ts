import { expect, test, type Page } from "@playwright/test";
async function workspace(page: Page) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Try a sample resume" }).click();
  await page.getByRole("button", { name: "Create sample resume" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Avery Morgan");
  await page.goto("/targets");
  const resume = page.getByLabel("Base resume");
  await expect(resume.locator("option")).toHaveCount(2);
  const value = await resume.locator("option").evaluateAll((items) => items.find((item) => item.value)?.value);
  await resume.selectOption(value!);
  await page.getByLabel("Company name").fill("Synthetic Tailoring Systems");
  await page.getByLabel("Role title").fill("Platform Engineer");
  await page.getByLabel("Job description").fill("TypeScript required. React preferred. Kubernetes required.");
  await page.getByRole("button", { name: "Create tailored workspace" }).click();
  await page.getByRole("button", { name: "Create target" }).click();
  await page.getByRole("link", { name: "Run local ATS in tailored resume" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Avery Morgan");
  await page.getByRole("textbox", { name: /^Summary/ }).fill("Built TypeScript services for internal teams.");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
}
async function open(page: Page) {
  await page.getByRole("button", { name: "Tailor to Job", exact: true }).click();
  const panel = page.getByRole("region", { name: "Job-specific tailoring" });
  await expect(
    panel.getByText("Target: Platform Engineer at Synthetic Tailoring Systems", { exact: true }),
  ).toBeVisible();
  return panel;
}
test("tailoring is explicit, private before acceptance and uses normal edit/undo/stale flow", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/ai/tailor", async (route) => {
    calls++;
    const body = route.request().postDataJSON();
    const source = body.fields.find((field: { draftType: string }) => field.draftType === "SUMMARY");
    expect(Object.keys(body).sort()).toEqual(["fields", "limitedJobDescription", "targetRole"]);
    expect(JSON.stringify(body)).not.toContain("avery@example");
    await route.fulfill({
      json: {
        proposals: [
          {
            fieldId: source.id,
            currentText: source.currentText,
            proposedText: "Built TypeScript services.",
            rationale: "Removes redundant wording.",
            evidenceRefs: [source.id],
            changeKind: "concision",
          },
        ],
        gaps: [{ requirement: "Kubernetes" }],
      },
    });
  });
  await workspace(page);
  const summary = page.getByRole("textbox", { name: /^Summary/ });
  await page.getByText("ATS check", { exact: true }).click();
  await expect(page.getByText("Analysis current.", { exact: true })).toBeVisible();
  const panel = await open(page);
  expect(calls).toBe(0);
  const generate = panel.getByRole("button", { name: "Generate tailoring proposals" });
  await expect(generate).toBeDisabled();
  await panel.getByRole("checkbox", { name: /I consent to sending/ }).check();
  await generate.click();
  await expect(panel.getByRole("button", { name: /Accept proposal/ })).toBeVisible();
  await expect(summary).toHaveValue("Built TypeScript services for internal teams.");
  await expect(panel.getByRole("region", { name: "Unmet job requirements" })).toContainText("Kubernetes");
  await panel
    .getByRole("textbox", { name: /Edit proposal \d+ before accepting/ })
    .fill("Built Kubernetes services by 40%.");
  await panel.getByRole("button", { name: /Accept proposal/ }).click();
  await expect(page.getByRole("status", { name: "Editor notifications" })).toContainText("More information required");
  await panel.getByRole("button", { name: /Reject proposal/ }).click();
  await expect(summary).toHaveValue("Built TypeScript services for internal teams.");
  await expect(generate).toBeFocused();
  await generate.click();
  await panel.getByRole("button", { name: /Regenerate proposal/ }).click();
  await expect.poll(() => calls).toBe(3);
  await panel.getByRole("button", { name: /Accept proposal/ }).click();
  await expect(summary).toHaveValue("Built TypeScript services.");
  await expect(page.getByLabel("Full name")).toHaveValue("Avery Morgan");
  await expect(page.getByText("Analysis out of date.", { exact: true })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(summary).toHaveValue("Built TypeScript services for internal teams.");
  await generate.click();
  await expect(panel.getByRole("button", { name: /Accept proposal/ })).toBeVisible();
  await summary.fill("New user edit with TypeScript.");
  await expect(panel.getByRole("button", { name: /Accept proposal/ })).toBeDisabled();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await open(page);
  await expect(panel.getByRole("button", { name: /Accept proposal/ })).toHaveCount(0);
  await expect(summary).toHaveValue("New user edit with TypeScript.");
  expect(calls).toBe(4);
});
test("tailoring keyboard, response errors, print and responsive containment", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/ai/tailor", (route) => {
    calls++;
    return route.fulfill({ status: 429, json: { code: "GEMINI_RATE_LIMITED" } });
  });
  await workspace(page);
  const panel = await open(page);
  await expect(panel.getByRole("heading", { name: "Tailor to Job" })).toBeFocused();
  const consent = panel.getByRole("checkbox", { name: /I consent to sending/ });
  await consent.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status", { name: "Editor notifications" })).toContainText("Try again later");
  expect(calls).toBe(1);
  for (const width of [320, 390, 768, 1024, 1180, 1280, 1366, 1440, 1572, 1573, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(consent.locator("..")).toHaveCSS("display", "flex");
    await expect(consent.locator("..")).toHaveCSS("flex-direction", "row");
    await expect(consent).toHaveCSS("width", "18px");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      `${width}px`,
    ).toBe(true);
  }
  await page.emulateMedia({ media: "print" });
  await expect(panel).not.toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await consent.focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Tailor to Job", exact: true })).toBeFocused();
});
