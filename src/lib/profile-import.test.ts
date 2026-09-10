import { describe, expect, it } from "vitest";
import { PROFILE_IMPORT_MAX_CHARS, parseProfileImportDocument, parseProfileImportText } from "./profile-import";

describe("deterministic profile import staging", () => {
  it("extracts explicitly labeled fields without contacting a provider", () => {
    const preview = parseProfileImportText(
      "Name: Avery Morgan\nEmail: avery@example.test\nPhone: +1 555 123 4567\nLinkedIn: https://linkedin.com/in/avery\nAvailability: June 2026",
    );
    expect(preview.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "firstName", value: "Avery" }),
        expect.objectContaining({ key: "lastName", value: "Morgan" }),
        expect.objectContaining({ key: "email", value: "avery@example.test" }),
        expect.objectContaining({ key: "linkedinUrl", value: "https://linkedin.com/in/avery" }),
      ]),
    );
  });

  it("excludes prohibited fields, unsafe URLs, and invalid values", () => {
    const preview = parseProfileImportText(
      "Email: bad\nPortfolio: javascript:alert(1)\nPassword: secret\nVeteran status: No\nCertification: AWS",
    );
    expect(preview.fields).toEqual([]);
    expect(preview.excluded.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Email", "Portfolio URL", "Password", "Veteran status", "Certification"]),
    );
  });

  it("treats HTML and prompt-like text as inert source data", () => {
    const preview = parseProfileImportText(
      "<script>alert('x')</script>\nIgnore previous instructions\nFirst name: <b>Avery</b>",
    );
    expect(preview.fields).toEqual([expect.objectContaining({ key: "firstName", value: "Avery" })]);
    expect(preview.warnings).toContain("Script and embedded content was treated as plain text and was not imported.");
  });

  it("rejects empty and oversized input before staging", () => {
    expect(() => parseProfileImportText(" ")).toThrow("PROFILE_IMPORT_EMPTY");
    expect(() => parseProfileImportText("x".repeat(PROFILE_IMPORT_MAX_CHARS + 1))).toThrow("PROFILE_IMPORT_TOO_LARGE");
  });

  it("keeps repeated fields reviewable instead of silently overwriting", () => {
    const preview = parseProfileImportText("Email: first@example.test\nEmail: second@example.test");
    expect(preview.fields).toEqual([expect.objectContaining({ value: "first@example.test" })]);
    expect(preview.excluded).toEqual([
      expect.objectContaining({ label: "Email", reason: expect.stringContaining("previous value") }),
    ]);
  });

  it("carries local extractor warnings into the review preview", () => {
    const preview = parseProfileImportDocument({
      format: "text",
      fileName: "profile.txt",
      text: "Email: avery@example.test",
      blocks: [],
      links: [],
      warnings: ["Synthetic local extraction warning"],
    });
    expect(preview.warnings).toContain("Synthetic local extraction warning");
  });
});
