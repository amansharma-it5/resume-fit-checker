import { normalizeImportText, type ExtractedResumeDocument } from "./file-parser";
import { normalizeApplicationProfile, safeProfileUrl, validateApplicationProfile } from "./application-profile";

export const PROFILE_IMPORT_MAX_CHARS = 12000;

export type ImportableProfileKey =
  | "firstName"
  | "lastName"
  | "preferredName"
  | "email"
  | "phone"
  | "city"
  | "stateRegion"
  | "country"
  | "postalCode"
  | "linkedinUrl"
  | "portfolioUrl"
  | "githubUrl"
  | "workAuthorization"
  | "availability"
  | "noticePeriod";

export type ProfileImportField = {
  key: ImportableProfileKey;
  label: string;
  value: string;
  sourceLabel: string;
};

export type ProfileImportPreview = {
  sourceLabel: string;
  fields: ProfileImportField[];
  excluded: Array<{ label: string; reason: string }>;
  warnings: string[];
};

const labels: Array<{ key: ImportableProfileKey; label: string; pattern: RegExp }> = [
  { key: "firstName", label: "First name", pattern: /^(?:first\s+name|given\s+name)$/i },
  { key: "lastName", label: "Last name", pattern: /^(?:last\s+name|family\s+name|surname)$/i },
  { key: "preferredName", label: "Preferred name", pattern: /^preferred\s+name$/i },
  { key: "email", label: "Email", pattern: /^(?:e-?mail|email\s+address)$/i },
  { key: "phone", label: "Phone", pattern: /^(?:phone|mobile|telephone)(?:\s+number)?$/i },
  { key: "city", label: "City", pattern: /^city|town$/i },
  { key: "stateRegion", label: "State / region", pattern: /^(?:state|province|region)$/i },
  { key: "country", label: "Country", pattern: /^(?:country)$/i },
  { key: "postalCode", label: "Postal code", pattern: /^(?:postal|zip)(?:\s+code)?$/i },
  { key: "linkedinUrl", label: "LinkedIn URL", pattern: /^linkedin(?:\s+url)?$/i },
  { key: "portfolioUrl", label: "Portfolio URL", pattern: /^(?:portfolio|personal\s+site)(?:\s+url)?$/i },
  { key: "githubUrl", label: "GitHub URL", pattern: /^github(?:\s+url)?$/i },
  { key: "workAuthorization", label: "Work authorization", pattern: /^(?:work\s+authorization|right\s+to\s+work)$/i },
  { key: "availability", label: "Availability", pattern: /^(?:availability|available(?:\s+date)?)$/i },
  { key: "noticePeriod", label: "Notice period", pattern: /^notice\s+period$/i },
];

const prohibitedPattern =
  /\b(?:ssn|social\s+security|aadhaar|national\s+id|passport|driver.?s?\s+licen[cs]e|bank|credit\s+card|debit\s+card|cvv|password|passcode|otp|one[- ]time|security\s+(?:answer|question)|api\s+key|auth(?:entication)?\s+token|access\s+token|race|ethnic(?:ity)?|religion|disab\w*|veteran|sexual\s+orientation|medical|criminal|convict|eeo|consent|acknowledg\w*|certif\w*)\b/i;

function cleanValue(value: string) {
  const withoutControls = Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return !(code <= 8 || (code >= 11 && code <= 12) || (code >= 14 && code <= 31) || code === 127);
    })
    .join("");
  return withoutControls
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitName(value: string) {
  const parts = cleanValue(value).split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function addField(
  fields: Map<ImportableProfileKey, ProfileImportField>,
  excluded: ProfileImportPreview["excluded"],
  key: ImportableProfileKey,
  label: string,
  rawValue: string,
) {
  const value = cleanValue(rawValue);
  if (!value) return;
  if (fields.has(key)) {
    excluded.push({ label, reason: "A previous value for this field was kept for review." });
    return;
  }
  const candidate = normalizeApplicationProfile({ [key]: value });
  const normalized = candidate[key];
  if (typeof normalized !== "string" || !normalized) {
    excluded.push({ label, reason: "The value was empty or outside the supported profile format." });
    return;
  }
  if (key.endsWith("Url") && !safeProfileUrl(normalized)) {
    excluded.push({ label, reason: "Only a valid HTTPS URL can be imported." });
    return;
  }
  const errors = validateApplicationProfile({ [key]: normalized });
  if (errors[key]) {
    excluded.push({ label, reason: "The value did not pass the existing profile validation rules." });
    return;
  }
  fields.set(key, { key, label, value: normalized, sourceLabel: label });
}

export function parseProfileImportText(text: string, sourceLabel = "Pasted profile"): ProfileImportPreview {
  if (typeof text !== "string" || !text.trim()) throw new Error("PROFILE_IMPORT_EMPTY");
  if (text.length > PROFILE_IMPORT_MAX_CHARS) throw new Error("PROFILE_IMPORT_TOO_LARGE");
  const normalized = normalizeImportText(text);
  const fields = new Map<ImportableProfileKey, ProfileImportField>();
  const excluded: ProfileImportPreview["excluded"] = [];
  const warnings: string[] = [];

  for (const line of normalized.split("\n")) {
    const match = line.match(/^\s*([^-:|]{1,60})\s*[-:|]\s*(.*?)\s*$/);
    if (!match) continue;
    const label = match[1].trim();
    const rawValue = match[2];
    if (prohibitedPattern.test(label)) {
      excluded.push({ label, reason: "Sensitive or prohibited fields are excluded from import." });
      continue;
    }
    if (/^name$/i.test(label)) {
      const name = splitName(rawValue);
      if (!name) {
        excluded.push({ label, reason: "Use separate First name and Last name fields for an unambiguous name." });
      } else {
        addField(fields, excluded, "firstName", "First name", name.firstName);
        addField(fields, excluded, "lastName", "Last name", name.lastName);
      }
      continue;
    }
    const definition = labels.find((item) => item.pattern.test(label));
    if (definition) addField(fields, excluded, definition.key, definition.label, rawValue);
  }

  if (!fields.size) warnings.push("No supported, explicitly labeled profile fields were found.");
  if (/<\s*(?:script|iframe|object|embed)\b/i.test(text))
    warnings.push("Script and embedded content was treated as plain text and was not imported.");
  return { sourceLabel, fields: [...fields.values()], excluded, warnings };
}

export function parseProfileImportDocument(document: ExtractedResumeDocument): ProfileImportPreview {
  const preview = parseProfileImportText(document.text, document.fileName);
  return { ...preview, warnings: [...document.warnings, ...preview.warnings] };
}
