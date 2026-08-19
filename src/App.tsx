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

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<CheckerPage />} />
        <Route path="checker" element={<CheckerPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="auth/callback" element={<AuthCallbackPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="account" element={<Navigate to="/account/data" replace />} />
        <Route
          path="account/data"
          element={
            <ProtectedRoute>
              <AccountDataPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
