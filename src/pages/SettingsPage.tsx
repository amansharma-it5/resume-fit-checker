import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { StatusMessage } from "../components/StatusMessage";
import { clearGuestData } from "../lib/guest-db";
import { supabase } from "../lib/supabase";

type Preferences = {
  aiConsent: boolean;
  storageConsent: boolean;
  analyticsConsent: boolean;
  theme: "system" | "light" | "dark";
  reducedMotion: boolean;
  pageSize: "letter" | "a4";
};
const defaults: Preferences = {
  aiConsent: false,
  storageConsent: false,
  analyticsConsent: false,
  theme: "system",
  reducedMotion: false,
  pageSize: "letter",
};
export function SettingsPage({ authEnabled }: { authEnabled: boolean }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(defaults);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const saved = sessionStorage.getItem("resume-lab-preferences");
    if (saved) {
      try {
        setPrefs({ ...defaults, ...JSON.parse(saved) });
      } catch {
        /* ignore invalid local preference */
      }
    }
    setName(String(user?.user_metadata?.display_name || ""));
  }, [user]);
  function savePreferences() {
    sessionStorage.setItem("resume-lab-preferences", JSON.stringify(prefs));
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.classList.toggle("reduce-motion", prefs.reducedMotion);
    setMessage("Preferences saved on this device.");
  }
  async function saveProfile() {
    if (!supabase || !user) return;
    const { error } = await supabase.auth.updateUser({ data: { display_name: name.trim() } });
    setMessage(error ? "Profile could not be updated." : "Profile updated.");
  }
  return (
    <section className="workspace-page">
      <header className="page-heading">
        <p className="eyebrow">Controls</p>
        <h1>Settings and privacy</h1>
      </header>
      <StatusMessage message={message} />
      <section>
        <h2>Profile</h2>
        {user ? (
          <>
            <p>Signed in as {user.email}</p>
            <label>
              Display name
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <button onClick={() => void saveProfile()}>Save profile</button>
          </>
        ) : authEnabled ? (
          <p>
            Guest mode. <Link to="/login">Log in</Link> to manage an account.
          </p>
        ) : (
          <p>
            Guest mode. <span className="availability-label">Accounts coming soon</span>
          </p>
        )}
      </section>
      <section>
        <h2>Consent</h2>
        <label className="check-row">
          <input
            type="checkbox"
            checked={prefs.aiConsent}
            onChange={(e) => setPrefs({ ...prefs, aiConsent: e.target.checked })}
          />
          Remember my AI-provider consent preference for this browser session
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={prefs.storageConsent}
            onChange={(e) => setPrefs({ ...prefs, storageConsent: e.target.checked })}
          />
          Allow account resume storage
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={prefs.analyticsConsent}
            onChange={(e) => setPrefs({ ...prefs, analyticsConsent: e.target.checked })}
          />
          Allow privacy-safe analytics (no analytics provider is enabled)
        </label>
      </section>
      <section>
        <h2>Display</h2>
        <label>
          Theme
          <select
            value={prefs.theme}
            onChange={(e) => setPrefs({ ...prefs, theme: e.target.value as Preferences["theme"] })}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={prefs.reducedMotion}
            onChange={(e) => setPrefs({ ...prefs, reducedMotion: e.target.checked })}
          />
          Reduce motion
        </label>
        <label>
          Default page size
          <select
            value={prefs.pageSize}
            onChange={(e) => setPrefs({ ...prefs, pageSize: e.target.value as Preferences["pageSize"] })}
          >
            <option value="letter">US Letter</option>
            <option value="a4">A4</option>
          </select>
        </label>
        <button className="primary" onClick={savePreferences}>
          Save preferences
        </button>
      </section>
      <section>
        <h2>Data controls</h2>
        <button
          className="danger"
          onClick={() => {
            if (window.confirm("Clear all guest resumes and local analysis summaries from this browser?"))
              void clearGuestData().then(() => setMessage("Guest data cleared."));
          }}
        >
          Clear guest data
        </button>
        {user && (
          <p>
            <Link to="/account/data">Export account data or request account deletion</Link>
          </p>
        )}
      </section>
    </section>
  );
}
