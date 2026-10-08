import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth, RequireCompany } from "./components/ProtectedRoute.jsx";
import AppLayout from "./layout/AppLayout.jsx";
import ClientsPage from "./pages/ClientsPage.jsx";
import CompanySelectPage from "./pages/CompanySelectPage.jsx";
import ComingSoonPage from "./pages/ComingSoonPage.jsx";
import CatalogPage from "./pages/CatalogPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import PetsPage from "./pages/PetsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import EmployeesPage from "./pages/EmployeesPage.jsx";
import TimeClockPage from "./pages/TimeClockPage.jsx";
import PackagesPage from "./pages/PackagesPage.jsx";
import PdvPage from "./pages/PdvPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/selecionar-empresa" element={<CompanySelectPage />} />
        <Route element={<RequireCompany />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="clientes" element={<ClientsPage />} />
            <Route path="pets" element={<PetsPage />} />
            <Route path="catalogo" element={<CatalogPage />} />
            <Route path="pdv" element={<PdvPage />} />
            <Route path="consultorio" element={<ComingSoonPage title="Consultório veterinário" />} />
            <Route path="banho-e-tosa" element={<ComingSoonPage title="Banho e Tosa" />} />
            <Route path="pacotes" element={<PackagesPage />} />
            <Route path="funcionarios" element={<EmployeesPage />} />
            <Route path="ponto" element={<TimeClockPage />} />
            <Route path="financeiro" element={<ComingSoonPage title="Financeiro" />} />
            <Route path="configuracoes" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
