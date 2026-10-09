import { CalendarDays, Home, LogOut, PawPrint, UserRound } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useClientAuth } from "../context/ClientAuthContext.jsx";

export default function ClientLayout() {
  const { account, organization, logout } = useClientAuth();
  const cfg = organization?.configuracao || {};
  return (
    <div className="client-shell">
      <header className="client-topbar">
        <div className="brand-wrap">
          <div className="brand-badge">P</div>
          <div><strong>PetRise</strong><span>{cfg.nomeExibicao || organization?.nome || "Portal do cliente"}</span></div>
        </div>
        <button className="ghost-button desktop-logout" onClick={logout}><LogOut size={18}/> Sair</button>
      </header>
      <main className="client-main"><Outlet /></main>
      <nav className="bottom-nav">
        <NavLink to="/" end><Home/><span>Início</span></NavLink>
        <NavLink to="/pets"><PawPrint/><span>Pets</span></NavLink>
        <NavLink to="/agendar"><CalendarDays/><span>Agendar</span></NavLink>
        <NavLink to="/perfil"><UserRound/><span>Perfil</span></NavLink>
      </nav>
      <div className="welcome-chip">Olá, {account?.cliente?.nome?.split(" ")[0] || "cliente"}!</div>
    </div>
  );
}
