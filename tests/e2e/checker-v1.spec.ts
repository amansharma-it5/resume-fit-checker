import { expect, test } from "@playwright/test";

const resume = `Avery Example\navery@example.com\nExperience\nSenior Platform Engineer | Jan 2020 - Present\n- Built TypeScript services on AWS for 12 teams.\n- Led cloud infrastructure delivery.\nEducation\nBachelor of Science\nSkills\nTypeScript, AWS, SQL`;

const jobDescription = `Required Qualifications\n- TypeScript\n- Amazon Web Services\n- cloud infrastructure platform\n- Kubernetes\nPreferred Qualifications\n- React`;

async function analyze(page: import("@playwright/test").Page, jd = jobDescription) {
  await page.goto("/checker");
  await page.getByLabel("Or paste resume text").fill(resume);
  await page.getByLabel("Target role").fill("Platform Engineer");
  await page.getByLabel("Job description").fill(jd);
  await page.getByRole("button", { name: "Analyze resume" }).click();
  await expect(page.getByRole("heading", { name: "Explainable local ATS results" })).toBeVisible();
}

test("presents scored local ATS v1 evidence without provider traffic", async ({ page }) => {
  const providerCalls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("ai-rewrite") || request.url().includes("groq")) providerCalls.push(request.url());
  });
  await analyze(page);
  await expect(page.getByText("Local ATS Engine v1")).toBeVisible();
  await expect(page.getByText(/Eligible for local ATS scoring/)).toBeVisible();
  await expect(page.getByText(/Overall local ATS score/)).toBeVisible();
  await expect(page.getByText("exact evidence", { exact: true })).toBeVisible();
  await expect(page.getByText("alias evidence")).toBeVisible();
  await expect(page.getByText("partial evidence", { exact: true })).toHaveCount(2);
  await expect(page.getByText("missing evidence", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Weight 18/100")).toBeVisible();
  await expect(page.locator(".checker-results-v1")).toBeFocused();
  expect(providerCalls).toEqual([]);
});

test("explains missing JD eligibility instead of showing a fabricated overall score", async ({ page }) => {
  await analyze(page, "");
  await expect(page.getByText("Job description needed")).toBeVisible();
  await expect(page.getByText(/Overall score is unavailable/)).toBeVisible();
  await expect(
    page
      .locator(".category-detail")
      .filter({ has: page.getByRole("heading", { name: "Required qualification coverage" }) })
      .getByText("Excluded", { exact: true }),
  ).toBeVisible();
});

test("contains long deterministic evidence at representative narrow and desktop widths", async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1180, 1280, 1366, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await analyze(page);
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth, `width ${width}`).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});
