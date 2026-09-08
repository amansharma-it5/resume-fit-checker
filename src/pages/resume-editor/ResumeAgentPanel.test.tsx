import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResumeAgentPanel } from "./ResumeAgentPanel";

const target = { id: "target-1", role: "Platform Engineer", company: "Example Systems" };
const fields = [
  {
    id: "summary:entry:text",
    label: "Professional summary",
    draftType: "SUMMARY" as const,
    currentText: "Built services",
    sectionId: "summary",
  },
  {
    id: "experience:entry:bullet:bullet-1",
    label: "Work Experience bullet",
    draftType: "EXPERIENCE_BULLET" as const,
    currentText: "Built services",
    sectionId: "experience",
  },
];
const analysis = {
  analysisEligibility: "scored",
  engineVersion: "local-ats-v1",
  rulesetVersion: "2026-08-ats-core-1",
  generatedAt: "2026-09-08T00:00:00.000Z",
  scores: { overall: 72 },
  categoryScores: {
    contentQualityActionLanguage: { score: 60, reason: "Review action language." },
    readabilityBulletQuality: { score: 70, reason: "Review bullet clarity." },
  },
  requirements: [{ term: "Kubernetes", priority: "required", matchState: "missing" }],
  missing: ["Kubernetes"],
  recommendations: [],
};

function renderPanel(overrides: Partial<React.ComponentProps<typeof ResumeAgentPanel>> = {}) {
  return render(
    <ResumeAgentPanel
      resumeId="resume-1"
      targetId="target-1"
      target={target}
      analysis={analysis}
      analysisState="current"
      analysisResumeVersion={1}
      fields={fields}
      onRunAnalysis={vi.fn()}
      onOpenTailoring={vi.fn()}
      onOpenTargetedDraft={vi.fn()}
      onOpenEditorSection={vi.fn()}
      onOpenGaps={vi.fn()}
      onAnnouncement={vi.fn()}
      {...overrides}
    />,
  );
}

describe("ResumeAgentPanel", () => {
  it("requires a linked target without making a request or changing the resume", () => {
    renderPanel({ target: null, targetId: null, analysis: null, analysisState: null });
    expect(screen.getByRole("heading", { name: "AI Resume Agent" })).toBeVisible();
    expect(screen.getByText("Choose a Job Target to optimize this resume.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Choose a Job Target" })).toHaveAttribute("href", "/targets");
    expect(screen.queryByRole("button", { name: "Review improvement plan" })).toBeNull();
  });

  it("builds local priorities and delegates only to approved existing actions", async () => {
    const user = userEvent.setup();
    const onOpenGaps = vi.fn();
    const onOpenTargetedDraft = vi.fn();
    const onOpenTailoring = vi.fn();
    const onAnnouncement = vi.fn();
    renderPanel({ onOpenGaps, onOpenTargetedDraft, onOpenTailoring, onAnnouncement });
    await user.click(screen.getByRole("button", { name: "Review improvement plan" }));
    expect(screen.getByRole("heading", { name: "Priority improvements" })).toBeVisible();
    expect(
      screen.getByText("Built locally from the current Local ATS result. No Gemini request was made."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Review gap" }));
    expect(onOpenGaps).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Draft improvement" }));
    expect(onOpenTargetedDraft).toHaveBeenCalledWith(fields[0].id);
    await user.click(screen.getByRole("button", { name: "Review tailoring" }));
    expect(onOpenTailoring).toHaveBeenCalledOnce();
    await user.click(screen.getAllByRole("button", { name: "Skip" })[0]);
    expect(onAnnouncement).toHaveBeenCalledWith("Recommendation skipped for this tab. Your resume was not changed.");
  });

  it("shows an explicit stale state and leaves re-analysis to the user", () => {
    const onRunAnalysis = vi.fn();
    renderPanel({ analysisState: "stale", onRunAnalysis });
    expect(screen.getByText("Run Local ATS analysis again.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Re-run Local ATS" })).toBeVisible();
    expect(onRunAnalysis).not.toHaveBeenCalled();
  });
});
