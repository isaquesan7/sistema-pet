import { useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bath,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageOpen,
  PawPrint,
  Settings,
  ShoppingCart,
  Stethoscope,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import BrandMark from "../components/BrandMark.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { companyTypeLabel } from "../lib/formatters.js";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/clientes", label: "Clientes", icon: UsersRound, permission: "clientes.visualizar" },
  { to: "/pets", label: "Pets", icon: PawPrint, permission: "pets.visualizar" },
  { to: "/pdv", label: "PDV", icon: ShoppingCart, permission: "pdv.acessar", module: "PDV" },
  { to: "/catalogo", label: "Produtos e serviços", icon: Boxes, permission: "catalogo.visualizar" },
  { to: "/consultorio", label: "Consultório", icon: Stethoscope, permission: "consultorio.acessar", module: "CONSULTORIO" },
  { to: "/banho-e-tosa", label: "Banho e Tosa", icon: Bath, permission: "banho_tosa.acessar", module: "BANHO_TOSA" },
  { to: "/pacotes", label: "Pacotes", icon: PackageOpen, permission: "pacotes.visualizar" },
  { to: "/funcionarios", label: "Funcionários", icon: UserRound, permission: "funcionarios.visualizar" },
  { to: "/ponto", label: "Ponto", icon: Clock3, permission: "ponto.registrar", module: "PONTO" },
  { to: "/financeiro", label: "Financeiro", icon: CircleDollarSign, permission: "financeiro.visualizar", module: "FINANCEIRO" },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const {
    user,
    selectedCompany,
    selectedOrganization,
    selectCompany,
    logout,
    hasPermission,
  } = useAuth();

  const modules = selectedOrganization?.modulos || [];
  const organizationConfig = selectedOrganization?.configuracao || {};

  const visibleItems = useMemo(
    () =>
      navItems.filter((item) => {
        const permissionOk = !item.permission || hasPermission(item.permission);
        const moduleOk = !item.module || modules.includes(item.module);
        return permissionOk && moduleOk;
      }),
    [hasPermission, modules]
  );

  const companies = user?.empresas || [];

  function handleCompanyChange(event) {
    selectCompany(event.target.value);
    navigate("/");
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const primary = organizationConfig.corPrimaria || "#5b5bd6";
  const secondary = organizationConfig.corSecundaria || "#14b8a6";

  return (
    <div
      className="app-shell"
      style={{ "--tenant-primary": primary, "--tenant-secondary": secondary }}
    >
      <aside className={`sidebar ${mobileOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar__top">
          <BrandMark />
          <button
            className="icon-button sidebar__close"
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="tenant-card">
          <div className="tenant-card__avatar">
            {organizationConfig.logoUrl ? (
              <img src={organizationConfig.logoUrl} alt="" />
            ) : (
              <span>{(organizationConfig.nomeExibicao || selectedOrganization?.nome || "O").slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="tenant-card__text">
            <strong>{organizationConfig.nomeExibicao || selectedOrganization?.nome || "Organização"}</strong>
            <span>{companyTypeLabel(selectedCompany?.tipo)}</span>
          </div>
        </div>

        <nav className="sidebar__nav" aria-label="Navegação principal">
          {visibleItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? "nav-item--active" : ""}`}
            >
              <Icon size={19} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar-user">
            <div className="sidebar-user__avatar">{user?.nome?.slice(0, 1).toUpperCase()}</div>
            <div className="sidebar-user__text">
              <strong>{user?.nome}</strong>
              <span>{user?.email}</span>
            </div>
            <button className="icon-button" type="button" onClick={handleLogout} title="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />}

      <div className="app-main">
        <header className="topbar">
          <div className="topbar__left">
            <button className="icon-button topbar__menu" type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
              <Menu size={21} />
            </button>
            <div>
              <span className="topbar__eyebrow">BichOne</span>
              <strong className="topbar__org">{organizationConfig.nomeExibicao || selectedOrganization?.nome}</strong>
            </div>
          </div>

          <label className="company-switcher">
            <span>Empresa atual</span>
            <div className="company-switcher__field">
              <select value={selectedCompany?.id || ""} onChange={handleCompanyChange}>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.nomeFantasia}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
          </label>
        </header>

        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
