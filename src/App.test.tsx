import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppRoutes } from "./App";
import { isAuthEnabled } from "./lib/features";

describe("authentication feature flag", () => {
  it("defaults to disabled unless explicitly true", () => {
    expect(isAuthEnabled(undefined)).toBe(false);
    expect(isAuthEnabled("false")).toBe(false);
    expect(isAuthEnabled("TRUE")).toBe(false);
    expect(isAuthEnabled("true")).toBe(true);
  });

  it("hides authentication actions when disabled", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <AppRoutes authEnabled={false} />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Accounts coming soon").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Open guest workspace" })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("button", { name: "Log in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Email magic link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Forgot password?" })).not.toBeInTheDocument();
  });

  it("retains existing authentication actions when enabled", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <AppRoutes authEnabled />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Email magic link" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/signup");
  });
});
