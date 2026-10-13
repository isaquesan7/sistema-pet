import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Eye, Trash2, ChevronLeft, ChevronRight, Plus, Search, UsersRound } from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";
import { formatDocument, formatPhone } from "../lib/formatters.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import {useNavigate,useLocation} from "react-router-dom";
import "../clients.css";
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

async function loadClients(search,page=1,tipoBusca="TODOS",situacao="ATIVOS") {
  const { data } = await api.get("/clientes", {
    params: { busca: search || undefined, limite: 20, pagina: page,tipoBusca,situacao },
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
  const { hasPermission,selectedOrganization } = useAuth();
  const navigate=useNavigate();
  const location=useLocation();
  const [page,setPage]=useState(1);
  const [deletion,setDeletion]=useState(null);
  const [deleteStep,setDeleteStep]=useState(1);
  const [deletePhrase,setDeletePhrase]=useState("");
  const [deleteError,setDeleteError]=useState("");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tipoBusca,setTipoBusca]=useState("TODOS");
  const [situacao,setSituacao]=useState("ATIVOS");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const deferredSearch = useDeferredValue(search);

  const query = useQuery({
    queryKey: ["clients", deferredSearch,page,tipoBusca,situacao],
    queryFn: () => loadClients(deferredSearch,page,tipoBusca,situacao),
  });

  const deleteMutation=useMutation({
    mutationFn:async id=>(await api.delete(`/clientes/${id}`)).data,
    onSuccess:async()=>{setDeletion(null);setDeletePhrase("");setDeleteError("");setPage(1);await queryClient.invalidateQueries({queryKey:["clients"]});await queryClient.invalidateQueries({queryKey:["pets"]});},
    onError:e=>setDeleteError(getApiErrorMessage(e,"Não foi possível excluir este cadastro."))
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
  const canDelete = hasPermission("clientes.editar") && ["PROPRIETARIO","ADMINISTRADOR"].includes(selectedOrganization?.papel);

  useEffect(()=>{
    const target=location.state?.editClientId;
    if(!target)return;
    api.get(`/clientes/${target}`).then(({data})=>{setEditingClient(data.cliente);setForm(normalizeForm(data.cliente));setFormError("");setModalOpen(true);}).catch(e=>setFormError(getApiErrorMessage(e)));
    navigate(location.pathname,{replace:true,state:null});
  },[location.state?.editClientId]);
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
        <div className="pv-client-filters"><label>Pesquisar por<select className="form-control" value={tipoBusca} onChange={e=>{setTipoBusca(e.target.value);setPage(1);}}><option value="TODOS">Todos os campos</option><option value="NOME">Nome do cliente</option><option value="DOCUMENTO">CPF/CNPJ</option><option value="TELEFONE">Telefone/WhatsApp</option><option value="EMAIL">E-mail</option><option value="PET">Nome do pet</option></select></label><label>Situação<select className="form-control" value={situacao} onChange={e=>{setSituacao(e.target.value);setPage(1);}}><option value="ATIVOS">Ativos</option><option value="INATIVOS">Inativos</option><option value="TODOS">Todos</option></select></label></div>
        <div className="toolbar">
          <label className="search-box">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => {setSearch(e.target.value);setPage(1);}}
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
                      <div className="pv-client-actions">
                        <button type="button" className="icon-button table-action" onClick={()=>navigate(`/clientes/${client.id}`)} title="Ver detalhes" aria-label={`Detalhes de ${client.nome}`}><Eye size={18}/></button>
                        <button type="button" className="icon-button table-action" onClick={()=>openEdit(client)} disabled={!canEdit} title="Editar cliente" aria-label={`Editar ${client.nome}`}><Edit3 size={18}/></button>
                        {canDelete&&<button type="button" className="icon-button table-action pv-danger-action" onClick={()=>{setDeletion(client);setDeleteStep(1);setDeletePhrase("");setDeleteError("");}} title="Excluir cliente" aria-label={`Excluir ${client.nome}`}><Trash2 size={18}/></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pv-list-pagination"><span>Página {page} de {Math.max(query.data?.paginacao?.paginas||1,1)} · {query.data?.paginacao?.total??0} clientes</span><div><button type="button" className="ghost-button" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} aria-label="Página anterior"><ChevronLeft size={18}/></button><button type="button" className="ghost-button" disabled={page>=(query.data?.paginacao?.paginas||1)} onClick={()=>setPage(p=>p+1)} aria-label="Próxima página"><ChevronRight size={18}/></button></div></div>
      </section>

      <Modal
        open={modalOpen}
        title={modalTitle}
        subtitle={editingClient ? "Atualize os dados do tutor sem perder o histórico." : "Cadastre um novo tutor na organização."}
        onClose={closeModal}
        size="lg"
        drawer
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

      <Modal open={Boolean(deletion)} title={deleteStep===1?"Excluir cliente?":"Confirmação final"} subtitle={deletion?.nome} onClose={()=>{if(!deleteMutation.isPending)setDeletion(null);}} footer={<><button className="ghost-button" disabled={deleteMutation.isPending} onClick={()=>setDeletion(null)}>Cancelar</button>{deleteStep===1?<button className="primary-button" onClick={()=>setDeleteStep(2)}>Continuar</button>:<button className="primary-button pv-delete-submit" disabled={deletePhrase!==deletion?.nome||deleteMutation.isPending} onClick={()=>deleteMutation.mutate(deletion.id)}>{deleteMutation.isPending?"Excluindo...":"Excluir definitivamente"}</button>}</>}>
        {deleteStep===1?<p>Esta ação é irreversível. Clientes com pets, vendas ou documentos vinculados não serão apagados automaticamente.</p>:<div className="form-stack"><p>Digite exatamente <strong>{deletion?.nome}</strong> para confirmar a exclusão.</p><input className="form-control" value={deletePhrase} onChange={e=>setDeletePhrase(e.target.value)} autoComplete="off" aria-label="Confirmação por nome"/>{deleteError&&<div className="alert alert--error" role="alert">{deleteError}</div>}</div>}
      </Modal>
    </div>
  );
}
