import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bath,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  Droplets,
  PackageCheck,
  Plus,
  Scissors,
  Sparkles,
  UserRound,
} from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";
import { formatCurrency, formatDateTime, formatTime } from "../lib/formatters.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import FormField from "../components/FormField.jsx";
import InlineNotice from "../components/InlineNotice.jsx";

const statusLabels = {
  AGUARDANDO: "Aguardando",
  EM_BANHO: "Em banho",
  EM_SECAGEM: "Secagem",
  EM_TOSA: "Tosa",
  FINALIZADO: "Finalizado",
  AGUARDANDO_RETIRADA: "Aguardando retirada",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

const appointmentLabels = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  PENDENTE: "Pendente",
  CONFIRMADO: "Confirmado",
  CHECK_IN: "Check-in",
  EM_ATENDIMENTO: "Em atendimento",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
  FALTOU: "Faltou",
};

const columns = [
  { key: "AGUARDANDO", label: "Aguardando", icon: Clock3 },
  { key: "EM_BANHO", label: "Banho", icon: Bath },
  { key: "EM_SECAGEM", label: "Secagem", icon: Droplets },
  { key: "EM_TOSA", label: "Tosa", icon: Scissors },
  { key: "AGUARDANDO_RETIRADA", label: "Prontos", icon: CheckCircle2 },
];

const nextStatus = {
  AGUARDANDO: "EM_BANHO",
  EM_BANHO: "EM_SECAGEM",
  EM_SECAGEM: "EM_TOSA",
  EM_TOSA: "AGUARDANDO_RETIRADA",
  FINALIZADO: "AGUARDANDO_RETIRADA",
  AGUARDANDO_RETIRADA: "ENTREGUE",
};

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toDateTimeLocal(date, time = "09:00") {
  return `${date}T${time}`;
}

function dayRange(value) {
  const [year, month, day] = value.split("-").map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return { inicio: start.toISOString(), fim: end.toISOString() };
}

const blankAppointment = {
  clienteId: "",
  petId: "",
  profissionalId: "",
  inicio: toDateTimeLocal(localDate(), "09:00"),
  origem: "INTERNO",
  observacoesCliente: "",
  observacoesInternas: "",
  itens: [{ itemCatalogoId: "", quantidade: 1 }],
};

const blankFicha = {
  tipoPelagem: "",
  temperamento: "",
  aceitaSecador: "",
  aceitaMaquina: "",
  aceitaUnhas: "",
  alergiaProdutos: "",
  shampooPreferencial: "",
  restricoes: "",
  observacoes: "",
};

export default function BanhoTosaPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("agenda");
  const [date, setDate] = useState(localDate());
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({ ...blankAppointment });
  const [detailId, setDetailId] = useState(null);
  const [checkinAppointment, setCheckinAppointment] = useState(null);
  const [checkinItems, setCheckinItems] = useState([]);
  const [fichaForm, setFichaForm] = useState({ ...blankFicha });
  const [attachment, setAttachment] = useState({ tipo: "ENTRADA", url: "", legenda: "" });
  const [error, setError] = useState("");
  const range = useMemo(() => dayRange(date), [date]);

  const canManage = hasPermission("banho_tosa.gerenciar");
  const canSchedule = hasPermission("agenda.gerenciar");

  const clientsQuery = useQuery({
    queryKey: ["grooming-clients"],
    queryFn: async () => (await api.get("/clientes", { params: { limite: 100 } })).data.dados || [],
  });
  const catalogQuery = useQuery({
    queryKey: ["grooming-catalog"],
    queryFn: async () => (await api.get("/catalogo/itens", { params: { tipo: "SERVICO", ativo: true } })).data.dados || [],
  });
  const professionalsQuery = useQuery({
    queryKey: ["grooming-professionals"],
    queryFn: async () => (await api.get("/banho-tosa/profissionais")).data.dados || [],
  });
  const summaryQuery = useQuery({
    queryKey: ["grooming-summary", date],
    queryFn: async () => (await api.get("/banho-tosa/resumo", { params: range })).data.dados,
  });
  const agendaQuery = useQuery({
    queryKey: ["grooming-agenda", date],
    queryFn: async () => (await api.get("/banho-tosa/agenda", { params: range })).data.dados || [],
  });
  const ordersQuery = useQuery({
    queryKey: ["grooming-orders", date],
    queryFn: async () => (await api.get("/banho-tosa/ordens", { params: range })).data.dados || [],
  });
  const detailQuery = useQuery({
    queryKey: ["grooming-order", detailId],
    enabled: Boolean(detailId),
    queryFn: async () => (await api.get(`/banho-tosa/ordens/${detailId}`)).data.ordem,
  });
  const creditsQuery = useQuery({
    queryKey: ["grooming-credits", checkinAppointment?.clienteId, checkinAppointment?.petId],
    enabled: Boolean(checkinAppointment),
    queryFn: async () => (await api.get("/banho-tosa/creditos", { params: { clienteId: checkinAppointment.clienteId, petId: checkinAppointment.petId } })).data.dados || [],
  });

  const refresh = async () => Promise.all([
    qc.invalidateQueries({ queryKey: ["grooming-summary"] }),
    qc.invalidateQueries({ queryKey: ["grooming-agenda"] }),
    qc.invalidateQueries({ queryKey: ["grooming-orders"] }),
    qc.invalidateQueries({ queryKey: ["grooming-order"] }),
    qc.invalidateQueries({ queryKey: ["pdv"] }),
    qc.invalidateQueries({ queryKey: ["packages"] }),
  ]);

  const createAppointmentMutation = useMutation({
    mutationFn: async () => (await api.post("/banho-tosa/agenda", {
      ...appointmentForm,
      inicio: new Date(appointmentForm.inicio).toISOString(),
      profissionalId: appointmentForm.profissionalId || null,
      itens: appointmentForm.itens.filter((i) => i.itemCatalogoId).map((i) => ({ ...i, quantidade: Number(i.quantidade) || 1 })),
    })).data.agendamento,
    onSuccess: async () => {
      await refresh();
      setAppointmentOpen(false);
      setAppointmentForm({ ...blankAppointment, inicio: toDateTimeLocal(date, "09:00") });
      setError("");
    },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const agendaActionMutation = useMutation({
    mutationFn: async ({ id, payload }) => (await api.patch(`/banho-tosa/agenda/${id}`, payload)).data,
    onSuccess: refresh,
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const checkinMutation = useMutation({
    mutationFn: async () => (await api.post(`/banho-tosa/agenda/${checkinAppointment.id}/checkin`, {
      profissionalId: checkinAppointment.profissionalId || null,
      itens: checkinItems.map((i) => ({ itemCatalogoId: i.itemCatalogoId, quantidade: Number(i.quantidade) || 1, pacoteClienteItemId: i.pacoteClienteItemId || null })),
    })).data.ordem,
    onSuccess: async (ordem) => {
      await refresh();
      setCheckinAppointment(null);
      setCheckinItems([]);
      setTab("producao");
      setDetailId(ordem.id);
      hydrateFicha(ordem.pet?.fichaBanhoTosa);
    },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => (await api.patch(`/banho-tosa/ordens/${id}/status`, { status })).data.ordem,
    onSuccess: refresh,
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const fichaMutation = useMutation({
    mutationFn: async () => (await api.put(`/banho-tosa/pets/${detailQuery.data.petId}/ficha`, normalizeFicha(fichaForm))).data.ficha,
    onSuccess: async () => { await refresh(); setError(""); },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const attachmentMutation = useMutation({
    mutationFn: async () => (await api.post(`/banho-tosa/ordens/${detailId}/anexos`, attachment)).data.anexo,
    onSuccess: async () => { await refresh(); setAttachment({ tipo: "ENTRADA", url: "", legenda: "" }); },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const clients = clientsQuery.data || [];
  const services = catalogQuery.data || [];
  const professionals = professionalsQuery.data || [];
  const selectedClient = clients.find((c) => c.id === appointmentForm.clienteId);
  const pets = selectedClient?.pets || [];
  const orders = ordersQuery.data || [];
  const credits = creditsQuery.data || [];

  function hydrateFicha(ficha) {
    setFichaForm({
      ...blankFicha,
      ...(ficha || {}),
      aceitaSecador: ficha?.aceitaSecador === null || ficha?.aceitaSecador === undefined ? "" : String(ficha.aceitaSecador),
      aceitaMaquina: ficha?.aceitaMaquina === null || ficha?.aceitaMaquina === undefined ? "" : String(ficha.aceitaMaquina),
      aceitaUnhas: ficha?.aceitaUnhas === null || ficha?.aceitaUnhas === undefined ? "" : String(ficha.aceitaUnhas),
    });
  }

  function openDetail(ordem) {
    setError("");
    setDetailId(ordem.id);
    hydrateFicha(ordem.pet?.fichaBanhoTosa);
  }

  function openCheckin(agendamento) {
    setError("");
    setCheckinAppointment(agendamento);
    setCheckinItems(agendamento.itens.map((i) => ({ itemCatalogoId: i.itemCatalogoId, quantidade: Number(i.quantidade), pacoteClienteItemId: "" })));
  }

  const detail = detailQuery.data;

  return (
    <div className="page-stack grooming-page">
      <section className="page-heading">
        <div>
          <span className="page-kicker">Operação estética</span>
          <h1>Banho e Tosa</h1>
          <p>Agenda, check-in, ficha técnica, produção em tempo real, pacotes e comanda integrados.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => { setAppointmentForm({ ...blankAppointment, inicio: toDateTimeLocal(date, "09:00") }); setError(""); setAppointmentOpen(true); }} disabled={!canSchedule}>
          <Plus size={17} /> Novo agendamento
        </button>
      </section>

      <section className="grooming-summary-grid">
        <Summary icon={CalendarDays} label="Agendados" value={summaryQuery.data?.agendados || 0} />
        <Summary icon={Clock3} label="Aguardando" value={summaryQuery.data?.aguardando || 0} />
        <Summary icon={Sparkles} label="Em produção" value={summaryQuery.data?.emProducao || 0} />
        <Summary icon={CheckCircle2} label="Prontos" value={summaryQuery.data?.prontos || 0} />
      </section>

      <section className="panel-card grooming-main-panel">
        <div className="panel-tabs grooming-tabs">
          <button type="button" className={tab === "agenda" ? "is-active" : ""} onClick={() => setTab("agenda")}><CalendarDays size={15} /> Agenda</button>
          <button type="button" className={tab === "producao" ? "is-active" : ""} onClick={() => setTab("producao")}><Sparkles size={15} /> Produção</button>
        </div>
        <div className="grooming-toolbar">
          <FormField label="Data"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
          <span>{tab === "agenda" ? `${agendaQuery.data?.length || 0} agendamento(s)` : `${orders.length} ordem(ns) de serviço`}</span>
        </div>

        {error ? <div className="grooming-inline-error"><InlineNotice variant="error">{error}</InlineNotice></div> : null}

        {tab === "agenda" ? (
          <div className="grooming-agenda-list">
            {(agendaQuery.data || []).map((a) => (
              <article key={a.id} className="grooming-appointment-card">
                <div className="grooming-time"><strong>{formatTime(a.inicio)}</strong><span>{formatTime(a.fim)}</span></div>
                <div className="grooming-appointment-main">
                  <div><strong>{a.pet.nome}</strong><span>{a.cliente.nome}</span></div>
                  <div className="grooming-service-tags">{a.itens.map((i) => <span key={i.id}>{i.itemCatalogo.nome}</span>)}</div>
                </div>
                <div className="grooming-professional"><UserRound size={14} /><span>{a.profissional?.nome || "Sem profissional"}</span></div>
                <span className="badge badge--muted">{appointmentLabels[a.status] || a.status}</span>
                <div className="grooming-row-actions">
                  {!a.ordem && !["CANCELADO", "FALTOU", "CONCLUIDO"].includes(a.status) ? <button className="secondary-button" type="button" onClick={() => openCheckin(a)} disabled={!canManage}>Check-in</button> : null}
                  {!a.ordem && !["CANCELADO", "FALTOU", "CONCLUIDO"].includes(a.status) ? <button className="text-button" type="button" onClick={() => agendaActionMutation.mutate({ id: a.id, payload: { status: "FALTOU" } })}>Faltou</button> : null}
                </div>
              </article>
            ))}
            {!agendaQuery.isLoading && !(agendaQuery.data || []).length ? <div className="empty-state"><CalendarDays size={24} /><strong>Nenhum agendamento nesta data</strong><span>Crie um horário para começar a agenda do dia.</span></div> : null}
          </div>
        ) : (
          <div className="grooming-kanban">
            {columns.map(({ key, label, icon: Icon }) => {
              const itens = orders.filter((o) => o.status === key || (key === "AGUARDANDO_RETIRADA" && o.status === "FINALIZADO"));
              return <section className="grooming-column" key={key}>
                <header><span><Icon size={15} /> {label}</span><b>{itens.length}</b></header>
                <div className="grooming-column-body">
                  {itens.map((o) => <article key={o.id} className="grooming-order-card" onClick={() => openDetail(o)}>
                    <div className="grooming-order-top"><strong>{o.pet.nome}</strong><span>OS #{o.numero}</span></div>
                    <p>{o.itens.map((i) => i.itemCatalogo.nome).join(" • ")}</p>
                    <small>{o.profissional?.nome || "Sem profissional"} · entrada {formatTime(o.entrada)}</small>
                    {o.comanda ? <span className="grooming-command-tag">Comanda #{o.comanda.numero}</span> : <span className="grooming-package-tag"><PackageCheck size={12} /> Pacote</span>}
                    {nextStatus[o.status] ? <button className="secondary-button grooming-next" type="button" onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ id: o.id, status: nextStatus[o.status] }); }}>{nextStatus[o.status] === "ENTREGUE" ? "Entregar" : "Avançar"}</button> : null}
                  </article>)}
                  {!itens.length ? <span className="grooming-column-empty">Nenhum pet</span> : null}
                </div>
              </section>;
            })}
          </div>
        )}
      </section>

      <Modal open={appointmentOpen} title="Novo agendamento" subtitle="Reserve o horário do pet e os serviços previstos." size="lg" onClose={() => setAppointmentOpen(false)} footer={<><button className="secondary-button" type="button" onClick={() => setAppointmentOpen(false)}>Cancelar</button><button className="primary-button" type="button" onClick={() => createAppointmentMutation.mutate()} disabled={createAppointmentMutation.isPending}>Salvar agendamento</button></>}>
        {error ? <InlineNotice variant="error">{error}</InlineNotice> : null}
        <div className="form-grid form-grid--2">
          <FormField label="Tutor"><select value={appointmentForm.clienteId} onChange={(e) => setAppointmentForm((f) => ({ ...f, clienteId: e.target.value, petId: "" }))}><option value="">Selecione</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></FormField>
          <FormField label="Pet"><select value={appointmentForm.petId} onChange={(e) => setAppointmentForm((f) => ({ ...f, petId: e.target.value }))}><option value="">Selecione</option>{pets.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></FormField>
          <FormField label="Profissional"><select value={appointmentForm.profissionalId} onChange={(e) => setAppointmentForm((f) => ({ ...f, profissionalId: e.target.value }))}><option value="">Sem profissional definido</option>{professionals.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.funcao?.nome ? ` — ${p.funcao.nome}` : ""}</option>)}</select></FormField>
          <FormField label="Data e hora"><input type="datetime-local" value={appointmentForm.inicio} onChange={(e) => setAppointmentForm((f) => ({ ...f, inicio: e.target.value }))} /></FormField>
          <FormField label="Origem"><select value={appointmentForm.origem} onChange={(e) => setAppointmentForm((f) => ({ ...f, origem: e.target.value }))}><option value="INTERNO">Interno</option><option value="BALCAO">Balcão</option><option value="WHATSAPP">WhatsApp</option><option value="TELEFONE">Telefone</option><option value="APP">App</option></select></FormField>
        </div>
        <div className="grooming-service-editor">
          <div className="section-title"><strong>Serviços</strong><button className="text-button" type="button" onClick={() => setAppointmentForm((f) => ({ ...f, itens: [...f.itens, { itemCatalogoId: "", quantidade: 1 }] }))}>+ Adicionar</button></div>
          {appointmentForm.itens.map((line, index) => <div className="grooming-service-line" key={index}><select value={line.itemCatalogoId} onChange={(e) => setAppointmentForm((f) => ({ ...f, itens: f.itens.map((i, ix) => ix === index ? { ...i, itemCatalogoId: e.target.value } : i) }))}><option value="">Selecione o serviço</option>{services.map((s) => <option key={s.id} value={s.id}>{s.nome} — {formatCurrency(s.precoVenda)}</option>)}</select><input type="number" min="1" step="1" value={line.quantidade} onChange={(e) => setAppointmentForm((f) => ({ ...f, itens: f.itens.map((i, ix) => ix === index ? { ...i, quantidade: e.target.value } : i) }))} /><button className="table-action" type="button" onClick={() => setAppointmentForm((f) => ({ ...f, itens: f.itens.filter((_, ix) => ix !== index) }))}>×</button></div>)}
        </div>
        <div className="form-grid form-grid--2">
          <FormField label="Observações do cliente"><textarea rows="3" value={appointmentForm.observacoesCliente} onChange={(e) => setAppointmentForm((f) => ({ ...f, observacoesCliente: e.target.value }))} /></FormField>
          <FormField label="Observações internas"><textarea rows="3" value={appointmentForm.observacoesInternas} onChange={(e) => setAppointmentForm((f) => ({ ...f, observacoesInternas: e.target.value }))} /></FormField>
        </div>
      </Modal>

      <Modal open={Boolean(checkinAppointment)} title="Fazer check-in" subtitle={checkinAppointment ? `${checkinAppointment.pet.nome} • ${checkinAppointment.cliente.nome}` : ""} size="lg" onClose={() => setCheckinAppointment(null)} footer={<><button className="secondary-button" type="button" onClick={() => setCheckinAppointment(null)}>Cancelar</button><button className="primary-button" type="button" onClick={() => checkinMutation.mutate()} disabled={checkinMutation.isPending}>Confirmar entrada</button></>}>
        {error ? <InlineNotice variant="error">{error}</InlineNotice> : null}
        <p className="modal-help">Escolha um crédito de pacote, quando houver. Serviços sem pacote serão lançados automaticamente na comanda do tutor.</p>
        <div className="grooming-checkin-lines">
          {checkinItems.map((line, index) => {
            const service = services.find((s) => s.id === line.itemCatalogoId);
            const available = credits.filter((c) => c.itemCatalogoId === line.itemCatalogoId);
            return <div className="grooming-checkin-line" key={`${line.itemCatalogoId}-${index}`}><div><strong>{service?.nome || "Serviço"}</strong><span>{formatCurrency(service?.precoVenda || 0)} · qtd. {line.quantidade}</span></div><select value={line.pacoteClienteItemId} onChange={(e) => setCheckinItems((items) => items.map((i, ix) => ix === index ? { ...i, pacoteClienteItemId: e.target.value } : i))}><option value="">Cobrar na comanda</option>{available.map((c) => <option key={c.id} value={c.id}>{c.pacoteCliente.nome} — saldo {(Number(c.quantidadeTotal) - Number(c.quantidadeConsumida)).toFixed(0)}</option>)}</select></div>;
          })}
        </div>
      </Modal>

      <Modal open={Boolean(detailId)} title={detail ? `OS #${detail.numero} — ${detail.pet.nome}` : "Ordem de serviço"} subtitle={detail ? `${detail.cliente.nome} • ${statusLabels[detail.status] || detail.status}` : ""} size="xl" onClose={() => setDetailId(null)} footer={detail ? <><button className="secondary-button" type="button" onClick={() => setDetailId(null)}>Fechar</button>{nextStatus[detail.status] ? <button className="primary-button" type="button" onClick={() => statusMutation.mutate({ id: detail.id, status: nextStatus[detail.status] })}>{nextStatus[detail.status] === "ENTREGUE" ? "Marcar como entregue" : "Avançar etapa"}</button> : null}</> : null}>
        {detail ? <div className="grooming-detail-grid">
          <section className="grooming-detail-main">
            <div className="grooming-detail-banner"><div><span>Pet</span><strong>{detail.pet.nome}</strong></div><div><span>Tutor</span><strong>{detail.cliente.nome}</strong></div><div><span>Profissional</span><strong>{detail.profissional?.nome || "Não definido"}</strong></div><div><span>Previsão</span><strong>{detail.previsaoSaida ? formatDateTime(detail.previsaoSaida) : "—"}</strong></div></div>
            <div className="grooming-detail-section"><div className="section-title"><strong>Serviços</strong></div><div className="grooming-detail-services">{detail.itens.map((i) => <div key={i.id}><span>{i.itemCatalogo.nome}</span><strong>{i.viaPacote ? `Pacote: ${i.pacoteClienteItem?.pacoteCliente?.nome || "crédito"}` : formatCurrency(Number(i.valorUnitario) * Number(i.quantidade))}</strong></div>)}</div></div>
            <div className="grooming-detail-section"><div className="section-title"><strong>Fotos e anexos</strong></div><div className="form-grid form-grid--3"><FormField label="Tipo"><select value={attachment.tipo} onChange={(e) => setAttachment((a) => ({ ...a, tipo: e.target.value }))}><option value="ENTRADA">Entrada</option><option value="ANTES">Antes</option><option value="DEPOIS">Depois</option><option value="LESAO">Lesão</option><option value="OBSERVACAO">Observação</option></select></FormField><FormField label="URL da imagem"><input value={attachment.url} onChange={(e) => setAttachment((a) => ({ ...a, url: e.target.value }))} placeholder="https://..." /></FormField><FormField label="Legenda"><input value={attachment.legenda} onChange={(e) => setAttachment((a) => ({ ...a, legenda: e.target.value }))} /></FormField></div><button className="secondary-button" type="button" disabled={!attachment.url || !canManage} onClick={() => attachmentMutation.mutate()}><Camera size={14} /> Adicionar anexo</button><div className="grooming-photo-grid">{detail.anexos.map((a) => <a key={a.id} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.legenda || a.tipo} /><span>{a.legenda || a.tipo}</span></a>)}</div></div>
          </section>
          <aside className="grooming-ficha"><div className="section-title"><strong>Ficha técnica do pet</strong></div><FormField label="Tipo de pelagem"><input value={fichaForm.tipoPelagem} onChange={(e) => setFichaForm((f) => ({ ...f, tipoPelagem: e.target.value }))} /></FormField><FormField label="Temperamento"><input value={fichaForm.temperamento} onChange={(e) => setFichaForm((f) => ({ ...f, temperamento: e.target.value }))} /></FormField><div className="form-grid form-grid--3"><BooleanSelect label="Aceita secador" value={fichaForm.aceitaSecador} onChange={(v) => setFichaForm((f) => ({ ...f, aceitaSecador: v }))} /><BooleanSelect label="Aceita máquina" value={fichaForm.aceitaMaquina} onChange={(v) => setFichaForm((f) => ({ ...f, aceitaMaquina: v }))} /><BooleanSelect label="Aceita unhas" value={fichaForm.aceitaUnhas} onChange={(v) => setFichaForm((f) => ({ ...f, aceitaUnhas: v }))} /></div><FormField label="Shampoo preferencial"><input value={fichaForm.shampooPreferencial} onChange={(e) => setFichaForm((f) => ({ ...f, shampooPreferencial: e.target.value }))} /></FormField><FormField label="Alergias a produtos"><textarea rows="2" value={fichaForm.alergiaProdutos} onChange={(e) => setFichaForm((f) => ({ ...f, alergiaProdutos: e.target.value }))} /></FormField><FormField label="Restrições"><textarea rows="3" value={fichaForm.restricoes} onChange={(e) => setFichaForm((f) => ({ ...f, restricoes: e.target.value }))} /></FormField><FormField label="Observações"><textarea rows="3" value={fichaForm.observacoes} onChange={(e) => setFichaForm((f) => ({ ...f, observacoes: e.target.value }))} /></FormField><button className="primary-button" type="button" disabled={!canManage || fichaMutation.isPending} onClick={() => fichaMutation.mutate()}>Salvar ficha</button></aside>
        </div> : <div className="empty-state">Carregando...</div>}
      </Modal>
    </div>
  );
}

function Summary({ icon: Icon, label, value }) {
  return <article className="grooming-summary-card"><span><Icon size={18} /></span><div><small>{label}</small><strong>{value}</strong></div></article>;
}

function BooleanSelect({ label, value, onChange }) {
  return <FormField label={label}><select value={value} onChange={(e) => onChange(e.target.value)}><option value="">Não informado</option><option value="true">Sim</option><option value="false">Não</option></select></FormField>;
}

function normalizeFicha(form) {
  const bool = (v) => v === "" ? null : v === true || v === "true";
  return {
    tipoPelagem: form.tipoPelagem || null,
    temperamento: form.temperamento || null,
    aceitaSecador: bool(form.aceitaSecador),
    aceitaMaquina: bool(form.aceitaMaquina),
    aceitaUnhas: bool(form.aceitaUnhas),
    alergiaProdutos: form.alergiaProdutos || null,
    shampooPreferencial: form.shampooPreferencial || null,
    restricoes: form.restricoes || null,
    observacoes: form.observacoes || null,
  };
}
