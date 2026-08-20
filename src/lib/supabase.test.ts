import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./supabase";

describe("safeRedirectPath", () => {
  it("allows only same-origin relative routes", () => {
    expect(safeRedirectPath("/dashboard?tab=recent")).toBe("/dashboard?tab=recent");
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", null])(
    "rejects unsafe redirect %s",
    (value) => {
      expect(safeRedirectPath(value)).toBe("/dashboard");
    },
  );
});
