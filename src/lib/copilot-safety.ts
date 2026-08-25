const FACT =
  /(?:\b\d+(?:\.\d+)?%|\b\d+\s+(?:years?|months?)\b|\b\d+(?:\.\d+)?\b|\$\d[\d,]*|\b(?:19|20)\d{2}\b|\b(?:AWS|Azure|React|Python|SQL|certified|degree|Bachelor|Master)\b|\b[A-Z][A-Za-z]+\s+(?:Inc\.?|Corp\.?|LLC|Ltd\.?|Company|Client)\b|\b(?:Senior|Junior|Lead|Principal|Staff)\s+(?:Software|Data|Product|Project|Engineering|Marketing)\s+(?:Engineer|Manager|Developer|Analyst|Designer)\b|\b(?:increased|reduced|generated|saved)\s+(?:revenue|costs?|sales|profit|conversion)\b)/gi;
export function validateCopilotSuggestion(suggestion: string, evidence: string) {
  const source = evidence.replace(/(?:ignore|disregard|override)\b[^.\n]*/gi, "").toLowerCase();
  const unsupported = [
    ...new Set((suggestion.match(FACT) || []).filter((claim) => !source.includes(claim.toLowerCase()))),
  ];
  return { ok: unsupported.length === 0, unsupported };
}
