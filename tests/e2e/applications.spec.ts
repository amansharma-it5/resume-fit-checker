import { expect, test } from "@playwright/test";

test("creates a private application, records a status change, and exports safe local data", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  await page.goto("/applications");
  await page.getByLabel("Company name").fill("Fictional Example Labs");
  await page.getByLabel("Role title").fill("Platform Engineer");
  await page.getByLabel("Next action").fill("Review locally");
  await page.getByRole("button", { name: "Create application" }).click();
  await expect(page.getByRole("heading", { name: "Platform Engineer at Fictional Example Labs" })).toBeVisible();
  await page.getByRole("button", { name: "Applied" }).click();
  await expect(page.getByRole("status")).toContainText("Status changed to Applied");
  await page.getByLabel("Follow-up title").fill("Send fictional follow-up");
  await page.getByRole("button", { name: "Add follow-up" }).click();
  await expect(
    page.locator(".application-follow-ups").getByText("Send fictional follow-up", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to applications" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  expect((await download).suggestedFilename()).toBe("applications.csv");
  await page.evaluate(() => {
    (window as Window & { __printed?: boolean }).print = () => {
      window.__printed = true;
    };
  });
  await page.getByRole("button", { name: "Print / Save as PDF" }).click();
  expect(await page.evaluate(() => (window as Window & { __printed?: boolean }).__printed)).toBe(true);
  expect(writes).toEqual([]);
});

test("is usable at a narrow viewport without a horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/applications");
  await expect(page.getByRole("heading", { name: "Applications" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
