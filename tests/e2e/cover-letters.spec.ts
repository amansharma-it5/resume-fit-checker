import { expect, test } from "@playwright/test";

test("creates and locally exports an evidence-safe cover letter without provider traffic", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Create resume" }).click();
  await expect(page.locator(".document-row").first()).toBeVisible();
  await page.goto("/cover-letters");
  await page.getByLabel("Resume").selectOption({ index: 1 });
  await page.getByLabel("Company").fill("Example Labs");
  await page.getByLabel("Role").fill("Engineer");
  await page.getByLabel("Job description").fill("Use TypeScript.");
  await page.getByRole("button", { name: "Create local cover letter" }).click();
  await expect(page.getByRole("heading", { name: /Engineer cover letter/ })).toBeVisible();
  await page.getByRole("button", { name: "Create evidence-based local draft" }).click();
  await expect(page.getByText(/More information required: add relevant resume evidence/)).toBeVisible();
  await expect(page.getByLabel(/consent to send/i)).not.toBeChecked();
  expect(writes).toEqual([]);
});
