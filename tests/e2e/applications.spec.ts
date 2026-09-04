import { expect, test } from "@playwright/test";

async function createTargetWithCurrentAnalysis(page: import("@playwright/test").Page) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Try a sample resume" }).click();
  await page.getByRole("button", { name: "Create sample resume" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Avery Morgan");
  await page.goto("/targets");
  const baseResume = page.getByLabel("Base resume");
  await expect(baseResume.locator("option")).toHaveCount(2);
  const baseValue = await baseResume
    .locator("option")
    .evaluateAll((options) => options.find((option) => option.value)?.value);
  await baseResume.selectOption(baseValue || "");
  await page.getByLabel("Company name").fill("Example Readiness Labs");
  await page.getByLabel("Role title").fill("Platform Engineer");
  await page
    .getByLabel("Job description")
    .fill("Required Qualifications\n- TypeScript\n- AWS\nPreferred Qualifications\n- React");
  await page.getByRole("button", { name: "Create tailored workspace" }).click();
  await page.getByRole("button", { name: "Create target" }).click();
  await page.getByRole("link", { name: "Run local ATS in tailored resume" }).click();
  await page.getByText("ATS check", { exact: true }).click();
  await expect(page.getByText("Analysis current.", { exact: true })).toBeVisible();
  await page.goto("/targets");
  await page.getByRole("link", { name: "Open target" }).click();
}

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
  await expect(page.getByRole("heading", { name: "Readiness", exact: true })).toBeVisible();
  await expect(page.getByText("Link a job target to review Local ATS status.")).toBeVisible();
  await page.getByRole("button", { name: "Create follow-up" }).click();
  await page.getByRole("button", { name: "Create follow-up" }).click();
  await expect(page.getByLabel("Follow-up title")).toBeFocused();
  await expect(page.getByLabel("Follow-up title")).toHaveValue("Follow up with Fictional Example Labs");
  await expect(page.locator(".application-follow-ups li")).toHaveCount(0);
  await page.getByRole("button", { name: "Applied" }).click();
  await expect(page.getByRole("status")).toContainText("Status changed to Applied");
  await page.getByLabel("Follow-up title").fill("Send fictional follow-up");
  await page.getByRole("button", { name: "Add follow-up" }).click();
  await expect(
    page.locator(".application-follow-ups").getByText("Send fictional follow-up", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".application-follow-ups li")).toHaveCount(1);
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

test("projects a current target analysis as read-only readiness and marks it stale after a resume edit", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes(".netlify")) writes.push(request.url());
  });
  await createTargetWithCurrentAnalysis(page);
  await page.getByRole("link", { name: "Track application" }).click();
  await page.getByRole("button", { name: "Create application" }).click();
  await expect(page.getByRole("heading", { name: "Readiness", exact: true })).toBeVisible();
  await expect(page.getByText(/Local ATS score/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Linked resume is available." })).toHaveAttribute(
    "href",
    /\/resumes\/.*\/edit/,
  );
  await expect(page.getByRole("link", { name: "Open resume" })).toHaveAttribute("href", /\/resumes\/.*\/edit/);
  await expect(page.getByRole("link", { name: "Open job target" })).toHaveAttribute("href", /\/targets\//);
  await expect(page.getByRole("link", { name: "Linked job target is available." })).toHaveAttribute(
    "href",
    /\/targets\//,
  );
  await expect(page.getByRole("link", { name: "Create cover letter" })).toHaveAttribute(
    "href",
    /\/cover-letters\?target=/,
  );
  await expect(page.getByRole("link", { name: "Start interview practice" })).toHaveAttribute(
    "href",
    "/interview-practice",
  );
  await page.getByRole("link", { name: "Linked resume is available." }).click();
  await page.getByLabel("Full name").fill("Avery Readiness Stale Name");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByText(/Analysis out of date/)).toBeVisible();
  await expect(page.getByText(/Local ATS score/)).toHaveCount(0);
  await page
    .getByRole("link", {
      name: "Analysis out of date. Re-run analysis; it is based on an earlier resume, job description, or ruleset.",
    })
    .focus();
  await expect(page.getByRole("link", { name: /Analysis out of date/ })).toBeFocused();
  for (const width of [320, 390, 768, 1024, 1280, 1572, 1573, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBeTruthy();
  }
  expect(writes).toEqual([]);
});

test("is usable at a narrow viewport without a horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/applications");
  await expect(page.getByRole("heading", { name: "Applications" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
