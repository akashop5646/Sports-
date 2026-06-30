import { Navigate } from "react-router-dom";

export default function IndexRedirect() {
  const raw = localStorage.getItem("crease-live-app-v2") || localStorage.getItem("crease-live-app");
  const parsed = raw ? JSON.parse(raw) : null;
  const user = parsed?.state?.user;
  const onboarded = parsed?.state?.onboarded;

  if (user) {
    return <Navigate to="/home" replace />;
  }
  if (onboarded) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/onboarding" replace />;
}
