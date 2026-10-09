import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useClientAuth } from "../context/ClientAuthContext.jsx";

export default function ProtectedRoute() {
  const { session } = useClientAuth();
  const location = useLocation();
  if (!session?.accessToken) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
