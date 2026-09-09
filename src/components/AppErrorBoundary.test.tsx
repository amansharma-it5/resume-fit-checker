import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

function BrokenChild(): never {
  throw new Error("synthetic render failure");
}

describe("AppErrorBoundary", () => {
  it("contains render failures without exposing error details", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <AppErrorBoundary>
        <BrokenChild />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The workspace needs to reload");
    expect(screen.getByRole("button", { name: "Reload workspace" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to RecruitOS AI" })).toHaveAttribute("href", "/");
    expect(screen.queryByText("synthetic render failure")).not.toBeInTheDocument();
  });

  it("renders children normally", () => {
    render(
      <AppErrorBoundary>
        <p>Ready</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });
});
