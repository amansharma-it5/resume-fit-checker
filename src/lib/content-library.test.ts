import { beforeEach, describe, expect, it } from "vitest";
import { clearGuestData } from "./guest-db";
import {
  BUILT_IN_CONTENT,
  CONTENT_LIBRARY_MAX_ITEMS,
  contentLibraryTags,
  extractPlaceholders,
  listUserSnippets,
  normalizeUserSnippet,
  saveUserSnippet,
  searchContentLibrary,
  deleteUserSnippet,
} from "./content-library";

describe.sequential("content library foundation", () => {
  beforeEach(async () => clearGuestData());

  it("keeps built-in content as guidance and preserves placeholders", () => {
    expect(BUILT_IN_CONTENT.length).toBeGreaterThan(10);
    expect(BUILT_IN_CONTENT.every((item) => item.source === "builtin" && item.evidenceEligible === false)).toBe(true);
    expect(BUILT_IN_CONTENT.some((item) => item.placeholders.includes("verified result"))).toBe(true);
    expect(BUILT_IN_CONTENT.every((item) => !/\b\d+%|\$\d|\b\d+x\b/.test(item.templateText))).toBe(true);
    expect(extractPlaceholders("[action] and [action] for [verified result]")).toEqual(["action", "verified result"]);
  });

  it("normalizes a user snippet without treating it as evidence", () => {
    const snippet = normalizeUserSnippet({
      category: "resume_bullet",
      title: "  My pattern ",
      templateText: "Use [action] with [verified result]",
      tags: ["Impact", "impact", " "],
      intendedUse: "Personal drafting guidance",
    });
    expect(snippet).toMatchObject({ source: "user", title: "My pattern", tags: ["impact"], evidenceEligible: false });
    expect(snippet.placeholders).toEqual(["action", "verified result"]);
  });

  it("searches by text, category, and tag with a bounded result set", () => {
    const items = Array.from({ length: CONTENT_LIBRARY_MAX_ITEMS + 10 }, (_, index) =>
      normalizeUserSnippet({
        category: "technical_delivery",
        title: `Pattern ${index}`,
        templateText: "Use [technology] for [scope]",
        tags: ["technical"],
        intendedUse: "Guidance",
      }),
    );
    expect(searchContentLibrary(items, "technology", "technical_delivery", "technical")).toHaveLength(
      CONTENT_LIBRARY_MAX_ITEMS,
    );
    expect(contentLibraryTags(items)).toEqual(["technical"]);
  });

  it("persists and deletes only local user snippets", async () => {
    const saved = await saveUserSnippet({
      category: "interview_star",
      title: "My STAR frame",
      templateText: "Situation: [context]\nAction: [action]",
      tags: ["Interview"],
      intendedUse: "Organize my own answer",
    });
    expect(await listUserSnippets()).toEqual([saved]);
    const updated = await saveUserSnippet({
      ...saved,
      title: "Updated STAR frame",
      templateText: "Situation: [context]\nResult: [verified result]",
    });
    expect(await listUserSnippets()).toEqual([expect.objectContaining({ id: saved.id, title: updated.title })]);
    await deleteUserSnippet(saved.id);
    expect(await listUserSnippets()).toEqual([]);
  });

  it("keeps snippet markup as inert text data", () => {
    const snippet = normalizeUserSnippet({
      category: "application_response",
      title: "Plain text",
      templateText: "<script>alert(1)</script> [truthful reason]",
      tags: [],
      intendedUse: "Review before copying",
    });
    expect(snippet.templateText).toContain("<script>");
    expect(snippet.evidenceEligible).toBe(false);
  });
});
