import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Coffee,
  FileSpreadsheet,
  History,
  ListChecks,
  LockKeyhole,
  LogIn,
  LogOut,
  PencilLine,
  RotateCcw,
  TimerReset,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import FormField from "../components/FormField.jsx";
import InlineNotice from "../components/InlineNotice.jsx";
import { formatDateTime, formatTime } from "../lib/formatters.js";

const POINT_LABELS = {
  ENTRADA: "Registrar entrada",
  INICIO_PAUSA: "Iniciar pausa",
  FIM_PAUSA: "Retornar da pausa",
  SAIDA: "Registrar saída",
};

const POINT_SHORT = {
  ENTRADA: "Entrada",
  INICIO_PAUSA: "Início da pausa",
  FIM_PAUSA: "Retorno da pausa",
  SAIDA: "Saída",
};

const POINT_ICONS = {
  ENTRADA: LogIn,
  INICIO_PAUSA: Coffee,
  FIM_PAUSA: ArrowRight,
  SAIDA: LogOut,
};

const DIVERGENCE_LABELS = {
  FALTA: "Falta",
  SEM_JORNADA: "Sem jornada",
  BATIDA_INCOMPLETA: "Batida incompleta",
  JORNADA_EM_ANDAMENTO: "Em andamento",
  SEQUENCIA_INVALIDA: "Sequência inválida",
  ATRASO: "Atraso",
  SAIDA_ANTECIPADA: "Saída antecipada",
};

function localDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localMonthInput(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateRange(day) {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(`${day}T23:59:59.999`);
  return { inicio: start.toISOString(), fim: end.toISOString() };
}

function latestApprovedAdjustment(record) {
  return (record?.ajustes || []).find((adjustment) => adjustment.status === "APROVADO") || null;
}

function effectiveDate(record) {
  return new Date(latestApprovedAdjustment(record)?.horarioNovo || record.registradoEm);
}

function summarize(records) {
  const sorted = [...records].sort((a, b) => effectiveDate(a) - effectiveDate(b));
  let worked = 0;
  let paused = 0;
  let workStart = null;
  let pauseStart = null;

  for (const record of sorted) {
    const time = effectiveDate(record).getTime();
    if (record.tipo === "ENTRADA") workStart = time;
    if (record.tipo === "INICIO_PAUSA") {
      if (workStart) worked += Math.max(0, time - workStart);
      workStart = null;
      pauseStart = time;
    }
    if (record.tipo === "FIM_PAUSA") {
      if (pauseStart) paused += Math.max(0, time - pauseStart);
      pauseStart = null;
      workStart = time;
    }
    if (record.tipo === "SAIDA") {
      if (workStart) worked += Math.max(0, time - workStart);
      workStart = null;
      if (pauseStart) paused += Math.max(0, time - pauseStart);
      pauseStart = null;
    }
  }

  if (workStart) worked += Math.max(0, Date.now() - workStart);
  if (pauseStart) paused += Math.max(0, Date.now() - pauseStart);
  const minutes = (ms) => Math.round(ms / 60000);
  return { worked: minutes(worked), paused: minutes(paused) };
}

function formatMinutes(total, { signed = false } = {}) {
  const value = Number(total) || 0;
  const sign = value < 0 ? "−" : signed && value > 0 ? "+" : "";
  const minutes = Math.abs(value);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${sign}${h}h ${String(m).padStart(2, "0")}min`;
}

function formatDateKey(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-");
  return `${day}/${month}/${year}`;
}

function adjustmentBadge(status) {
  if (status === "APROVADO") return ["Aprovado", "success"];
  if (status === "REJEITADO") return ["Rejeitado", "danger"];
  return ["Pendente", "warning"];
}

async function loadEmployees() {
  const { data } = await api.get("/funcionarios");
  return data.dados || [];
}

export default function TimeClockPage() {
  const { user, selectedCompany, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("registro");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [day, setDay] = useState(() => localDateInput());
  const [competence, setCompetence] = useState(() => localMonthInput());
  const [clock, setClock] = useState(() => new Date());
  const [pageError, setPageError] = useState("");
  const [pageSuccess, setPageSuccess] = useState("");
  const [adjusting, setAdjusting] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ horarioNovo: "", motivo: "" });
  const [adjustError, setAdjustError] = useState("");
  const [reviewing, setReviewing] = useState(null);
  const [reviewForm, setReviewForm] = useState({ decisao: "REJEITAR", observacao: "" });
  const [reviewError, setReviewError] = useState("");
  const [reopening, setReopening] = useState(null);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenError, setReopenError] = useState("");
  const [detailRow, setDetailRow] = useState(null);

  const canManage = hasPermission("ponto.gerenciar");
  const canPunch = hasPermission("ponto.registrar");
  const canApprove = hasPermission("ponto.aprovar_ajustes");
  const canClose = hasPermission("ponto.fechamento");

  useEffect(() => {
    if (tab === "registro" && !canPunch && !canManage) {
      if (canClose) setTab("fechamento");
      else if (canApprove) setTab("ajustes");
    } else if (tab === "fechamento" && !canClose) {
      if (canPunch || canManage) setTab("registro");
      else if (canApprove) setTab("ajustes");
    } else if (tab === "ajustes" && !canApprove) {
      if (canPunch || canManage) setTab("registro");
      else if (canClose) setTab("fechamento");
    }
  }, [tab, canPunch, canManage, canApprove, canClose]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const employeesQuery = useQuery({ queryKey: ["employees-point", selectedCompany?.id], queryFn: loadEmployees });
  const eligibleEmployees = useMemo(
    () => (employeesQuery.data || []).filter((employee) => employee.status !== "DESLIGADO" && (employee.empresas || []).some((link) => (link.empresaId || link.empresa?.id) === selectedCompany?.id && link.ativo !== false)),
    [employeesQuery.data, selectedCompany?.id]
  );

  useEffect(() => {
    if (!eligibleEmployees.length) {
      setSelectedEmployeeId("");
      return;
    }
    const own = eligibleEmployees.find((employee) => employee.usuario?.id === user?.id);
    setSelectedEmployeeId((current) => eligibleEmployees.some((employee) => employee.id === current) ? current : (own?.id || eligibleEmployees[0].id));
  }, [eligibleEmployees, user?.id]);

  const selectedEmployee = eligibleEmployees.find((employee) => employee.id === selectedEmployeeId) || null;
  const isToday = day === localDateInput();
  const range = useMemo(() => dateRange(day), [day]);

  const statusQuery = useQuery({
    queryKey: ["point-status", selectedCompany?.id, selectedEmployeeId],
    queryFn: async () => (await api.get(`/funcionarios/${selectedEmployeeId}/ponto/status`)).data,
    enabled: Boolean(selectedEmployeeId && isToday && canPunch && tab === "registro"),
    refetchInterval: 30000,
  });

  const recordsQuery = useQuery({
    queryKey: ["point-records", selectedCompany?.id, selectedEmployeeId, day],
    queryFn: async () => (await api.get(`/funcionarios/${selectedEmployeeId}/ponto/registros`, { params: { empresaId: selectedCompany.id, ...range } })).data.dados || [],
    enabled: Boolean(selectedEmployeeId && selectedCompany?.id && canManage && tab === "registro"),
  });

  const monthlyQuery = useQuery({
    queryKey: ["point-monthly-close", selectedCompany?.id, competence],
    queryFn: async () => (await api.get("/funcionarios/ponto/fechamento", { params: { competencia: competence } })).data,
    enabled: Boolean(selectedCompany?.id && canClose && tab === "fechamento"),
  });

  const adjustmentsQuery = useQuery({
    queryKey: ["point-adjustments", selectedCompany?.id, competence],
    queryFn: async () => (await api.get("/funcionarios/ponto/ajustes", { params: { status: "PENDENTE", competencia: competence } })).data.dados || [],
    enabled: Boolean(selectedCompany?.id && canApprove && tab === "ajustes"),
  });

  const records = recordsQuery.data || [];
  const summary = useMemo(() => summarize(records), [records, clock]);
  const permitted = statusQuery.data?.tiposPermitidos || [];
  const monthly = monthlyQuery.data;

  function invalidatePointManagement() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["point-records"] }),
      queryClient.invalidateQueries({ queryKey: ["point-adjustments"] }),
      queryClient.invalidateQueries({ queryKey: ["point-monthly-close"] }),
    ]);
  }

  const punchMutation = useMutation({
    mutationFn: async (tipo) => (await api.post(`/funcionarios/${selectedEmployeeId}/ponto/bater`, { tipo })).data,
    onSuccess: async () => {
      setPageError("");
      setPageSuccess("Ponto registrado com sucesso.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["point-status"] }),
        queryClient.invalidateQueries({ queryKey: ["point-records"] }),
      ]);
    },
    onError: (error) => setPageError(getApiErrorMessage(error, "Não foi possível registrar o ponto.")),
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const local = new Date(adjustForm.horarioNovo);
      return (await api.post(`/funcionarios/ponto/registros/${adjusting.id}/ajustes`, { horarioNovo: local.toISOString(), motivo: adjustForm.motivo.trim() })).data;
    },
    onSuccess: async () => {
      await invalidatePointManagement();
      setAdjusting(null);
      setAdjustError("");
      setPageSuccess("Solicitação de ajuste enviada para aprovação.");
    },
    onError: (error) => setAdjustError(getApiErrorMessage(error, "Não foi possível solicitar o ajuste.")),
  });

  const analyzeMutation = useMutation({
    mutationFn: async ({ ajusteId, decisao, observacao }) => (await api.post(`/funcionarios/ponto/ajustes/${ajusteId}/analisar`, { decisao, observacao: observacao || null })).data,
    onSuccess: async (_, variables) => {
      await invalidatePointManagement();
      setReviewing(null);
      setReviewError("");
      setPageSuccess(variables.decisao === "APROVAR" ? "Ajuste aprovado e aplicado ao espelho de ponto." : "Solicitação de ajuste rejeitada.");
    },
    onError: (error) => setReviewError(getApiErrorMessage(error, "Não foi possível analisar o ajuste.")),
  });

  const closeEmployeeMutation = useMutation({
    mutationFn: async (row) => (await api.post(`/funcionarios/${row.funcionario.id}/ponto/fechar`, { competencia: competence })).data,
    onSuccess: async () => {
      await invalidatePointManagement();
      setPageSuccess("Ponto do funcionário fechado com sucesso.");
    },
    onError: (error) => setPageError(getApiErrorMessage(error, "Não foi possível fechar o ponto.")),
  });

  const closeAllMutation = useMutation({
    mutationFn: async () => (await api.post("/funcionarios/ponto/fechamento/fechar", { competencia: competence })).data,
    onSuccess: async (data) => {
      await invalidatePointManagement();
      setPageSuccess(`${data.fechados || 0} fechamento(s) concluído(s) na competência ${competence}.`);
    },
    onError: (error) => {
      const detail = error?.response?.data?.detalhes?.funcionarios;
      const suffix = Array.isArray(detail) && detail.length ? ` ${detail.length} funcionário(s) possuem pendências.` : "";
      setPageError(`${getApiErrorMessage(error, "Não foi possível fechar a competência.")}${suffix}`);
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async () => (await api.post(`/funcionarios/ponto/fechamento/${reopening.fechamentoId}/reabrir`, { motivo: reopenReason.trim() })).data,
    onSuccess: async () => {
      await invalidatePointManagement();
      setReopening(null);
      setReopenReason("");
      setReopenError("");
      setPageSuccess("Competência reaberta. Ajustes e correções voltaram a ser permitidos.");
    },
    onError: (error) => setReopenError(getApiErrorMessage(error, "Não foi possível reabrir o fechamento.")),
  });

  function openAdjustment(record) {
    const date = effectiveDate(record);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
    setAdjusting(record);
    setAdjustForm({ horarioNovo: local, motivo: "" });
    setAdjustError("");
  }

  function submitAdjustment(event) {
    event.preventDefault();
    if (!adjustForm.horarioNovo) return setAdjustError("Informe o novo horário.");
    if (adjustForm.motivo.trim().length < 5) return setAdjustError("Informe um motivo com pelo menos 5 caracteres.");
    adjustMutation.mutate();
  }

  function reviewAdjustment(adjustment, decision) {
    setReviewing(adjustment);
    setReviewForm({ decisao: decision, observacao: "" });
    setReviewError("");
  }

  function submitReview(event) {
    event.preventDefault();
    analyzeMutation.mutate({ ajusteId: reviewing.id, decisao: reviewForm.decisao, observacao: reviewForm.observacao.trim() });
  }

  async function exportCsv() {
    try {
      setPageError("");
      const response = await api.get("/funcionarios/ponto/fechamento/exportar", { params: { competencia: competence }, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ponto-${competence}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setPageError(getApiErrorMessage(error, "Não foi possível exportar o fechamento."));
    }
  }

  const tabs = [
    ["registro", "Bater ponto", Clock3, canPunch || canManage],
    ["fechamento", "Fechamento mensal", LockKeyhole, canClose],
    ["ajustes", "Ajustes pendentes", ListChecks, canApprove],
  ].filter(([, , , visible]) => visible);

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="page-kicker">RH e jornada</span>
          <h1>Ponto eletrônico</h1>
          <p>Batidas, ajustes auditáveis, banco de horas e fechamento mensal por CNPJ.</p>
        </div>
        <div className="point-heading-clock"><Clock3 size={18} /><div><strong>{clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong><span>{clock.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</span></div></div>
      </section>

      <div className="settings-tabs point-management-tabs">
        {tabs.map(([value, label, Icon]) => <button key={value} type="button" className={`settings-tab ${tab === value ? "settings-tab--active" : ""}`} onClick={() => { setTab(value); setPageError(""); setPageSuccess(""); }}><Icon size={14} />{label}</button>)}
      </div>

      <InlineNotice tone="error">{pageError}</InlineNotice>
      <InlineNotice tone="success">{pageSuccess}</InlineNotice>

      {tab === "registro" && (
        <>
          <section className="point-layout">
            <article className="panel point-punch-card">
              <div className="point-punch-card__top">
                <div><span className="page-kicker">Registro de hoje</span><h2>{selectedEmployee?.nome || "Selecione um funcionário"}</h2><p>{selectedEmployee?.funcao?.nome || "Sem função definida"} • {selectedCompany?.nomeFantasia}</p></div>
                <label className="point-employee-select"><span>Funcionário</span><select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>{eligibleEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.nome}</option>)}</select></label>
              </div>

              {!eligibleEmployees.length ? (
                <div className="empty-state point-empty"><UserRound size={30} /><strong>Nenhum funcionário disponível</strong><p>Cadastre um funcionário e vincule-o ao CNPJ atual.</p></div>
              ) : (
                <>
                  <div className="point-status-orb"><span>{statusQuery.data?.ultimoRegistro ? POINT_SHORT[statusQuery.data.ultimoRegistro.tipo] : "Aguardando entrada"}</span><strong>{statusQuery.data?.ultimoRegistro ? formatTime(statusQuery.data.ultimoRegistro.registradoEm) : "—"}</strong><small>{statusQuery.data?.ultimoRegistro ? "último registro" : "nenhuma batida hoje"}</small></div>
                  <div className="point-action-grid">
                    {Object.entries(POINT_LABELS).map(([type, label]) => {
                      const Icon = POINT_ICONS[type];
                      const enabled = isToday && permitted.includes(type) && canPunch && !punchMutation.isPending;
                      return <button key={type} type="button" className={`point-action point-action--${type.toLowerCase()} ${enabled ? "is-enabled" : ""}`} disabled={!enabled} onClick={() => punchMutation.mutate(type)}><Icon size={18} /><span>{label}</span></button>;
                    })}
                  </div>
                  {!isToday && <InlineNotice tone="info">Batidas só podem ser registradas na data atual. Use a data selecionada apenas para consultar o histórico.</InlineNotice>}
                </>
              )}
            </article>

            <aside className="point-side-stack">
              <article className="panel point-metric-card"><span><TimerReset size={18} /></span><div><small>Tempo trabalhado</small><strong>{formatMinutes(summary.worked)}</strong><em>estimativa do dia</em></div></article>
              <article className="panel point-metric-card"><span><Coffee size={18} /></span><div><small>Tempo em pausa</small><strong>{formatMinutes(summary.paused)}</strong><em>intervalos registrados</em></div></article>
              <article className="panel point-metric-card"><span><CheckCircle2 size={18} /></span><div><small>Batidas</small><strong>{records.length}</strong><em>na data selecionada</em></div></article>
            </aside>
          </section>

          {canManage && <section className="panel point-history-panel">
            <div className="point-history-toolbar"><div><span className="page-kicker">Espelho diário</span><h2>Registros de ponto</h2></div><label><CalendarDays size={16} /><input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label></div>
            {recordsQuery.isLoading ? <div className="loading-state">Carregando registros...</div> : recordsQuery.isError ? <div className="empty-state"><Clock3 size={30} /><strong>Não foi possível carregar o ponto</strong><p>{getApiErrorMessage(recordsQuery.error)}</p></div> : records.length === 0 ? <div className="empty-state"><Clock3 size={30} /><strong>Nenhuma batida nesta data</strong><p>Os registros aparecerão aqui assim que o funcionário bater o ponto.</p></div> : <div className="point-timeline">{[...records].sort((a,b) => effectiveDate(a) - effectiveDate(b)).map((record) => {
              const Icon = POINT_ICONS[record.tipo] || Clock3;
              const approved = latestApprovedAdjustment(record);
              const latest = record.ajustes?.[0] || null;
              const [statusLabel, statusTone] = latest ? adjustmentBadge(latest.status) : [null, null];
              return <div key={record.id} className="point-timeline-row"><span className={`point-timeline-icon point-timeline-icon--${record.tipo.toLowerCase()}`}><Icon size={16} /></span><div className="point-timeline-main"><strong>{POINT_SHORT[record.tipo] || record.tipo}</strong><span>{formatDateTime(effectiveDate(record))}{approved ? " • horário ajustado" : ""}</span>{latest && <small className={`point-adjustment-state point-adjustment-state--${statusTone}`}>{statusLabel}: {latest.motivo}</small>}</div><div className="point-timeline-meta"><span>{record.origem || "WEB"}</span>{record.ajustes?.length > 0 && <small>{record.ajustes.length} solicitação(ões)</small>}</div><button className="icon-button table-action" type="button" title="Solicitar ajuste" onClick={() => openAdjustment(record)}><PencilLine size={15} /></button></div>;
            })}</div>}
          </section>}
        </>
      )}

      {tab === "fechamento" && canClose && (
        <>
          <section className="panel point-month-toolbar">
            <div><span className="page-kicker">Competência</span><strong>Fechamento mensal do ponto</strong><small>O fechamento usa somente ajustes aprovados e cria um snapshot auditável.</small></div>
            <div className="point-month-actions"><label><CalendarDays size={15} /><input type="month" value={competence} onChange={(e) => setCompetence(e.target.value)} /></label><button type="button" className="secondary-button" onClick={() => monthlyQuery.refetch()}>Atualizar</button><button type="button" className="secondary-button" onClick={exportCsv}><FileSpreadsheet size={15} /> Exportar CSV</button><button type="button" className="primary-button" disabled={!monthly || monthly.competencia >= monthly.competenciaAtual || closeAllMutation.isPending} onClick={() => closeAllMutation.mutate()}><LockKeyhole size={15} /> {closeAllMutation.isPending ? "Fechando..." : "Fechar competência"}</button></div>
          </section>

          {monthlyQuery.isLoading ? <div className="loading-state">Calculando jornada e banco de horas...</div> : monthlyQuery.isError ? <div className="empty-state panel"><AlertTriangle size={30} /><strong>Não foi possível calcular a competência</strong><p>{getApiErrorMessage(monthlyQuery.error)}</p></div> : monthly && <>
            {monthly.competencia >= monthly.competenciaAtual && <InlineNotice tone="info">A competência atual pode ser acompanhada em tempo real, mas só poderá ser fechada depois que o mês terminar.</InlineNotice>}
            <section className="point-month-summary">
              <article className="panel"><span><UsersRound size={17} /></span><div><small>Funcionários</small><strong>{monthly.resumo.funcionarios}</strong><em>{monthly.resumo.fechados} fechado(s)</em></div></article>
              <article className="panel"><span><TimerReset size={17} /></span><div><small>Trabalhado</small><strong>{formatMinutes(monthly.resumo.minutosTrabalhados)}</strong><em>de {formatMinutes(monthly.resumo.minutosPrevistos)} previstos</em></div></article>
              <article className={`panel ${monthly.resumo.saldoBancoCompetencia < 0 ? "is-negative" : ""}`}><span><History size={17} /></span><div><small>Saldo da competência</small><strong>{formatMinutes(monthly.resumo.saldoBancoCompetencia, { signed: true })}</strong><em>banco de horas</em></div></article>
              <article className={`panel ${monthly.resumo.ajustesPendentes || monthly.resumo.divergencias ? "has-warning" : ""}`}><span><AlertTriangle size={17} /></span><div><small>Pendências</small><strong>{monthly.resumo.divergencias}</strong><em>{monthly.resumo.ajustesPendentes} ajuste(s) aguardando</em></div></article>
            </section>

            <section className="panel point-month-panel">
              <div className="table-scroll"><table className="data-table point-month-table"><thead><tr><th>Funcionário</th><th>Status</th><th>Previsto</th><th>Trabalhado</th><th>Extras</th><th>Atrasos</th><th>Faltas</th><th>Saldo mês</th><th>Banco acumulado</th><th>Pendências</th><th></th></tr></thead><tbody>{monthly.funcionarios.map((row) => <tr key={row.funcionario.id}><td><strong>{row.funcionario.nome}</strong><small>{row.funcionario.funcao?.nome || row.funcionario.matricula || "Sem função"}</small></td><td><span className={`badge ${row.statusFechamento === "FECHADO" ? "badge--success" : "badge--neutral"}`}>{row.statusFechamento === "FECHADO" ? "Fechado" : "Aberto"}</span></td><td>{formatMinutes(row.minutosPrevistos)}</td><td>{formatMinutes(row.minutosTrabalhados)}</td><td className="point-positive">{formatMinutes(row.minutosExtras)}</td><td>{formatMinutes(row.minutosAtraso)}</td><td>{row.faltas}</td><td className={row.saldoBancoCompetencia < 0 ? "point-negative" : "point-positive"}>{formatMinutes(row.saldoBancoCompetencia, { signed: true })}</td><td className={row.saldoBancoAcumulado < 0 ? "point-negative" : "point-positive"}>{formatMinutes(row.saldoBancoAcumulado, { signed: true })}</td><td><span className={row.divergenciasCriticas ? "point-negative" : ""}>{row.divergencias.length} diverg.</span><small>{row.ajustesPendentes} ajuste(s)</small></td><td><div className="table-actions"><button type="button" className="icon-button table-action" title="Ver espelho mensal" onClick={() => setDetailRow(row)}><ClipboardCheck size={15} /></button>{row.statusFechamento === "FECHADO" ? <button type="button" className="icon-button table-action" title="Reabrir competência" onClick={() => { setReopening(row); setReopenReason(""); setReopenError(""); }}><RotateCcw size={15} /></button> : <button type="button" className="icon-button table-action" title={row.prontoParaFechar ? "Fechar ponto" : "Resolva as pendências antes de fechar"} disabled={!row.prontoParaFechar || closeEmployeeMutation.isPending} onClick={() => closeEmployeeMutation.mutate(row)}><LockKeyhole size={15} /></button>}</div></td></tr>)}</tbody></table></div>
            </section>
          </>}
        </>
      )}

      {tab === "ajustes" && canApprove && (
        <>
          <section className="panel point-adjustment-toolbar"><div><span className="page-kicker">Aprovação</span><strong>Solicitações de ajuste</strong><small>O horário original nunca é apagado. Somente ajustes aprovados entram no cálculo da jornada.</small></div><label><CalendarDays size={15} /><input type="month" value={competence} onChange={(e) => setCompetence(e.target.value)} /></label></section>
          {adjustmentsQuery.isLoading ? <div className="loading-state">Carregando solicitações...</div> : adjustmentsQuery.isError ? <div className="empty-state panel"><AlertTriangle size={30} /><strong>Não foi possível carregar os ajustes</strong><p>{getApiErrorMessage(adjustmentsQuery.error)}</p></div> : (adjustmentsQuery.data || []).length === 0 ? <div className="empty-state panel"><BadgeCheck size={30} /><strong>Nenhum ajuste pendente</strong><p>Não existem solicitações aguardando aprovação nesta competência.</p></div> : <section className="panel point-adjustment-list">{adjustmentsQuery.data.map((adjustment) => <article key={adjustment.id} className="point-adjustment-card"><span className="point-adjustment-icon"><PencilLine size={16} /></span><div className="point-adjustment-person"><strong>{adjustment.registro.funcionario.nome}</strong><small>{POINT_SHORT[adjustment.registro.tipo]} • solicitado por {adjustment.usuario?.nome || "usuário"}</small></div><div className="point-adjustment-times"><span><small>Original</small><strong>{formatDateTime(adjustment.horarioAnterior)}</strong></span><ArrowRight size={15} /><span><small>Solicitado</small><strong>{formatDateTime(adjustment.horarioNovo)}</strong></span></div><div className="point-adjustment-reason"><small>Motivo</small><span>{adjustment.motivo}</span></div><div className="point-adjustment-actions"><button type="button" className="secondary-button point-reject" onClick={() => reviewAdjustment(adjustment, "REJEITAR")}><XCircle size={14} /> Rejeitar</button><button type="button" className="primary-button" onClick={() => reviewAdjustment(adjustment, "APROVAR")}><BadgeCheck size={14} /> Aprovar</button></div></article>)}</section>}
        </>
      )}

      <Modal open={Boolean(adjusting)} title="Solicitar ajuste de ponto" onClose={() => setAdjusting(null)}>
        <form onSubmit={submitAdjustment}>
          <div className="modal-body form-stack">
            <InlineNotice tone="error">{adjustError}</InlineNotice>
            <InlineNotice tone="info">O PetRise preserva a batida original. O novo horário só entra no espelho e no banco de horas após aprovação.</InlineNotice>
            <FormField label="Registro atual"><input value={adjusting ? `${POINT_SHORT[adjusting.tipo]} • ${formatDateTime(effectiveDate(adjusting))}` : ""} disabled /></FormField>
            <FormField label="Novo horário"><input type="datetime-local" value={adjustForm.horarioNovo} onChange={(e) => setAdjustForm((current) => ({ ...current, horarioNovo: e.target.value }))} /></FormField>
            <FormField label="Motivo"><textarea rows="4" value={adjustForm.motivo} onChange={(e) => setAdjustForm((current) => ({ ...current, motivo: e.target.value }))} placeholder="Ex.: funcionário esqueceu de registrar o retorno do intervalo." /></FormField>
          </div>
          <div className="modal-footer"><button type="button" className="text-button" onClick={() => setAdjusting(null)}>Cancelar</button><button className="primary-button" disabled={adjustMutation.isPending}>{adjustMutation.isPending ? "Enviando..." : "Enviar para aprovação"}</button></div>
        </form>
      </Modal>

      <Modal open={Boolean(reviewing)} title={reviewForm.decisao === "APROVAR" ? "Aprovar ajuste" : "Rejeitar ajuste"} onClose={() => setReviewing(null)}>
        <form onSubmit={submitReview}>
          <div className="modal-body form-stack">
            <InlineNotice tone="error">{reviewError}</InlineNotice>
            {reviewing && <div className="point-review-summary"><strong>{reviewing.registro.funcionario.nome}</strong><span>{formatDateTime(reviewing.horarioAnterior)} → {formatDateTime(reviewing.horarioNovo)}</span><small>{reviewing.motivo}</small></div>}
            <InlineNotice tone={reviewForm.decisao === "APROVAR" ? "info" : "warning"}>{reviewForm.decisao === "APROVAR" ? "Ao aprovar, o novo horário passa a valer nos cálculos do ponto." : "A batida original continuará válida e esta solicitação ficará registrada como rejeitada."}</InlineNotice>
            <FormField label="Observação da análise (opcional)"><textarea rows="3" value={reviewForm.observacao} onChange={(e) => setReviewForm((current) => ({ ...current, observacao: e.target.value }))} /></FormField>
          </div>
          <div className="modal-footer"><button type="button" className="text-button" onClick={() => setReviewing(null)}>Cancelar</button><button className={reviewForm.decisao === "APROVAR" ? "primary-button" : "secondary-button"} disabled={analyzeMutation.isPending}>{analyzeMutation.isPending ? "Salvando..." : reviewForm.decisao === "APROVAR" ? "Aprovar ajuste" : "Confirmar rejeição"}</button></div>
        </form>
      </Modal>

      <Modal open={Boolean(reopening)} title="Reabrir competência" onClose={() => setReopening(null)}>
        <form onSubmit={(event) => { event.preventDefault(); if (reopenReason.trim().length < 5) return setReopenError("Informe um motivo com pelo menos 5 caracteres."); reopenMutation.mutate(); }}>
          <div className="modal-body form-stack"><InlineNotice tone="error">{reopenError}</InlineNotice><InlineNotice tone="warning">A reabertura será auditada e permitirá novos ajustes. Se houver competências posteriores fechadas, elas precisam ser reabertas primeiro.</InlineNotice><FormField label="Funcionário"><input value={reopening?.funcionario.nome || ""} disabled /></FormField><FormField label="Motivo da reabertura"><textarea rows="4" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} /></FormField></div>
          <div className="modal-footer"><button type="button" className="text-button" onClick={() => setReopening(null)}>Cancelar</button><button className="primary-button" disabled={reopenMutation.isPending}>{reopenMutation.isPending ? "Reabrindo..." : "Reabrir competência"}</button></div>
        </form>
      </Modal>

      <Modal open={Boolean(detailRow)} title={detailRow ? `Espelho mensal — ${detailRow.funcionario.nome}` : "Espelho mensal"} onClose={() => setDetailRow(null)}>
        {detailRow && <div className="modal-body point-month-detail">
          <div className="point-month-detail-summary"><div><span>Previsto</span><strong>{formatMinutes(detailRow.minutosPrevistos)}</strong></div><div><span>Trabalhado</span><strong>{formatMinutes(detailRow.minutosTrabalhados)}</strong></div><div><span>Saldo mês</span><strong className={detailRow.saldoBancoCompetencia < 0 ? "point-negative" : "point-positive"}>{formatMinutes(detailRow.saldoBancoCompetencia, { signed: true })}</strong></div><div><span>Banco acumulado</span><strong className={detailRow.saldoBancoAcumulado < 0 ? "point-negative" : "point-positive"}>{formatMinutes(detailRow.saldoBancoAcumulado, { signed: true })}</strong></div></div>
          <div className="point-day-list">{detailRow.dias.length === 0 ? <div className="empty-state"><CalendarDays size={26} /><strong>Sem jornada no período</strong></div> : detailRow.dias.map((dia) => <article key={dia.data} className="point-day-card"><header><div><strong>{formatDateKey(dia.data)}</strong><small>{dia.jornada ? `${dia.jornada.entradaPrevista}–${dia.jornada.saidaPrevista}` : "Sem jornada prevista"}</small></div><span className={dia.saldoBanco < 0 ? "point-negative" : "point-positive"}>{formatMinutes(dia.saldoBanco, { signed: true })}</span></header><div className="point-day-metrics"><span>Previsto <b>{formatMinutes(dia.minutosPrevistos)}</b></span><span>Trabalhado <b>{formatMinutes(dia.minutosTrabalhados)}</b></span><span>Pausa <b>{formatMinutes(dia.minutosPausa)}</b></span></div>{dia.divergencias.length > 0 && <div className="point-divergences">{dia.divergencias.map((div, index) => <span key={`${div.tipo}-${index}`} className={`point-divergence point-divergence--${div.severidade.toLowerCase()}`}><AlertTriangle size={11} /> {DIVERGENCE_LABELS[div.tipo] || div.tipo}: {div.mensagem}</span>)}</div>}</article>)}</div>
        </div>}
        <div className="modal-footer"><button type="button" className="primary-button" onClick={() => setDetailRow(null)}>Fechar</button></div>
      </Modal>
    </div>
  );
}
