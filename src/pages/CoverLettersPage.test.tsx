import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createCoverLetter } from "../lib/cover-letters";
import type { ResumeDocument } from "../types";
import { CoverLettersPage, type CoverLetterRepository } from "./CoverLettersPage";

const resume: ResumeDocument = {
  id: "resume-1",
  title: "Synthetic resume",
  status: "active",
  structuredData: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderPage(repository: CoverLetterRepository) {
  return render(
    <MemoryRouter>
      <CoverLettersPage repository={repository} />
    </MemoryRouter>,
  );
}

async function createLetter(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("option", { name: "Synthetic resume" });
  await user.selectOptions(screen.getByLabelText("Resume"), "resume-1");
  await user.type(screen.getByLabelText("Company"), "Example Labs");
  await user.type(screen.getByLabelText("Role"), "Engineer");
  await user.type(screen.getByLabelText("Job description"), "Use TypeScript.");
  await user.click(screen.getByRole("button", { name: "Create local cover letter" }));
  await screen.findByRole("heading", { name: /Engineer cover letter/ });
}

describe("CoverLettersPage save recovery", () => {
  it("keeps unsaved text visible and recovers through manual Save after a storage failure", async () => {
    const stored = new Map<string, ReturnType<typeof createCoverLetter>>();
    let failNextUpdate = true;
    const repository: CoverLetterRepository = {
      getTarget: vi.fn(),
      listLetters: vi.fn(async () => [...stored.values()]),
      listResumes: vi.fn(async () => [resume]),
      putLetter: vi.fn(async (letter, expectedVersion) => {
        const previous = stored.get(letter.id);
        if (!previous) {
          const created = { ...letter, editorVersion: 1 };
          stored.set(created.id, created);
          return created;
        }
        if (failNextUpdate) {
          failNextUpdate = false;
          throw new Error("Synthetic storage failure");
        }
        if (expectedVersion !== previous.editorVersion) throw new Error("SAVE_CONFLICT");
        const saved = { ...letter, editorVersion: previous.editorVersion + 1 };
        stored.set(saved.id, saved);
        return saved;
      }),
    };
    const user = userEvent.setup();
    renderPage(repository);
    await createLetter(user);

    const opening = screen.getByLabelText("Opening");
    await user.clear(opening);
    await user.type(opening, "Current unsaved synthetic text.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("could not be saved locally"));
    expect(opening).toHaveValue("Current unsaved synthetic text.");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Cover letter saved locally."));
    expect(opening).toHaveValue("Current unsaved synthetic text.");

    await user.click(screen.getByRole("button", { name: "Undo" }));
    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(opening).toHaveValue("Current unsaved synthetic text.");
  });

  it("does not let a delayed stale save replace a newer editor revision", async () => {
    let resolveFirst: ((value: ReturnType<typeof createCoverLetter>) => void) | undefined;
    let saved: ReturnType<typeof createCoverLetter> | undefined;
    const repository: CoverLetterRepository = {
      getTarget: vi.fn(),
      listLetters: vi.fn(async () => (saved ? [saved] : [])),
      listResumes: vi.fn(async () => [resume]),
      putLetter: vi.fn((letter: ReturnType<typeof createCoverLetter>) => {
        if (!saved) {
          saved = { ...letter, editorVersion: 1 };
          return Promise.resolve(saved);
        }
        if (!resolveFirst) {
          return new Promise<ReturnType<typeof createCoverLetter>>((resolve) => {
            resolveFirst = resolve;
          });
        }
        saved = { ...letter, editorVersion: saved.editorVersion + 1 };
        return Promise.resolve(saved);
      }),
    };
    const user = userEvent.setup();
    renderPage(repository);
    await createLetter(user);
    const opening = screen.getByLabelText("Opening");
    fireEvent.change(opening, { target: { value: "First revision." } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.change(opening, { target: { value: "Newer revision." } });
    resolveFirst?.({ ...(saved as ReturnType<typeof createCoverLetter>), opening: "First revision.", editorVersion: 2 });
    await waitFor(() => expect(opening).toHaveValue("Newer revision."));
  });
});
