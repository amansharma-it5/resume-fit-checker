import { expect, test } from "@playwright/test";

const result = {
  source: "remotive",
  jobs: [
    {
      source: "remotive",
      sourceJobId: "42",
      sourceUrl: "https://remotive.com/remote-jobs/platform-engineer-42",
      title: "Platform Engineer",
      company: "Synthetic Labs",
      location: "Worldwide",
      workplaceType: "remote",
      employmentType: "full_time",
      postedAt: "2026-09-09T00:00:00Z",
      description: "Build reliable services using supported job context only.",
      requirements: [],
      skills: [],
      fetchedAt: "2026-09-10T00:00:00.000Z",
    },
  ],
  page: 1,
  pageSize: 20,
  hasMore: false,
};

test("searches only after an explicit action and shows attributed details", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/jobs/search", async (route) => {
    calls += 1;
    await route.fulfill({ json: result });
  });
  await page.goto("/jobs");
  expect(calls).toBe(0);
  await page.getByRole("textbox", { name: "Role or keyword" }).fill("platform engineer");
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Search jobs" }).click();
  await expect(page.getByRole("heading", { name: "Platform Engineer" })).toBeVisible();
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "View details" }).click();
  await expect(page.getByRole("heading", { name: "Platform Engineer", level: 2 })).toBeVisible();
  await expect(page.getByText("This job description is source context only.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open original listing" })).toHaveAttribute(
    "href",
    result.jobs[0].sourceUrl,
  );
});

test("saves a selected listing as one local target with explicit resume choice", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Create resume" }).click();
  await expect(page.getByText("Resume created.")).toBeVisible();
  await page.goto("/jobs");
  await page.route("**/api/jobs/search", (route) => route.fulfill({ json: result }));
  await page.getByRole("textbox", { name: "Role or keyword" }).fill("platform engineer");
  await page.getByRole("button", { name: "Search jobs" }).click();
  await page.getByRole("button", { name: "View details" }).click();
  await page.getByLabel("Resume for local target").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save as target" }).click();
  await expect(page).toHaveURL(/\/targets\//);
  await expect(page.getByText(/Source: remotive/)).toBeVisible();
});

for (const width of [320, 390, 768, 1280]) {
  test(`keeps job discovery contained at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/jobs");
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
}
