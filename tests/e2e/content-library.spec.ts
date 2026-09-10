import { expect, test } from "@playwright/test";

test("keeps content library guidance explicit and local", async ({ page }) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (/groq|generativelanguage|remotive|telemetry/i.test(request.url())) externalRequests.push(request.url());
  });
  await page.goto("/content-library");
  await expect(page.getByRole("heading", { name: "Content library" })).toBeVisible();
  await expect(page.getByText("Guidance, not evidence")).toBeVisible();
  await page.getByRole("textbox", { name: "Search" }).fill("STAR");
  await expect(page.getByText("STAR structure", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Insert into snippet editor" }).click();
  await expect(page.getByRole("heading", { name: "Create user snippet" })).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("STAR structure");
  await expect(page.getByLabel("Pattern text")).toHaveValue(/\[context\]/);
  await page.getByLabel("Title").fill("My interview frame");
  await page.getByRole("button", { name: "Save user snippet" }).click();
  await expect(page.getByRole("status")).toContainText("User snippet saved locally.");
  await page.getByRole("textbox", { name: "Search" }).fill("");
  await expect(page.getByText("My interview frame", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete snippet" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete snippet" }).click();
  await expect(page.getByRole("status")).toContainText("User snippet deleted locally.");
  await page.reload();
  await expect(page.getByText("My interview frame", { exact: true })).toHaveCount(0);
  expect(externalRequests).toEqual([]);
});

for (const width of [320, 768, 1280]) {
  test(`content library is contained at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/content-library");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
  });
}
