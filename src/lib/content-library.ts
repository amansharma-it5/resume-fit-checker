import { deleteGuestMetaValue, getGuestMetaValue, putGuestMetaValue } from "./guest-db";

export const CONTENT_LIBRARY_META_KEY = "content-library:user-snippets:v1";
export const CONTENT_LIBRARY_MAX_ITEMS = 100;
export const CONTENT_LIBRARY_MAX_TEXT = 4000;
export const CONTENT_LIBRARY_MAX_TITLE = 160;
export const CONTENT_LIBRARY_MAX_TAGS = 8;

export const CONTENT_LIBRARY_CATEGORIES = [
  "resume_bullet",
  "professional_summary",
  "accomplishment_pattern",
  "action_verb",
  "skill_description",
  "leadership",
  "project_impact",
  "technical_delivery",
  "operations",
  "stakeholder_management",
  "problem_solving",
  "interview_star",
  "cover_letter_structure",
  "application_response",
] as const;

export type ContentLibraryCategory = (typeof CONTENT_LIBRARY_CATEGORIES)[number];
export type ContentLibrarySource = "builtin" | "user";

export type ContentLibraryItem = {
  id: string;
  source: ContentLibrarySource;
  category: ContentLibraryCategory;
  title: string;
  templateText: string;
  tags: string[];
  intendedUse: string;
  placeholders: string[];
  evidenceEligible: false;
  createdAt?: string;
  updatedAt?: string;
};

export type UserSnippetDraft = {
  id?: string;
  category: ContentLibraryCategory;
  title: string;
  templateText: string;
  tags: string[];
  intendedUse: string;
};

export const CONTENT_CATEGORY_LABELS: Record<ContentLibraryCategory, string> = {
  resume_bullet: "Resume bullet",
  professional_summary: "Professional summary",
  accomplishment_pattern: "Accomplishment pattern",
  action_verb: "Action verb",
  skill_description: "Skill description",
  leadership: "Leadership",
  project_impact: "Project impact",
  technical_delivery: "Technical delivery",
  operations: "Operations",
  stakeholder_management: "Stakeholder management",
  problem_solving: "Problem solving",
  interview_star: "Interview STAR",
  cover_letter_structure: "Cover letter structure",
  application_response: "Application response",
};

const guidance = "Guidance only. Replace placeholders with facts you can verify yourself.";

export const BUILT_IN_CONTENT: ContentLibraryItem[] = [
  item(
    "bullet-action-result",
    "resume_bullet",
    "Action + result",
    "[action] [scope] to improve [verified result].",
    ["impact", "resume"],
    guidance,
  ),
  item(
    "bullet-process",
    "resume_bullet",
    "Process improvement",
    "Improved [process] by applying [action] across [scope].",
    ["process", "resume"],
    guidance,
  ),
  item(
    "summary-foundation",
    "professional_summary",
    "Summary foundation",
    "[role] focused on [domain] with experience in [technology or capability].",
    ["summary", "profile"],
    guidance,
  ),
  item(
    "accomplishment-proof",
    "accomplishment_pattern",
    "Evidence-backed accomplishment",
    "Delivered [outcome] by [action], supported by [verified result].",
    ["achievement", "evidence"],
    guidance,
  ),
  item(
    "verb-delivered",
    "action_verb",
    "Delivery verbs",
    "built, delivered, improved, launched, streamlined, resolved",
    ["verbs", "writing"],
    "Use the verb that accurately matches your contribution.",
  ),
  item(
    "skill-description",
    "skill_description",
    "Skill in context",
    "Used [technology] to support [task or outcome] in [context].",
    ["skills", "evidence"],
    guidance,
  ),
  item(
    "leadership-supported",
    "leadership",
    "Supported leadership",
    "Coordinated [workstream] with [stakeholders] to support [outcome].",
    ["leadership", "collaboration"],
    guidance,
  ),
  item(
    "project-impact",
    "project_impact",
    "Project impact",
    "Built or improved [project] for [audience] using [technology], with [verified result].",
    ["projects", "impact"],
    guidance,
  ),
  item(
    "technical-delivery",
    "technical_delivery",
    "Technical delivery",
    "Designed, implemented, or maintained [system] to address [problem].",
    ["technical", "delivery"],
    guidance,
  ),
  item(
    "operations",
    "operations",
    "Operational improvement",
    "Reduced friction in [process] by [action] while maintaining [constraint].",
    ["operations", "process"],
    guidance,
  ),
  item(
    "stakeholder",
    "stakeholder_management",
    "Stakeholder alignment",
    "Partnered with [stakeholder] to clarify [need] and deliver [verified outcome].",
    ["communication", "stakeholders"],
    guidance,
  ),
  item(
    "problem-solving",
    "problem_solving",
    "Problem-solving frame",
    "Investigated [problem], evaluated [options], and applied [action] to reach [verified result].",
    ["problem solving", "evidence"],
    guidance,
  ),
  item(
    "star",
    "interview_star",
    "STAR structure",
    "Situation: [context]\nTask: [responsibility]\nAction: [action]\nResult: [verified result]",
    ["STAR", "interview"],
    "Use this structure to organize your own answer; do not fill gaps with invented facts.",
  ),
  item(
    "cover-structure",
    "cover_letter_structure",
    "Evidence-led letter",
    "Opening: connect [motivation] to [role].\nEvidence: explain [supported experience].\nClosing: invite [next step].",
    ["cover letter", "structure"],
    guidance,
  ),
  item(
    "application-response",
    "application_response",
    "Application response",
    "I am interested in [role] because [truthful reason]. My relevant evidence is [supported example].",
    ["applications", "response"],
    guidance,
  ),
];

function item(
  id: string,
  category: ContentLibraryCategory,
  title: string,
  templateText: string,
  tags: string[],
  intendedUse: string,
): ContentLibraryItem {
  return {
    id,
    source: "builtin",
    category,
    title,
    templateText,
    tags,
    intendedUse,
    placeholders: extractPlaceholders(templateText),
    evidenceEligible: false,
  };
}

function cleanText(value: string, maxLength: number) {
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return !(code <= 8 || (code >= 11 && code <= 12) || (code >= 14 && code <= 31) || code === 127);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function extractPlaceholders(value: string) {
  return [
    ...new Set(Array.from(value.matchAll(/\[([^\]]{1,60})\]/g), (match) => match[1].trim()).filter(Boolean)),
  ].slice(0, 20);
}

export function normalizeUserSnippet(input: UserSnippetDraft, existingId?: string): ContentLibraryItem {
  const title = cleanText(input.title, CONTENT_LIBRARY_MAX_TITLE);
  const templateText = cleanText(input.templateText, CONTENT_LIBRARY_MAX_TEXT);
  const intendedUse = cleanText(input.intendedUse, 300);
  const tags = [...new Set(input.tags.map((tag) => cleanText(tag, 40).toLowerCase()).filter(Boolean))].slice(
    0,
    CONTENT_LIBRARY_MAX_TAGS,
  );
  if (!title || !templateText) throw new Error("CONTENT_LIBRARY_REQUIRED");
  if (templateText.length > CONTENT_LIBRARY_MAX_TEXT) throw new Error("CONTENT_LIBRARY_TEXT_TOO_LARGE");
  const now = new Date().toISOString();
  return {
    id: existingId || input.id || crypto.randomUUID(),
    source: "user",
    category: input.category,
    title,
    templateText,
    tags,
    intendedUse: intendedUse || "User-authored guidance. Verify every factual claim before use.",
    placeholders: extractPlaceholders(templateText),
    evidenceEligible: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function searchContentLibrary(items: ContentLibraryItem[], query: string, category = "all", tag = "all") {
  const normalizedQuery = query.trim().toLowerCase();
  return items
    .filter((entry) => category === "all" || entry.category === category)
    .filter((entry) => tag === "all" || entry.tags.includes(tag))
    .filter((entry) => {
      if (!normalizedQuery) return true;
      return [entry.title, entry.templateText, entry.intendedUse, ...entry.tags].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    })
    .slice(0, CONTENT_LIBRARY_MAX_ITEMS);
}

export function contentLibraryTags(items: ContentLibraryItem[]) {
  return [...new Set(items.flatMap((entry) => entry.tags))].sort((a, b) => a.localeCompare(b));
}

export async function listUserSnippets() {
  const saved = await getGuestMetaValue<unknown>(CONTENT_LIBRARY_META_KEY);
  if (!Array.isArray(saved)) return [];
  return saved.filter(isContentLibraryItem).slice(0, CONTENT_LIBRARY_MAX_ITEMS);
}

export async function saveUserSnippet(input: UserSnippetDraft) {
  const snippets = await listUserSnippets();
  const normalized = normalizeUserSnippet(input, input.id);
  const next = [normalized, ...snippets.filter((item) => item.id !== normalized.id)].slice(
    0,
    CONTENT_LIBRARY_MAX_ITEMS,
  );
  await putGuestMetaValue(CONTENT_LIBRARY_META_KEY, next);
  return normalized;
}

export async function deleteUserSnippet(id: string) {
  const snippets = await listUserSnippets();
  const next = snippets.filter((item) => item.id !== id);
  if (next.length) await putGuestMetaValue(CONTENT_LIBRARY_META_KEY, next);
  else await deleteGuestMetaValue(CONTENT_LIBRARY_META_KEY);
}

function isContentLibraryItem(value: unknown): value is ContentLibraryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ContentLibraryItem>;
  return (
    item.source === "user" &&
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.templateText === "string" &&
    Array.isArray(item.tags) &&
    Array.isArray(item.placeholders) &&
    item.evidenceEligible === false &&
    CONTENT_LIBRARY_CATEGORIES.includes(item.category as ContentLibraryCategory)
  );
}
