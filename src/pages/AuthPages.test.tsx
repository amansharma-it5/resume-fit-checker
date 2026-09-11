import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    signInWithOtp: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    getSession: vi.fn(),
  },
}));

vi.mock("../lib/supabase", () => ({
  isSupabaseConfigured: true,
  safeRedirectPath: (value: string | null | undefined) => value || "/dashboard",
  supabase: { auth },
}));

import { AuthCallbackPage, LoginPage } from "./AuthPages";

describe("authentication page failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it("releases the login control and shows a generic error when the provider throws", async () => {
    auth.signInWithPassword.mockRejectedValue(new Error("provider response and token details"));
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    await user.type(screen.getAllByRole("textbox", { name: "Email" })[0], "person@example.test");
    await user.type(screen.getByLabelText("Password"), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Login failed."));
    expect(screen.getByRole("button", { name: "Log in" })).not.toBeDisabled();
    expect(screen.queryByText(/provider response|token details/i)).not.toBeInTheDocument();
  });

  it("turns callback restoration errors into a safe expired-link state", async () => {
    auth.getSession.mockRejectedValue(new Error("internal auth response"));
    render(
      <MemoryRouter initialEntries={["/auth/callback?next=/dashboard"]}>
        <AuthCallbackPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("invalid or expired"));
    expect(screen.queryByText(/internal auth response/i)).not.toBeInTheDocument();
  });
});
