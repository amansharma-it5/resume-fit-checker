import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthCallbackPage, ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from "./pages/AuthPages";
import { AccountDataPage } from "./pages/AccountDataPage";
import { CheckerPage } from "./pages/CheckerPage";
import { DashboardPage } from "./pages/DashboardPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AccountsComingSoonPage } from "./pages/AccountsComingSoonPage";
import { ResumeEditorPage } from "./pages/ResumeEditorPage";
import { JobTargetsPage } from "./pages/JobTargetsPage";
import { CoverLettersPage } from "./pages/CoverLettersPage";
import { InterviewPracticePage } from "./pages/InterviewPracticePage";
import { authEnabled as configuredAuthEnabled } from "./lib/features";

export function App() {
  return <AppRoutes authEnabled={configuredAuthEnabled} />;
}

export function AppRoutes({ authEnabled }: { authEnabled: boolean }) {
  const authPage = (page: React.ReactNode) => (authEnabled ? page : <AccountsComingSoonPage />);
  return (
    <Routes>
      <Route element={<AppShell authEnabled={authEnabled} />}>
        <Route index element={<CheckerPage />} />
        <Route path="checker" element={<CheckerPage />} />
        <Route path="login" element={authPage(<LoginPage />)} />
        <Route path="signup" element={authPage(<SignupPage />)} />
        <Route path="forgot-password" element={authPage(<ForgotPasswordPage />)} />
        <Route path="reset-password" element={authPage(<ResetPasswordPage />)} />
        <Route path="auth/callback" element={authPage(<AuthCallbackPage />)} />
        <Route path="dashboard" element={<DashboardPage authEnabled={authEnabled} />} />
        <Route path="targets" element={<JobTargetsPage />} />
        <Route path="targets/:targetId" element={<JobTargetsPage />} />
        <Route path="cover-letters" element={<CoverLettersPage />} />
        <Route path="interview-practice" element={<InterviewPracticePage />} />
        <Route path="resumes/:resumeId/edit" element={<ResumeEditorPage />} />
        <Route path="settings" element={<SettingsPage authEnabled={authEnabled} />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="account" element={<Navigate to="/account/data" replace />} />
        <Route
          path="account/data"
          element={
            authEnabled ? (
              <ProtectedRoute>
                <AccountDataPage />
              </ProtectedRoute>
            ) : (
              <AccountsComingSoonPage />
            )
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
