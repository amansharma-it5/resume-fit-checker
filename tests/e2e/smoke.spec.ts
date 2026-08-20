import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const responsiveViewports = [
  { width: 320, height: 760 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const dimensions = await page.evaluate(() => {
    const innerWidth = window.innerWidth;
    const overflowing = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          className: element.className,
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          tagName: element.tagName,
        };
      })
      .filter(({ left, right }) => left < 0 || right > innerWidth)
      .slice(0, 8);
    const internallyOverflowing = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .reverse()
      .filter((element) => element.scrollWidth > element.clientWidth)
      .map((element) => ({
        className: element.className,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        tagName: element.tagName,
      }))
      .slice(0, 8);
    return { innerWidth, internallyOverflowing, overflowing, scrollWidth: document.documentElement.scrollWidth };
  });
  expect(
    dimensions.scrollWidth,
    JSON.stringify({ boxes: dimensions.overflowing, contents: dimensions.internallyOverflowing }),
  ).toBeLessThanOrEqual(dimensions.innerWidth);
}

async function expectContained(page: import("@playwright/test").Page, selector: string) {
  const bounds = await page.locator(selector).first().boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
}

test("guest checker and dashboard critical flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Resume Lab" })).toBeVisible();
  await page
    .getByLabel("Or paste resume text")
    .fill(
      "Jane Candidate jane@example.com Experience Senior Engineer 2020-2025 Built React applications and improved release time by 20 percent. Skills React TypeScript SQL Education Bachelor of Science",
    );
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

test("production-default build keeps accounts disabled and guest mode available", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Accounts coming soon")).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(0);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Continue privately in guest mode" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Email magic link" })).toHaveCount(0);
  await page.getByRole("link", { name: "Open guest workspace" }).click();
  await expect(page.getByRole("heading", { name: "Your resumes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create resume" })).toBeEnabled();
});

test("3D lab stays within the document at mobile, tablet, and desktop widths", async ({ page }) => {
  for (const viewport of responsiveViewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator(".lab-stage")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test("mobile dialogs, upload controls, ATS results, and rewrite sections stay contained", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/");
  await expectContained(page, ".file-control");
  await expectContained(page, ".rewrite-lab");

  await page
    .getByLabel("Or paste resume text")
    .fill(
      "Jordan Test Experience Senior Frontend Engineer 2020-2025 Built React applications for 12 teams and improved delivery by 20 percent. Skills React TypeScript SQL Education Bachelor of Science",
    );
  await page.getByLabel("Target role").fill("Senior Frontend Engineer");
  await page.getByLabel("Job description").fill("Required Qualifications\n- React\n- TypeScript\n- SQL");
  await page.getByRole("button", { name: "Analyze locally" }).click();
  await expect(page.getByRole("heading", { name: "Evidence dashboard" })).toBeVisible();
  await expectContained(page, ".results");
  await expectContained(page, ".rewrite-lab");
  await expectNoHorizontalOverflow(page);

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Create resume" }).click();
  await page.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByRole("dialog", { name: "Rename resume" })).toBeVisible();
  await expectContained(page, '[role="dialog"]');
  await expectNoHorizontalOverflow(page);
});
