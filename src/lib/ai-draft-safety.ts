import { validateCopilotSuggestion } from "./copilot-safety";

const TECHNICAL_CLAIM =
  /\b(?:Kubernetes|Docker|Terraform|Node\.?js|JavaScript|TypeScript|React|Angular|Vue(?:\.js)?|Python|Java|C#|C\+\+|Go|Rust|AWS|Azure|GCP|Google Cloud|SQL|PostgreSQL|MongoDB|Salesforce|Tableau|Power BI|Figma|Jira|Scrum|Agile)\b/gi;

/** Conservative shared validation: only resume evidence can support candidate claims. */
export function validateAiDraft(draft: string, relevantEvidence: string) {
  const base = validateCopilotSuggestion(draft, relevantEvidence);
  const evidence = relevantEvidence.toLocaleLowerCase();
  const technicalClaims = [
    ...new Set((draft.match(TECHNICAL_CLAIM) || []).filter((claim) => !evidence.includes(claim.toLocaleLowerCase()))),
  ];
  const unsupported = [...new Set([...base.unsupported, ...technicalClaims])];
  return { ok: unsupported.length === 0, unsupported };
}
