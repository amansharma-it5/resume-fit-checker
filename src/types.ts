export type ResumeStatus = "active" | "archived" | "deleted";

export interface ResumeDocument {
  id: string;
  ownerId?: string;
  sourceGuestId?: string;
  title: string;
  status: ResumeStatus;
  structuredData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  importedAt?: string | null;
  editorVersion?: number;
}

export interface AnalysisResult {
  role: string;
  fileName: string;
  scores: Record<string, number | null>;
  matched: string[];
  partial: string[];
  missing: string[];
  recommendations: string[];
  keywordState?: string;
  resume?: Record<string, any>;
  job?: Record<string, any>;
  [key: string]: any;
}

export interface AnalysisSummary {
  id: string;
  role: string;
  fileName: string;
  timestamp: string;
  scores: Record<string, number | null>;
  counts: { matched: number; partial: number; missing: number };
  sections: string[];
  matchedTerms: string[];
  partialTerms: string[];
  missingTerms: string[];
  recommendations: string[];
}
