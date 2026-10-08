import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ClipboardList,
  FileText,
  FlaskConical,
  HeartPulse,
  Pill,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  Syringe,
} from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";
import { formatCurrency, formatDate, formatDateTime } from "../lib/formatters.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import FormField from "../components/FormField.jsx";
import InlineNotice from "../components/InlineNotice.jsx";

const statusLabels = {
  AGUARDANDO: "Aguardando",
  EM_ATENDIMENTO: "Em atendimento",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
};

const statusBadge = {
  AGUARDANDO: "badge--warning",
  EM_ATENDIMENTO: "badge--success",
  FINALIZADO: "badge--muted",
  CANCELADO: "badge--danger",
};

const exameLabels = {
  SOLICITADO: "Solicitado",
  COLETADO: "Coletado",
  EM_PROCESSAMENTO: "Em processamento",
  RESULTADO_DISPONIVEL: "Resultado disponível",
  CANCELADO: "Cancelado",
};

function parseLocaleNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function todayInput() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayRange(value) {
  const [y, m, d] = value.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { inicio: start.toISOString(), fim: end.toISOString() };
}

const blankAttendance = {
  clienteId: "",
  petId: "",
  queixaPrincipal: "",
  peso: "",
  itemConsultaId: "",
  lancarComanda: true,
};

const blankRecord = {
  queixaPrincipal: "",
  anamnese: "",
  exameFisico: "",
  diagnostico: "",
  conduta: "",
  observacoesInternas: "",
  temperatura: "",
  frequenciaCardiaca: "",
  frequenciaRespiratoria: "",
  hidratacao: "",
  mucosas: "",
  tpcSegundos: "",
  peso: "",
};

const blankPrescriptionItem = {
  itemCatalogoId: "",
  medicamento: "",
  concentracao: "",
  dose: "",
  via: "",
  frequencia: "",
  duracao: "",
  quantidade: "",
  orientacao: "",
};

function normalizeRecord(atendimento) {
  if (!atendimento) return { ...blankRecord };
  return {
    queixaPrincipal: atendimento.queixaPrincipal || "",
    anamnese: atendimento.anamnese || "",
    exameFisico: atendimento.exameFisico || "",
    diagnostico: atendimento.diagnostico || "",
    conduta: atendimento.conduta || "",
    observacoesInternas: atendimento.observacoesInternas || "",
    temperatura: atendimento.temperatura ?? "",
    frequenciaCardiaca: atendimento.frequenciaCardiaca ?? "",
    frequenciaRespiratoria: atendimento.frequenciaRespiratoria ?? "",
    hidratacao: atendimento.hidratacao || "",
    mucosas: atendimento.mucosas || "",
    tpcSegundos: atendimento.tpcSegundos ?? "",
    peso: "",
  };
}

export default function ConsultorioPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState(todayInput());
  const [createOpen, setCreateOpen] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState({ ...blankAttendance });
  const [detailId, setDetailId] = useState(null);
  const [tab, setTab] = useState("prontuario");
  const [recordForm, setRecordForm] = useState({ ...blankRecord });
  const [error, setError] = useState("");
  const deferredSearch = useDeferredValue(search);
  const range = useMemo(() => dayRange(date), [date]);

  const clientsQuery = useQuery({
    queryKey: ["clinic-clients"],
    queryFn: async () => (await api.get("/clientes", { params: { limite: 100 } })).data.dados || [],
  });

  const catalogQuery = useQuery({
    queryKey: ["clinic-catalog"],
    queryFn: async () => (await api.get("/catalogo/itens", { params: { ativo: true } })).data.dados || [],
  });

  const summaryQuery = useQuery({
    queryKey: ["clinic-summary", range.inicio, range.fim],
    queryFn: async () => (await api.get("/consultorio/resumo", { params: range })).data.dados,
  });

  const listQuery = useQuery({
    queryKey: ["clinic-list", deferredSearch, status, range.inicio, range.fim],
    queryFn: async () => (await api.get("/consultorio/atendimentos", {
      params: { busca: deferredSearch || undefined, status: status || undefined, ...range },
    })).data.dados || [],
  });

  const detailQuery = useQuery({
    queryKey: ["clinic-detail", detailId],
    enabled: Boolean(detailId),
    queryFn: async () => (await api.get(`/consultorio/atendimentos/${detailId}`)).data.atendimento,
  });

  useEffect(() => {
    if (detailQuery.data) setRecordForm(normalizeRecord(detailQuery.data));
  }, [detailQuery.data]);

  const services = useMemo(() => (catalogQuery.data || []).filter((item) => item.tipo === "SERVICO"), [catalogQuery.data]);
  const products = useMemo(() => (catalogQuery.data || []).filter((item) => item.tipo === "PRODUTO"), [catalogQuery.data]);
  const clients = clientsQuery.data || [];
  const selectedClient = clients.find((item) => item.id === attendanceForm.clienteId);
  const selectedPets = selectedClient?.pets || [];

  const refreshClinic = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["clinic-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["clinic-list"] }),
      queryClient.invalidateQueries({ queryKey: ["clinic-detail"] }),
      queryClient.invalidateQueries({ queryKey: ["pets"] }),
      queryClient.invalidateQueries({ queryKey: ["pdv"] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async () => (await api.post("/consultorio/atendimentos", {
      ...attendanceForm,
      peso: parseLocaleNumber(attendanceForm.peso),
      itemConsultaId: attendanceForm.itemConsultaId || null,
    })).data.atendimento,
    onSuccess: async (atendimento) => {
      await refreshClinic();
      setCreateOpen(false);
      setAttendanceForm({ ...blankAttendance });
      setDetailId(atendimento.id);
      setTab("prontuario");
    },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, payload }) => {
      if (action === "save") return (await api.patch(`/consultorio/atendimentos/${detailId}`, payload)).data;
      return (await api.post(`/consultorio/atendimentos/${detailId}/${action}`)).data;
    },
    onSuccess: refreshClinic,
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const detail = detailQuery.data;
  const canEdit = hasPermission("consultorio.prontuario");
  const canPrescribe = hasPermission("consultorio.prescrever");
  const canVaccinate = hasPermission("consultorio.vacinas");
  const canExams = hasPermission("consultorio.exames");
  const canDocuments = hasPermission("consultorio.documentos");

  function openCreate() {
    setError("");
    setAttendanceForm({ ...blankAttendance });
    setCreateOpen(true);
  }

  function openDetail(id) {
    setError("");
    setDetailId(id);
    setTab("prontuario");
  }

  function saveRecord() {
    const payload = {};
    for (const [key, value] of Object.entries(recordForm)) {
      if (["temperatura", "frequenciaCardiaca", "frequenciaRespiratoria", "tpcSegundos", "peso"].includes(key)) {
        payload[key] = value === "" ? null : Number(value);
      } else {
        payload[key] = value || null;
      }
    }
    actionMutation.mutate({ action: "save", payload });
  }

  return (
    <div className="page-stack clinic-page">
      <section className="page-heading">
        <div>
          <span className="page-kicker">Módulo clínico</span>
          <h1>Consultório veterinário</h1>
          <p>Fila, prontuário, prescrições, vacinas, exames, documentos e lançamentos em comanda.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreate} disabled={!canEdit}>
          <Plus size={17} /> Novo atendimento
        </button>
      </section>

      <section className="clinic-summary-grid">
        <Summary icon={ClipboardList} label="Aguardando" value={summaryQuery.data?.aguardando || 0} />
        <Summary icon={Stethoscope} label="Em atendimento" value={summaryQuery.data?.emAtendimento || 0} />
        <Summary icon={ShieldCheck} label="Finalizados hoje" value={summaryQuery.data?.finalizados || 0} />
        <Summary icon={Activity} label="Total hoje" value={summaryQuery.data?.total || 0} />
      </section>

      <section className="panel table-panel">
        <div className="clinic-toolbar">
          <label className="search-box clinic-search">
            <Search size={17} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tutor, pet ou queixa..." />
          </label>
          <input className="form-control clinic-date-filter" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="form-control clinic-status-filter" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="AGUARDANDO">Aguardando</option>
            <option value="EM_ATENDIMENTO">Em atendimento</option>
            <option value="FINALIZADO">Finalizado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
          <span className="toolbar__count">{listQuery.data?.length || 0} atendimentos</span>
        </div>

        {listQuery.isLoading ? <div className="loading-state">Carregando atendimentos...</div> :
          listQuery.isError ? <div className="empty-state"><Stethoscope size={30}/><strong>Não foi possível carregar o consultório</strong><p>{getApiErrorMessage(listQuery.error)}</p></div> :
          !listQuery.data?.length ? <div className="empty-state"><Stethoscope size={30}/><strong>Nenhum atendimento encontrado</strong><p>Crie um novo atendimento ou altere os filtros.</p></div> :
          <div className="table-scroll">
            <table className="data-table clinic-table">
              <thead><tr><th>Pet / Tutor</th><th>Queixa</th><th>Veterinário</th><th>Entrada</th><th>Status</th><th>Registros</th><th></th></tr></thead>
              <tbody>{listQuery.data.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.pet?.nome}</strong><small>{item.cliente?.nome} · {item.pet?.especie?.nome || "—"}{item.pet?.raca?.nome ? ` · ${item.pet.raca.nome}` : ""}</small></td>
                  <td>{item.queixaPrincipal || "Sem queixa registrada"}</td>
                  <td>{item.veterinario?.nome || "—"}</td>
                  <td>{formatDateTime(item.agendadoPara || item.createdAt)}</td>
                  <td><span className={`badge ${statusBadge[item.status] || "badge--muted"}`}>{statusLabels[item.status] || item.status}</span></td>
                  <td><span className="clinic-counts">{item._count?.prescricoes || 0} Rx · {item._count?.exames || 0} exames · {item._count?.vacinas || 0} vacinas</span></td>
                  <td className="table-actions-col"><button className="ghost-button" type="button" onClick={() => openDetail(item.id)}>Abrir</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>}
      </section>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo atendimento" subtitle="Abra a ficha e, se desejar, já lance a consulta na comanda." size="lg" footer={<><button className="secondary-button" onClick={() => setCreateOpen(false)}>Cancelar</button><button className="primary-button" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>{createMutation.isPending ? "Abrindo..." : "Abrir atendimento"}</button></>}>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        <div className="form-grid form-grid--2">
          <FormField label="Tutor"><select className="form-control" value={attendanceForm.clienteId} onChange={(e) => setAttendanceForm((f) => ({ ...f, clienteId: e.target.value, petId: "" }))}><option value="">Selecione...</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></FormField>
          <FormField label="Pet"><select className="form-control" value={attendanceForm.petId} onChange={(e) => setAttendanceForm((f) => ({ ...f, petId: e.target.value }))} disabled={!attendanceForm.clienteId}><option value="">Selecione...</option>{selectedPets.map((pet) => <option key={pet.id} value={pet.id}>{pet.nome}</option>)}</select></FormField>
          <FormField label="Peso atual (kg)"><input className="form-control" type="number" step="0.01" min="0" value={attendanceForm.peso} onChange={(e) => setAttendanceForm((f) => ({ ...f, peso: e.target.value }))}/></FormField>
          <FormField label="Serviço de consulta"><select className="form-control" value={attendanceForm.itemConsultaId} onChange={(e) => setAttendanceForm((f) => ({ ...f, itemConsultaId: e.target.value }))}><option value="">Sem cobrança agora</option>{services.map((item) => <option key={item.id} value={item.id}>{item.nome} · {formatCurrency(item.precoVenda)}</option>)}</select></FormField>
          <FormField label="Queixa principal" className="form-field--span-2"><textarea className="form-control" rows="4" value={attendanceForm.queixaPrincipal} onChange={(e) => setAttendanceForm((f) => ({ ...f, queixaPrincipal: e.target.value }))}/></FormField>
        </div>
        <label className="check-card check-card--compact"><input type="checkbox" checked={attendanceForm.lancarComanda} onChange={(e) => setAttendanceForm((f) => ({ ...f, lancarComanda: e.target.checked }))}/><span><strong>Lançar consulta na comanda</strong><small>O PDV fará o recebimento posteriormente pelo CNPJ atual.</small></span></label>
      </Modal>

      <Modal open={Boolean(detailId)} onClose={() => setDetailId(null)} title={detail ? `${detail.pet?.nome} · ${detail.cliente?.nome}` : "Prontuário"} subtitle={detail ? `${statusLabels[detail.status]} · ${formatDateTime(detail.createdAt)}` : "Carregando..."} size="lg" footer={detail ? <DetailFooter detail={detail} canEdit={canEdit} pending={actionMutation.isPending} onStart={() => actionMutation.mutate({ action: "iniciar" })} onFinish={() => actionMutation.mutate({ action: "finalizar" })} onSave={saveRecord} /> : null}>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        {detailQuery.isLoading ? <div className="loading-state">Carregando prontuário...</div> : detail ? <>
          <div className="clinic-patient-banner">
            <div><strong>{detail.pet?.nome}</strong><span>{detail.pet?.especie?.nome || "—"}{detail.pet?.raca?.nome ? ` · ${detail.pet.raca.nome}` : ""} · Tutor: {detail.cliente?.nome}</span></div>
            <div><span>Comanda</span><strong>{detail.comanda ? `#${detail.comanda.numero} · ${detail.comanda.status}` : "Ainda não aberta"}</strong></div>
            <div><span>Veterinário</span><strong>{detail.veterinario?.nome || "Não definido"}</strong></div>
          </div>
          <div className="clinic-tabs">
            {[
              ["prontuario", "Prontuário", Stethoscope],
              ["prescricoes", "Prescrições", Pill],
              ["vacinas", "Vacinas", Syringe],
              ["vermifugos", "Vermífugos", ShieldCheck],
              ["exames", "Exames", FlaskConical],
              ["procedimentos", "Procedimentos", HeartPulse],
              ["documentos", "Documentos", FileText],
            ].map(([id, label, Icon]) => <button key={id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}><Icon size={14}/>{label}</button>)}
          </div>
          {tab === "prontuario" ? <ProntuarioTab form={recordForm} setForm={setRecordForm} detail={detail} /> : null}
          {tab === "prescricoes" ? <PrescricoesTab detail={detail} products={products} canEdit={canPrescribe} refresh={refreshClinic} /> : null}
          {tab === "vacinas" ? <VacinasTab detail={detail} products={products} canEdit={canVaccinate} refresh={refreshClinic} /> : null}
          {tab === "vermifugos" ? <VermifugosTab detail={detail} products={products} canEdit={canVaccinate} refresh={refreshClinic} /> : null}
          {tab === "exames" ? <ExamesTab detail={detail} services={services} canEdit={canExams} refresh={refreshClinic} /> : null}
          {tab === "procedimentos" ? <ProcedimentosTab detail={detail} items={catalogQuery.data || []} canEdit={canEdit} refresh={refreshClinic} /> : null}
          {tab === "documentos" ? <DocumentosTab detail={detail} canEdit={canDocuments} refresh={refreshClinic} /> : null}
        </> : null}
      </Modal>
    </div>
  );
}

function Summary({ icon: Icon, label, value }) {
  return <div className="clinic-summary-card"><span><Icon size={18}/></span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function DetailFooter({ detail, canEdit, pending, onStart, onFinish, onSave }) {
  return <>
    {detail.status === "AGUARDANDO" && canEdit ? <button className="secondary-button" disabled={pending} onClick={onStart}>Iniciar atendimento</button> : null}
    {detail.status === "EM_ATENDIMENTO" && canEdit ? <button className="secondary-button" disabled={pending} onClick={onFinish}>Finalizar atendimento</button> : null}
    {canEdit && !["CANCELADO"].includes(detail.status) ? <button className="primary-button" disabled={pending} onClick={onSave}>{pending ? "Salvando..." : "Salvar prontuário"}</button> : null}
  </>;
}

function ProntuarioTab({ form, setForm, detail }) {
  const field = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  return <div className="clinic-tab-content">
    <div className="clinic-vitals-grid">
      <FormField label="Peso (kg)"><input className="form-control" type="number" step="0.01" value={form.peso} onChange={(e) => field("peso", e.target.value)}/></FormField>
      <FormField label="Temperatura °C"><input className="form-control" type="number" step="0.1" value={form.temperatura} onChange={(e) => field("temperatura", e.target.value)}/></FormField>
      <FormField label="FC (bpm)"><input className="form-control" type="number" value={form.frequenciaCardiaca} onChange={(e) => field("frequenciaCardiaca", e.target.value)}/></FormField>
      <FormField label="FR (mpm)"><input className="form-control" type="number" value={form.frequenciaRespiratoria} onChange={(e) => field("frequenciaRespiratoria", e.target.value)}/></FormField>
      <FormField label="TPC (s)"><input className="form-control" type="number" step="0.1" value={form.tpcSegundos} onChange={(e) => field("tpcSegundos", e.target.value)}/></FormField>
      <FormField label="Hidratação"><input className="form-control" value={form.hidratacao} onChange={(e) => field("hidratacao", e.target.value)}/></FormField>
      <FormField label="Mucosas"><input className="form-control" value={form.mucosas} onChange={(e) => field("mucosas", e.target.value)}/></FormField>
      <div className="clinic-last-weight"><span>Último peso</span><strong>{detail.pet?.pesos?.[0]?.peso ? `${detail.pet.pesos[0].peso} kg` : "—"}</strong></div>
    </div>
    <div className="form-grid form-grid--2 clinic-record-grid">
      <FormField label="Queixa principal"><textarea className="form-control" rows="4" value={form.queixaPrincipal} onChange={(e) => field("queixaPrincipal", e.target.value)}/></FormField>
      <FormField label="Anamnese"><textarea className="form-control" rows="4" value={form.anamnese} onChange={(e) => field("anamnese", e.target.value)}/></FormField>
      <FormField label="Exame físico"><textarea className="form-control" rows="5" value={form.exameFisico} onChange={(e) => field("exameFisico", e.target.value)}/></FormField>
      <FormField label="Diagnóstico / hipóteses"><textarea className="form-control" rows="5" value={form.diagnostico} onChange={(e) => field("diagnostico", e.target.value)}/></FormField>
      <FormField label="Conduta"><textarea className="form-control" rows="5" value={form.conduta} onChange={(e) => field("conduta", e.target.value)}/></FormField>
      <FormField label="Observações internas"><textarea className="form-control" rows="5" value={form.observacoesInternas} onChange={(e) => field("observacoesInternas", e.target.value)}/></FormField>
    </div>
    <PetClinicalHistory petId={detail.pet?.id} currentId={detail.id} />
  </div>;
}

function PetClinicalHistory({ petId, currentId }) {
  const query = useQuery({
    queryKey: ["clinic-pet-history", petId],
    enabled: Boolean(petId),
    queryFn: async () => (await api.get(`/consultorio/pets/${petId}/historico`)).data.dados || [],
  });
  const rows = (query.data || []).filter((item) => item.id !== currentId);
  return <section className="clinic-pet-history">
    <div className="clinic-editor-title"><strong>Histórico clínico do pet</strong><span>Últimos atendimentos realizados por este CNPJ.</span></div>
    {query.isLoading ? <div className="mini-empty">Carregando histórico...</div> : !rows.length ? <div className="mini-empty">Nenhum atendimento anterior neste CNPJ.</div> : <div className="clinic-history-list">{rows.slice(0, 8).map((item) => <article className="clinic-history-card" key={item.id}><header><strong>{formatDateTime(item.createdAt)} · {statusLabels[item.status] || item.status}</strong><span>{item.veterinario?.nome || "—"}</span></header><div className="clinic-history-line"><b>{item.queixaPrincipal || "Sem queixa registrada"}</b><span>{item.diagnostico || "Sem diagnóstico registrado"}</span></div></article>)}</div>}
  </section>;
}

function PrescricoesTab({ detail, products, canEdit, refresh }) {
  const [orientacoes, setOrientacoes] = useState("");
  const [itens, setItens] = useState([{ ...blankPrescriptionItem }]);
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: async () => (await api.post(`/consultorio/atendimentos/${detail.id}/prescricoes`, { orientacoes: orientacoes || null, itens: itens.map((i) => ({ ...i, itemCatalogoId: i.itemCatalogoId || null })) })).data,
    onSuccess: async () => { setOrientacoes(""); setItens([{ ...blankPrescriptionItem }]); await refresh(); },
    onError: (e) => setError(getApiErrorMessage(e)),
  });
  const update = (index, patch) => setItens((all) => all.map((item, i) => i === index ? { ...item, ...patch } : item));
  return <div className="clinic-tab-content">
    {canEdit ? <section className="clinic-editor-card"><div className="clinic-editor-title"><strong>Nova prescrição</strong><span>Registre medicamentos e orientações.</span></div>{error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      <div className="clinic-prescription-lines">{itens.map((item, index) => <div className="clinic-prescription-line" key={index}>
        <select className="form-control" value={item.itemCatalogoId} onChange={(e) => { const selected = products.find((p) => p.id === e.target.value); update(index, { itemCatalogoId: e.target.value, medicamento: selected?.nome || item.medicamento }); }}><option value="">Catálogo (opcional)</option>{products.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
        <input className="form-control" placeholder="Medicamento" value={item.medicamento} onChange={(e) => update(index, { medicamento: e.target.value })}/>
        <input className="form-control" placeholder="Dose" value={item.dose} onChange={(e) => update(index, { dose: e.target.value })}/>
        <input className="form-control" placeholder="Via" value={item.via} onChange={(e) => update(index, { via: e.target.value })}/>
        <input className="form-control" placeholder="Frequência" value={item.frequencia} onChange={(e) => update(index, { frequencia: e.target.value })}/>
        <input className="form-control" placeholder="Duração" value={item.duracao} onChange={(e) => update(index, { duracao: e.target.value })}/>
        <button className="icon-button table-action" onClick={() => setItens((all) => all.filter((_, i) => i !== index))}>×</button>
      </div>)}</div>
      <button className="ghost-button" onClick={() => setItens((all) => [...all, { ...blankPrescriptionItem }])}><Plus size={14}/> Medicamento</button>
      <textarea className="form-control" rows="3" placeholder="Orientações gerais" value={orientacoes} onChange={(e) => setOrientacoes(e.target.value)}/>
      <div className="clinic-editor-actions"><button className="primary-button" disabled={mutation.isPending || !itens.some((i) => i.medicamento.trim())} onClick={() => mutation.mutate()}>Emitir prescrição</button></div>
    </section> : null}
    <div className="clinic-history-list">{detail.prescricoes?.length ? detail.prescricoes.map((rx) => <article className="clinic-history-card" key={rx.id}><header><strong>Prescrição · {formatDateTime(rx.emitidaEm)}</strong><span>{rx.veterinario?.nome || "Veterinário"}</span></header>{rx.itens.map((item) => <div className="clinic-history-line" key={item.id}><b>{item.medicamento}</b><span>{[item.dose, item.via, item.frequencia, item.duracao].filter(Boolean).join(" · ") || "Sem posologia detalhada"}</span></div>)}{rx.orientacoes ? <p>{rx.orientacoes}</p> : null}</article>) : <div className="mini-empty">Nenhuma prescrição registrada.</div>}</div>
  </div>;
}

function VacinasTab({ detail, products, canEdit, refresh }) {
  const [form, setForm] = useState({ itemCatalogoId: "", nomeVacina: "", fabricante: "", numeroLote: "", dataValidade: "", dose: "", via: "SC", local: "", proximaDose: "", observacoes: "", consumirEstoque: false, quantidadeEstoque: 1 });
  const [error, setError] = useState("");
  const mutation = useMutation({ mutationFn: async () => (await api.post(`/consultorio/atendimentos/${detail.id}/vacinas`, form)).data, onSuccess: async () => { setForm({ itemCatalogoId: "", nomeVacina: "", fabricante: "", numeroLote: "", dataValidade: "", dose: "", via: "SC", local: "", proximaDose: "", observacoes: "", consumirEstoque: false, quantidadeEstoque: 1 }); await refresh(); }, onError: (e) => setError(getApiErrorMessage(e)) });
  return <SimpleClinicalTab title="Registrar vacina" canEdit={canEdit} error={error} action={<button className="primary-button" disabled={mutation.isPending || !form.nomeVacina.trim()} onClick={() => mutation.mutate()}>Registrar aplicação</button>} editor={<div className="form-grid form-grid--3">
    <FormField label="Produto do estoque"><select className="form-control" value={form.itemCatalogoId} onChange={(e) => { const p = products.find((i) => i.id === e.target.value); setForm((f) => ({ ...f, itemCatalogoId: e.target.value, nomeVacina: p?.nome || f.nomeVacina })); }}><option value="">Sem vínculo</option>{products.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></FormField>
    <FormField label="Vacina"><input className="form-control" value={form.nomeVacina} onChange={(e) => setForm({ ...form, nomeVacina: e.target.value })}/></FormField>
    <FormField label="Fabricante"><input className="form-control" value={form.fabricante} onChange={(e) => setForm({ ...form, fabricante: e.target.value })}/></FormField>
    <FormField label="Lote"><input className="form-control" value={form.numeroLote} onChange={(e) => setForm({ ...form, numeroLote: e.target.value })}/></FormField>
    <FormField label="Validade"><input className="form-control" type="date" value={form.dataValidade} onChange={(e) => setForm({ ...form, dataValidade: e.target.value })}/></FormField>
    <FormField label="Dose"><input className="form-control" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })}/></FormField>
    <FormField label="Via"><input className="form-control" value={form.via} onChange={(e) => setForm({ ...form, via: e.target.value })}/></FormField>
    <FormField label="Local"><input className="form-control" value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })}/></FormField>
    <FormField label="Próxima dose"><input className="form-control" type="date" value={form.proximaDose} onChange={(e) => setForm({ ...form, proximaDose: e.target.value })}/></FormField>
    <label className="check-card clinic-stock-check"><input type="checkbox" checked={form.consumirEstoque} onChange={(e) => setForm({ ...form, consumirEstoque: e.target.checked })}/><span><strong>Baixar estoque</strong><small>FEFO automático quando houver lote.</small></span></label>
  </div>} list={detail.vacinas?.length ? detail.vacinas.map((v) => <article className="clinic-history-card" key={v.id}><header><strong>{v.nomeVacina}</strong><span>{formatDateTime(v.aplicadaEm)}</span></header><div className="clinic-history-line"><b>Lote {v.numeroLote || "—"}</b><span>Val. {formatDate(v.dataValidade)} · Próxima {formatDate(v.proximaDose)}</span></div></article>) : <div className="mini-empty">Nenhuma vacina registrada.</div>} />;
}

function VermifugosTab({ detail, products, canEdit, refresh }) {
  const [form, setForm] = useState({ itemCatalogoId: "", produto: "", principioAtivo: "", dose: "", numeroLote: "", dataValidade: "", proximaDose: "", observacoes: "", consumirEstoque: false, quantidadeEstoque: 1 });
  const [error, setError] = useState("");
  const mutation = useMutation({ mutationFn: async () => (await api.post(`/consultorio/atendimentos/${detail.id}/vermifugacoes`, form)).data, onSuccess: async () => { setForm({ itemCatalogoId: "", produto: "", principioAtivo: "", dose: "", numeroLote: "", dataValidade: "", proximaDose: "", observacoes: "", consumirEstoque: false, quantidadeEstoque: 1 }); await refresh(); }, onError: (e) => setError(getApiErrorMessage(e)) });
  return <SimpleClinicalTab title="Registrar vermifugação" canEdit={canEdit} error={error} action={<button className="primary-button" disabled={mutation.isPending || !form.produto.trim()} onClick={() => mutation.mutate()}>Registrar</button>} editor={<div className="form-grid form-grid--3">
    <FormField label="Produto do estoque"><select className="form-control" value={form.itemCatalogoId} onChange={(e) => { const p = products.find((i) => i.id === e.target.value); setForm((f) => ({ ...f, itemCatalogoId: e.target.value, produto: p?.nome || f.produto })); }}><option value="">Sem vínculo</option>{products.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></FormField>
    <FormField label="Produto"><input className="form-control" value={form.produto} onChange={(e) => setForm({ ...form, produto: e.target.value })}/></FormField>
    <FormField label="Princípio ativo"><input className="form-control" value={form.principioAtivo} onChange={(e) => setForm({ ...form, principioAtivo: e.target.value })}/></FormField>
    <FormField label="Dose"><input className="form-control" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })}/></FormField>
    <FormField label="Lote"><input className="form-control" value={form.numeroLote} onChange={(e) => setForm({ ...form, numeroLote: e.target.value })}/></FormField>
    <FormField label="Próxima dose"><input className="form-control" type="date" value={form.proximaDose} onChange={(e) => setForm({ ...form, proximaDose: e.target.value })}/></FormField>
    <label className="check-card clinic-stock-check"><input type="checkbox" checked={form.consumirEstoque} onChange={(e) => setForm({ ...form, consumirEstoque: e.target.checked })}/><span><strong>Baixar estoque</strong><small>Registra consumo interno.</small></span></label>
  </div>} list={detail.vermifugacoes?.length ? detail.vermifugacoes.map((v) => <article className="clinic-history-card" key={v.id}><header><strong>{v.produto}</strong><span>{formatDateTime(v.aplicadaEm)}</span></header><div className="clinic-history-line"><b>{v.dose || "Dose não informada"}</b><span>Próxima {formatDate(v.proximaDose)}</span></div></article>) : <div className="mini-empty">Nenhuma vermifugação registrada.</div>} />;
}

function ExamesTab({ detail, services, canEdit, refresh }) {
  const [form, setForm] = useState({ itemCatalogoId: "", nome: "", observacoes: "", lancarComanda: true });
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState({ status: "RESULTADO_DISPONIVEL", resultadoTexto: "", arquivoUrl: "" });
  const [error, setError] = useState("");
  const create = useMutation({ mutationFn: async () => (await api.post(`/consultorio/atendimentos/${detail.id}/exames`, form)).data, onSuccess: async () => { setForm({ itemCatalogoId: "", nome: "", observacoes: "", lancarComanda: true }); await refresh(); }, onError: (e) => setError(getApiErrorMessage(e)) });
  const update = useMutation({ mutationFn: async () => (await api.patch(`/consultorio/atendimentos/${detail.id}/exames/${selected.id}`, result)).data, onSuccess: async () => { setSelected(null); setResult({ status: "RESULTADO_DISPONIVEL", resultadoTexto: "", arquivoUrl: "" }); await refresh(); }, onError: (e) => setError(getApiErrorMessage(e)) });
  return <div className="clinic-tab-content">
    {canEdit ? <section className="clinic-editor-card"><div className="clinic-editor-title"><strong>Solicitar exame</strong><span>O serviço pode ser lançado automaticamente na comanda.</span></div>{error ? <InlineNotice tone="error">{error}</InlineNotice> : null}<div className="form-grid form-grid--2"><FormField label="Serviço do catálogo"><select className="form-control" value={form.itemCatalogoId} onChange={(e) => { const item = services.find((s) => s.id === e.target.value); setForm((f) => ({ ...f, itemCatalogoId: e.target.value, nome: item?.nome || f.nome })); }}><option value="">Sem vínculo</option>{services.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></FormField><FormField label="Exame"><input className="form-control" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}/></FormField></div><label className="check-card check-card--compact"><input type="checkbox" checked={form.lancarComanda} onChange={(e) => setForm({ ...form, lancarComanda: e.target.checked })}/><span><strong>Lançar na comanda</strong><small>Usa o preço atual do serviço selecionado.</small></span></label><div className="clinic-editor-actions"><button className="primary-button" disabled={create.isPending || !form.nome.trim()} onClick={() => create.mutate()}>Solicitar exame</button></div></section> : null}
    {selected ? <section className="clinic-editor-card clinic-result-card"><div className="clinic-editor-title"><strong>Atualizar exame: {selected.nome}</strong><span>Registre andamento e resultado.</span></div><div className="form-grid form-grid--2"><FormField label="Status"><select className="form-control" value={result.status} onChange={(e) => setResult({ ...result, status: e.target.value })}>{Object.entries(exameLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></FormField><FormField label="Arquivo / URL"><input className="form-control" value={result.arquivoUrl} onChange={(e) => setResult({ ...result, arquivoUrl: e.target.value })}/></FormField><FormField label="Resultado" className="form-field--span-2"><textarea className="form-control" rows="5" value={result.resultadoTexto} onChange={(e) => setResult({ ...result, resultadoTexto: e.target.value })}/></FormField></div><div className="clinic-editor-actions"><button className="secondary-button" onClick={() => setSelected(null)}>Cancelar</button><button className="primary-button" onClick={() => update.mutate()}>Salvar resultado</button></div></section> : null}
    <div className="clinic-history-list">{detail.exames?.length ? detail.exames.map((exam) => <article className="clinic-history-card" key={exam.id}><header><strong>{exam.nome}</strong><span>{exameLabels[exam.status] || exam.status}</span></header><div className="clinic-history-line"><b>{formatDateTime(exam.solicitadoEm)}</b><span>{exam.resultadoTexto || "Sem resultado informado"}</span></div>{canEdit ? <button className="ghost-button" onClick={() => { setSelected(exam); setResult({ status: exam.status, resultadoTexto: exam.resultadoTexto || "", arquivoUrl: exam.arquivoUrl || "" }); }}>Atualizar</button> : null}</article>) : <div className="mini-empty">Nenhum exame solicitado.</div>}</div>
  </div>;
}

function ProcedimentosTab({ detail, items, canEdit, refresh }) {
  const [form, setForm] = useState({ itemCatalogoId: "", quantidade: 1, observacoes: "", lancarComanda: true });
  const [error, setError] = useState("");
  const mutation = useMutation({ mutationFn: async () => (await api.post(`/consultorio/atendimentos/${detail.id}/procedimentos`, { ...form, quantidade: Number(form.quantidade) })).data, onSuccess: async () => { setForm({ itemCatalogoId: "", quantidade: 1, observacoes: "", lancarComanda: true }); await refresh(); }, onError: (e) => setError(getApiErrorMessage(e)) });
  return <SimpleClinicalTab title="Adicionar procedimento" canEdit={canEdit} error={error} action={<button className="primary-button" disabled={mutation.isPending || !form.itemCatalogoId} onClick={() => mutation.mutate()}>Adicionar</button>} editor={<div className="form-grid form-grid--2"><FormField label="Produto/serviço"><select className="form-control" value={form.itemCatalogoId} onChange={(e) => setForm({ ...form, itemCatalogoId: e.target.value })}><option value="">Selecione...</option>{items.map((i) => <option key={i.id} value={i.id}>{i.nome} · {formatCurrency(i.precoVenda)}</option>)}</select></FormField><FormField label="Quantidade"><input className="form-control" type="number" min="0.001" step="0.001" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })}/></FormField><label className="check-card check-card--compact"><input type="checkbox" checked={form.lancarComanda} onChange={(e) => setForm({ ...form, lancarComanda: e.target.checked })}/><span><strong>Lançar na comanda</strong><small>Será cobrado no PDV depois.</small></span></label></div>} list={detail.procedimentos?.length ? detail.procedimentos.map((p) => <article className="clinic-history-card" key={p.id}><header><strong>{p.itemCatalogo?.nome}</strong><span>{formatDateTime(p.realizadoEm)}</span></header><div className="clinic-history-line"><b>{p.quantidade} × {formatCurrency(p.valorUnitario)}</b><span>{p.comandaItemId ? "Lançado na comanda" : "Sem cobrança vinculada"}</span></div></article>) : <div className="mini-empty">Nenhum procedimento registrado.</div>} />;
}

function DocumentosTab({ detail, canEdit, refresh }) {
  const [form, setForm] = useState({ tipo: "ATESTADO", titulo: "", conteudo: "", visivelCliente: true });
  const [error, setError] = useState("");
  const mutation = useMutation({ mutationFn: async () => (await api.post(`/consultorio/atendimentos/${detail.id}/documentos`, form)).data, onSuccess: async () => { setForm({ tipo: "ATESTADO", titulo: "", conteudo: "", visivelCliente: true }); await refresh(); }, onError: (e) => setError(getApiErrorMessage(e)) });
  return <SimpleClinicalTab title="Emitir documento" canEdit={canEdit} error={error} action={<button className="primary-button" disabled={mutation.isPending || !form.titulo.trim() || !form.conteudo.trim()} onClick={() => mutation.mutate()}>Salvar documento</button>} editor={<div className="form-grid form-grid--2"><FormField label="Tipo"><select className="form-control" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}><option value="ATESTADO">Atestado</option><option value="RECEITA">Receita</option><option value="RELATORIO">Relatório</option><option value="ORIENTACAO">Orientação</option><option value="OUTRO">Outro</option></select></FormField><FormField label="Título"><input className="form-control" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })}/></FormField><FormField label="Conteúdo" className="form-field--span-2"><textarea className="form-control" rows="8" value={form.conteudo} onChange={(e) => setForm({ ...form, conteudo: e.target.value })}/></FormField><label className="check-card check-card--compact"><input type="checkbox" checked={form.visivelCliente} onChange={(e) => setForm({ ...form, visivelCliente: e.target.checked })}/><span><strong>Visível ao cliente</strong><small>Preparado para o futuro portal/app.</small></span></label></div>} list={detail.documentos?.length ? detail.documentos.map((doc) => <article className="clinic-history-card" key={doc.id}><header><strong>{doc.titulo}</strong><span>{doc.tipo} · {formatDateTime(doc.emitidoEm)}</span></header><p>{doc.conteudo}</p></article>) : <div className="mini-empty">Nenhum documento emitido.</div>} />;
}

function SimpleClinicalTab({ title, canEdit, error, editor, action, list }) {
  return <div className="clinic-tab-content">{canEdit ? <section className="clinic-editor-card"><div className="clinic-editor-title"><strong>{title}</strong></div>{error ? <InlineNotice tone="error">{error}</InlineNotice> : null}{editor}<div className="clinic-editor-actions">{action}</div></section> : null}<div className="clinic-history-list">{list}</div></div>;
}
