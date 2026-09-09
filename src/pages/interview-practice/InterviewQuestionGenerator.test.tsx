import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InterviewQuestionGenerator } from "./InterviewQuestionGenerator";

const generatedQuestions = {
  questions: [
    {
      prompt: "How would you approach the role's Kubernetes requirements?",
      category: "skills",
      reason: "This treats the job requirement as a neutral discussion topic.",
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

function renderGenerator() {
  const onUseQuestions = vi.fn();
  const onAnnouncement = vi.fn();
  render(
    <InterviewQuestionGenerator
      role="Platform Engineer"
      company="Synthetic Example Corp"
      jobDescription="Java required. Kubernetes is a discussion topic."
      resumeEvidence="Built Java services with REST APIs."
      onUseQuestions={onUseQuestions}
      onAnnouncement={onAnnouncement}
    />,
  );
  return { onUseQuestions, onAnnouncement };
}

describe("InterviewQuestionGenerator", () => {
  it("does not request or persist generated questions without explicit actions", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(generatedQuestions), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    const { onUseQuestions } = renderGenerator();

    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Generate AI questions" })).toBeDisabled();

    await user.click(screen.getByLabelText(/consent to send selected Interview context/i));
    await user.click(screen.getByRole("button", { name: "Generate AI questions" }));
    await screen.findByRole("heading", { name: "Review AI questions" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onUseQuestions).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Use these questions" }));
    expect(onUseQuestions).toHaveBeenCalledWith(generatedQuestions.questions);
  });

  it("announces a safe error without exposing provider details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("provider secret details", { status: 503 })));
    const user = userEvent.setup();
    const { onAnnouncement } = renderGenerator();

    await user.click(screen.getByLabelText(/consent to send selected Interview context/i));
    await user.click(screen.getByRole("button", { name: "Generate AI questions" }));
    await screen.findByText("AI questions are unavailable. Try again later.");
    expect(onAnnouncement).toHaveBeenLastCalledWith("AI questions are unavailable. Try again later.");
    expect(screen.queryByText(/provider secret/i)).not.toBeInTheDocument();
  });
});
