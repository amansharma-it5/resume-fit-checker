import { expect, test } from "@playwright/test";

test("creates an isolated local job target with an explicit confirmation", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Create resume" }).click();
  await expect(page.locator(".document-row").first()).toBeVisible();
  await page.goto("/targets");
  await page.getByLabel("Company name").fill("Fictional Example Labs");
  await page.getByLabel("Role title").fill("Platform Engineer");
  await page.getByLabel("Base resume").selectOption({ index: 1 });
  await page.getByLabel("Job description").fill("Build reliable TypeScript services with clear evidence.");
  await page.getByRole("button", { name: "Create tailored workspace" }).click();
  await expect(page.getByRole("alertdialog", { name: "Create isolated tailored resume?" })).toBeVisible();
  await page.getByRole("button", { name: "Create target" }).click();
  await expect(page.getByRole("heading", { name: "Platform Engineer at Fictional Example Labs" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open tailored resume" })).toHaveAttribute("href", /\?target=/);
  expect(writes).toEqual([]);
});

test("job target validation does not persist cancelled or incomplete forms", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Create resume" }).click();
  await expect(page.locator(".document-row").first()).toBeVisible();
  await page.goto("/targets");
  await page.getByRole("button", { name: "Create tailored workspace" }).click();
  await expect(page.getByText("Company name is required.")).toBeVisible();
  await expect(page.getByText("No local job targets yet.")).toBeVisible();
});
