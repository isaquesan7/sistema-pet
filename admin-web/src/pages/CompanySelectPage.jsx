import { Building2, ChevronRight, LogOut } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import BrandMark from "../components/BrandMark.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { companyTypeLabel } from "../lib/formatters.js";

export default function CompanySelectPage() {
  const { isAuthenticated, user, selectCompany, logout } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const companies = user?.empresas || [];

  function select(id) {
    selectCompany(id);
    navigate("/", { replace: true });
  }

  return (
    <div className="selection-page">
      <div className="selection-card">
        <div className="selection-card__header">
          <BrandMark />
          <button className="ghost-button" type="button" onClick={async () => { await logout(); navigate("/login", { replace: true }); }}>
            <LogOut size={17} /> Sair
          </button>
        </div>

        <div className="selection-card__intro">
          <span>Olá, {user?.nome?.split(" ")[0]}.</span>
          <h1>Onde você quer trabalhar agora?</h1>
          <p>Selecione o CNPJ/empresa. Você poderá trocar de empresa a qualquer momento.</p>
        </div>

        <div className="company-grid">
          {companies.map((company) => (
            <button className="company-card" key={company.id} type="button" onClick={() => select(company.id)}>
              <span className="company-card__icon"><Building2 size={22} /></span>
              <span className="company-card__copy">
                <strong>{company.nomeFantasia}</strong>
                <small>{companyTypeLabel(company.tipo)}</small>
                <em>{company.cargo?.nome || "Acesso autorizado"}</em>
              </span>
              <ChevronRight size={20} />
            </button>
          ))}
        </div>

        {companies.length === 0 && (
          <div className="empty-state">
            <Building2 size={30} />
            <strong>Nenhuma empresa disponível</strong>
            <p>Seu usuário ainda não foi vinculado a uma empresa.</p>
          </div>
        )}
      </div>
    </div>
  );
}
