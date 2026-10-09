import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth, RequireCompany, RequirePlatformAdmin } from "./components/ProtectedRoute.jsx";
import AppLayout from "./layout/AppLayout.jsx";
import ClientsPage from "./pages/ClientsPage.jsx";
import CompanySelectPage from "./pages/CompanySelectPage.jsx";
import CatalogPage from "./pages/CatalogPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import PetsPage from "./pages/PetsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import EmployeesPage from "./pages/EmployeesPage.jsx";
import TimeClockPage from "./pages/TimeClockPage.jsx";
import PackagesPage from "./pages/PackagesPage.jsx";
import PdvPage from "./pages/PdvPage.jsx";
import StockPage from "./pages/StockPage.jsx";
import ConsultorioPage from "./pages/ConsultorioPage.jsx";
import BanhoTosaPage from "./pages/BanhoTosaPage.jsx";
import FinancePage from "./pages/FinancePage.jsx";
import FiscalPage from "./pages/FiscalPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import OnboardingPage from "./pages/OnboardingPage.jsx";
import SubscriptionPage from "./pages/SubscriptionPage.jsx";
import PlatformAdminPage from "./pages/PlatformAdminPage.jsx";
import SecurityPage from "./pages/SecurityPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/comecar" element={<OnboardingPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<RequirePlatformAdmin />}>
          <Route path="/plataforma" element={<PlatformAdminPage />} />
        </Route>
        <Route path="/selecionar-empresa" element={<CompanySelectPage />} />
        <Route element={<RequireCompany />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="clientes" element={<ClientsPage />} />
            <Route path="pets" element={<PetsPage />} />
            <Route path="catalogo" element={<CatalogPage />} />
            <Route path="pdv" element={<PdvPage />} />
            <Route path="estoque" element={<StockPage />} />
            <Route path="consultorio" element={<ConsultorioPage />} />
            <Route path="banho-e-tosa" element={<BanhoTosaPage />} />
            <Route path="pacotes" element={<PackagesPage />} />
            <Route path="funcionarios" element={<EmployeesPage />} />
            <Route path="ponto" element={<TimeClockPage />} />
            <Route path="financeiro" element={<FinancePage />} />
            <Route path="fiscal" element={<FiscalPage />} />
            <Route path="relatorios" element={<ReportsPage />} />
            <Route path="assinatura" element={<SubscriptionPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
            <Route path="seguranca" element={<SecurityPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
