import {
  mapApplicationField,
  type ApplicationPrepIntent,
  type ApplicationPrepMappingStatus,
} from "./application-profile";
import type { ApplicationProfile, ApplicationReusableAnswer } from "../types";

export const ASSISTED_APPLY_PROTOCOL = "resume-fit-checker.assisted-apply.v1" as const;
export const ASSISTED_APPLY_APP_ORIGIN = "https://resume-fit-checker.pages.dev" as const;

export type DetectedApplicationField = {
  fieldId: string;
  label: string;
  type: string;
  autocomplete?: string;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  hidden: boolean;
  mappingStatus: ApplicationPrepMappingStatus;
  normalizedIntent?: ApplicationPrepIntent;
};

export type ApplicationFillProposal = DetectedApplicationField & { value: string };

export type ApplicationBridgeSnapshot = {
  profile: Pick<
    ApplicationProfile,
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
    | "sponsorshipRequired"
    | "relocationPreference"
    | "workplacePreference"
    | "compensationExpectation"
    | "noticePeriod"
    | "availability"
    | "yearsExperience"
  >;
  answers: Array<Pick<ApplicationReusableAnswer, "id" | "label" | "question" | "answer" | "category">>;
};

const ambiguousFieldPattern =
  /\b(full\s+name|legal\s+name|preferred\s+name|current\s+location|location|authorized|name)\b/i;
const blockedFieldPattern =
  /\b(password|passcode|one[- ]time|otp|security\s+(?:question|answer)|ssn|social\s+security|passport|driver.?s?\s+licen[cs]e|bank|card\s+number|cvv|captcha|certif\w*|attest\w*|consent|acknowledg\w*|race|ethnic|religion|disab\w*|veteran|gender|sexual\s+orientation|medical|criminal|convict|legal\s+declaration)\b/i;

export function classifyDetectedField(
  label: string,
  value?: string,
): Pick<DetectedApplicationField, "mappingStatus" | "normalizedIntent"> {
  if (blockedFieldPattern.test(label)) return { mappingStatus: "manual_only" };
  if (ambiguousFieldPattern.test(label)) return { mappingStatus: "needs_review" };
  const mapping = mapApplicationField(label, value);
  return {
    mappingStatus: mapping.status,
    ...(mapping.normalizedIntent ? { normalizedIntent: mapping.normalizedIntent } : {}),
  };
}

export function detectApplicationFields(root: Document = document): DetectedApplicationField[] {
  const elements = Array.from(root.querySelectorAll("input, textarea, select"));
  const ids = elements.map((element, index) => element.id || element.getAttribute("name") || `assisted-field-${index}`);
  const duplicateIds = new Set(ids.filter((id, index) => ids.indexOf(id) !== index));
  return elements.map((element, index) => {
    const input = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const type = (input.getAttribute("type") || input.tagName).toLowerCase();
    const label = fieldLabel(input, root);
    const fieldId = input.id || input.name || `assisted-field-${index}`;
    const hidden =
      type === "hidden" || input.getAttribute("aria-hidden") === "true" || input.getClientRects().length === 0;
    const classification = duplicateIds.has(fieldId)
      ? { mappingStatus: "needs_review" as const }
      : classifyDetectedField(`${label} ${input.getAttribute("autocomplete") || ""}`, type);
    return {
      fieldId,
      label,
      type,
      ...(input.getAttribute("autocomplete") ? { autocomplete: input.getAttribute("autocomplete") || undefined } : {}),
      required: input.required,
      disabled: input.disabled,
      readOnly: "readOnly" in input ? input.readOnly : false,
      hidden,
      ...classification,
    };
  });
}

export function buildApplicationFillProposals(
  fields: DetectedApplicationField[],
  profile: Partial<ApplicationProfile>,
): ApplicationFillProposal[] {
  return fields.flatMap((field) => {
    if (
      field.mappingStatus !== "matched" ||
      !field.normalizedIntent ||
      field.disabled ||
      field.readOnly ||
      field.hidden
    )
      return [];
    const value = profileValue(profile, field.normalizedIntent);
    return value ? [{ ...field, value }] : [];
  });
}

export function isFillSafeField(
  field: Pick<DetectedApplicationField, "type" | "disabled" | "readOnly" | "hidden" | "mappingStatus">,
) {
  return (
    field.mappingStatus === "matched" &&
    !field.disabled &&
    !field.readOnly &&
    !field.hidden &&
    !["password", "file", "submit", "button", "reset", "image"].includes(field.type)
  );
}

export function sanitizeApplicationBridgeSnapshot(
  profile: Partial<ApplicationProfile>,
  answers: ApplicationReusableAnswer[],
): ApplicationBridgeSnapshot {
  const allowedProfile = [
    "firstName",
    "lastName",
    "preferredName",
    "email",
    "phone",
    "city",
    "stateRegion",
    "country",
    "postalCode",
    "linkedinUrl",
    "portfolioUrl",
    "githubUrl",
    "workAuthorization",
    "sponsorshipRequired",
    "relocationPreference",
    "workplacePreference",
    "compensationExpectation",
    "noticePeriod",
    "availability",
    "yearsExperience",
  ] as const;
  const profileSnapshot = Object.fromEntries(
    allowedProfile.flatMap((key) => (typeof profile[key] === "string" ? [[key, profile[key]!.slice(0, 400)]] : [])),
  ) as ApplicationBridgeSnapshot["profile"];
  return {
    profile: profileSnapshot,
    answers: answers.slice(0, 20).map((answer) => ({
      id: answer.id.slice(0, 120),
      label: answer.label.slice(0, 160),
      question: answer.question.slice(0, 300),
      answer: answer.answer.slice(0, 4000),
      category: answer.category,
    })),
  };
}

function fieldLabel(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, root: Document) {
  const labels = input.labels ? Array.from(input.labels).map((label) => label.textContent || "") : [];
  const nearby = input.parentElement?.textContent || "";
  return (
    (
      labels.join(" ") ||
      input.getAttribute("aria-label") ||
      input.getAttribute("placeholder") ||
      input.name ||
      input.id ||
      nearby
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240) || `Field ${Array.from(root.querySelectorAll("input, textarea, select")).indexOf(input) + 1}`
  );
}

function profileValue(profile: Partial<ApplicationProfile>, intent: ApplicationPrepIntent) {
  const values: Partial<Record<ApplicationPrepIntent, string | undefined>> = {
    first_name: profile.firstName,
    last_name: profile.lastName,
    email: profile.email,
    phone: profile.phone,
    city: profile.city,
    state_region: profile.stateRegion,
    country: profile.country,
    postal_code: profile.postalCode,
    linkedin_url: profile.linkedinUrl,
    portfolio_url: profile.portfolioUrl,
    github_url: profile.githubUrl,
    work_authorization: profile.workAuthorization,
    sponsorship: profile.sponsorshipRequired,
    relocation: profile.relocationPreference,
    workplace_preference: profile.workplacePreference,
    compensation: profile.compensationExpectation,
    notice_period: profile.noticePeriod,
    availability: profile.availability,
    years_experience: profile.yearsExperience,
  };
  return values[intent]?.trim();
}
