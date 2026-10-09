import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Download,
  FileCheck2,
  HeartPulse,
  PackageSearch,
  PawPrint,
  ReceiptText,
  RefreshCw,
  Scissors,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  UsersRound,
  WalletCards,
  Warehouse,
} from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { formatCurrency, formatDate } from "../lib/formatters.js";

const paymentLabels = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  CARTAO_DEBITO: "Cartão de débito",
  CARTAO_CREDITO: "Cartão de crédito",
  TRANSFERENCIA: "Transferência",
  CREDITO_CLIENTE: "Fiado",
  OUTRO: "Outro",
};
const typeLabels = { PRODUTO: "Produtos", SERVICO: "Serviços", OUTRO: "Outros" };
const fiscalTypeLabels = { NFCE: "NFC-e", NFE: "NF-e", NFSE: "NFS-e", RECIBO: "Recibo" };
const statusLabels = {
  AGUARDANDO: "Aguardando", EM_ATENDIMENTO: "Em atendimento", FINALIZADO: "Finalizado", CANCELADO: "Cancelado",
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento", PENDENTE: "Pendente", CONFIRMADO: "Confirmado", CHECK_IN: "Check-in",
  CONCLUIDO: "Concluído", FALTOU: "Faltou", PROCESSANDO: "Processando", AUTORIZADO: "Autorizado", REJEITADO: "Rejeitado", ERRO: "Erro",
  FIXO: "Fixo", TEMPORARIO: "Temporário", PERSONALIZADO: "Personalizado", ATIVO: "Ativo", ESGOTADO: "Esgotado", EXPIRADO: "Expirado",
};
const movementLabels = {
  ENTRADA: "Entradas", VENDA: "Vendas", CONSUMO_INTERNO: "Consumo interno", AJUSTE_POSITIVO: "Ajuste +", AJUSTE_NEGATIVO: "Ajuste -",
  PERDA: "Perdas", DEVOLUCAO_CLIENTE: "Devolução cliente", DEVOLUCAO_FORNECEDOR: "Devolução fornecedor", CANCELAMENTO: "Cancelamentos",
  TRANSFERENCIA_ENTRADA: "Transferência +", TRANSFERENCIA_SAIDA: "Transferência -",
};

function today() { return new Date().toISOString().slice(0, 10); }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }
function monthEnd() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); }
function compactNumber(value) { return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number(value || 0)); }
function percent(value) { return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number(value || 0))}%`; }
function duration(minutes) { const value = Number(minutes || 0); if (value < 60) return `${Math.round(value)} min`; const h = Math.floor(value / 60); const m = Math.round(value % 60); return `${h}h${m ? ` ${m}min` : ""}`; }
function label(value) { return statusLabels[value] || String(value || "—").replaceAll("_", " "); }

function Variation({ value }) {
  const n = Number(value || 0);
  const Icon = n >= 0 ? TrendingUp : TrendingDown;
  return <span className={`report-variation ${n >= 0 ? "is-positive" : "is-negative"}`}><Icon size={12}/>{Math.abs(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>;
}

function MetricCard({ icon: Icon, label: title, value, hint, variation: change, tone = "default" }) {
  return <article className={`report-metric report-metric--${tone}`}>
    <span className="report-metric__icon"><Icon size={19}/></span>
    <div><small>{title}</small><strong>{value}</strong><span>{hint}</span>{change !== undefined ? <Variation value={change}/> : null}</div>
  </article>;
}

function Bars({ rows, valueKey = "valor", labelKey = "nome", formatter = formatCurrency, empty = "Sem dados no período." }) {
  const max = Math.max(0, ...rows.map((row) => Number(row[valueKey] || 0)));
  if (!rows.length) return <div className="mini-empty">{empty}</div>;
  return <div className="report-bars">{rows.map((row, index) => {
    const value = Number(row[valueKey] || 0);
    const width = max > 0 ? Math.max(3, value / max * 100) : 0;
    return <div className="report-bar" key={`${row[labelKey] || row.chave || row.forma || index}-${index}`}>
      <div className="report-bar__label"><span>{row[labelKey] || row.chave || row.forma || "—"}</span><strong>{formatter(value)}</strong></div>
      <div className="report-bar__track"><span style={{ width: `${width}%` }}/></div>
    </div>;
  })}</div>;
}

function SalesChart({ rows }) {
  const max = Math.max(0, ...rows.map((row) => Number(row.faturamento || 0)));
  if (!rows.length) return <div className="mini-empty">Nenhuma venda finalizada no período.</div>;
  const visible = rows.length > 31 ? rows.slice(-31) : rows;
  return <div className="report-sales-chart" aria-label="Evolução do faturamento">
    <div className="report-chart-grid">
      {visible.map((row) => <div className="report-chart-column" key={row.data} title={`${formatDate(`${row.data}T12:00:00`)} · ${formatCurrency(row.faturamento)} · ${row.vendas} venda(s)`}>
        <span className="report-chart-value">{row.vendas}</span>
        <div className="report-chart-bar"><span style={{ height: `${max ? Math.max(4, Number(row.faturamento) / max * 100) : 0}%` }}/></div>
        <small>{row.data.slice(8, 10)}</small>
      </div>)}
    </div>
  </div>;
}

function Table({ columns, rows, empty = "Sem dados no período." }) {
  return <div className="table-scroll"><table className="data-table report-table"><thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={row.id || `${index}-${row.nome || row.produto || row.status || "row"}`}>{columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : row[c.key] ?? "—"}</td>)}</tr>) : <tr><td colSpan={columns.length} className="empty-cell">{empty}</td></tr>}</tbody></table></div>;
}

export default function ReportsPage() {
  const { selectedCompany, selectedOrganization, user } = useAuth();
  const [tab, setTab] = useState("GERAL");
  const [scope, setScope] = useState("empresa");
  const [period, setPeriod] = useState({ dataInicio: monthStart(), dataFim: monthEnd() });
  const [downloading, setDownloading] = useState("");
  const [downloadError, setDownloadError] = useState("");

  const orgCompanies = (user?.empresas || []).filter((company) => !selectedOrganization?.id || company.organizacaoId === selectedOrganization.id || company.organizacao?.id === selectedOrganization.id);
  const canConsolidate = orgCompanies.length > 1;
  const params = { escopo: scope, dataInicio: period.dataInicio, dataFim: period.dataFim };
  const query = useQuery({
    queryKey: ["reports-panel", selectedCompany?.id, scope, period.dataInicio, period.dataFim],
    queryFn: async () => (await api.get("/relatorios/painel", { params })).data.dados,
    staleTime: 60000,
  });
  const data = query.data || {};
  const sales = data.vendas || {};
  const clients = data.clientes || {};
  const operation = data.operacao || {};
  const stock = data.estoque || {};
  const finance = data.financeiro || {};
  const fiscal = data.fiscal || {};
  const compare = data.comparativo || {};
  const warnings = data.avisos || [];

  const paymentRows = useMemo(() => (sales.pagamentos || []).map((row) => ({ ...row, nome: paymentLabels[row.forma] || row.forma })), [sales.pagamentos]);
  const typeRows = useMemo(() => (sales.porTipo || []).map((row) => ({ ...row, nome: typeLabels[row.tipo] || row.tipo })), [sales.porTipo]);

  function preset(name) {
    const now = new Date();
    if (name === "HOJE") setPeriod({ dataInicio: today(), dataFim: today() });
    if (name === "MES") setPeriod({ dataInicio: monthStart(), dataFim: monthEnd() });
    if (name === "30D") {
      const start = new Date(now); start.setDate(start.getDate() - 29);
      setPeriod({ dataInicio: start.toISOString().slice(0, 10), dataFim: today() });
    }
    if (name === "ANO") setPeriod({ dataInicio: `${now.getFullYear()}-01-01`, dataFim: `${now.getFullYear()}-12-31` });
  }

  async function download(type) {
    try {
      setDownloading(type); setDownloadError("");
      const response = await api.get("/relatorios/exportar", { params: { ...params, tipo: type }, responseType: "blob" });
      const disposition = response.headers["content-disposition"] || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || `petrise-relatorio-${type}.csv`;
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (error) { setDownloadError(getApiErrorMessage(error, "Não foi possível exportar o relatório.")); }
    finally { setDownloading(""); }
  }

  const tabs = [
    ["GERAL", "Visão geral"], ["VENDAS", "Vendas"], ["CLIENTES", "Clientes"], ["OPERACAO", "Operação"], ["ESTOQUE", "Estoque"], ["FINANCEIRO", "Financeiro"], ["FISCAL", "Fiscal"],
  ];

  return <div className="page-stack reports-page">
    <section className="page-heading page-heading--hero reports-heading">
      <div><span className="page-kicker">Inteligência do negócio</span><h1>Relatórios e indicadores</h1><p>Transforme a operação do PetRise em números para decidir com mais segurança.</p></div>
      <div className="reports-heading__badge"><BarChart3 size={19}/><div><strong>{scope === "organizacao" ? "Consolidado" : selectedCompany?.nomeFantasia}</strong><span>{formatDate(`${period.dataInicio}T12:00:00`)} a {formatDate(`${period.dataFim}T12:00:00`)}</span></div></div>
    </section>

    <section className="panel reports-filter-panel">
      <div className="reports-filter-presets"><button onClick={() => preset("HOJE")}>Hoje</button><button onClick={() => preset("MES")}>Este mês</button><button onClick={() => preset("30D")}>Últimos 30 dias</button><button onClick={() => preset("ANO")}>Este ano</button></div>
      <div className="reports-filter-fields">
        <label><CalendarDays size={14}/><span>De</span><input type="date" value={period.dataInicio} onChange={(e) => setPeriod((p) => ({ ...p, dataInicio: e.target.value }))}/></label>
        <label><CalendarDays size={14}/><span>Até</span><input type="date" value={period.dataFim} onChange={(e) => setPeriod((p) => ({ ...p, dataFim: e.target.value }))}/></label>
        {canConsolidate ? <label className="reports-scope"><Building2 size={14}/><span>Escopo</span><select value={scope} onChange={(e) => setScope(e.target.value)}><option value="empresa">CNPJ atual</option><option value="organizacao">Organização consolidada</option></select></label> : null}
        <button className="secondary-button reports-refresh" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw size={14} className={query.isFetching ? "spin" : ""}/>{query.isFetching ? "Atualizando..." : "Atualizar"}</button>
      </div>
    </section>

    <div className="settings-tabs report-tabs">{tabs.map(([key, text]) => <button key={key} className={`settings-tab ${tab === key ? "settings-tab--active" : ""}`} onClick={() => setTab(key)}>{text}</button>)}</div>

    {query.isLoading ? <section className="panel report-loading"><RefreshCw size={22} className="spin"/><strong>Calculando indicadores...</strong><span>Consolidando vendas, clientes, operação, estoque, financeiro e fiscal.</span></section> : null}
    {query.isError ? <div className="alert alert--error">{getApiErrorMessage(query.error, "Não foi possível carregar os relatórios.")}</div> : null}
    {!query.isError && warnings.length ? <div className="alert alert--warning"><strong>Alguns indicadores não puderam ser calculados.</strong> {warnings.map((warning) => `${warning.secao}: ${warning.mensagem}`).join(" ")}</div> : null}
    {downloadError ? <div className="alert alert--error">{downloadError}</div> : null}

    {!query.isLoading && !query.isError && tab === "GERAL" ? <>
      <section className="report-metric-grid">
        <MetricCard icon={ShoppingCart} label="Faturamento" value={formatCurrency(sales.faturamento || 0)} hint={`${sales.vendas || 0} vendas finalizadas`} variation={compare.faturamento}/>
        <MetricCard icon={ReceiptText} label="Ticket médio" value={formatCurrency(sales.ticketMedio || 0)} hint="por venda" variation={compare.ticketMedio}/>
        <MetricCard icon={UsersRound} label="Clientes atendidos" value={sales.clientesAtendidos || 0} hint={`${clients.taxaRecorrencia || 0}% recorrentes`} variation={compare.clientesAtendidos}/>
        <MetricCard icon={WalletCards} label="Resultado financeiro" value={formatCurrency(finance.resultado || 0)} hint={`${formatCurrency(finance.recebimentos || 0)} recebidos · ${formatCurrency(finance.pagamentos || 0)} pagos`} tone={Number(finance.resultado || 0) < 0 ? "danger" : "success"}/>
      </section>
      <section className="reports-main-grid">
        <article className="panel report-chart-panel"><div className="panel__heading"><div><span>Faturamento diário</span><h2>Evolução no período</h2></div><span className="report-period-count">{data.periodo?.dias || 0} dias</span></div><SalesChart rows={sales.evolucao || []}/></article>
        <article className="panel"><div className="panel__heading"><div><span>Mix de receita</span><h2>Produtos x serviços</h2></div></div><Bars rows={typeRows} labelKey="nome"/></article>
      </section>
      <section className="reports-health-grid">
        <article className="panel report-health-card"><span className="report-health-card__icon"><Warehouse size={18}/></span><div><small>Estoque</small><strong>{formatCurrency(stock.valorEstoque || 0)}</strong><span>{stock.itensEstoqueBaixo || 0} abaixo do mínimo · {stock.lotesVencidos || 0} lotes vencidos</span></div></article>
        <article className="panel report-health-card"><span className="report-health-card__icon"><HeartPulse size={18}/></span><div><small>Consultório</small><strong>{operation.consultorio?.finalizados || 0} atendimentos</strong><span>{duration(operation.consultorio?.tempoMedioMinutos)} de duração média</span></div></article>
        <article className="panel report-health-card"><span className="report-health-card__icon"><Scissors size={18}/></span><div><small>Banho e Tosa</small><strong>{operation.banhoTosa?.agendamentos || 0} agendamentos</strong><span>{percent(operation.banhoTosa?.taxaComparecimento)} de comparecimento</span></div></article>
        <article className="panel report-health-card"><span className="report-health-card__icon"><FileCheck2 size={18}/></span><div><small>Fiscal</small><strong>{fiscal.autorizados || 0} autorizados</strong><span>{percent(fiscal.taxaAutorizacao)} de autorização · {fiscal.erros || 0} erro(s)</span></div></article>
      </section>
      {scope === "organizacao" && (sales.empresas || []).length > 1 ? <section className="panel"><div className="panel__heading"><div><span>Multi-CNPJ</span><h2>Faturamento por empresa</h2></div></div><div className="report-panel-body"><Bars rows={(sales.empresas || []).map((x) => ({ ...x, nome: x.empresa }))} labelKey="nome"/></div></section> : null}
    </> : null}

    {!query.isLoading && tab === "VENDAS" ? <>
      <section className="report-metric-grid report-metric-grid--5">
        <MetricCard icon={ShoppingCart} label="Vendas" value={sales.vendas || 0} hint="finalizadas" variation={compare.vendas}/>
        <MetricCard icon={ReceiptText} label="Faturamento" value={formatCurrency(sales.faturamento || 0)} hint="receita bruta" variation={compare.faturamento}/>
        <MetricCard icon={CreditCard} label="Ticket médio" value={formatCurrency(sales.ticketMedio || 0)} hint="por venda" variation={compare.ticketMedio}/>
        <MetricCard icon={PackageSearch} label="Itens vendidos" value={compactNumber(sales.unidades || 0)} hint="unidades/serviços"/>
        <MetricCard icon={AlertTriangle} label="Canceladas" value={sales.canceladas || 0} hint="vendas/estornos no período" tone={(sales.canceladas || 0) ? "warning" : "default"}/>
      </section>
      <section className="reports-main-grid"><article className="panel"><div className="panel__heading"><div><span>Recebimentos</span><h2>Formas de pagamento</h2></div></div><div className="report-panel-body"><Bars rows={paymentRows} labelKey="nome"/></div></article><article className="panel"><div className="panel__heading"><div><span>Receita</span><h2>Por categoria</h2></div></div><div className="report-panel-body"><Bars rows={(sales.categorias || []).slice(0, 10).map((x) => ({ ...x, nome: x.categoria }))} labelKey="nome"/></div></article></section>
      <section className="panel report-table-panel"><div className="panel__heading"><div><span>Ranking</span><h2>Produtos e serviços mais vendidos</h2></div><button className="secondary-button" onClick={() => download("vendas")} disabled={downloading === "vendas"}><Download size={14}/>{downloading === "vendas" ? "Exportando..." : "Exportar CSV"}</button></div><Table rows={sales.topItens || []} columns={[{key:"nome",label:"Item"},{key:"tipo",label:"Tipo",render:(r)=>typeLabels[r.tipo]||r.tipo},{key:"categoria",label:"Categoria"},{key:"quantidade",label:"Quantidade",render:(r)=>compactNumber(r.quantidade)},{key:"valor",label:"Faturamento",render:(r)=><strong>{formatCurrency(r.valor)}</strong>}]} /></section>
    </> : null}

    {!query.isLoading && tab === "CLIENTES" ? <>
      <section className="report-metric-grid report-metric-grid--5"><MetricCard icon={UsersRound} label="Clientes ativos" value={clients.clientesAtivos || 0} hint="na organização"/><MetricCard icon={UsersRound} label="Novos clientes" value={clients.novosClientes || 0} hint="cadastrados no período"/><MetricCard icon={ShoppingCart} label="Compradores" value={clients.compradoresPeriodo || 0} hint="com venda no período"/><MetricCard icon={RefreshCw} label="Recorrentes" value={clients.clientesRecorrentes || 0} hint={`${percent(clients.taxaRecorrencia)} dos compradores`}/><MetricCard icon={PawPrint} label="Pets ativos" value={clients.petsAtivos || 0} hint="cadastros ativos"/></section>
      <section className="reports-main-grid"><article className="panel"><div className="panel__heading"><div><span>Base pet</span><h2>Distribuição por espécie</h2></div></div><div className="report-panel-body"><Bars rows={(clients.especies || []).map((x)=>({...x,nome:x.especie}))} labelKey="nome" valueKey="quantidade" formatter={(v)=>`${v} pet(s)`}/></div></article><article className="panel report-highlight"><div className="report-highlight__icon"><UsersRound size={24}/></div><div><span>Fidelização</span><strong>{percent(clients.taxaRecorrencia)}</strong><p>dos clientes que compraram neste período já tinham histórico de compras anterior.</p></div></article></section>
      <section className="panel report-table-panel"><div className="panel__heading"><div><span>Relacionamento</span><h2>Clientes por faturamento</h2></div><button className="secondary-button" onClick={() => download("clientes")} disabled={downloading === "clientes"}><Download size={14}/>Exportar CSV</button></div><Table rows={clients.ranking || []} columns={[{key:"nome",label:"Cliente"},{key:"compras",label:"Compras"},{key:"recorrente",label:"Perfil",render:(r)=><span className={`badge badge--${r.recorrente?"success":"info"}`}>{r.recorrente?"Recorrente":"Novo comprador"}</span>},{key:"faturamento",label:"Faturamento",render:(r)=><strong>{formatCurrency(r.faturamento)}</strong>}]} /></section>
    </> : null}

    {!query.isLoading && tab === "OPERACAO" ? <>
      <section className="reports-operation-grid">
        <article className="panel"><div className="panel__heading"><div><span>Consultório</span><h2>Atendimento veterinário</h2></div><HeartPulse size={18}/></div><div className="report-operation-kpis"><div><span>Atendimentos</span><strong>{operation.consultorio?.atendimentos || 0}</strong></div><div><span>Finalizados</span><strong>{operation.consultorio?.finalizados || 0}</strong></div><div><span>Cancelados</span><strong>{operation.consultorio?.cancelados || 0}</strong></div><div><span>Tempo médio</span><strong>{duration(operation.consultorio?.tempoMedioMinutos)}</strong></div></div><Bars rows={(operation.consultorio?.status || []).map((x)=>({...x,nome:label(x.chave)}))} labelKey="nome" valueKey="quantidade" formatter={(v)=>`${v}`}/></article>
        <article className="panel"><div className="panel__heading"><div><span>Banho e Tosa</span><h2>Agenda e produção</h2></div><Scissors size={18}/></div><div className="report-operation-kpis"><div><span>Agendamentos</span><strong>{operation.banhoTosa?.agendamentos || 0}</strong></div><div><span>Concluídos</span><strong>{operation.banhoTosa?.concluidos || 0}</strong></div><div><span>Faltas</span><strong>{operation.banhoTosa?.faltas || 0}</strong></div><div><span>Comparecimento</span><strong>{percent(operation.banhoTosa?.taxaComparecimento)}</strong></div></div><Bars rows={(operation.banhoTosa?.status || []).map((x)=>({...x,nome:label(x.chave)}))} labelKey="nome" valueKey="quantidade" formatter={(v)=>`${v}`}/></article>
      </section>
      <section className="reports-main-grid"><article className="panel"><div className="panel__heading"><div><span>Equipe</span><h2>Agendamentos por profissional</h2></div></div><div className="report-panel-body"><Bars rows={(operation.banhoTosa?.profissionais || []).map((x)=>({...x,nome:x.profissional}))} labelKey="nome" valueKey="agendamentos" formatter={(v)=>`${v} agendamento(s)`}/></div></article><article className="panel"><div className="panel__heading"><div><span>Pacotes</span><h2>Créditos e contratos</h2></div></div><div className="report-package-summary"><div><span>Consumos no período</span><strong>{operation.pacotes?.consumosPeriodo || 0}</strong></div>{(operation.pacotes?.porStatus || []).map((x)=><div key={x.status}><span>{label(x.status)}</span><strong>{x.quantidade}</strong></div>)}</div></article></section>
    </> : null}

    {!query.isLoading && tab === "ESTOQUE" ? <>
      <section className="report-metric-grid report-metric-grid--5"><MetricCard icon={Warehouse} label="Valor em estoque" value={formatCurrency(stock.valorEstoque || 0)} hint="a custo médio"/><MetricCard icon={PackageSearch} label="Produtos controlados" value={stock.produtosControlados || 0} hint="com controle de saldo"/><MetricCard icon={AlertTriangle} label="Abaixo do mínimo" value={stock.itensEstoqueBaixo || 0} hint="precisam atenção" tone={(stock.itensEstoqueBaixo||0)>0?"warning":"default"}/><MetricCard icon={AlertTriangle} label="Zerados" value={stock.itensZerados || 0} hint="sem saldo" tone={(stock.itensZerados||0)>0?"danger":"default"}/><MetricCard icon={CalendarDays} label="Validade" value={stock.lotesVencendo30Dias || 0} hint={`${stock.lotesVencidos || 0} vencidos · próximos 30 dias`} tone={(stock.lotesVencidos||0)>0?"danger":"default"}/></section>
      <section className="reports-main-grid"><article className="panel"><div className="panel__heading"><div><span>Movimentação</span><h2>Movimentos do período</h2></div></div><div className="report-panel-body"><Bars rows={(stock.movimentos || []).map((x)=>({...x,nome:movementLabels[x.tipo]||label(x.tipo)}))} labelKey="nome" valueKey="quantidade" formatter={(v)=>compactNumber(v)}/></div></article><article className="panel"><div className="panel__heading"><div><span>Alertas</span><h2>Próximas validades</h2></div></div><div className="report-alert-list">{(stock.validade || []).slice(0,8).map((row)=><div key={row.id}><span className={`report-alert-dot ${row.situacao==="VENCIDO"?"is-danger":"is-warning"}`}/><div><strong>{row.produto}</strong><small>{row.empresa} · lote {row.lote}</small></div><b>{formatDate(row.validade)}</b></div>)}{!(stock.validade||[]).length?<div className="mini-empty">Nenhum lote vencido ou próximo da validade.</div>:null}</div></article></section>
      <section className="panel report-table-panel"><div className="panel__heading"><div><span>Reposição</span><h2>Itens abaixo do estoque mínimo</h2></div><button className="secondary-button" onClick={() => download("estoque")} disabled={downloading === "estoque"}><Download size={14}/>Exportar CSV</button></div><Table rows={stock.estoqueBaixo || []} columns={[{key:"produto",label:"Produto"},{key:"empresa",label:"Empresa"},{key:"quantidade",label:"Saldo",render:(r)=><strong>{compactNumber(r.quantidade)}</strong>},{key:"minimo",label:"Mínimo",render:(r)=>compactNumber(r.minimo)}]} empty="Nenhum item abaixo do estoque mínimo."/></section>
    </> : null}

    {!query.isLoading && tab === "FINANCEIRO" ? <>
      <section className="report-metric-grid report-metric-grid--5"><MetricCard icon={TrendingUp} label="Recebimentos" value={formatCurrency(finance.recebimentos || 0)} hint="baixados no período" tone="success"/><MetricCard icon={TrendingDown} label="Pagamentos" value={formatCurrency(finance.pagamentos || 0)} hint="baixados no período"/><MetricCard icon={WalletCards} label="Resultado" value={formatCurrency(finance.resultado || 0)} hint="recebimentos − pagamentos" tone={Number(finance.resultado||0)<0?"danger":"success"}/><MetricCard icon={ReceiptText} label="A receber" value={formatCurrency(finance.receberAberto || 0)} hint={`${formatCurrency(finance.receberVencido || 0)} vencido`} tone={Number(finance.receberVencido||0)>0?"warning":"default"}/><MetricCard icon={ClipboardList} label="A pagar" value={formatCurrency(finance.pagarAberto || 0)} hint={`${formatCurrency(finance.pagarVencido || 0)} vencido`} tone={Number(finance.pagarVencido||0)>0?"warning":"default"}/></section>
      <section className="reports-main-grid"><article className="panel"><div className="panel__heading"><div><span>Resultado</span><h2>Movimento por categoria</h2></div></div><div className="report-panel-body"><Bars rows={(finance.categorias || []).slice(0,12).map((x)=>({...x,nome:`${x.tipo==="RECEBER"?"Receita":"Despesa"} · ${x.categoria}`}))} labelKey="nome"/></div></article><article className="panel"><div className="panel__heading"><div><span>Liquidações</span><h2>Formas de pagamento</h2></div></div><div className="report-panel-body"><Bars rows={(finance.formas || []).map((x)=>({...x,nome:paymentLabels[x.forma]||x.forma}))} labelKey="nome"/></div></article></section>
      <section className="panel report-export-strip"><div><strong>Relatório financeiro</strong><span>Exporte a composição por categorias para análise externa ou contabilidade.</span></div><button className="primary-button" onClick={() => download("financeiro")} disabled={downloading === "financeiro"}><Download size={14}/>Exportar CSV</button></section>
    </> : null}

    {!query.isLoading && tab === "FISCAL" ? <>
      <section className="report-metric-grid report-metric-grid--5"><MetricCard icon={ReceiptText} label="Documentos" value={fiscal.documentos || 0} hint="criados no período"/><MetricCard icon={CheckCircle2} label="Autorizados" value={fiscal.autorizados || 0} hint={`${percent(fiscal.taxaAutorizacao)} de autorização`} tone="success"/><MetricCard icon={RefreshCw} label="Pendentes" value={fiscal.pendentes || 0} hint="aguardando processamento"/><MetricCard icon={AlertTriangle} label="Erros/Rejeitados" value={fiscal.erros || 0} hint="exigem revisão" tone={(fiscal.erros||0)>0?"danger":"default"}/><MetricCard icon={FileCheck2} label="Valor autorizado" value={formatCurrency(fiscal.valorAutorizado || 0)} hint={`${fiscal.simulados || 0} documento(s) simulado(s)`}/></section>
      <section className="reports-main-grid"><article className="panel"><div className="panel__heading"><div><span>Documentos</span><h2>Status fiscal</h2></div></div><div className="report-panel-body"><Bars rows={(fiscal.porStatus || []).map((x)=>({...x,nome:label(x.status)}))} labelKey="nome" valueKey="quantidade" formatter={(v)=>`${v}`}/></div></article><article className="panel"><div className="panel__heading"><div><span>Modelos</span><h2>Documentos por tipo</h2></div></div><div className="report-panel-body"><Bars rows={(fiscal.porTipo || []).map((x)=>({...x,nome:fiscalTypeLabels[x.tipo]||x.tipo}))} labelKey="nome" valueKey="quantidade" formatter={(v)=>`${v}`}/></div></article></section>
      <section className="panel report-export-strip"><div><strong>Resumo fiscal</strong><span>Exporte a distribuição por status do período selecionado.</span></div><button className="primary-button" onClick={() => download("fiscal")} disabled={downloading === "fiscal"}><Download size={14}/>Exportar CSV</button></section>
    </> : null}
  </div>;
}
