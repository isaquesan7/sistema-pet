import { POINTVET_VERSION } from "../lib/version.js";
import { useMemo, useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bath,
  CreditCard,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  ReceiptText,
  Clock3,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageOpen,
  PawPrint,
  Settings,
  ShoppingCart,
  ShieldCheck,
  ListChecks,
  LifeBuoy,
  Stethoscope,
  UserRound,
  UsersRound,
  Warehouse,
  X,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import BrandMark from "../components/BrandMark.jsx";
import StagingEnvironmentNotice from "../components/StagingEnvironmentNotice.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { companyTypeLabel } from "../lib/formatters.js";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/clientes", label: "Clientes", icon: UsersRound, permission: "clientes.visualizar" },
  { to: "/pets", label: "Pets", icon: PawPrint, permission: "pets.visualizar" },
  { to: "/pdv", label: "PDV", icon: ShoppingCart, permission: "pdv.acessar", module: "PDV" },
  { to: "/catalogo", label: "Produtos e serviços", icon: Boxes, permission: "catalogo.visualizar" },
  { to: "/estoque", label: "Estoque", icon: Warehouse, permission: "estoque.visualizar", module: "ESTOQUE" },
  { to: "/consultorio", label: "Consultório", icon: Stethoscope, permission: "consultorio.acessar", module: "CONSULTORIO", companyTypes: ["LOJA_CONSULTORIO", "OUTRA"] },
  { to: "/banho-e-tosa", label: "Banho e Tosa", icon: Bath, permission: "banho_tosa.acessar", module: "BANHO_TOSA", companyTypes: ["BANHO_TOSA", "OUTRA"] },
  { to: "/pacotes", label: "Pacotes", icon: PackageOpen, permission: "pacotes.visualizar" },
  { to: "/funcionarios", label: "Funcionários", icon: UserRound, permission: "funcionarios.visualizar" },
  { to: "/ponto", label: "Ponto", icon: Clock3, permissionsAny: ["ponto.registrar", "ponto.gerenciar", "ponto.aprovar_ajustes", "ponto.fechamento"], module: "PONTO" },
  { to: "/financeiro", label: "Financeiro", icon: CircleDollarSign, permission: "financeiro.visualizar", module: "FINANCEIRO" },
  { to: "/fiscal", label: "Fiscal", icon: ReceiptText, permission: "fiscal.visualizar", module: "FISCAL" },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, permission: "relatorios.visualizar", module: "RELATORIOS" },
  { to: "/suporte", label: "Suporte", icon: LifeBuoy, organizationRoles: ["PROPRIETARIO", "ADMINISTRADOR"] },
  { to: "/primeiros-passos", label: "Primeiros passos", icon: ListChecks, organizationRoles: ["PROPRIETARIO", "ADMINISTRADOR"] },
  { to: "/assinatura", label: "Plano e assinatura", icon: CreditCard, organizationRoles: ["PROPRIETARIO", "ADMINISTRADOR"] },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
  { to: "/seguranca", label: "Segurança e LGPD", icon: ShieldCheck, permissionsAny: ["seguranca.auditoria", "lgpd.gerenciar", "arquivos.gerenciar"] },
];

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen,setAccountOpen]=useState(false);
  const [collapsed,setCollapsed]=useState(()=>localStorage.getItem("pointvet:sidebar-collapsed")==="true");
  const [clock,setClock]=useState(()=>new Date());
  useEffect(()=>{const id=setInterval(()=>setClock(new Date()),30000);return()=>clearInterval(id);},[]);
  useEffect(()=>{localStorage.setItem("pointvet:sidebar-collapsed",String(collapsed));},[collapsed]);
  const navigate = useNavigate();
  const {
    user,
    selectedCompany,
    selectedOrganization,
    selectCompany,
    logout,
    hasPermission,
    isPlatformAdmin,
  } = useAuth();

  const modules = selectedOrganization?.modulos || [];
  const organizationConfig = selectedOrganization?.configuracao || {};

  const visibleItems = useMemo(
    () =>
      navItems.filter((item) => {
        const permissionOk = (!item.permission || hasPermission(item.permission)) && (!item.permissionsAny || item.permissionsAny.some((permission) => hasPermission(permission)));
        const moduleOk = !item.module || modules.includes(item.module);
        const companyOk = !item.companyTypes || item.companyTypes.includes(selectedCompany?.tipo);
        const roleOk = !item.organizationRoles || item.organizationRoles.includes(selectedOrganization?.papel);
        return permissionOk && moduleOk && companyOk && roleOk;
      }),
    [hasPermission, modules, selectedCompany?.tipo, selectedOrganization?.papel]
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
      className={`app-shell ${collapsed?"pv-collapsed":""}`}
      style={{ "--tenant-primary": primary, "--tenant-secondary": secondary }}
    >
      <aside className={`sidebar ${mobileOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar__top">
          <div className="pv-sidebar-brand"><BrandMark /></div>
          <button className="icon-button pv-collapse-toggle" aria-label={collapsed?"Expandir menu lateral":"Recolher menu lateral"} title={collapsed?"Expandir menu":"Recolher menu"} onClick={()=>setCollapsed(v=>!v)}>{collapsed?<PanelLeftOpen size={21}/>:<PanelLeftClose size={21}/>}</button>
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
              title={collapsed?label:undefined}
              aria-label={label}
              className={({ isActive }) => `nav-item ${isActive ? "nav-item--active" : ""}`}
            >
              <Icon size={19} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          {isPlatformAdmin && (
            <button className="platform-sidebar-link" type="button" onClick={() => navigate("/plataforma")}>
              <ShieldCheck size={16}/> Administração PointVet
            </button>
          )}

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
              <span className="topbar__eyebrow">PointVet</span>
              <strong className="topbar__org">{organizationConfig.nomeExibicao || selectedOrganization?.nome}</strong>
            </div>
          </div>

          <div className="pv-shell-meta"><strong>{POINTVET_VERSION}</strong><time dateTime={clock.toISOString()}>{clock.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}</time></div>
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
          <div className="account-switcher">
            <button type="button" className="account-switcher__trigger" aria-expanded={accountOpen} aria-haspopup="true" onClick={()=>setAccountOpen(v=>!v)}>
              <div className="account-switcher__avatar">{user?.fotoUrl?<img src={user.fotoUrl} alt=""/>:(user?.nomeExibicao||user?.nome||"U").slice(0,1).toUpperCase()}</div>
              <div className="account-switcher__identity"><strong>{user?.nomeExibicao||user?.nome||"Meu perfil"}</strong><small>{selectedCompany?.nomeFantasia||"PointVet"}</small></div>
              <ChevronsUpDown size={15}/>
            </button>
            {accountOpen&&<div className="account-switcher__menu" role="menu">
              <div className="account-switcher__heading">{user?.email}</div>
              <button type="button" role="menuitem" onClick={()=>{setAccountOpen(false);navigate("/minha-conta");}}><UserRound size={17}/> Meu Usuário</button>
              <button type="button" role="menuitem" onClick={()=>{setAccountOpen(false);navigate("/configuracoes");}}><Settings size={17}/> Meu Estabelecimento</button>
              {["PROPRIETARIO","ADMINISTRADOR"].includes(selectedOrganization?.papel)&&<button type="button" role="menuitem" onClick={()=>{setAccountOpen(false);navigate("/assinatura");}}><CreditCard size={17}/> Meus Planos</button>}
              {isPlatformAdmin&&<button type="button" role="menuitem" onClick={()=>{setAccountOpen(false);navigate("/plataforma");}}><ShieldCheck size={17}/> Console Interno</button>}
              <div className="account-switcher__divider"/>
              <button type="button" role="menuitem" onClick={()=>{setAccountOpen(false);handleLogout();}}><LogOut size={17}/> Sair</button>
            </div>}
          </div>

        </header>

        <StagingEnvironmentNotice />

        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
