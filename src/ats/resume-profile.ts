import * as legacy from "../../analysis-engine.js";

/** Resume text is the sole input used for candidate-specific evidence. */
export function buildResumeProfile(resumeText: string, role = "Target role") {
  return legacy.analyzeResume(resumeText, role) as Record<string, unknown>;
}

export function hasEnoughResumeDetail(profile: Record<string, unknown>) {
  const words = Number(profile.words || 0);
  const sections = Array.isArray(profile.sections) ? profile.sections.length : 0;
  return words >= 20 || sections >= 2;
}
