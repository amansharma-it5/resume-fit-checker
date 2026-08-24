import { describe, expect, it } from "vitest";
import { expectedAuthEnabled } from "./playwright-auth-mode";

describe("Playwright expected authentication mode", () => {
  it("defaults local runs to authentication disabled", () => {
    expect(expectedAuthEnabled({})).toBe(false);
  });

  it("requires an explicit mode for external targets", () => {
    expect(() => expectedAuthEnabled({ PLAYWRIGHT_BASE_URL: "https://example.test" })).toThrow(
      "PLAYWRIGHT_EXPECT_AUTH_ENABLED",
    );
  });

  it("supports auth-enabled Deploy Preview coverage", () => {
    expect(
      expectedAuthEnabled({
        PLAYWRIGHT_BASE_URL: "https://deploy-preview.example.test",
        PLAYWRIGHT_EXPECT_AUTH_ENABLED: "true",
      }),
    ).toBe(true);
  });

  it("supports intentionally auth-disabled production coverage", () => {
    expect(
      expectedAuthEnabled({
        PLAYWRIGHT_BASE_URL: "https://production.example.test",
        PLAYWRIGHT_EXPECT_AUTH_ENABLED: "false",
      }),
    ).toBe(false);
  });
});
