import * as legacy from "../../analysis-engine.js";
import type { MatchState, RequirementEvidence, RequirementPriority } from "./types";

function hasWholeTerm(term: string, text: string) {
  const escaped = term
    .trim()
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return escaped ? new RegExp(`(?:^|[^a-z0-9+#.])${escaped}(?=$|[^a-z0-9+#.])`, "i").test(text) : false;
}

function matchState(type: unknown, found: boolean): MatchState {
  if (!found) return "missing";
  if (type === "synonym") return "alias";
  if (type === "partial" || type === "fuzzy") return "partial";
  return "exact";
}

// Evidence is displayed only for the current analysis. Bound it anyway so a
// one-line pasted resume cannot turn an evidence snippet into the whole resume.
function transientSnippet(value: string) {
  const normalized = value.trim();
  return normalized.length > 280 ? `${normalized.slice(0, 277).trimEnd()}...` : normalized;
}

export function matchRequirement(
  term: string,
  priority: RequirementPriority,
  resumeText: string,
  index = 0,
): RequirementEvidence {
  const directMatch = hasWholeTerm(term, resumeText);
  const evidence = legacy.findEvidence(term, resumeText) as Record<string, unknown>;
  const text = String(evidence.exact || evidence.partial || "");
  if (directMatch) {
    const directLine = String(resumeText)
      .split(/\r?\n/)
      .find((line) => hasWholeTerm(term, line))
      ?.trim();
    return {
      id: `${priority}:${term.trim().toLowerCase()}:${index}`,
      term,
      priority,
      matchState: "exact",
      evidence: transientSnippet(directLine || text) || undefined,
      location: evidence.location ? String(evidence.location) : undefined,
      ruleIds: ["match.exact"],
    };
  }
  const state = matchState(evidence.type, Boolean(text));
  return {
    id: `${priority}:${term.trim().toLowerCase()}:${index}`,
    term,
    priority,
    matchState: state,
    evidence: transientSnippet(text) || undefined,
    location: evidence.location ? String(evidence.location) : undefined,
    ruleIds: [`match.${state}`],
  };
}

export function matchRequirements(
  requirements: Array<{ term: string; priority: RequirementPriority }>,
  resumeText: string,
) {
  const seen = new Set<string>();
  return requirements
    .filter((item) => {
      // A requirement must only contribute once, even if a JD repeats it under
      // multiple headings. Required is kept because it is processed first.
      const key = item.term.trim().toLowerCase().replace(/\s+/g, " ");
      if (!item.term.trim() || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item, index) => matchRequirement(item.term, item.priority, resumeText, index));
}
