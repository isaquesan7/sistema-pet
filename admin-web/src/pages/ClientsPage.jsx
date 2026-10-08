import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Plus, Search, UsersRound } from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";
import { formatDocument, formatPhone } from "../lib/formatters.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import FormField from "../components/FormField.jsx";
import InlineNotice from "../components/InlineNotice.jsx";

const emptyForm = {
  nome: "",
  cpfCnpj: "",
  telefone: "",
  whatsapp: "",
  email: "",
  dataNascimento: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  observacoes: "",
};

async function loadClients(search) {
  const { data } = await api.get("/clientes", {
    params: { busca: search || undefined, limite: 50 },
  });
  return data;
}

function normalizeForm(client) {
  if (!client) return { ...emptyForm };
  return {
    nome: client.nome || "",
    cpfCnpj: client.cpfCnpj || "",
    telefone: client.telefone || "",
    whatsapp: client.whatsapp || "",
    email: client.email || "",
    dataNascimento: client.dataNascimento ? String(client.dataNascimento).slice(0, 10) : "",
    cep: client.cep || "",
    logradouro: client.logradouro || "",
    numero: client.numero || "",
    complemento: client.complemento || "",
    bairro: client.bairro || "",
    cidade: client.cidade || "",
    estado: client.estado || "",
    observacoes: client.observacoes || "",
  };
}

export default function ClientsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const deferredSearch = useDeferredValue(search);

  const query = useQuery({
    queryKey: ["clients", deferredSearch],
    queryFn: () => loadClients(deferredSearch),
  });

  const mutation = useMutation({
    mutationFn: async (payload) => {
      if (editingClient) {
        return (await api.patch(`/clientes/${editingClient.id}`, payload)).data;
      }
      return (await api.post("/clientes", payload)).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["pets"] });
      closeModal();
    },
    onError: (error) => setFormError(getApiErrorMessage(error, "Não foi possível salvar o cliente.")),
  });

  const clients = query.data?.dados || [];
  const canCreate = hasPermission("clientes.criar");
  const canEdit = hasPermission("clientes.editar");

  const modalTitle = useMemo(
    () => (editingClient ? "Editar cliente" : "Novo cliente"),
    [editingClient]
  );

  function openCreate() {
    setEditingClient(null);
    setForm({ ...emptyForm });
    setFormError("");
    setModalOpen(true);
  }

  async function openEdit(client) {
    if (!canEdit) return;
    setFormError("");
    try {
      const { data } = await api.get(`/clientes/${client.id}`);
      setEditingClient(data.cliente);
      setForm(normalizeForm(data.cliente));
      setModalOpen(true);
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Não foi possível abrir o cadastro."));
      setEditingClient(client);
      setForm(normalizeForm(client));
      setModalOpen(true);
    }
  }

  function closeModal() {
    if (mutation.isPending) return;
    setModalOpen(false);
    setEditingClient(null);
    setForm({ ...emptyForm });
    setFormError("");
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function submit(event) {
    event.preventDefault();
    setFormError("");

    if (!form.nome.trim()) {
      setFormError("Informe o nome do cliente.");
      return;
    }

    mutation.mutate({
      ...form,
      nome: form.nome.trim(),
      cpfCnpj: form.cpfCnpj || null,
      telefone: form.telefone || null,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      dataNascimento: form.dataNascimento || null,
      cep: form.cep || null,
      logradouro: form.logradouro || null,
      numero: form.numero || null,
      complemento: form.complemento || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      observacoes: form.observacoes || null,
    });
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="page-kicker">Cadastros</span>
          <h1>Clientes</h1>
          <p>Consulte, cadastre e mantenha os dados dos tutores da organização.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreate} disabled={!canCreate}>
          <Plus size={18} /> Novo cliente
        </button>
      </section>

      <section className="panel table-panel">
        <div className="toolbar">
          <label className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, CPF, telefone ou pet..."
            />
          </label>
          <span className="toolbar__count">{query.data?.paginacao?.total ?? 0} clientes</span>
        </div>

        {query.isLoading ? (
          <div className="loading-state">Carregando clientes...</div>
        ) : query.isError ? (
          <div className="empty-state">
            <UsersRound size={30} />
            <strong>Não foi possível carregar os clientes</strong>
            <p>{getApiErrorMessage(query.error)}</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="empty-state">
            <UsersRound size={30} />
            <strong>Nenhum cliente encontrado</strong>
            <p>Altere a busca ou cadastre um novo tutor.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Contato</th>
                  <th>Pets</th>
                  <th>Conta</th>
                  <th className="table-actions-col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div className="person-cell">
                        <span className="avatar-soft">{client.nome.slice(0, 1).toUpperCase()}</span>
                        <div>
                          <strong>{client.nome}</strong>
                          <small>{client.email || "Sem e-mail"}</small>
                        </div>
                      </div>
                    </td>
                    <td>{formatDocument(client.cpfCnpj)}</td>
                    <td>{formatPhone(client.whatsapp || client.telefone)}</td>
                    <td>
                      <div className="pet-tags">
                        {client.pets?.length ? client.pets.map((pet) => <span key={pet.id}>{pet.nome}</span>) : <em>Sem pets</em>}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${client.conta ? "badge--success" : "badge--muted"}`}>
                        {client.conta ? "Portal ativo" : "Sem conta"}
                      </span>
                    </td>
                    <td className="table-actions-col">
                      <button
                        type="button"
                        className="icon-button table-action"
                        onClick={() => openEdit(client)}
                        disabled={!canEdit}
                        title="Editar cliente"
                      >
                        <Edit3 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={modalOpen}
        title={modalTitle}
        subtitle={editingClient ? "Atualize os dados do tutor sem perder o histórico." : "Cadastre um novo tutor na organização."}
        onClose={closeModal}
        size="lg"
        footer={
          <>
            <button type="button" className="ghost-button" onClick={closeModal} disabled={mutation.isPending}>Cancelar</button>
            <button type="submit" form="client-form" className="primary-button" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : editingClient ? "Salvar alterações" : "Cadastrar cliente"}
            </button>
          </>
        }
      >
        <form id="client-form" className="form-stack" onSubmit={submit}>
          <InlineNotice tone="error">{formError}</InlineNotice>

          <div className="form-section">
            <div className="form-section__heading">
              <strong>Identificação</strong>
              <span>Dados principais do tutor.</span>
            </div>
            <div className="form-grid form-grid--2">
              <FormField label="Nome completo" className="form-field--wide">
                <input className="form-control" value={form.nome} onChange={(e) => updateField("nome", e.target.value)} required />
              </FormField>
              <FormField label="CPF / CNPJ">
                <input className="form-control" value={form.cpfCnpj} onChange={(e) => updateField("cpfCnpj", e.target.value)} placeholder="Somente números ou formatado" />
              </FormField>
              <FormField label="Data de nascimento">
                <input className="form-control" type="date" value={form.dataNascimento} onChange={(e) => updateField("dataNascimento", e.target.value)} />
              </FormField>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section__heading"><strong>Contato</strong><span>Informações usadas pela recepção e pelo portal.</span></div>
            <div className="form-grid form-grid--3">
              <FormField label="WhatsApp"><input className="form-control" value={form.whatsapp} onChange={(e) => updateField("whatsapp", e.target.value)} /></FormField>
              <FormField label="Telefone"><input className="form-control" value={form.telefone} onChange={(e) => updateField("telefone", e.target.value)} /></FormField>
              <FormField label="E-mail"><input className="form-control" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} /></FormField>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section__heading"><strong>Endereço</strong><span>Opcional, mas útil para cadastro completo e documentos.</span></div>
            <div className="form-grid form-grid--4">
              <FormField label="CEP"><input className="form-control" value={form.cep} onChange={(e) => updateField("cep", e.target.value)} /></FormField>
              <FormField label="Logradouro" className="form-field--span-2"><input className="form-control" value={form.logradouro} onChange={(e) => updateField("logradouro", e.target.value)} /></FormField>
              <FormField label="Número"><input className="form-control" value={form.numero} onChange={(e) => updateField("numero", e.target.value)} /></FormField>
              <FormField label="Complemento"><input className="form-control" value={form.complemento} onChange={(e) => updateField("complemento", e.target.value)} /></FormField>
              <FormField label="Bairro"><input className="form-control" value={form.bairro} onChange={(e) => updateField("bairro", e.target.value)} /></FormField>
              <FormField label="Cidade"><input className="form-control" value={form.cidade} onChange={(e) => updateField("cidade", e.target.value)} /></FormField>
              <FormField label="UF"><input className="form-control" maxLength={2} value={form.estado} onChange={(e) => updateField("estado", e.target.value.toUpperCase())} /></FormField>
            </div>
          </div>

          <FormField label="Observações">
            <textarea className="form-control form-control--textarea" rows={3} value={form.observacoes} onChange={(e) => updateField("observacoes", e.target.value)} />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
