import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  LogIn,
  LogOut,
  PencilLine,
  TimerReset,
  UserRound,
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

function localDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateRange(day) {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(`${day}T23:59:59.999`);
  return { inicio: start.toISOString(), fim: end.toISOString() };
}

function effectiveDate(record) {
  const lastAdjustment = record?.ajustes?.[0];
  return new Date(lastAdjustment?.horarioNovo || record.registradoEm);
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

function formatMinutes(total) {
  const minutes = Math.max(0, Number(total) || 0);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

async function loadEmployees() {
  const { data } = await api.get("/funcionarios");
  return data.dados || [];
}

export default function TimeClockPage() {
  const { user, selectedCompany, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [day, setDay] = useState(() => localDateInput());
  const [clock, setClock] = useState(() => new Date());
  const [pageError, setPageError] = useState("");
  const [adjusting, setAdjusting] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ horarioNovo: "", motivo: "" });
  const [adjustError, setAdjustError] = useState("");

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
    enabled: Boolean(selectedEmployeeId && isToday),
    refetchInterval: 30000,
  });

  const recordsQuery = useQuery({
    queryKey: ["point-records", selectedCompany?.id, selectedEmployeeId, day],
    queryFn: async () => (await api.get(`/funcionarios/${selectedEmployeeId}/ponto/registros`, { params: { empresaId: selectedCompany.id, ...range } })).data.dados || [],
    enabled: Boolean(selectedEmployeeId && selectedCompany?.id),
  });

  const records = recordsQuery.data || [];
  const summary = useMemo(() => summarize(records), [records, clock]);
  const canManage = hasPermission("ponto.gerenciar");
  const canPunch = hasPermission("ponto.registrar");

  const punchMutation = useMutation({
    mutationFn: async (tipo) => (await api.post(`/funcionarios/${selectedEmployeeId}/ponto/bater`, { tipo })).data,
    onSuccess: async () => {
      setPageError("");
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
      await queryClient.invalidateQueries({ queryKey: ["point-records"] });
      setAdjusting(null);
      setAdjustError("");
    },
    onError: (error) => setAdjustError(getApiErrorMessage(error, "Não foi possível ajustar o registro.")),
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

  const permitted = statusQuery.data?.tiposPermitidos || [];

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="page-kicker">RH e jornada</span>
          <h1>Ponto eletrônico</h1>
          <p>Registre entrada, pausas e saída preservando o histórico original de cada batida.</p>
        </div>
        <div className="point-heading-clock"><Clock3 size={18} /><div><strong>{clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong><span>{clock.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</span></div></div>
      </section>

      <InlineNotice type="error">{pageError}</InlineNotice>

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
              {!isToday && <InlineNotice type="info">Batidas só podem ser registradas na data atual. Use a data selecionada apenas para consultar o histórico.</InlineNotice>}
            </>
          )}
        </article>

        <aside className="point-side-stack">
          <article className="panel point-metric-card"><span><TimerReset size={18} /></span><div><small>Tempo trabalhado</small><strong>{formatMinutes(summary.worked)}</strong><em>estimativa do dia</em></div></article>
          <article className="panel point-metric-card"><span><Coffee size={18} /></span><div><small>Tempo em pausa</small><strong>{formatMinutes(summary.paused)}</strong><em>intervalos registrados</em></div></article>
          <article className="panel point-metric-card"><span><CheckCircle2 size={18} /></span><div><small>Batidas</small><strong>{records.length}</strong><em>na data selecionada</em></div></article>
        </aside>
      </section>

      <section className="panel point-history-panel">
        <div className="point-history-toolbar"><div><span className="page-kicker">Espelho diário</span><h2>Registros de ponto</h2></div><label><CalendarDays size={16} /><input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label></div>
        {recordsQuery.isLoading ? <div className="loading-state">Carregando registros...</div> : recordsQuery.isError ? <div className="empty-state"><Clock3 size={30} /><strong>Não foi possível carregar o ponto</strong><p>{getApiErrorMessage(recordsQuery.error)}</p></div> : records.length === 0 ? <div className="empty-state"><Clock3 size={30} /><strong>Nenhuma batida nesta data</strong><p>Os registros aparecerão aqui assim que o funcionário bater o ponto.</p></div> : <div className="point-timeline">{[...records].sort((a,b) => effectiveDate(a) - effectiveDate(b)).map((record) => { const Icon = POINT_ICONS[record.tipo] || Clock3; const adjusted = record.ajustes?.length > 0; return <div key={record.id} className="point-timeline-row"><span className={`point-timeline-icon point-timeline-icon--${record.tipo.toLowerCase()}`}><Icon size={16} /></span><div className="point-timeline-main"><strong>{POINT_SHORT[record.tipo] || record.tipo}</strong><span>{formatDateTime(effectiveDate(record))}{adjusted ? " • horário ajustado" : ""}</span></div><div className="point-timeline-meta"><span>{record.origem || "WEB"}</span>{adjusted && <small>{record.ajustes.length} ajuste(s)</small>}</div>{canManage && <button className="icon-button table-action" type="button" title="Ajustar horário" onClick={() => openAdjustment(record)}><PencilLine size={15} /></button>}</div>; })}</div>}
      </section>

      <Modal open={Boolean(adjusting)} title="Ajustar registro de ponto" onClose={() => setAdjusting(null)}>
        <form onSubmit={submitAdjustment}>
          <div className="modal-body form-stack">
            <InlineNotice type="error">{adjustError}</InlineNotice>
            <InlineNotice type="info">O BichOne não apaga a batida original. O novo horário ficará registrado como ajuste com usuário, data e motivo.</InlineNotice>
            <FormField label="Registro original"><input value={adjusting ? `${POINT_SHORT[adjusting.tipo]} • ${formatDateTime(adjusting.registradoEm)}` : ""} disabled /></FormField>
            <FormField label="Novo horário"><input type="datetime-local" value={adjustForm.horarioNovo} onChange={(e) => setAdjustForm((current) => ({ ...current, horarioNovo: e.target.value }))} /></FormField>
            <FormField label="Motivo"><textarea rows="4" value={adjustForm.motivo} onChange={(e) => setAdjustForm((current) => ({ ...current, motivo: e.target.value }))} placeholder="Ex.: funcionário esqueceu de registrar o retorno do intervalo." /></FormField>
          </div>
          <div className="modal-footer"><button type="button" className="text-button" onClick={() => setAdjusting(null)}>Cancelar</button><button className="primary-button" disabled={adjustMutation.isPending}>{adjustMutation.isPending ? "Salvando..." : "Registrar ajuste"}</button></div>
        </form>
      </Modal>
    </div>
  );
}
