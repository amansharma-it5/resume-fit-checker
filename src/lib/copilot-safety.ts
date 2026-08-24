const FACT =
  /(?:\b\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?\b|\$\d[\d,]*|\b(?:19|20)\d{2}\b|\b(?:AWS|Azure|React|Python|SQL|certified|degree|Bachelor|Master)\b)/gi;
export function validateCopilotSuggestion(suggestion: string, evidence: string) {
  const source = evidence.replace(/(?:ignore|disregard|override)\b[^.\n]*/gi, "").toLowerCase();
  const unsupported = [
    ...new Set((suggestion.match(FACT) || []).filter((claim) => !source.includes(claim.toLowerCase()))),
  ];
  return { ok: unsupported.length === 0, unsupported };
}
