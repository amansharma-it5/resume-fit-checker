import * as engine from "../../analysis-engine.js";
import * as verification from "../../rewrite-verification.js";
import type { AnalysisResult, AnalysisSummary } from "../types";

export const analyzeResumeFit = engine.analyzeResumeFit as unknown as (input: {
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
export function sanitizeAnalysisForStorage(analysis: AnalysisResult): Omit<AnalysisSummary, "id"> {
  const safe = (engine.sanitizeAnalysisForStorage as (value: unknown) => any)(analysis);
  return {
    role: String(safe.role || "Target role"),
    fileName: String(safe.fileName || "Resume"),
    timestamp: String(safe.generatedAt || new Date().toISOString()),
    scores: safe.scores || {},
    counts: {
      matched: safe.matched?.length || 0,
      partial: safe.partial?.length || 0,
      missing: safe.missing?.length || 0,
    },
    sections: safe.resume?.sections || [],
    matchedTerms: safe.matched || [],
    partialTerms: safe.partial || [],
    missingTerms: safe.missing || [],
    recommendations: safe.recommendations || [],
  };
}
export const canCopyOrApply = verification.canCopyOrApply as (value: unknown) => boolean;
export const createSafeVerifiedVersion = verification.createSafeVerifiedVersion as (value: unknown) => string;
export const applyUserConfirmation = verification.applyUserConfirmation as (value: unknown, claimId: string) => unknown;
