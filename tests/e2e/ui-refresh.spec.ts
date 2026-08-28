import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}

test("light workspace shell keeps desktop navigation visible and distinct", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard");

  const sidebar = page.getByRole("complementary", { name: "RecruitOS workspace" });
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Resume Checker" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Backup & Recovery" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".app-content")).toHaveCSS("margin-left", "264px");
  await expectNoHorizontalOverflow(page);
});

test("authentication-disabled entry retains a clear light guest-mode surface", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");

  const panel = page.locator(".auth-panel");
  await expect(page.getByRole("heading", { name: "Continue privately in guest mode" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open guest workspace" })).toBeVisible();
  await expect(panel).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expectNoHorizontalOverflow(page);
});

test("mobile navigation uses an accessible drawer with escape and focus restoration", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/dashboard");

  const trigger = page.getByRole("button", { name: "Open navigation" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const drawer = page.getByRole("complementary", { name: "Mobile workspace navigation" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Interview Practice" })).toBeVisible();
  const firstDrawerLink = drawer.getByRole("link", { name: "RecruitOS AI home" });
  await expect(firstDrawerLink).toBeFocused();
  const lastDrawerLink = drawer.getByRole("link", { name: "Settings" });
  await lastDrawerLink.focus();
  await page.keyboard.press("Tab");
  await expect(firstDrawerLink).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  await expectNoHorizontalOverflow(page);
});

test("dashboard renders a compact resume row with a keyboard-accessible action menu", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Create resume" }).click();
  const row = page.locator(".document-row").first();
  await expect(row.locator(".document-thumbnail")).toBeVisible();
  await expect(row).toContainText("Saved locally");
  const menu = row.getByRole("button", { name: /More actions for Untitled resume/ });
  await menu.focus();
  await menu.press("Enter");
  await expect(row.getByRole("button", { name: "Rename" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("editor exposes section navigation and responsive review views without losing controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Create resume" }).click();
  await page.locator(".document-row").first().getByRole("link", { name: "Edit" }).click();
  const navigator = page.getByRole("complementary", { name: "Resume sections" });
  await expect(navigator).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await expect(page.locator(".preview-pane")).toBeVisible();
  await page.getByLabel("Full name").fill("Avery Morgan with a deliberately long synthetic professional identity");
  await navigator.getByRole("button", { name: /Work Experience/ }).click();
  await expect(page.locator(".section-editor").filter({ hasText: "Work Experience" })).toBeFocused();

  await page.setViewportSize({ width: 320, height: 760 });
  const editorViews = page.getByRole("group", { name: "Editor view" });
  await editorViews.getByRole("button", { name: "Sections", exact: true }).click();
  await expect(navigator).toBeVisible();
  await editorViews.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator("#resume-fields")).toBeVisible();
  await editorViews.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".preview-pane")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
