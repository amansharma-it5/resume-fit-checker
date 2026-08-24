export type PlaywrightEnvironment = {
  PLAYWRIGHT_BASE_URL?: string;
  PLAYWRIGHT_EXPECT_AUTH_ENABLED?: string;
};

export function expectedAuthEnabled(environment: PlaywrightEnvironment): boolean {
  const configured = environment.PLAYWRIGHT_EXPECT_AUTH_ENABLED;
  const usesExternalUrl = Boolean(environment.PLAYWRIGHT_BASE_URL?.trim());

  if (configured === "true") return true;
  if (configured === "false") return false;
  if (usesExternalUrl) {
    throw new Error(
      "External Playwright runs must set PLAYWRIGHT_EXPECT_AUTH_ENABLED=true or PLAYWRIGHT_EXPECT_AUTH_ENABLED=false.",
    );
  }
  return false;
}
