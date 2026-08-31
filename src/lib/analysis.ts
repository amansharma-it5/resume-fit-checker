import * as engine from "../../analysis-engine.js";
import { runLocalAtsEngine, toPrivacySafeSummary } from "../ats/engine";
import * as verification from "../../rewrite-verification.js";
import type { AnalysisResult, AnalysisSummary } from "../types";

export const analyzeResumeFit = runLocalAtsEngine as unknown as (input: {
  resumeText: string;
  jobDescription: string;
  role: string;
  fileName?: string;
}) => AnalysisResult;
export const smartRewrite = engine.rewriteBullet as (text: string) => {
  before: string;
  after: string;
  warnings: string[];
};
export function sanitizeAnalysisForStorage(
  analysis: AnalysisResult,
  context: Pick<AnalysisSummary, "resumeId" | "resumeVersion" | "analysisKey"> = {},
): Omit<AnalysisSummary, "id"> {
  const legacySafe = (engine.sanitizeAnalysisForStorage as (value: unknown) => any)(analysis);
  const safe = analysis.engineVersion === "local-ats-v1" ? toPrivacySafeSummary(analysis as any) : null;
  const value = safe || legacySafe;
  return {
    ...context,
    role: String(value.role || "Target role"),
    fileName: String(value.fileName || "Resume"),
    timestamp: String(value.generatedAt || new Date().toISOString()),
    scores: value.scores || {},
    counts: {
      matched: safe?.counts.matched ?? legacySafe.matched?.length ?? 0,
      partial: safe?.counts.partial ?? legacySafe.partial?.length ?? 0,
      missing: safe?.counts.missing ?? legacySafe.missing?.length ?? 0,
    },
    sections: safe?.sections || legacySafe.resume?.sections || [],
    matchedTerms:
      safe?.requirements
        .filter((item) => item.matchState === "exact" || item.matchState === "alias")
        .map((item) => item.term) ||
      legacySafe.matched ||
      [],
    partialTerms:
      safe?.requirements.filter((item) => item.matchState === "partial").map((item) => item.term) ||
      legacySafe.partial ||
      [],
    missingTerms:
      safe?.requirements.filter((item) => item.matchState === "missing").map((item) => item.term) ||
      legacySafe.missing ||
      [],
    recommendations: safe?.recommendations || legacySafe.recommendations || [],
    ...(safe
      ? {
          engineVersion: safe.engineVersion,
          rulesetVersion: safe.rulesetVersion,
          analysisEligibility: safe.analysisEligibility,
          ruleIds: safe.ruleIds,
        }
      : {}),
  };
}
export const canCopyOrApply = verification.canCopyOrApply as (value: unknown) => boolean;
export const createSafeVerifiedVersion = verification.createSafeVerifiedVersion as (value: unknown) => string;
export const applyUserConfirmation = verification.applyUserConfirmation as (value: unknown, claimId: string) => unknown;
