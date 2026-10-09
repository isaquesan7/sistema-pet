import { useQuery } from "@tanstack/react-query";
import { Building2, CircleDollarSign, PawPrint, ReceiptText, Sparkles, TrendingUp, UsersRound, Warehouse } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { companyTypeLabel, formatCurrency } from "../lib/formatters.js";

async function dashboardData() {
  const [context, clients, pets] = await Promise.all([
    api.get("/auth/contexto"),
    api.get("/clientes", { params: { limite: 1 } }),
    api.get("/pets", { params: { limite: 1 } }),
  ]);
  return { context: context.data, clients: clients.data, pets: pets.data };
}

function monthDates() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { dataInicio: start, dataFim: end };
}

export default function DashboardPage() {
  const { user, selectedCompany, selectedOrganization, hasPermission } = useAuth();
  const query = useQuery({ queryKey: ["dashboard", selectedCompany?.id], queryFn: dashboardData });
  const canReports = hasPermission("relatorios.visualizar") && (selectedOrganization?.modulos || []).includes("RELATORIOS");
  const reportQuery = useQuery({
    queryKey: ["dashboard-reports", selectedCompany?.id],
    enabled: canReports,
    queryFn: async () => (await api.get("/relatorios/painel", { params: { escopo: "empresa", ...monthDates() } })).data.dados,
    staleTime: 60000,
  });
  const data = query.data;
  const report = reportQuery.data || {};
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

      {canReports ? <section className="stats-grid dashboard-business-stats">
        <article className="stat-card"><span className="stat-card__icon"><TrendingUp /></span><div><small>Faturamento do mês</small><strong>{reportQuery.isLoading ? "—" : formatCurrency(report?.vendas?.faturamento || 0)}</strong><span>{report?.vendas?.vendas || 0} vendas finalizadas</span></div></article>
        <article className="stat-card"><span className="stat-card__icon"><ReceiptText /></span><div><small>Ticket médio</small><strong>{reportQuery.isLoading ? "—" : formatCurrency(report?.vendas?.ticketMedio || 0)}</strong><span>por venda</span></div></article>
        <article className="stat-card"><span className="stat-card__icon"><CircleDollarSign /></span><div><small>Resultado financeiro</small><strong>{reportQuery.isLoading ? "—" : formatCurrency(report?.financeiro?.resultado || 0)}</strong><span>recebimentos menos pagamentos</span></div></article>
        <article className="stat-card"><span className="stat-card__icon"><Warehouse /></span><div><small>Alertas de estoque</small><strong>{reportQuery.isLoading ? "—" : (report?.estoque?.itensEstoqueBaixo || 0)}</strong><span>{report?.estoque?.lotesVencidos || 0} lotes vencidos</span></div></article>
      </section> : <section className="stats-grid">
        <article className="stat-card"><span className="stat-card__icon"><UsersRound /></span><div><small>Clientes</small><strong>{query.isLoading ? "—" : data?.clients?.paginacao?.total ?? 0}</strong><span>tutores ativos</span></div></article>
        <article className="stat-card"><span className="stat-card__icon"><PawPrint /></span><div><small>Pets</small><strong>{query.isLoading ? "—" : data?.pets?.paginacao?.total ?? 0}</strong><span>cadastros ativos</span></div></article>
        <article className="stat-card"><span className="stat-card__icon"><Sparkles /></span><div><small>Módulos</small><strong>{modules.length}</strong><span>habilitados na organização</span></div></article>
        <article className="stat-card"><span className="stat-card__icon"><Building2 /></span><div><small>Operação atual</small><strong className="stat-card__text-value">{companyTypeLabel(selectedCompany?.tipo)}</strong><span>CNPJ selecionado</span></div></article>
      </section>}

      {canReports ? <section className="dashboard-grid">
        <article className="panel">
          <div className="panel__heading"><div><span>Indicadores do mês</span><h2>Saúde da operação</h2></div><Link className="text-button" to="/relatorios">Ver relatórios</Link></div>
          <div className="info-list">
            <div><span>Clientes atendidos</span><strong>{report?.vendas?.clientesAtendidos || 0}</strong></div>
            <div><span>A receber em aberto</span><strong>{formatCurrency(report?.financeiro?.receberAberto || 0)}</strong></div>
            <div><span>Estoque a custo médio</span><strong>{formatCurrency(report?.estoque?.valorEstoque || 0)}</strong></div>
            <div><span>Documentos fiscais autorizados</span><strong>{report?.fiscal?.autorizados || 0}</strong></div>
          </div>
        </article>
        <article className="panel panel--soft">
          <div className="panel__heading"><div><span>PetRise Insights</span><h2>Alertas rápidos</h2></div></div>
          <div className="info-list">
            <div><span>Contas a receber vencidas</span><strong>{formatCurrency(report?.financeiro?.receberVencido || 0)}</strong></div>
            <div><span>Produtos abaixo do mínimo</span><strong>{report?.estoque?.itensEstoqueBaixo || 0}</strong></div>
            <div><span>Lotes vencendo em 30 dias</span><strong>{report?.estoque?.lotesVencendo30Dias || 0}</strong></div>
            <div><span>Fiscal com erro/rejeição</span><strong>{report?.fiscal?.erros || 0}</strong></div>
          </div>
        </article>
      </section> : <section className="dashboard-grid">
        <article className="panel">
          <div className="panel__heading"><div><span>Ambiente</span><h2>Seu PetRise está conectado</h2></div><span className="status-dot">Online</span></div>
          <div className="info-list">
            <div><span>Organização</span><strong>{data?.context?.organizacao?.nome || selectedOrganization?.nome || "—"}</strong></div>
            <div><span>Empresa</span><strong>{selectedCompany?.nomeFantasia}</strong></div>
            <div><span>Cargo</span><strong>{data?.context?.cargo?.nome || selectedCompany?.cargo?.nome || "—"}</strong></div>
            <div><span>Permissões</span><strong>{data?.context?.permissoes?.length ?? selectedCompany?.permissoes?.length ?? 0}</strong></div>
          </div>
        </article>
        <article className="panel panel--soft">
          <div className="panel__heading"><div><span>Próximos passos</span><h2>Estrutura preparada para crescer</h2></div></div>
          <div className="feature-chips">{modules.map((module) => <span key={module}>{module.replaceAll("_", " ")}</span>)}</div>
          <p className="muted-copy">Os módulos exibidos no menu respeitam as permissões do usuário e os recursos habilitados para a organização.</p>
        </article>
      </section>}

      {(query.isError || reportQuery.isError) && <div className="alert alert--error">Não foi possível carregar todos os indicadores. Confira se a API está online.</div>}
    </div>
  );
}
