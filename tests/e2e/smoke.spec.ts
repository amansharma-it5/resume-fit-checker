import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectedAuthEnabled } from "../../src/test/playwright-auth-mode";

const responsiveViewports = [
  { width: 320, height: 760 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const animationFractions = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

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

async function expectAnimationStatesContained(page: import("@playwright/test").Page, context: string) {
  const samples = await page.evaluate(async (fractions) => {
    const scene = document.querySelector<HTMLElement>(".lab-stage");
    if (!scene) throw new Error("The 3D lab scene was not found.");
    const animations = scene.getAnimations({ subtree: true });
    animations.forEach((animation) => animation.pause());
    const results = [];
    for (const fraction of fractions) {
      for (const animation of animations) {
        const duration = Number(animation.effect?.getTiming().duration) || 1;
        animation.currentTime = duration * fraction;
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      results.push({
        fraction,
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      });
    }
    return results;
  }, animationFractions);

  for (const sample of samples) {
    expect(sample.scrollWidth, `${context} at ${sample.fraction} animation cycles`).toBeLessThanOrEqual(
      sample.innerWidth,
    );
  }
}

async function fillAndAnalyze(page: import("@playwright/test").Page) {
  await page
    .getByLabel("Or paste resume text")
    .fill(
      "Jordan Test Experience Senior Frontend Engineer 2020-2025 Built React applications for 12 teams and improved delivery by 20 percent. Skills React TypeScript SQL Education Bachelor of Science",
    );
  await page.getByLabel("Target role").fill("Senior Frontend Engineer");
  await page.getByLabel("Job description").fill("Required Qualifications\n- React\n- TypeScript\n- SQL");
  const analyzeButton = page.getByRole("button", { name: "Analyze resume" });
  await analyzeButton.focus();
  await analyzeButton.press("Enter");
  await expect(page.getByRole("heading", { name: "ATS evidence dashboard" })).toBeVisible();
}

async function openDashboard(page: import("@playwright/test").Page) {
  const mobileTrigger = page.getByRole("button", { name: "Open navigation" });
  if (await mobileTrigger.isVisible()) {
    await mobileTrigger.click();
    await page
      .getByRole("complementary", { name: "Mobile workspace navigation" })
      .getByRole("link", { name: "Dashboard" })
      .click();
    return;
  }
  await page.getByRole("link", { name: "Dashboard" }).click();
}

test("guest checker and dashboard critical flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tailor your resume with transparent ATS evidence." })).toBeVisible();
  await page
    .getByLabel("Or paste resume text")
    .fill(
      "Jane Candidate jane@example.com Experience Senior Engineer 2020-2025 Built React applications and improved release time by 20 percent. Skills React TypeScript SQL Education Bachelor of Science",
    );
  await page.getByRole("button", { name: "Analyze resume" }).click();
  await expect(page.getByRole("heading", { name: "ATS evidence dashboard" })).toBeVisible();
  await openDashboard(page);
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

test("authentication feature flag matches the deployment context", async ({ page }) => {
  const authEnabled = expectedAuthEnabled(process.env);
  await page.goto("/");
  if (authEnabled) {
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Email magic link" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
    await page.goto("/signup");
    await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();
    await page.goto("/forgot-password");
    await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
    return;
  }
  await expect(page.getByText("Accounts coming soon")).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign up" })).toHaveCount(0);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Continue privately in guest mode" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Email magic link" })).toHaveCount(0);
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Continue privately in guest mode" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign up" })).toHaveCount(0);
  await page.goto("/login");
  await page.getByRole("link", { name: "Open guest workspace" }).click();
  await expect(page.getByRole("heading", { name: "Your resumes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create resume" })).toBeEnabled();
});

test("3D lab stays within the document for two complete animation cycles", async ({ page }) => {
  test.setTimeout(90_000);
  for (const viewport of responsiveViewports) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await expect(page.locator(".lab-stage")).toBeVisible();
    await expectAnimationStatesContained(page, `${viewport.width}px before ATS results`);
    await fillAndAnalyze(page);
    await expectAnimationStatesContained(page, `${viewport.width}px after ATS results`);
  }
});

test("reduced motion remains contained before and after ATS results", async ({ page }) => {
  test.setTimeout(90_000);
  for (const viewport of responsiveViewports) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".lab-stage")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.waitForTimeout(100);
    await expectNoHorizontalOverflow(page);
    await fillAndAnalyze(page);
    await expectNoHorizontalOverflow(page);
  }
});

test("mobile dialogs, upload controls, ATS results, and rewrite sections stay contained", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/");
  await expectContained(page, ".file-control");
  await expectContained(page, ".rewrite-lab");

  await page.getByLabel("Resume file").setInputFiles({
    name: "responsive-smoke.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Jordan Test Experience Senior Frontend Engineer Built React applications for 12 teams. Skills React TypeScript SQL Education Bachelor of Science",
    ),
  });
  await expect(page.getByLabel("Or paste resume text")).toContainText("Jordan Test");
  await fillAndAnalyze(page);
  await expectContained(page, ".results");
  await expectContained(page, ".rewrite-lab");
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: /Smart Rewrite/ }).click();
  await expect(page.locator(".rewrite-output")).not.toContainText("Your rewrite will appear here.");
  const aiRewrite = page.getByRole("button", { name: /AI Rewrite/ });
  await expect(aiRewrite).toBeDisabled();
  await page.getByLabel("Send this selected text to Groq AI for rewriting.").check();
  await expect(aiRewrite).toBeEnabled();

  const analyzeButton = page.getByRole("button", { name: "Analyze resume" });
  await page.keyboard.press("Tab");
  await analyzeButton.focus();
  const focusStyle = await analyzeButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(focusStyle.outlineWidth).not.toBe("0px");
  await expectContained(page, ".workbench");

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Create resume" }).click();
  await page.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByRole("dialog", { name: "Rename resume" })).toBeVisible();
  await expectContained(page, '[role="dialog"]');
  await expectNoHorizontalOverflow(page);
});
