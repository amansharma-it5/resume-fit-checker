import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { TailoringPanel } from "./TailoringPanel";
import type { DraftField } from "../../lib/ai-drafting";
const apply = vi.fn();
const announce = vi.fn();
const field: DraftField = {
  id: "summary:entry:text",
  label: "Professional summary",
  draftType: "SUMMARY",
  sectionId: "summary",
  entryId: "entry",
  field: "text",
  currentText: "Built TypeScript services.",
  relevantEvidence: "Built TypeScript services for internal teams.",
  apply,
};
const output = {
  proposals: [
    {
      fieldId: field.id,
      currentText: field.currentText,
      proposedText: "Built TypeScript services for internal teams.",
      rationale: "Clarifies existing work.",
      evidenceRefs: [field.id],
      changeKind: "clarity",
    },
  ],
  gaps: [{ requirement: "Kubernetes" }],
};
const props = {
  fields: [field],
  role: "Engineer",
  jobDescription: "TypeScript and Kubernetes required.",
  onAnnouncement: announce,
};
const view = (patch: Partial<typeof props> = {}) => <TailoringPanel {...props} {...patch} />;
async function generate() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Tailor to Job" }));
  await user.click(screen.getByRole("checkbox", { name: /I consent to sending/ }));
  await user.click(screen.getByRole("button", { name: "Generate tailoring proposals" }));
  return user;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  apply.mockReset();
  announce.mockReset();
});
it("regenerates one field and preserves the other proposals with distinct controls", async () => {
  const other = { ...field, id: "second:entry:text", sectionId: "second" };
  const otherProposal = { ...output.proposals[0], fieldId: other.id, evidenceRefs: [other.id] };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ ...output, proposals: [...output.proposals, otherProposal] }))
    .mockResolvedValueOnce(Response.json(output));
  vi.stubGlobal("fetch", fetcher);
  render(view({ fields: [field, other] }));
  const user = await generate();
  await screen.findByRole("button", { name: "Accept proposal 2" });
  await user.click(screen.getByRole("button", { name: "Regenerate proposal 1" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByRole("button", { name: "Accept proposal 2" })).toBeEnabled());
  expect(screen.getAllByRole("button", { name: /Accept proposal/ })).toHaveLength(2);
  expect(JSON.parse(fetcher.mock.calls[1][1].body).fields).toHaveLength(1);
  expect(apply).not.toHaveBeenCalled();
});
it("requires explicit consent and does not request on render or target/source changes", async () => {
  const fetcher = vi.fn(async () => Response.json(output));
  vi.stubGlobal("fetch", fetcher);
  const user = userEvent.setup();
  const rendered = render(view());
  rendered.rerender(view({ role: "New role" }));
  await user.click(screen.getByRole("button", { name: "Tailor to Job" }));
  expect(screen.getByRole("checkbox", { name: /I consent/ })).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Generate tailoring proposals" })).toBeDisabled();
  expect(fetcher).not.toHaveBeenCalled();
});
it("separates gaps, edits transiently, rejects without mutation and restores focus", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(output)),
  );
  render(view());
  const user = await generate();
  await screen.findByRole("region", { name: /Professional summary proposal/ });
  expect(within(screen.getByRole("region", { name: "Unmet job requirements" })).getByText(/Kubernetes/)).toBeVisible();
  const edit = screen.getByRole("textbox", { name: /Edit proposal \d+ before accepting/ });
  await user.clear(edit);
  await user.type(edit, "Built Kubernetes services by 40%.");
  expect(apply).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: /Accept proposal/ }));
  expect(apply).not.toHaveBeenCalled();
  expect(announce).toHaveBeenLastCalledWith(expect.stringContaining("More information required"));
  await user.click(screen.getByRole("button", { name: /Reject proposal/ }));
  expect(apply).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Generate tailoring proposals" })).toHaveFocus();
});
it("accepts only the intended field through its existing callback", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(output)),
  );
  render(view());
  const user = await generate();
  await user.click(await screen.findByRole("button", { name: /Accept proposal/ }));
  expect(apply).toHaveBeenCalledExactlyOnceWith(output.proposals[0].proposedText);
  expect(screen.queryByRole("button", { name: /Accept proposal/ })).not.toBeInTheDocument();
});
it.each(["source", "evidence", "target", "deleted"])("prevents accepting a stale %s", async (change) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(output)),
  );
  const rendered = render(view());
  await generate();
  await screen.findByRole("button", { name: /Accept proposal/ });
  rendered.rerender(
    view(
      change === "target"
        ? { jobDescription: "New JD" }
        : {
            fields:
              change === "deleted"
                ? []
                : [
                    {
                      ...field,
                      ...(change === "source"
                        ? { currentText: "New user edit" }
                        : { relevantEvidence: "Changed evidence" }),
                    },
                  ],
          },
    ),
  );
  expect(screen.getByRole("button", { name: /Accept proposal/ })).toBeDisabled();
  expect(apply).not.toHaveBeenCalled();
});
it("cancels in-flight requests, ignores late responses, and prevents duplicates", async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi.fn<(url: unknown, init: RequestInit) => Promise<Response>>(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(view());
  const user = await generate();
  expect(screen.getByRole("button", { name: "Generating tailoring..." })).toBeDisabled();
  expect(fetcher).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole("button", { name: "Cancel tailoring" }));
  expect(fetcher.mock.calls[0][1].signal?.aborted).toBe(true);
  await act(async () => resolve(Response.json(output)));
  expect(screen.queryByRole("button", { name: /Accept proposal/ })).not.toBeInTheDocument();
  expect(apply).not.toHaveBeenCalled();
});
it.each([429, 502, 503])("handles %s without automatic retries", async (status) => {
  const fetcher = vi.fn(async () => Response.json({ code: "SAFE_ERROR" }, { status }));
  vi.stubGlobal("fetch", fetcher);
  render(view());
  await generate();
  await waitFor(() => expect(screen.getByRole("button", { name: "Generate tailoring proposals" })).toBeEnabled());
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(apply).not.toHaveBeenCalled();
  expect(announce).toHaveBeenLastCalledWith(
    expect.stringMatching(status === 429 ? /Try again later/ : status === 502 ? /validated/ : /unavailable/),
  );
});
it("removes transient proposals when unmounted and only regenerates explicitly", async () => {
  const fetcher = vi.fn(async () => Response.json(output));
  vi.stubGlobal("fetch", fetcher);
  const rendered = render(view());
  const user = await generate();
  await user.click(await screen.findByRole("button", { name: /Regenerate proposal/ }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  rendered.unmount();
  render(view());
  expect(screen.queryByRole("button", { name: /Accept proposal/ })).not.toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
