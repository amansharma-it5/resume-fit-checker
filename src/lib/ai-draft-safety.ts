import { validateCopilotSuggestion } from "./copilot-safety";

const TECHNICAL_CLAIM =
  /\b(?:Kubernetes|Docker|Terraform|Node\.?js|JavaScript|TypeScript|React|Angular|Vue(?:\.js)?|Python|Java|C#|C\+\+|Go|Rust|AWS|Azure|GCP|Google Cloud|SQL|PostgreSQL|MongoDB|Salesforce|Tableau|Power BI|Figma|Jira|Scrum|Agile)\b/gi;
const COMPOUND_TECHNICAL_CLAIM = /\b(?:React Native|AWS (?:Certified|Certification))\b/gi;

function evidenceOnly(value: string) {
  return value.replace(/(?:ignore|disregard|override)\b[^.\n]*/gi, "");
}

function hasWholeClaim(evidence: string, claim: string) {
  const escaped = claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, "iu").test(evidence);
}

/** Conservative shared validation: only resume evidence can support candidate claims. */
export function validateAiDraft(draft: string, relevantEvidence: string) {
  const base = validateCopilotSuggestion(draft, relevantEvidence);
  const evidence = evidenceOnly(relevantEvidence).toLocaleLowerCase();
  const claims = [...(draft.match(TECHNICAL_CLAIM) || []), ...(draft.match(COMPOUND_TECHNICAL_CLAIM) || [])];
  const technicalClaims = [...new Set(claims.filter((claim) => !hasWholeClaim(evidence, claim.toLocaleLowerCase())))];
  const unsupported = [...new Set([...base.unsupported, ...technicalClaims])];
  return { ok: unsupported.length === 0, unsupported };
}
