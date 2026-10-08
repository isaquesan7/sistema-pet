import { useQuery } from "@tanstack/react-query";
import { Building2, PawPrint, Sparkles, UsersRound } from "lucide-react";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { companyTypeLabel } from "../lib/formatters.js";

async function dashboardData() {
  const [context, clients, pets] = await Promise.all([
    api.get("/auth/contexto"),
    api.get("/clientes", { params: { limite: 1 } }),
    api.get("/pets", { params: { limite: 1 } }),
  ]);

  return {
    context: context.data,
    clients: clients.data,
    pets: pets.data,
  };
}

export default function DashboardPage() {
  const { user, selectedCompany, selectedOrganization } = useAuth();
  const query = useQuery({ queryKey: ["dashboard", selectedCompany?.id], queryFn: dashboardData });
  const data = query.data;
  const modules = selectedOrganization?.modulos || [];

  return (
    <div className="page-stack">
      <section className="page-heading page-heading--hero">
        <div>
          <span className="page-kicker">Visão geral</span>
          <h1>Boa noite, {user?.nome?.split(" ")[0]}.</h1>
          <p>Acompanhe a operação da {selectedCompany?.nomeFantasia}.</p>
        </div>
        <div className="company-badge">
          <Building2 size={18} />
          <div><strong>{selectedCompany?.nomeFantasia}</strong><span>{companyTypeLabel(selectedCompany?.tipo)}</span></div>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card"><span className="stat-card__icon"><UsersRound /></span><div><small>Clientes</small><strong>{query.isLoading ? "—" : data?.clients?.paginacao?.total ?? 0}</strong><span>tutores ativos</span></div></article>
        <article className="stat-card"><span className="stat-card__icon"><PawPrint /></span><div><small>Pets</small><strong>{query.isLoading ? "—" : data?.pets?.paginacao?.total ?? 0}</strong><span>cadastros ativos</span></div></article>
        <article className="stat-card"><span className="stat-card__icon"><Sparkles /></span><div><small>Módulos</small><strong>{modules.length}</strong><span>habilitados na organização</span></div></article>
        <article className="stat-card"><span className="stat-card__icon"><Building2 /></span><div><small>Operação atual</small><strong className="stat-card__text-value">{companyTypeLabel(selectedCompany?.tipo)}</strong><span>CNPJ selecionado</span></div></article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel__heading"><div><span>Ambiente</span><h2>Seu BichOne está conectado</h2></div><span className="status-dot">Online</span></div>
          <div className="info-list">
            <div><span>Organização</span><strong>{data?.context?.organizacao?.nome || selectedOrganization?.nome || "—"}</strong></div>
            <div><span>Empresa</span><strong>{selectedCompany?.nomeFantasia}</strong></div>
            <div><span>Cargo</span><strong>{data?.context?.cargo?.nome || selectedCompany?.cargo?.nome || "—"}</strong></div>
            <div><span>Permissões</span><strong>{data?.context?.permissoes?.length ?? selectedCompany?.permissoes?.length ?? 0}</strong></div>
          </div>
        </article>

        <article className="panel panel--soft">
          <div className="panel__heading"><div><span>Próximos passos</span><h2>Estrutura preparada para crescer</h2></div></div>
          <div className="feature-chips">
            {modules.map((module) => <span key={module}>{module.replaceAll("_", " ")}</span>)}
          </div>
          <p className="muted-copy">Os módulos exibidos no menu respeitam as permissões do usuário e os recursos habilitados para a organização.</p>
        </article>
      </section>

      {query.isError && <div className="alert alert--error">Não foi possível carregar todos os indicadores. Confira se a API está online.</div>}
    </div>
  );
}
