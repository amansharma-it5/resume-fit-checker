import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <p className="page-status" role="status">
        Restoring your secure session...
      </p>
    );
  return user ? children : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
}
