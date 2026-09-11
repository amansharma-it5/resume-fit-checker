import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { StatusMessage } from "../components/StatusMessage";
import { isSupabaseConfigured, safeRedirectPath, supabase } from "../lib/supabase";

function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="auth-page">
      <div className="auth-panel">
        <p className="eyebrow">RecruitOS AI account</p>
        <h1>{title}</h1>
        {children}
      </div>
    </section>
  );
}
function configMessage() {
  return !isSupabaseConfigured
    ? "Account services are not configured in this environment. Guest mode remains available."
    : "";
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState(configMessage());
  const [busy, setBusy] = useState(false);
  const from = safeRedirectPath((location.state as { from?: string } | null)?.from);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: String(data.get("email")),
        password: String(data.get("password")),
      });
      if (error) setMessage("Login failed. Check your credentials and try again.");
      else navigate(from, { replace: true });
    } catch {
      setMessage("Login failed. Check your credentials and try again.");
    } finally {
      setBusy(false);
    }
  }
  async function magic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(from)}`;
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: String(data.get("magicEmail")),
        options: { emailRedirectTo: redirectTo },
      });
      setMessage(error ? "Magic link could not be sent." : "Check your email for a secure sign-in link.");
    } catch {
      setMessage("Magic link could not be sent.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame title="Welcome back">
      <StatusMessage message={message} error={message.includes("failed") || message.includes("not configured")} />
      <form onSubmit={login}>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="primary" disabled={busy || !supabase}>
          Log in
        </button>
      </form>
      <div className="divider">
        <span>or use a magic link</span>
      </div>
      <form onSubmit={magic}>
        <label>
          Email
          <input name="magicEmail" type="email" autoComplete="email" required />
        </label>
        <button disabled={busy || !supabase}>Email magic link</button>
      </form>
      <p>
        <Link to="/forgot-password">Forgot password?</Link> <Link to="/signup">Create account</Link>
      </p>
      <p>
        <Link to="/dashboard">Continue in guest mode</Link>
      </p>
    </AuthFrame>
  );
}

export function SignupPage() {
  const [message, setMessage] = useState(configMessage());
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const data = new FormData(event.currentTarget);
    if (data.get("password") !== data.get("confirm")) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: String(data.get("email")),
        password: String(data.get("password")),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setMessage(
        error ? "Account creation failed. Review the form and try again." : "Check your email to verify your account.",
      );
    } catch {
      setMessage("Account creation failed. Review the form and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame title="Create your account">
      <StatusMessage message={message} error={message.includes("failed") || message.includes("not configured")} />
      <form onSubmit={submit}>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" minLength={10} autoComplete="new-password" required />
        </label>
        <label>
          Confirm password
          <input name="confirm" type="password" minLength={10} autoComplete="new-password" required />
        </label>
        <button className="primary" disabled={busy || !supabase}>
          Sign up
        </button>
      </form>
      <p>
        <Link to="/login">Already have an account?</Link>
      </p>
    </AuthFrame>
  );
}

export function ForgotPasswordPage() {
  const [message, setMessage] = useState(configMessage());
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(String(data.get("email")), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      setMessage(error ? "Reset email could not be sent." : "If an account exists, a reset link is on its way.");
    } catch {
      setMessage("Reset email could not be sent.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame title="Reset your password">
      <StatusMessage message={message} />
      <form onSubmit={submit}>
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <button className="primary" disabled={busy || !supabase}>
          Send reset link
        </button>
      </form>
      <Link to="/login">Back to login</Link>
    </AuthFrame>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password !== data.get("confirm")) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) setMessage("Password could not be updated. Request a new reset link.");
      else navigate("/dashboard", { replace: true });
    } catch {
      setMessage("Password could not be updated. Request a new reset link.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame title="Choose a new password">
      <StatusMessage message={message} error />
      <form onSubmit={submit}>
        <label>
          New password
          <input name="password" type="password" minLength={10} autoComplete="new-password" required />
        </label>
        <label>
          Confirm password
          <input name="confirm" type="password" minLength={10} autoComplete="new-password" required />
        </label>
        <button className="primary" disabled={busy || !supabase}>
          Update password
        </button>
      </form>
    </AuthFrame>
  );
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState("Completing secure sign-in...");
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!supabase) {
        if (active) setMessage("Account services are unavailable.");
        return;
      }
      try {
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (active) setMessage("This sign-in link is invalid or expired.");
            return;
          }
        }
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (active) setMessage("This sign-in link is invalid or expired.");
          return;
        }
        if (active) navigate(safeRedirectPath(params.get("next")), { replace: true });
      } catch {
        if (active) setMessage("This sign-in link is invalid or expired.");
      }
    })();
    return () => {
      active = false;
    };
  }, [location.search, navigate]);
  return (
    <AuthFrame title="Signing you in">
      <StatusMessage message={message} error={message.includes("invalid") || message.includes("unavailable")} />
    </AuthFrame>
  );
}
