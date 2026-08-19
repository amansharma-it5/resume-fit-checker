import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("guest checker and dashboard critical flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Resume Lab" })).toBeVisible();
  await page.getByLabel("Or paste resume text").fill("Jane Candidate jane@example.com Experience Senior Engineer 2020-2025 Built React applications and improved release time by 20 percent. Skills React TypeScript SQL Education Bachelor of Science");
  await page.getByRole("button", { name: "Analyze locally" }).click();
  await expect(page.getByRole("heading", { name: "Evidence dashboard" })).toBeVisible();
  await page.getByRole("link", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: "Create resume" }).click();
  await expect(page.getByText("Untitled resume")).toBeVisible();
});

test("checker has no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact || ""))).toEqual([]);
});

test("rename dialog supports validation, keyboard cancellation, save, and focus restoration", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Create resume" }).click();
  await expect(page.getByRole("status")).toContainText("Resume created.");
  const rename = page.getByRole("button", { name: "Rename" });
  await rename.click();
  const dialog = page.getByRole("dialog", { name: "Rename resume" });
  const input = dialog.getByLabel("Resume name");
  await expect(input).toHaveValue("Untitled resume");
  await expect(input).toBeFocused();
  await input.fill("");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Enter a resume name.");
  await input.fill("Cancelled name");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(rename).toBeFocused();
  await expect(page.getByRole("heading", { name: "Untitled resume" })).toBeVisible();
  await rename.click();
  await input.fill("Targeted frontend resume");
  await input.press("Enter");
  await expect(page.getByRole("heading", { name: "Targeted frontend resume" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Resume renamed.");
  await expect(rename).toBeFocused();
});
