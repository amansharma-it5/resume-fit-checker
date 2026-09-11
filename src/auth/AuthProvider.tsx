import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase) {
      setSession(null);
      setLoading(false);
      return;
    }
    let active = true;
    let authEventSeen = false;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      authEventSeen = true;
      if (!active) return;
      setSession(next);
      setLoading(false);
    });
    void supabase.auth
      .getSession()
      .then(({ data: sessionData, error }) => {
        if (!active) return;
        if (!authEventSeen) setSession(error ? null : sessionData.session);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        if (!authEventSeen) setSession(null);
        setLoading(false);
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const value = useMemo(
    () => ({
      user: session?.user || null,
      session,
      loading,
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  return useContext(AuthContext);
}
