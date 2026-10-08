import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function RequireCompany() {
  const { selectedCompany } = useAuth();
  if (!selectedCompany) {
    return <Navigate to="/selecionar-empresa" replace />;
  }
  return <Outlet />;
}
