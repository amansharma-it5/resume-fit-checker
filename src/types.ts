export type ResumeStatus = "active" | "archived" | "deleted";

export const JOB_TARGET_STATUSES = [
  "Interested",
  "Tailoring",
  "Ready to apply",
  "Applied",
  "Interviewing",
  "Offer",
  "Closed",
  "Archived",
] as const;
export type JobTargetStatus = (typeof JOB_TARGET_STATUSES)[number];

/** Browser-local job-target metadata. Resume/JD bodies are never copied into analytics or onboarding state. */
export interface JobTarget {
  id: string;
  schemaVersion: 1;
  company: string;
  role: string;
  location?: string;
  sourceUrl?: string;
  status: JobTargetStatus;
  baseResumeId: string;
  tailoredResumeId: string;
  jobDescription: string;
  jobDescriptionHash: string;
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
  latestAnalysis?: { overall: number | null; resumeVersion: number; calculatedAt: string; stale: boolean };
}

/** A browser-local, independently editable career document. */
export interface CoverLetterDocument {
  id: string;
  schemaVersion: 1;
  title: string;
  resumeId: string;
  jobTargetId?: string;
  company: string;
  role: string;
  jobDescription: string;
  sender: { name: string; email: string; phone: string; location: string };
  recipient: { name: string; company: string; address: string };
  greeting: string;
  opening: string;
  experience: string[];
  roleFit: string;
  closing: string;
  signOff: string;
  createdAt: string;
  updatedAt: string;
  editorVersion: number;
}

/** A browser-local practice session. Answers and feedback never leave Guest Mode unless the user separately consents. */
export interface InterviewPracticeQuestion {
  id: string;
  prompt: string;
  category: "introduction" | "resume" | "behavioral" | "job" | "skills" | "custom";
  reason: string;
  evidence: string[];
  answer: string;
  answerVersions: string[];
  completed: boolean;
  skipped: boolean;
}

export interface InterviewPracticeSession {
  id: string;
  schemaVersion: 1;
  title: string;
  resumeId: string;
  jobTargetId?: string;
  company: string;
  role: string;
  jobDescription: string;
  questions: InterviewPracticeQuestion[];
  createdAt: string;
  updatedAt: string;
  editorVersion: number;
}

export const APPLICATION_STATUSES = [
  "Saved",
  "Preparing",
  "Applied",
  "Screening",
  "Interviewing",
  "Offer",
  "Rejected",
  "Withdrawn",
  "Archived",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type ApplicationActivityKind = "created" | "updated" | "status" | "follow-up" | "note";

/** A privacy-safe timeline entry. It never stores resume or job-description bodies. */
export interface ApplicationActivity {
  id: string;
  kind: ApplicationActivityKind;
  message: string;
  createdAt: string;
}

export interface ApplicationFollowUp {
  id: string;
  title: string;
  notes?: string;
  dueDate?: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

/** Browser-local application metadata. Linked documents remain in their own stores. */
export interface ApplicationRecord {
  id: string;
  schemaVersion: 1;
  company: string;
  role: string;
  location?: string;
  workArrangement?: string;
  source?: string;
  sourceUrl?: string;
  status: ApplicationStatus;
  resumeId?: string;
  jobTargetId?: string;
  coverLetterId?: string;
  interviewSessionIds: string[];
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  nextAction?: string;
  dueDate?: string;
  appliedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  editorVersion: number;
  activities: ApplicationActivity[];
  followUps: ApplicationFollowUp[];
}

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
  engineVersion?: string;
  rulesetVersion?: string;
  analysisEligibility?: string;
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
  /** Links a summary to one document without retaining its text. */
  resumeId?: string;
  resumeVersion?: number;
  analysisKey?: string;
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
  engineVersion?: string;
  rulesetVersion?: string;
  analysisEligibility?: string;
  ruleIds?: string[];
}
