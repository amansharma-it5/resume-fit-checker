# Phase 12: Backup & Recovery

## Scope and privacy

Backup & Recovery is a Guest Mode, browser-local safety feature. Creating, validating,
encrypting, restoring, scanning, and repairing a backup makes no network or provider
request. A backup can contain sensitive career data, so the application warns before a
plain download and never uploads the file automatically.

The format includes application-owned IndexedDB records: resumes, privacy-safe ATS
summaries, resume versions, job targets, cover letters, interview-practice sessions,
application-tracker records, their stable links, and safe workspace metadata. It also
preserves minimal onboarding state only when the user retains it locally. It excludes
provider prompts and responses, secrets, authentication tokens, environment values,
debug state, transient request state, and object URLs. Session-only display preferences
are deliberately not part of a durable backup.

## Format, encryption, and migration

The JSON manifest identifies `recruitos-ai.workspace-backup`, format schema version,
creation time, entity counts, and a SHA-256 integrity digest of stable serialized
workspace data. Future versions are rejected. Supported older versions must use an
explicit migration; unknown data is never guessed into a current model.

Plain backups are UTF-8 JSON. Optional encrypted backups derive a fresh AES-GCM key
from a user passphrase using PBKDF2-SHA-256 with a fresh cryptographically secure salt
and IV on every export. The passphrase is never stored, logged, transmitted, prefilled,
or recoverable. A forgotten passphrase means the encrypted backup cannot be recovered.
AES-GCM authentication and the manifest digest detect tampering without exposing
cryptographic internals.

## Restore safety

Selecting a file performs a read-only preflight: size limit, format, encryption,
integrity, IDs, dates, duplicate records, unsafe keys, and relationship checks are
validated before any workspace write. Imported strings remain data and are never
rendered as HTML or executed.

**Safe merge** preserves current records and deterministically renames collision IDs,
then remaps internal relationships. **Replace workspace** requires typing `REPLACE` and
clears only RecruitOS AI's own IndexedDB records in one transaction before writing the
validated backup. A failed required write aborts the transaction so the prior workspace
remains unchanged. Restore reports only counts, not sensitive record text.

Storage health lists local entity counts, available browser usage information, broken
links, and last local backup metadata. An integrity scan does not send data. Repair is
limited to explicitly confirmed removal of optional orphan references; it never guesses
a replacement record. Delete all local data requires typing `DELETE`, recommends a
backup, and only removes RecruitOS AI local workspace data.

## Accessibility and manual checklist

The page uses labeled file and password inputs, ordinary keyboard controls, status/error
announcements, typed destructive confirmation, and responsive controls from 320px up.
Screen readers receive one page-level outcome announcement per action.

1. With synthetic data, download a plain backup and inspect the local JSON file.
2. Create an encrypted backup, confirm different exports use different salt/IV values,
   and verify a wrong passphrase does not reveal data.
3. Select a backup and confirm no records change before the read-only preview is
   confirmed. Test merge collisions and typed replace confirmation.
4. Use an invalid, oversized, or modified file and confirm the error is safe and local.
5. Verify integrity scan, persistence request, typed delete cancellation, 320px layout,
   keyboard focus, and browser print behavior.

## Limitations

Browser storage can still be cleared by the user, browser policy, or device recovery;
users should keep encrypted backups in a location they control. Storage usage and
persistence capability vary by browser. Native browser file and print interfaces control
their own final presentation. The feature is not cloud sync, collaboration, telemetry,
or a substitute for an independently stored backup.
