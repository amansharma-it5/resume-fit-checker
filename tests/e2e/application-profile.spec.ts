import { expect, test } from "@playwright/test";

test("saves explicit profile data and reusable answers with deterministic mapping", async ({ page }) => {
  await page.goto("/profile");
  await page.getByLabel("First name").fill("Sam");
  await page.getByLabel("Email").fill("sam@example.test");
  await page.getByLabel("Phone").fill("+1 (555) 123-4567");
  await page.getByLabel("LinkedIn URL").fill("https://linkedin.com/in/sam");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toContainText("Application profile saved locally.");

  await page.getByLabel("Label").fill("Relocation");
  await page.getByLabel("Common question").fill("Are you open to relocation?");
  await page.getByLabel("Category").selectOption("relocation");
  await page.getByLabel("Your answer").fill("I am open to discussing relocation.");
  await page.getByRole("button", { name: "Add answer" }).click();
  await expect(page.getByText("Reusable answer saved locally.")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Reusable answers" }).getByText("relocation", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Mapping preview" }).getByText("matched", { exact: true }).first(),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("First name")).toHaveValue("Sam");
  await expect(page.getByText("Are you open to relocation?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Reusable answer removed.")).toBeVisible();
});

test("keeps unsaved values transient and references existing local records", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Try a sample resume" }).click();
  await page.getByRole("button", { name: "Create sample resume" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Avery Morgan");
  await page.goto("/profile");
  await expect(page.getByLabel("Resume").locator("option")).toHaveCount(2);
  await page.getByLabel("First name").fill("Unsaved");
  await page.reload();
  await expect(page.getByLabel("First name")).toHaveValue("");
  const resumeId = await page.getByLabel("Resume").locator("option").nth(1).getAttribute("value");
  await page.getByLabel("Resume").selectOption(resumeId || "");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toContainText("Application profile saved locally.");
  await page.reload();
  await expect(page.getByLabel("Resume")).toHaveValue(resumeId || "");
  await expect(page.getByLabel("SSN")).toHaveCount(0);
  await expect(page.getByLabel("Password")).toHaveCount(0);
});

for (const width of [320, 390, 768, 1280]) {
  test(`application preparation is contained at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Application profile" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
  });
}
