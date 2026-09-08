import { z } from "zod";
import { DRAFT_TYPES, type DraftField } from "./ai-drafting";
import { validateAiDraft } from "./ai-draft-safety";

export const MAX_TAILOR_FIELDS = 12;
const text = (max: number) => z.string().max(max);
const id = z
  .string()
  .min(1)
  .max(300)
  .regex(/^[\w:-]+$/);
export const tailoringFieldSchema = z
  .object({
    id,
    draftType: z.enum(DRAFT_TYPES),
    sectionId: id,
    entryId: id,
    field: z.enum(["professionalTitle", "text", "description", "skill", "bullet"]),
    bulletId: id.optional(),
    currentText: text(2000),
    relevantEvidence: text(6000).refine((value) => Boolean(value.trim())),
  })
  .strict()
  .refine((field) => {
    if (field.id !== `${field.sectionId}:${field.entryId}:${field.field}${field.bulletId ? `:${field.bulletId}` : ""}`)
      return false;
    if (field.draftType === "EXPERIENCE_BULLET") return field.field === "bullet" && Boolean(field.bulletId);
    if (field.bulletId) return false;
    return field.draftType === "HEADLINE"
      ? field.field === "professionalTitle"
      : field.draftType === "SKILLS_PHRASING"
        ? field.field === "skill"
        : field.draftType === "SUMMARY"
          ? field.field === "text"
          : ["text", "description"].includes(field.field);
  });
export const tailoringInputSchema = z
  .object({
    targetRole: text(160).refine((value) => Boolean(value.trim())),
    limitedJobDescription: text(4000).refine((value) => Boolean(value.trim())),
    fields: z.array(tailoringFieldSchema).min(1).max(MAX_TAILOR_FIELDS),
  })
  .strict()
  .refine((input) => new Set(input.fields.map((field) => field.id)).size === input.fields.length);
export type TailoringInput = z.infer<typeof tailoringInputSchema>;
export const CHANGE_KINDS = [
  "clarity",
  "keyword_alignment",
  "action_language",
  "concision",
  "organization",
  "evidence_supported_skill",
  "summary_alignment",
] as const;
export const tailoringOutputSchema = z
  .object({
    proposals: z
      .array(
        z
          .object({
            fieldId: id,
            currentText: text(2000),
            proposedText: text(1200).refine((value) => Boolean(value.trim())),
            rationale: text(400).refine((value) => Boolean(value.trim())),
            evidenceRefs: z.array(id).min(1).max(1),
            changeKind: z.enum(CHANGE_KINDS),
          })
          .strict(),
      )
      .max(MAX_TAILOR_FIELDS),
    gaps: z.array(z.object({ requirement: text(160).refine((value) => Boolean(value.trim())) }).strict()).max(12),
  })
  .strict();
export type TailoringOutput = z.infer<typeof tailoringOutputSchema>;

// Instruction-like sentences never authorize claims, even when copied into a source field.
function evidenceOnly(value: string) {
  return value
    .split(/(?<=[.!?])\s+|\n/)
    .filter(
      (sentence) =>
        !/ignore|disregard|override|instructions?|system prompt|pretend|fabricat|claim that/i.test(sentence),
    )
    .join(" ");
}
function words(value: string) {
  return (value.toLowerCase().match(/[\p{L}\p{N}+#.%-]+/gu) || [])
    .map((word) => word.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
}
function stem(value: string) {
  return value.replace(/(?:ing|ed|es|s)$/, "");
}
const connective = new Set(
  words(
    "a an the and or for of to in on at by with from as through across using use focused focusing focus experience experienced professional skills seeking goal objective role opportunity pursue pursuing",
  ).map(stem),
);

/** Conservative language guard, not semantic fact verification. New content words require evidence. */
export function tailoringClaimCheck(proposedText: string, relevantEvidence: string) {
  const evidence = evidenceOnly(relevantEvidence);
  const base = validateAiDraft(proposedText, evidence);
  const sourceWords = new Set(words(evidence).map(stem));
  const novelWords = words(proposedText).filter((word) => !sourceWords.has(stem(word)) && !connective.has(stem(word)));
  return { ok: base.ok && novelWords.length === 0, unsupported: [...new Set([...base.unsupported, ...novelWords])] };
}

export function validateTailoringOutput(value: unknown, input: TailoringInput): TailoringOutput | null {
  const parsed = tailoringOutputSchema.safeParse(value);
  if (!parsed.success) return null;
  const output = parsed.data;
  const seen = new Set<string>();
  for (const proposal of output.proposals) {
    const field = input.fields.find((item) => item.id === proposal.fieldId);
    if (
      !field ||
      seen.has(field.id) ||
      proposal.currentText !== field.currentText ||
      proposal.evidenceRefs[0] !== field.id ||
      !tailoringClaimCheck(proposal.proposedText, field.relevantEvidence).ok
    )
      return null;
    seen.add(field.id);
  }
  const evidence = evidenceOnly(input.fields.map((field) => field.relevantEvidence).join("\n")).toLowerCase();
  const jd = input.limitedJobDescription.toLowerCase();
  if (
    output.gaps.some(
      (gap) => !jd.includes(gap.requirement.toLowerCase()) || evidence.includes(gap.requirement.toLowerCase()),
    )
  )
    return null;
  return output;
}

export function buildTailoringInput(fields: DraftField[], targetRole: string, jobDescription: string): TailoringInput {
  return tailoringInputSchema.parse({
    targetRole: targetRole.trim(),
    limitedJobDescription: jobDescription.trim().slice(0, 4000),
    fields: fields.map(({ id, draftType, sectionId, entryId, field, bulletId, currentText, relevantEvidence }) => ({
      id,
      draftType,
      sectionId,
      entryId,
      field,
      ...(bulletId ? { bulletId } : {}),
      currentText,
      relevantEvidence,
    })),
  });
}

export function proposalIsCurrent(field: DraftField | undefined, source: TailoringInput["fields"][number]) {
  return Boolean(
    field &&
    field.currentText === source.currentText &&
    field.relevantEvidence === source.relevantEvidence &&
    field.sectionId === source.sectionId &&
    field.entryId === source.entryId &&
    field.field === source.field &&
    field.bulletId === source.bulletId,
  );
}
