import { act, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock("../lib/supabase", () => ({
  supabase: { auth },
}));

import { AuthProvider, useAuth } from "./AuthProvider";

function Probe() {
  const { loading, session } = useAuth();
  return <output data-testid="auth-state">{loading ? "loading" : session?.user.email || "signed-out"}</output>;
}

const signedInSession = { user: { email: "person@example.test" } } as unknown as Session;

describe("AuthProvider session bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("leaves the loading gate when session restoration fails", async () => {
    auth.getSession.mockRejectedValue(new Error("provider response details"));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("auth-state")).toHaveTextContent("signed-out"));
  });

  it("does not let a stale bootstrap result overwrite a newer auth event", async () => {
    let resolveSession!: (value: { data: { session: Session | null }; error: null }) => void;
    auth.getSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    const callback = auth.onAuthStateChange.mock.calls[0][0] as (_event: string, session: Session) => void;
    await act(async () => {
      callback("SIGNED_IN", signedInSession);
      resolveSession({ data: { session: null }, error: null });
    });
    await waitFor(() => expect(screen.getByTestId("auth-state")).toHaveTextContent("person@example.test"));
  });
});
