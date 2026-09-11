import { expect, test } from "@playwright/test";

test("shows descriptive local analytics without provider or telemetry requests", async ({ page }) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (/groq|generativelanguage|remotive|telemetry|google-analytics|segment|amplitude/i.test(request.url()))
      externalRequests.push(request.url());
  });
  await page.goto("/applications");
  await page.getByLabel("Company name").fill("Synthetic Analytics Co");
  await page.getByLabel("Role title").fill("Platform Engineer");
  await page.getByRole("button", { name: "Create application" }).click();
  await expect(page.getByRole("heading", { name: "Platform Engineer at Synthetic Analytics Co" })).toBeVisible();
  await page.getByRole("link", { name: "Back to applications" }).click();
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Application analytics" })).toBeVisible();
  await expect(page.getByText("1 record in this view.", { exact: true })).toBeVisible();
  await expect(page.getByText(/No predictions, AI, or data upload\./)).toBeVisible();
  await expect(page.getByText("Not available", { exact: true })).toHaveCount(3);
  await expect(page.getByRole("heading", { name: "Status distribution" })).toBeVisible();
  await expect(page.getByLabel("Application distributions").getByText("Planned", { exact: true })).toBeVisible();
  await page.getByLabel("Status").selectOption("applied");
  await expect(page.getByText("No records match these filters", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText("1 record in this view.", { exact: true })).toBeVisible();
  expect(externalRequests).toEqual([]);
});

for (const width of [320, 768, 1280]) {
  test(`analytics is contained at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "Application analytics" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
  });
}
