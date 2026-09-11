import { describe, expect, it } from "vitest";
import { safeAccountErrorMessage } from "./AccountDataPage";

describe("safe account operation errors", () => {
  it("maps known server codes to user-safe messages", () => {
    expect(safeAccountErrorMessage({ code: "AUTH_REQUIRED", error: "provider detail" })).toBe("Please sign in again.");
    expect(safeAccountErrorMessage({ code: "DATA_SERVICE_ERROR", error: "database detail" })).toBe(
      "Account data is temporarily unavailable.",
    );
  });

  it("does not surface arbitrary server or exception text", () => {
    expect(safeAccountErrorMessage({ code: "INTERNAL", error: "stack trace and secret" })).toBe(
      "Account data request could not be completed. Please try again.",
    );
    expect(safeAccountErrorMessage(null)).toBe("Account data request could not be completed. Please try again.");
  });
});
