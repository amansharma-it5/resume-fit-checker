import { expect, test } from "@playwright/test";

test("downloads a local workspace backup without a network write", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (request) => request.method() !== "GET" && writes.push(request.url()));
  await page.goto("/backup-recovery");
  await expect(page.getByRole("heading", { name: "Backup & recovery" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download workspace backup" }).click();
  expect((await download).suggestedFilename()).toMatch(/^recruitos-ai-workspace-v1-\d{4}-\d{2}-\d{2}\.json$/);
  expect(writes).toEqual([]);
});

test("keeps recovery controls accessible at a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/backup-recovery");
  await expect(page.getByText("Storage health")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("preflights a downloaded backup without writing local workspace data", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (request) => request.method() !== "GET" && writes.push(request.url()));
  await page.goto("/backup-recovery");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download workspace backup" }).click();
  const path = await (await download).path();
  if (!path) throw new Error("Expected a local backup download path");
  await page.getByLabel("Backup file").setInputFiles(path);
  await expect(page.getByRole("heading", { name: "Read-only restore preview" })).toBeVisible();
  await expect(page.getByText("Backup validated. Review the restore plan before making any changes.")).toBeVisible();
  expect(writes).toEqual([]);
});
