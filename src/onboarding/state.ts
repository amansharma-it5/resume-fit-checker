const KEY = "resume-lab.onboarding.v1";
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
