import { describe, expect, it } from "vitest";
import {
  buildApplicationFillProposals,
  classifyDetectedField,
  detectApplicationFields,
  isFillSafeField,
  sanitizeApplicationBridgeSnapshot,
} from "./assisted-apply";

describe("assisted apply foundation", () => {
  it("detects fields from multiple semantic signals and reuses Phase 18 intents", () => {
    const root = document.implementation.createHTMLDocument();
    root.body.innerHTML = `<form>
      <label for="email">Work email</label><input id="email" autocomplete="email" />
      <label for="where">Current location</label><input id="where" />
      <label for="k8s">Kubernetes experience</label><input id="k8s" />
    </form>`;
    const fields = detectApplicationFields(root);
    expect(fields[0]).toMatchObject({ normalizedIntent: "email", mappingStatus: "matched" });
    expect(fields[1]).toMatchObject({ mappingStatus: "needs_review" });
    expect(fields[2]).toMatchObject({ mappingStatus: "unmapped" });
  });

  it("never proposes values for manual-only, hidden, disabled, or ambiguous fields", () => {
    const profile = { firstName: "Sam", email: "sam@example.test", workAuthorization: "Yes" };
    const fields = [
      {
        fieldId: "first",
        label: "First name",
        type: "text",
        required: false,
        disabled: false,
        readOnly: false,
        hidden: false,
        mappingStatus: "matched" as const,
        normalizedIntent: "first_name" as const,
      },
      {
        fieldId: "legal",
        label: "I certify this is true",
        type: "checkbox",
        required: true,
        disabled: false,
        readOnly: false,
        hidden: false,
        mappingStatus: "manual_only" as const,
      },
      {
        fieldId: "hidden",
        label: "Email",
        type: "email",
        required: false,
        disabled: false,
        readOnly: false,
        hidden: true,
        mappingStatus: "matched" as const,
        normalizedIntent: "email" as const,
      },
      {
        fieldId: "location",
        label: "Location",
        type: "text",
        required: false,
        disabled: false,
        readOnly: false,
        hidden: false,
        mappingStatus: "needs_review" as const,
      },
    ];
    expect(buildApplicationFillProposals(fields, profile)).toMatchObject([{ fieldId: "first", value: "Sam" }]);
    expect(isFillSafeField(fields[1])).toBe(false);
  });

  it("keeps bridge data allowlisted and bounded", () => {
    const snapshot = sanitizeApplicationBridgeSnapshot(
      { firstName: "Sam", linkedResumeId: "resume-1", ssn: "never" } as never,
      [{ id: "a", label: "Interest", question: "Why?", answer: "Because.", category: "interest", updatedAt: "now" }],
    );
    expect(snapshot.profile).toEqual({ firstName: "Sam" });
    expect(JSON.stringify(snapshot)).not.toContain("resume-1");
    expect(JSON.stringify(snapshot)).not.toContain("never");
  });

  it.each([["I certify that this is true"], ["SSN"], ["Password"], ["Veteran status"]])(
    "classifies %s as manual-only",
    (label) => {
      expect(classifyDetectedField(label).mappingStatus).toBe("manual_only");
    },
  );
});
