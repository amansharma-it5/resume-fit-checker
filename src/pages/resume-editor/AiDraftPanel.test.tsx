import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiDraftPanel } from "./AiDraftPanel";
import type { DraftField } from "../../lib/ai-drafting";

const apply = vi.fn();
const announce = vi.fn();
const field: DraftField = {
  id: "summary",
  label: "Professional summary",
  draftType: "SUMMARY",
  currentText: "Built TypeScript services.",
  relevantEvidence: "Built TypeScript services for internal teams.",
  sectionId: "summary-section",
  entryId: "summary-entry",
  field: "text",
  apply,
};

function renderPanel() {
  return render(
    <AiDraftPanel
      fields={[field]}
      role="Platform Engineer"
      jobDescription="TypeScript required."
      onAnnouncement={announce}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  apply.mockReset();
  announce.mockReset();
});

describe("AiDraftPanel", () => {
  it("does not request a draft until the user gives explicit consent and clicks Generate", async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ draft: "Built TypeScript services.", evidenceWarnings: [] })),
    );
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderPanel();
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Generate AI draft" }));
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(screen.getByLabelText(/I understand the selected resume field/i));
    await user.click(screen.getByRole("button", { name: "Generate AI draft" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    const requestCall = (fetcher.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>)[0];
    expect(JSON.parse(String(requestCall?.[1]?.body))).toEqual({
      draftType: "SUMMARY",
      currentText: "Built TypeScript services.",
      targetRole: "Platform Engineer",
      limitedJobDescription: "TypeScript required.",
      relevantEvidence: "Built TypeScript services for internal teams.",
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("keeps a proposal transient until accept, then uses only the selected field apply path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ draft: "Built TypeScript services for internal teams.", evidenceWarnings: [] }),
          ),
      ),
    );
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByLabelText(/I understand the selected resume field/i));
    await user.click(screen.getByRole("button", { name: "Generate AI draft" }));
    await screen.findByRole("heading", { name: "Review AI draft" });
    expect(apply).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Accept AI draft" }));
    expect(apply).toHaveBeenCalledWith("Built TypeScript services for internal teams.");
    expect(announce).toHaveBeenLastCalledWith(expect.stringContaining("normal undo and save flow"));
  });

  it("rejects an edited fabricated claim before accept and allows rejecting without mutation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ draft: "Built TypeScript services for internal teams.", evidenceWarnings: [] }),
          ),
      ),
    );
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByLabelText(/I understand the selected resume field/i));
    await user.click(screen.getByRole("button", { name: "Generate AI draft" }));
    const editor = await screen.findByLabelText("Edit AI draft before accepting");
    await user.clear(editor);
    await user.type(editor, "Built Kubernetes services by 40%.");
    await user.click(screen.getByRole("button", { name: "Accept AI draft" }));
    expect(apply).not.toHaveBeenCalled();
    expect(announce).toHaveBeenLastCalledWith(expect.stringContaining("More information required"));
    await user.click(screen.getByRole("button", { name: "Reject AI draft" }));
    expect(apply).not.toHaveBeenCalled();
  });

  it("does not display a server-blocked fabricated provider draft", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ code: "UNSUPPORTED_DRAFT", evidenceWarnings: ["Kubernetes", "40%"] }), {
            status: 422,
          }),
      ),
    );
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByLabelText(/I understand the selected resume field/i));
    await user.click(screen.getByRole("button", { name: "Generate AI draft" }));
    await waitFor(() => expect(announce).toHaveBeenLastCalledWith(expect.stringContaining("Kubernetes")));
    expect(screen.queryByRole("heading", { name: "Review AI draft" })).not.toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
  });

  it("keeps retry explicit after a normalized failure", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "GEMINI_UNAVAILABLE" }), { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ draft: "Built TypeScript services for internal teams.", evidenceWarnings: [] })),
      );
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByLabelText(/I understand the selected resume field/i));
    const generate = screen.getByRole("button", { name: "Generate AI draft" });
    await user.click(generate);
    await waitFor(() => expect(announce).toHaveBeenLastCalledWith(expect.stringContaining("unavailable")));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(apply).not.toHaveBeenCalled();
    await user.click(generate);
    await screen.findByRole("heading", { name: "Review AI draft" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(apply).not.toHaveBeenCalled();
  });

  it("surfaces a normalized failure and keeps keyboard focus on Generate after cancellation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByLabelText(/I understand the selected resume field/i));
    const generate = screen.getByRole("button", { name: "Generate AI draft" });
    await user.click(generate);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(generate).toHaveFocus());
    expect(generate).toBeEnabled();
    expect(announce).toHaveBeenLastCalledWith(expect.stringContaining("cancelled"));
    expect(apply).not.toHaveBeenCalled();
  });
});
