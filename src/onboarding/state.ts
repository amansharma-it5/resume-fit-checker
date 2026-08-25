const KEY = "resume-lab.onboarding.v1";
const NON_EDIT_ACTIONS = new Set(["undo", "redo", "replace"]);
export interface OnboardingState {
  version: 1;
  dismissed: boolean;
  steps: Record<string, boolean>;
}
const initial = (): OnboardingState => ({ version: 1, dismissed: false, steps: {} });
export function readOnboardingState(): OnboardingState {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "null");
    return value?.version === 1 && typeof value.steps === "object"
      ? { version: 1, dismissed: Boolean(value.dismissed), steps: value.steps }
      : initial();
  } catch {
    return initial();
  }
}
export function writeOnboardingState(next: OnboardingState) {
  localStorage.setItem(KEY, JSON.stringify({ version: 1, dismissed: Boolean(next.dismissed), steps: next.steps }));
}
export function resetOnboardingState() {
  writeOnboardingState(initial());
}
export type OnboardingStep = "resume" | "edited" | "jobDescription" | "ats" | "rewrite" | "export";
export function markOnboardingStep(step: OnboardingStep) {
  const state = readOnboardingState();
  writeOnboardingState({ ...state, steps: { ...state.steps, [step]: true } });
}

/** Hydration, history navigation, and replace actions must not complete onboarding review. */
export function isMeaningfulEditorAction(action: { type: string }) {
  return !NON_EDIT_ACTIONS.has(action.type);
}
