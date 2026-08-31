import { expect, test } from "@playwright/test";

async function createTargetFromSample(page: import("@playwright/test").Page) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Try a sample resume" }).click();
  await page.getByRole("button", { name: "Create sample resume" }).click();
  await page.goto("/targets");
  const baseResume = page.getByLabel("Base resume");
  await expect(baseResume.locator("option")).toHaveCount(2);
  const baseValue = await baseResume
    .locator("option")
    .evaluateAll((options) => options.find((option) => option.value)?.value);
  await baseResume.selectOption(baseValue || "");
  await page.getByLabel("Company name").fill("Example Target Systems");
  await page.getByLabel("Role title").fill("Platform Engineer");
  await page
    .getByLabel("Job description")
    .fill("Required Qualifications\n- TypeScript\n- AWS\nPreferred Qualifications\n- React");
  await page.getByRole("button", { name: "Create tailored workspace" }).click();
  await page.getByRole("button", { name: "Create target" }).click();
  await expect(page.getByRole("heading", { name: "Platform Engineer at Example Target Systems" })).toBeVisible();
}

test("shows a compact local ATS state for an associated tailored resume without provider traffic", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes(".netlify")) writes.push(request.url());
  });
  await createTargetFromSample(page);
  await page.getByRole("link", { name: "Run local ATS in tailored resume" }).click();
  await page.getByText("ATS check", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Current local ATS score|Local ATS score unavailable/ }),
  ).toBeVisible();
  await expect(page.getByText("Local ATS Engine v1")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open full local ATS Checker" })).toBeVisible();
  await expect(page.getByLabel("Evidence locations")).toBeVisible();
  expect(writes).toEqual([]);
});

test("target summaries label stale state and remain contained at the editor breakpoint", async ({ page }) => {
  await createTargetFromSample(page);
  await page.getByRole("link", { name: "Run local ATS in tailored resume" }).click();
  await page.getByText("ATS check", { exact: true }).click();
  await expect(page.getByText("Local ATS Engine v1")).toBeVisible();
  await page.getByLabel("Full name").fill("Avery Example Long Structured Resume Name");
  await expect(page.getByText(/Analysis out of date|Analysis current/)).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1180, 1280, 1366, 1440, 1572, 1573, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth, `width ${width}`).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});
