import {
  deleteGuestApplicationAnswer,
  getGuestApplicationProfile,
  listGuestApplicationAnswers,
  saveGuestApplicationAnswer,
  saveGuestApplicationProfile,
} from "./guest-db";
import type { ApplicationAnswerCategory, ApplicationProfile, ApplicationReusableAnswer } from "../types";

export const APPLICATION_PROFILE_ID = "default" as const;
export const APPLICATION_PROFILE_SCHEMA_VERSION = 1 as const;

export const APPLICATION_PREP_INTENTS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "city",
  "state_region",
  "country",
  "postal_code",
  "linkedin_url",
  "portfolio_url",
  "github_url",
  "work_authorization",
  "sponsorship",
  "relocation",
  "workplace_preference",
  "availability",
  "notice_period",
  "compensation",
  "years_experience",
] as const;
export type ApplicationPrepIntent = (typeof APPLICATION_PREP_INTENTS)[number];
export type ApplicationPrepMappingStatus = "matched" | "needs_review" | "unmapped" | "manual_only";

export type ApplicationPrepMapping = {
  fieldLabel: string;
  normalizedIntent?: ApplicationPrepIntent;
  value?: string;
  status: ApplicationPrepMappingStatus;
};

const profileTextLimits: Record<string, number> = {
  firstName: 80,
  lastName: 80,
  preferredName: 80,
  email: 254,
  phone: 40,
  city: 120,
  stateRegion: 120,
  country: 120,
  postalCode: 40,
  workAuthorization: 300,
  relocationPreference: 300,
  compensationExpectation: 200,
  noticePeriod: 120,
  availability: 200,
  yearsExperience: 80,
};

const profileFields = [
  ["firstName", "First name", "first_name"],
  ["lastName", "Last name", "last_name"],
  ["preferredName", "Preferred name", undefined],
  ["email", "Email", "email"],
  ["phone", "Phone", "phone"],
  ["city", "City", "city"],
  ["stateRegion", "State / region", "state_region"],
  ["country", "Country", "country"],
  ["postalCode", "Postal code", "postal_code"],
  ["linkedinUrl", "LinkedIn URL", "linkedin_url"],
  ["portfolioUrl", "Portfolio URL", "portfolio_url"],
  ["githubUrl", "GitHub URL", "github_url"],
  ["workAuthorization", "Work authorization", "work_authorization"],
  ["sponsorshipRequired", "Sponsorship required", "sponsorship"],
  ["relocationPreference", "Relocation preference", "relocation"],
  ["workplacePreference", "Workplace preference", "workplace_preference"],
  ["compensationExpectation", "Compensation expectation", "compensation"],
  ["noticePeriod", "Notice period", "notice_period"],
  ["availability", "Availability", "availability"],
  ["yearsExperience", "Years of experience", "years_experience"],
] as const;

export function emptyApplicationProfile(): ApplicationProfile {
  return { id: APPLICATION_PROFILE_ID, schemaVersion: APPLICATION_PROFILE_SCHEMA_VERSION, updatedAt: "" };
}

export function normalizeApplicationProfile(input: Partial<ApplicationProfile>): ApplicationProfile {
  const profile = emptyApplicationProfile();
  for (const [key, limit] of Object.entries(profileTextLimits)) {
    const value = input[key as keyof ApplicationProfile];
    if (typeof value === "string" && value.trim())
      (profile as unknown as Record<string, unknown>)[key] = value.trim().replace(/\s+/g, " ").slice(0, limit);
  }
  for (const key of [
    "linkedinUrl",
    "portfolioUrl",
    "githubUrl",
    "linkedResumeId",
    "linkedCoverLetterId",
    "linkedJobTargetId",
    "linkedApplicationId",
  ] as const) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) profile[key] = value.trim().slice(0, 2048);
  }
  if (input.sponsorshipRequired && ["yes", "no", "prefer-not-to-say"].includes(input.sponsorshipRequired))
    profile.sponsorshipRequired = input.sponsorshipRequired;
  if (input.workplacePreference && ["remote", "hybrid", "on-site", "flexible"].includes(input.workplacePreference))
    profile.workplacePreference = input.workplacePreference;
  profile.updatedAt = typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString();
  return profile;
}

export function safeProfileUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function validateApplicationProfile(profile: Partial<ApplicationProfile>) {
  const errors: Partial<Record<keyof ApplicationProfile, string>> = {};
  for (const [key, limit] of Object.entries(profileTextLimits)) {
    const value = profile[key as keyof ApplicationProfile];
    if (value != null && typeof value !== "string") errors[key as keyof ApplicationProfile] = "Use text only.";
    if (typeof value === "string" && value.trim().length > limit)
      errors[key as keyof ApplicationProfile] = `Use ${limit} characters or fewer.`;
  }
  if (profile.email && !/^\S+@\S+\.\S+$/.test(profile.email.trim())) errors.email = "Use a valid email address.";
  if (
    profile.phone &&
    (!/^\+?[0-9()\s.-]{7,40}$/.test(profile.phone.trim()) || profile.phone.replace(/\D/g, "").length < 7)
  )
    errors.phone = "Use a valid phone number.";
  for (const key of ["linkedinUrl", "portfolioUrl", "githubUrl"] as const)
    if (profile[key] && !safeProfileUrl(profile[key])) errors[key] = "Use an HTTPS URL.";
  if (profile.sponsorshipRequired && !["yes", "no", "prefer-not-to-say"].includes(profile.sponsorshipRequired))
    errors.sponsorshipRequired = "Choose a supported option.";
  if (profile.workplacePreference && !["remote", "hybrid", "on-site", "flexible"].includes(profile.workplacePreference))
    errors.workplacePreference = "Choose a supported option.";
  return errors;
}

export async function loadApplicationProfile() {
  const saved = await getGuestApplicationProfile();
  return saved ? normalizeApplicationProfile(saved) : emptyApplicationProfile();
}

export async function saveApplicationProfile(input: Partial<ApplicationProfile>) {
  const errors = validateApplicationProfile(input);
  if (Object.keys(errors).length) throw new Error("APPLICATION_PROFILE_INVALID");
  return saveGuestApplicationProfile(normalizeApplicationProfile(input));
}

export async function saveApplicationAnswer(input: Omit<ApplicationReusableAnswer, "updatedAt">) {
  const label = input.label.trim().replace(/\s+/g, " ").slice(0, 160);
  const question = input.question.trim().replace(/\s+/g, " ").slice(0, 300);
  const answer = input.answer.trim().slice(0, 4000);
  if (!label || !question || !answer || !isAnswerCategory(input.category))
    throw new Error("APPLICATION_ANSWER_INVALID");
  return saveGuestApplicationAnswer({
    id: input.id || crypto.randomUUID(),
    label,
    question,
    answer,
    category: input.category,
    updatedAt: new Date().toISOString(),
  });
}

export { listGuestApplicationAnswers, deleteGuestApplicationAnswer };

export function buildApplicationPrepPreview(
  profile: Partial<ApplicationProfile>,
  answers: ApplicationReusableAnswer[],
): ApplicationPrepMapping[] {
  const mappings: ApplicationPrepMapping[] = [];
  for (const [key, fieldLabel, intent] of profileFields) {
    const value = profile[key as keyof ApplicationProfile];
    if (value == null || value === "") continue;
    mappings.push({
      fieldLabel,
      normalizedIntent: intent as ApplicationPrepIntent,
      value: String(value),
      status: "matched",
    });
  }
  for (const answer of answers) mappings.push(mapApplicationField(`${answer.label} ${answer.question}`, answer.answer));
  return mappings;
}

export function mapApplicationField(fieldLabel: string, value?: string): ApplicationPrepMapping {
  const label = fieldLabel.trim();
  const lower = label.toLowerCase();
  if (isManualOnlyQuestion(lower)) return { fieldLabel: label, value, status: "manual_only" };
  const normalizedIntent = detectIntent(lower);
  if (!normalizedIntent) return { fieldLabel: label, value, status: "unmapped" };
  return {
    fieldLabel: label,
    normalizedIntent,
    ...(value ? { value: value.trim() } : {}),
    status: value?.trim() ? "matched" : "needs_review",
  };
}

function detectIntent(value: string): ApplicationPrepIntent | undefined {
  if (/\b(first|given)\s*name\b/.test(value)) return "first_name";
  if (/\blast\s*name|surname|family\s*name\b/.test(value)) return "last_name";
  if (/e-?mail/.test(value)) return "email";
  if (/phone|mobile|telephone/.test(value)) return "phone";
  if (/city|town/.test(value)) return "city";
  if (/state|province|region/.test(value)) return "state_region";
  if (/country|nationality/.test(value)) return "country";
  if (/postal|zip\s*code/.test(value)) return "postal_code";
  if (/linkedin/.test(value)) return "linkedin_url";
  if (/portfolio|personal\s+site/.test(value)) return "portfolio_url";
  if (/github/.test(value)) return "github_url";
  if (/work\s+authorization|authorized\s+to\s+work|legally\s+eligible/.test(value)) return "work_authorization";
  if (/sponsor|visa/.test(value)) return "sponsorship";
  if (/relocat|willing\s+to\s+move/.test(value)) return "relocation";
  if (/remote|hybrid|on-site|on site|workplace|work\s+arrangement/.test(value)) return "workplace_preference";
  if (/available|availability|start\s+date/.test(value)) return "availability";
  if (/notice\s+period|how\s+soon/.test(value)) return "notice_period";
  if (/compensation|salary|pay\s+expectation/.test(value)) return "compensation";
  if (/years?\s+(of\s+)?experience|experience\s+in\s+years/.test(value)) return "years_experience";
  return undefined;
}

function isManualOnlyQuestion(value: string) {
  return /\b(certif\w*|attest\w*|truth\w*|consent\w*|acknowledg\w*|disab\w*|veteran\w*|race\w*|ethnic\w*|criminal\w*|convict\w*|legal\s+declaration|background\s+check)\b/.test(
    value,
  );
}

function isAnswerCategory(value: string): value is ApplicationAnswerCategory {
  return ["interest", "relocation", "sponsorship", "availability", "notice-period", "compensation", "other"].includes(
    value,
  );
}
