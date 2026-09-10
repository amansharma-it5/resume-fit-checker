import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusMessage } from "../components/StatusMessage";
import { extractResumeDocument } from "../lib/file-parser";
import {
  buildApplicationPrepPreview,
  deleteGuestApplicationAnswer,
  emptyApplicationProfile,
  listGuestApplicationAnswers,
  loadApplicationProfile,
  saveApplicationAnswer,
  saveApplicationProfile,
  validateApplicationProfile,
} from "../lib/application-profile";
import {
  parseProfileImportDocument,
  parseProfileImportText,
  type ProfileImportField,
  type ProfileImportPreview,
} from "../lib/profile-import";
import { createBridgeNonce, isBridgeMessage } from "../lib/assisted-apply-bridge";
import { sanitizeApplicationBridgeSnapshot } from "../lib/assisted-apply";
import { listGuestApplications, listGuestCoverLetters, listGuestResumes, listGuestTargets } from "../lib/guest-db";
import type {
  ApplicationAnswerCategory,
  ApplicationProfile,
  ApplicationReusableAnswer,
  ApplicationRecord,
  CoverLetterDocument,
  JobTarget,
  ResumeDocument,
} from "../types";

const answerCategories: Array<[ApplicationAnswerCategory, string]> = [
  ["interest", "Interest in role"],
  ["relocation", "Relocation"],
  ["sponsorship", "Sponsorship"],
  ["availability", "Availability"],
  ["notice-period", "Notice period"],
  ["compensation", "Compensation"],
  ["other", "Other"],
];

const blankAnswer = { id: "", label: "", question: "", answer: "", category: "other" as ApplicationAnswerCategory };

export function ApplicationProfilePage() {
  const [profile, setProfile] = useState<ApplicationProfile>(emptyApplicationProfile());
  const [answers, setAnswers] = useState<ApplicationReusableAnswer[]>([]);
  const [resumes, setResumes] = useState<ResumeDocument[]>([]);
  const [letters, setLetters] = useState<CoverLetterDocument[]>([]);
  const [targets, setTargets] = useState<JobTarget[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [answerDraft, setAnswerDraft] = useState(blankAnswer);
  const [errors, setErrors] = useState<Partial<Record<keyof ApplicationProfile, string>>>({});
  const [message, setMessage] = useState("");
  const [bridgeNonce, setBridgeNonce] = useState("");
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<ProfileImportPreview | null>(null);
  const [importDecisions, setImportDecisions] = useState<Record<string, "keep" | "use" | "skip">>({});

  useEffect(() => {
    void Promise.all([
      loadApplicationProfile(),
      listGuestApplicationAnswers(),
      listGuestResumes(),
      listGuestCoverLetters(),
      listGuestTargets(),
      listGuestApplications(),
    ]).then(([savedProfile, savedAnswers, savedResumes, savedLetters, savedTargets, savedApplications]) => {
      setProfile(savedProfile);
      setAnswers(savedAnswers);
      setResumes(savedResumes.filter((item) => item.status === "active"));
      setLetters(savedLetters);
      setTargets(savedTargets);
      setApplications(savedApplications);
    });
  }, []);

  useEffect(() => {
    if (!bridgeNonce) return;
    const handleBridgeMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin || !isBridgeMessage(event.data)) return;
      if (event.data.type !== "BRIDGE_PROFILE_REQUEST" || event.data.nonce !== bridgeNonce) return;
      window.postMessage(
        {
          protocol: event.data.protocol,
          type: "BRIDGE_PROFILE_RESPONSE",
          nonce: bridgeNonce,
          snapshot: sanitizeApplicationBridgeSnapshot(profile, answers),
        },
        window.location.origin,
      );
    };
    window.addEventListener("message", handleBridgeMessage);
    window.postMessage(
      { protocol: "resume-fit-checker.assisted-apply.v1", type: "BRIDGE_READY", nonce: bridgeNonce },
      window.location.origin,
    );
    return () => window.removeEventListener("message", handleBridgeMessage);
  }, [answers, bridgeNonce, profile]);

  const preview = useMemo(() => buildApplicationPrepPreview(profile, answers), [profile, answers]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateApplicationProfile(profile);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("Review the highlighted profile fields.");
      return;
    }
    try {
      const saved = await saveApplicationProfile(profile);
      setProfile(saved);
      setMessage("Application profile saved locally.");
    } catch {
      setMessage("The application profile could not be saved.");
    }
  }

  async function clearProfile() {
    const cleared = emptyApplicationProfile();
    await saveApplicationProfile(cleared);
    setProfile(cleared);
    setErrors({});
    setMessage("Application profile cleared locally.");
  }

  async function saveAnswer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const saved = await saveApplicationAnswer(answerDraft);
      setAnswers((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setAnswerDraft(blankAnswer);
      setMessage("Reusable answer saved locally.");
    } catch {
      setMessage("Add a label, question, and answer before saving.");
    }
  }

  async function removeAnswer(id: string) {
    await deleteGuestApplicationAnswer(id);
    setAnswers((current) => current.filter((item) => item.id !== id));
    if (answerDraft.id === id) setAnswerDraft(blankAnswer);
    setMessage("Reusable answer removed.");
  }

  function updateProfile<K extends keyof ApplicationProfile>(key: K, value: ApplicationProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function stageProfileImport(preview: ProfileImportPreview) {
    setImportPreview(preview);
    setImportDecisions(Object.fromEntries(preview.fields.map((field) => [field.key, "skip"])));
    setMessage(`${preview.fields.length} safe field${preview.fields.length === 1 ? "" : "s"} staged for review.`);
  }

  function updateImportDecision(field: ProfileImportField, decision: "keep" | "use" | "skip") {
    setImportDecisions((current) => ({ ...current, [field.key]: decision }));
  }

  async function acceptProfileImport() {
    if (!importPreview) return;
    const updates = Object.fromEntries(
      importPreview.fields
        .filter((field) => importDecisions[field.key] === "use")
        .map((field) => [field.key, field.value]),
    );
    if (!Object.keys(updates).length) {
      setMessage("Choose at least one imported field to use.");
      return;
    }
    try {
      const saved = await saveApplicationProfile({ ...profile, ...updates });
      setProfile(saved);
      setImportPreview(null);
      setImportDecisions({});
      setImportText("");
      setMessage("Selected imported fields saved locally.");
    } catch {
      setMessage("The selected imported fields could not be saved.");
    }
  }

  return (
    <section className="workspace-page application-profile-page">
      <header className="page-heading">
        <p className="eyebrow">Application preparation</p>
        <h1>Application profile</h1>
        <p>
          Keep your own reusable application details in this browser for review before any future assisted autofill.
        </p>
      </header>
      <StatusMessage message={message} />
      <p className="privacy-note">
        Every value here is user-entered. We do not infer facts, submit applications, or auto-fill legal and demographic
        declarations.
      </p>
      <section className="profile-section profile-import-section" aria-labelledby="profile-import-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">User-controlled import</p>
            <h2 id="profile-import-title">Import profile details</h2>
          </div>
          <span className="availability-label">Local only</span>
        </div>
        <p>
          Import labeled details from a file or pasted text. Parsing happens in this browser. Nothing is saved until you
          review each proposed value and choose Use imported.
        </p>
        <div className="profile-import-inputs">
          <label className="wide-field">
            Paste structured profile text
            <textarea
              value={importText}
              maxLength={12000}
              rows={6}
              placeholder={"First name: Avery\nEmail: avery@example.test"}
              onChange={(event) => setImportText(event.target.value)}
            />
          </label>
          <div className="button-row profile-import-actions">
            <button
              type="button"
              className="primary"
              disabled={!importText.trim()}
              onClick={() => {
                try {
                  stageProfileImport(parseProfileImportText(importText));
                } catch (cause) {
                  setMessage(cause instanceof Error ? cause.message : "The profile text could not be reviewed.");
                }
              }}
            >
              Preview pasted profile
            </button>
            <label className="file-import-label">
              Choose profile file
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md,.rtf"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    stageProfileImport(parseProfileImportDocument(await extractResumeDocument(file)));
                  } catch (cause) {
                    setMessage(cause instanceof Error ? cause.message : "The profile file could not be reviewed.");
                  }
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
        {importPreview && (
          <div className="profile-import-preview" aria-labelledby="profile-import-review-title">
            <h3 id="profile-import-review-title">Import review: {importPreview.sourceLabel}</h3>
            <p>
              Choose a decision for each staged field. Current values stay unchanged until you save selected imports.
            </p>
            {importPreview.fields.length ? (
              <ul className="profile-import-list">
                {importPreview.fields.map((field) => (
                  <li key={field.key}>
                    <div className="profile-import-values">
                      <strong>{field.label}</strong>
                      <span>
                        <b>Current:</b> {String(profile[field.key] || "Not set")}
                      </span>
                      <span>
                        <b>Imported:</b> {field.value}
                      </span>
                    </div>
                    <label>
                      Decision
                      <select
                        value={importDecisions[field.key] || "skip"}
                        onChange={(event) => updateImportDecision(field, event.target.value as "keep" | "use" | "skip")}
                      >
                        <option value="skip">Skip</option>
                        <option value="keep">Keep current</option>
                        <option value="use">Use imported</option>
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No safe profile fields are ready to review.</p>
            )}
            {importPreview.excluded.length > 0 && (
              <div className="profile-import-excluded" role="status">
                <strong>Excluded from import</strong>
                <ul>
                  {importPreview.excluded.map((item, index) => (
                    <li key={`${item.label}-${index}`}>
                      {item.label}: {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {importPreview.warnings.map((warning) => (
              <p className="profile-import-warning" role="status" key={warning}>
                {warning}
              </p>
            ))}
            <div className="button-row">
              <button
                type="button"
                onClick={() =>
                  setImportDecisions(
                    Object.fromEntries(
                      importPreview.fields.filter((field) => !profile[field.key]).map((field) => [field.key, "use"]),
                    ),
                  )
                }
              >
                Use all new fields
              </button>
              <button type="button" className="primary" onClick={() => void acceptProfileImport()}>
                Save selected imports
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportPreview(null);
                  setImportDecisions({});
                  setMessage("Import review canceled. No profile changes were made.");
                }}
              >
                Cancel import
              </button>
            </div>
          </div>
        )}
      </section>
      <section className="profile-bridge-note" aria-labelledby="bridge-title">
        <div>
          <p className="eyebrow">Optional local bridge</p>
          <h2 id="bridge-title">Connect an assisted-apply extension</h2>
          <p>
            Enable a one-session, user-started bridge when the extension is open. Only this allowlisted profile snapshot
            and reusable answers are shared; nothing is uploaded or filled automatically.
          </p>
        </div>
        <button type="button" onClick={() => setBridgeNonce(createBridgeNonce())}>
          {bridgeNonce ? "Bridge enabled for this tab" : "Enable extension bridge"}
        </button>
      </section>

      <form className="profile-section" onSubmit={(event) => void saveProfile(event)}>
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Contact details</p>
            <h2>Your details</h2>
          </div>
          <button className="primary" type="submit">
            Save profile
          </button>
        </div>
        <div className="profile-field-grid">
          <ProfileField
            label="First name"
            value={profile.firstName}
            error={errors.firstName}
            onChange={(value) => updateProfile("firstName", value)}
          />
          <ProfileField
            label="Last name"
            value={profile.lastName}
            error={errors.lastName}
            onChange={(value) => updateProfile("lastName", value)}
          />
          <ProfileField
            label="Preferred name"
            value={profile.preferredName}
            error={errors.preferredName}
            onChange={(value) => updateProfile("preferredName", value)}
          />
          <ProfileField
            label="Email"
            type="email"
            value={profile.email}
            error={errors.email}
            onChange={(value) => updateProfile("email", value)}
          />
          <ProfileField
            label="Phone"
            value={profile.phone}
            error={errors.phone}
            onChange={(value) => updateProfile("phone", value)}
          />
          <ProfileField
            label="City"
            value={profile.city}
            error={errors.city}
            onChange={(value) => updateProfile("city", value)}
          />
          <ProfileField
            label="State / region"
            value={profile.stateRegion}
            error={errors.stateRegion}
            onChange={(value) => updateProfile("stateRegion", value)}
          />
          <ProfileField
            label="Country"
            value={profile.country}
            error={errors.country}
            onChange={(value) => updateProfile("country", value)}
          />
          <ProfileField
            label="Postal code"
            value={profile.postalCode}
            error={errors.postalCode}
            onChange={(value) => updateProfile("postalCode", value)}
          />
          <ProfileField
            label="LinkedIn URL"
            type="url"
            value={profile.linkedinUrl}
            error={errors.linkedinUrl}
            onChange={(value) => updateProfile("linkedinUrl", value)}
          />
          <ProfileField
            label="Portfolio URL"
            type="url"
            value={profile.portfolioUrl}
            error={errors.portfolioUrl}
            onChange={(value) => updateProfile("portfolioUrl", value)}
          />
          <ProfileField
            label="GitHub URL"
            type="url"
            value={profile.githubUrl}
            error={errors.githubUrl}
            onChange={(value) => updateProfile("githubUrl", value)}
          />
        </div>
        <div className="profile-field-grid">
          <ProfileField
            label="Work authorization"
            value={profile.workAuthorization}
            error={errors.workAuthorization}
            onChange={(value) => updateProfile("workAuthorization", value)}
          />
          <label>
            Sponsorship required
            <select
              value={profile.sponsorshipRequired || ""}
              onChange={(event) =>
                updateProfile(
                  "sponsorshipRequired",
                  (event.target.value || undefined) as ApplicationProfile["sponsorshipRequired"],
                )
              }
            >
              <option value="">Not provided</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="prefer-not-to-say">Prefer not to say</option>
            </select>
          </label>
          <ProfileField
            label="Relocation preference"
            value={profile.relocationPreference}
            error={errors.relocationPreference}
            onChange={(value) => updateProfile("relocationPreference", value)}
          />
          <label>
            Workplace preference
            <select
              value={profile.workplacePreference || ""}
              onChange={(event) =>
                updateProfile(
                  "workplacePreference",
                  (event.target.value || undefined) as ApplicationProfile["workplacePreference"],
                )
              }
            >
              <option value="">Not provided</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="on-site">On-site</option>
              <option value="flexible">Flexible</option>
            </select>
          </label>
          <ProfileField
            label="Compensation expectation"
            value={profile.compensationExpectation}
            error={errors.compensationExpectation}
            onChange={(value) => updateProfile("compensationExpectation", value)}
          />
          <ProfileField
            label="Notice period"
            value={profile.noticePeriod}
            error={errors.noticePeriod}
            onChange={(value) => updateProfile("noticePeriod", value)}
          />
          <ProfileField
            label="Availability"
            value={profile.availability}
            error={errors.availability}
            onChange={(value) => updateProfile("availability", value)}
          />
          <ProfileField
            label="Years of experience (your entry)"
            value={profile.yearsExperience}
            error={errors.yearsExperience}
            onChange={(value) => updateProfile("yearsExperience", value)}
          />
        </div>
        <div className="button-row">
          <button type="button" onClick={() => void clearProfile()}>
            Clear profile
          </button>
        </div>
      </form>

      <section className="profile-section" aria-labelledby="context-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Stable references</p>
            <h2 id="context-title">Application context</h2>
          </div>
        </div>
        <p>References point to existing local records. Their contents are not copied into this profile.</p>
        <div className="profile-field-grid">
          <ReferenceSelect
            label="Resume"
            value={profile.linkedResumeId}
            options={resumes.map((item) => [item.id, item.title])}
            onChange={(value) => updateProfile("linkedResumeId", value || undefined)}
          />
          <ReferenceSelect
            label="Cover letter"
            value={profile.linkedCoverLetterId}
            options={letters.map((item) => [item.id, item.title])}
            onChange={(value) => updateProfile("linkedCoverLetterId", value || undefined)}
          />
          <ReferenceSelect
            label="Job target"
            value={profile.linkedJobTargetId}
            options={targets.map((item) => [item.id, `${item.role} at ${item.company}`])}
            onChange={(value) => updateProfile("linkedJobTargetId", value || undefined)}
          />
          <ReferenceSelect
            label="Application"
            value={profile.linkedApplicationId}
            options={applications.map((item) => [item.id, `${item.role} at ${item.company}`])}
            onChange={(value) => updateProfile("linkedApplicationId", value || undefined)}
          />
        </div>
        <p className="privacy-note">Save the profile above to keep reference selections on this device.</p>
      </section>

      <section className="profile-section" aria-labelledby="answers-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">User-written library</p>
            <h2 id="answers-title">Reusable answers</h2>
          </div>
        </div>
        <p>Write answers once for review. No answer is generated or submitted automatically.</p>
        <form className="answer-form" onSubmit={(event) => void saveAnswer(event)}>
          <label>
            Label
            <input
              value={answerDraft.label}
              maxLength={160}
              onChange={(event) => setAnswerDraft({ ...answerDraft, label: event.target.value })}
              required
            />
          </label>
          <label>
            Common question
            <input
              value={answerDraft.question}
              maxLength={300}
              onChange={(event) => setAnswerDraft({ ...answerDraft, question: event.target.value })}
              required
            />
          </label>
          <label>
            Category
            <select
              value={answerDraft.category}
              onChange={(event) =>
                setAnswerDraft({ ...answerDraft, category: event.target.value as ApplicationAnswerCategory })
              }
            >
              {answerCategories.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="wide-field">
            Your answer
            <textarea
              value={answerDraft.answer}
              maxLength={4000}
              rows={5}
              onChange={(event) => setAnswerDraft({ ...answerDraft, answer: event.target.value })}
              required
            />
          </label>
          <div className="button-row">
            <button className="primary" type="submit">
              {answerDraft.id ? "Update answer" : "Add answer"}
            </button>
            {answerDraft.id && (
              <button type="button" onClick={() => setAnswerDraft(blankAnswer)}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
        {answers.length ? (
          <ul className="profile-answer-list">
            {answers.map((answer) => (
              <li key={answer.id}>
                <div>
                  <strong>{answer.label}</strong>
                  <span>{answer.category}</span>
                  <p>{answer.question}</p>
                </div>
                <div className="button-row">
                  <button type="button" onClick={() => setAnswerDraft(answer)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => void removeAnswer(answer.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">No reusable answers saved yet.</p>
        )}
      </section>

      <section className="profile-section" aria-labelledby="preview-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Deterministic review</p>
            <h2 id="preview-title">Mapping preview</h2>
          </div>
          <span className="availability-label">No external website connected</span>
        </div>
        <p>
          Preview shows how a future assisted flow would classify your explicit entries. Ambiguous fields stay visible
          for review.
        </p>
        {preview.length ? (
          <ul className="profile-mapping-list">
            {preview.map((item, index) => (
              <li key={`${item.fieldLabel}-${index}`}>
                <div>
                  <strong>{item.fieldLabel}</strong>
                  {item.normalizedIntent && <span>{item.normalizedIntent}</span>}
                </div>
                <span className={`mapping-status mapping-${item.status}`}>{item.status.replace("_", " ")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">Add a profile field or reusable answer to preview its mapping.</p>
        )}
        <p className="manual-only-note">
          Legal certifications, truthfulness attestations, consent acknowledgments, criminal/legal declarations, and
          sensitive demographic self-identification remain manual-only.
        </p>
      </section>
      <p>
        <Link to="/applications">Open Applications</Link> to review existing local application records.
      </p>
    </section>
  );
}

function ProfileField({
  label,
  value,
  type = "text",
  error,
  onChange,
}: {
  label: string;
  value?: string;
  type?: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = `profile-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        type={type}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
      />
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

function ReferenceSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value || ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">No reference selected</option>
        {options.map(([id, title]) => (
          <option key={id} value={id}>
            {title}
          </option>
        ))}
      </select>
    </label>
  );
}
