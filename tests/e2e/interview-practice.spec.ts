import { expect, test } from "@playwright/test";

const aiQuestions = {
  questions: [
    {
      prompt: "Tell me about a service decision.",
      category: "behavioral",
      reason: "Uses selected resume evidence.",
      evidenceRefs: [],
    },
    {
      prompt: "How would you approach service reliability?",
      category: "technical",
      reason: "Explores role-relevant reasoning.",
      evidenceRefs: [],
    },
    {
      prompt: "Which experience is most relevant to this role?",
      category: "role-fit",
      reason: "Connects the role to the supplied resume.",
      evidenceRefs: [],
    },
  ],
};
const aiFeedback = {
  feedback: {
    strengths: ["The answer is direct."],
    gaps: ["Add the situation and result if you have those facts."],
    starGuidance: "Name the situation, task, action, and result.",
    improvement: "Organize the existing answer around the action you took.",
    examplePhrasing: "Built TypeScript services for internal teams.",
    evidenceWarnings: [],
  },
  provider: "gemini",
  model: "gemini-3.7-flash",
  version: "interview-v1",
};

async function createTarget(page: import("@playwright/test").Page) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Try a sample resume" }).click();
  await page.getByRole("button", { name: "Create sample resume" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Avery Morgan");
  await page.goto("/targets");
  const resume = page.getByLabel("Base resume");
  await expect(resume.locator("option")).toHaveCount(2);
  const resumeValue = await resume
    .locator("option")
    .evaluateAll((options) => options.find((option) => option.value)?.value);
  await resume.selectOption(resumeValue || "");
  await page.getByLabel("Company name").fill("Example Interview Systems");
  await page.getByLabel("Role title").fill("Platform Engineer");
  await page.getByLabel("Job description").fill("TypeScript services and reliable systems are relevant.");
  await page.getByRole("button", { name: "Create tailored workspace" }).click();
  await expect(page.getByRole("alertdialog", { name: "Create isolated tailored resume?" })).toBeVisible();
  await page.getByRole("button", { name: "Create target" }).click();
  await expect(page.getByRole("heading", { name: "Platform Engineer at Example Interview Systems" })).toBeVisible();
}

async function createSession(page: import("@playwright/test").Page) {
  await createTarget(page);
  await page.goto("/interview-practice");
  const target = page.getByLabel("Job target (optional)");
  await expect(target.locator("option", { hasText: "Example Interview Systems" })).toHaveCount(1);
  const targetValue = await target.locator("option", { hasText: "Example Interview Systems" }).getAttribute("value");
  await target.selectOption(targetValue || "");
  await expect(page.getByLabel("Target role")).toHaveValue("Platform Engineer");
  await expect(page.getByLabel("Job description (optional)")).toHaveValue(/TypeScript services/);
  await page.getByRole("button", { name: "Create local practice session" }).click();
  await expect(page.getByRole("heading", { name: /Platform Engineer practice/ })).toBeVisible();
}

test("generates a transient job-specific question set only after consent and explicit action", async ({ page }) => {
  const requests: string[] = [];
  let questionPayload: Record<string, unknown> | undefined;
  await page.on("request", (request) => {
    if (request.method() !== "GET") requests.push(request.url());
  });
  await createTarget(page);
  await page.goto("/interview-practice");
  const target = page.getByLabel("Job target (optional)");
  await expect(target.locator("option", { hasText: "Example Interview Systems" })).toHaveCount(1);
  const targetValue = await target.locator("option", { hasText: "Example Interview Systems" }).getAttribute("value");
  await target.selectOption(targetValue || "");
  await expect(page.getByLabel("Target role")).toHaveValue("Platform Engineer");
  await expect(page.getByLabel("Job description (optional)")).toHaveValue(/TypeScript services/);
  await page.getByLabel("Interview type").selectOption("MIXED");
  await page.route("**/api/ai/interview", async (route) => {
    questionPayload = route.request().postDataJSON();
    expect(questionPayload).toMatchObject({ mode: "questions", interviewType: "MIXED" });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        questions: aiQuestions,
        provider: "gemini",
        model: "gemini-3.7-flash",
        version: "interview-v1",
      }),
    });
  });
  const consent = page.getByLabel(/consent to send selected interview context/i);
  await expect(consent).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Generate AI questions" })).toBeDisabled();
  expect(requests.filter((url) => url.includes("/api/ai/interview"))).toEqual([]);
  await consent.check();
  await page.getByRole("button", { name: "Generate AI questions" }).click();
  await expect(page.getByRole("heading", { name: "Review AI question set" })).toBeVisible();
  await expect(page.getByText("AI-generated questions. No session has been created.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Interview practice" })).toBeVisible();
  expect(Object.keys(questionPayload || {}).sort()).toEqual([
    "company",
    "interviewType",
    "limitedJobDescription",
    "mode",
    "resumeEvidence",
    "targetRole",
  ]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Review AI question set" })).toHaveCount(0);
});

test("uses reviewed AI questions only after explicit local session creation", async ({ page }) => {
  await createTarget(page);
  await page.goto("/interview-practice");
  const target = page.getByLabel("Job target (optional)");
  await expect(target.locator("option", { hasText: "Example Interview Systems" })).toHaveCount(1);
  const targetValue = await target.locator("option", { hasText: "Example Interview Systems" }).getAttribute("value");
  await target.selectOption(targetValue || "");
  await expect(page.getByLabel("Target role")).toHaveValue("Platform Engineer");
  await expect(page.getByLabel("Job description (optional)")).toHaveValue(/TypeScript services/);
  await page.route("**/api/ai/interview", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ questions: aiQuestions }) }),
  );
  await page.getByLabel(/consent to send selected interview context/i).check();
  await page.getByRole("button", { name: "Generate AI questions" }).click();
  await expect(page.getByRole("heading", { name: "Review AI question set" })).toBeVisible();
  await page.getByRole("button", { name: "Create local session from reviewed AI questions" }).click();
  await expect(page.getByRole("heading", { name: /Platform Engineer practice/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tell me about a service decision." })).toBeVisible();
});

test("requests answer feedback explicitly, keeps the answer unchanged, and handles a safe fallback", async ({
  page,
}) => {
  await createSession(page);
  await page.route("**/api/ai/interview", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(aiFeedback) }),
  );
  await page.getByLabel("Your practice answer").fill("Built TypeScript services for internal teams.");
  const consent = page.getByLabel(/consent to send this selected question/i);
  await expect(consent).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Request AI feedback" })).toBeDisabled();
  await consent.check();
  await page.getByRole("button", { name: "Request AI feedback" }).click();
  await expect(page.getByRole("heading", { name: "AI Insights" })).toBeVisible();
  await expect(page.getByLabel("Your practice answer")).toHaveValue("Built TypeScript services for internal teams.");
  await page.getByRole("button", { name: "Dismiss feedback" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "AI Insights" })).toHaveCount(0);
});

test("rejects unsafe feedback and keeps provider failures local", async ({ page }) => {
  await createSession(page);
  await page.route("**/api/ai/interview", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ feedback: { ...aiFeedback.feedback, improvement: "Built Kubernetes services by 40%." } }),
    }),
  );
  await page.getByLabel("Your practice answer").fill("Built TypeScript services.");
  await page.getByLabel(/consent to send this selected question/i).check();
  await page.getByRole("button", { name: "Request AI feedback" }).click();
  await expect(page.locator('.dashboard-page > [role="status"]')).toContainText(/More information required/);
  await expect(page.getByText("Kubernetes", { exact: true })).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.route("**/api/ai/interview", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "private provider detail", code: "GEMINI_UNAVAILABLE" }),
    }),
  );
  await page.getByRole("button", { name: "Request AI feedback" }).click();
  await expect(page.getByRole("heading", { name: "Deterministic local fallback" })).toBeVisible();
  await expect(page.getByText(/private provider detail/i)).toHaveCount(0);
});

test("keeps existing local practice controls, print, and narrow layout usable", async ({ page }) => {
  await createSession(page);
  await page.getByLabel("Your practice answer").fill("A local answer for the synthetic session.");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Previous" }).click();
  await page.getByRole("button", { name: "Mark complete" }).click();
  await expect(page.getByLabel("Practice progress")).toContainText("1 completed");
  await page.getByRole("button", { name: "Start timer" }).click();
  await expect(page.getByRole("button", { name: "Pause timer" })).toBeVisible();
  await page.getByRole("button", { name: "Reset answer" }).click();
  await expect(page.getByLabel("Your practice answer")).toHaveValue("");
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).resolves.toBe(true);
});

test("keeps keyboard focus and print chrome behavior accessible", async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => undefined;
  });
  await createSession(page);
  await page.getByRole("button", { name: "Print / Save as PDF" }).click();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByLabel("Printable interview practice review")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.getByLabel(/consent to send this selected question/i).focus();
  await expect(page.getByLabel(/consent to send this selected question/i)).toBeFocused();
});
