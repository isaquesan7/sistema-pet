import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, PawPrint, Plus, Scale, Search } from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";
import { formatPhone } from "../lib/formatters.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import FormField from "../components/FormField.jsx";
import InlineNotice from "../components/InlineNotice.jsx";

const emptyForm = {
  clienteId: "",
  especieId: "",
  racaId: "",
  nome: "",
  sexo: "NAO_INFORMADO",
  dataNascimento: "",
  castrado: "",
  cor: "",
  microchip: "",
  fotoUrl: "",
  alergias: "",
  doencasPreexistentes: "",
  observacoes: "",
  peso: "",
};

async function loadPets(search) {
  const { data } = await api.get("/pets", { params: { busca: search || undefined, limite: 50 } });
  return data;
}

async function loadClients() {
  return (await api.get("/clientes", { params: { limite: 100 } })).data.dados || [];
}

async function loadSpecies() {
  return (await api.get("/pets/catalogos/especies")).data.dados || [];
}

async function loadBreeds(especieId) {
  if (!especieId) return [];
  return (await api.get("/pets/catalogos/racas", { params: { especieId } })).data.dados || [];
}

function normalizePet(pet) {
  if (!pet) return { ...emptyForm };
  return {
    clienteId: pet.clienteId || pet.cliente?.id || "",
    especieId: pet.especieId || pet.especie?.id || "",
    racaId: pet.racaId || pet.raca?.id || "",
    nome: pet.nome || "",
    sexo: pet.sexo || "NAO_INFORMADO",
    dataNascimento: pet.dataNascimento ? String(pet.dataNascimento).slice(0, 10) : "",
    castrado: pet.castrado === true ? "true" : pet.castrado === false ? "false" : "",
    cor: pet.cor || "",
    microchip: pet.microchip || "",
    fotoUrl: pet.fotoUrl || "",
    alergias: pet.alergias || "",
    doencasPreexistentes: pet.doencasPreexistentes || "",
    observacoes: pet.observacoes || "",
    peso: "",
  };
}

export default function PetsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [modalOpen, setModalOpen] = useState(false);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [editingPet, setEditingPet] = useState(null);
  const [weightPet, setWeightPet] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [weightForm, setWeightForm] = useState({ peso: "", data: "", origem: "MANUAL", observacao: "" });
  const [formError, setFormError] = useState("");
  const [weightError, setWeightError] = useState("");

  const query = useQuery({ queryKey: ["pets", deferredSearch], queryFn: () => loadPets(deferredSearch) });
  const clientsQuery = useQuery({ queryKey: ["clients", "pet-form"], queryFn: loadClients });
  const speciesQuery = useQuery({ queryKey: ["species"], queryFn: loadSpecies });
  const breedsQuery = useQuery({
    queryKey: ["breeds", form.especieId],
    queryFn: () => loadBreeds(form.especieId),
    enabled: Boolean(form.especieId),
  });

  const mutation = useMutation({
    mutationFn: async (payload) => {
      if (editingPet) return (await api.patch(`/pets/${editingPet.id}`, payload)).data;
      return (await api.post("/pets", payload)).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pets"] });
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      closeModal();
    },
    onError: (error) => setFormError(getApiErrorMessage(error, "Não foi possível salvar o pet.")),
  });

  const weightMutation = useMutation({
    mutationFn: async (payload) => (await api.post(`/pets/${weightPet.id}/pesos`, payload)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pets"] });
      setWeightModalOpen(false);
      setWeightPet(null);
      setWeightForm({ peso: "", data: "", origem: "MANUAL", observacao: "" });
      setWeightError("");
    },
    onError: (error) => setWeightError(getApiErrorMessage(error, "Não foi possível registrar o peso.")),
  });

  const pets = query.data?.dados || [];
  const clients = clientsQuery.data || [];
  const species = speciesQuery.data || [];
  const breeds = breedsQuery.data || [];
  const canCreate = hasPermission("pets.criar");
  const canEdit = hasPermission("pets.editar");

  useEffect(() => {
    if (!form.racaId) return;
    const stillExists = breeds.some((breed) => breed.id === form.racaId);
    if (!stillExists && !breedsQuery.isFetching) {
      setForm((current) => ({ ...current, racaId: "" }));
    }
  }, [breeds, breedsQuery.isFetching, form.racaId]);

  const modalTitle = useMemo(() => (editingPet ? "Editar pet" : "Novo pet"), [editingPet]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function openCreate() {
    setEditingPet(null);
    setForm({ ...emptyForm });
    setFormError("");
    setModalOpen(true);
  }

  async function openEdit(pet) {
    if (!canEdit) return;
    setFormError("");
    try {
      const { data } = await api.get(`/pets/${pet.id}`);
      setEditingPet(data.pet);
      setForm(normalizePet(data.pet));
      setModalOpen(true);
    } catch (error) {
      setEditingPet(pet);
      setForm(normalizePet(pet));
      setFormError(getApiErrorMessage(error, "Não foi possível carregar todos os dados do pet."));
      setModalOpen(true);
    }
  }

  function closeModal() {
    if (mutation.isPending) return;
    setModalOpen(false);
    setEditingPet(null);
    setForm({ ...emptyForm });
    setFormError("");
  }

  function openWeight(pet) {
    setWeightPet(pet);
    setWeightError("");
    setWeightForm({ peso: "", data: new Date().toISOString().slice(0, 10), origem: "MANUAL", observacao: "" });
    setWeightModalOpen(true);
  }

  function submit(event) {
    event.preventDefault();
    setFormError("");

    if (!form.nome.trim() || !form.especieId || (!editingPet && !form.clienteId)) {
      setFormError("Preencha tutor, espécie e nome do pet.");
      return;
    }

    const payload = {
      ...(editingPet ? {} : { clienteId: form.clienteId }),
      especieId: form.especieId,
      racaId: form.racaId || null,
      nome: form.nome.trim(),
      sexo: form.sexo,
      dataNascimento: form.dataNascimento || null,
      castrado: form.castrado === "" ? null : form.castrado === "true",
      cor: form.cor || null,
      microchip: form.microchip || null,
      fotoUrl: form.fotoUrl || null,
      alergias: form.alergias || null,
      doencasPreexistentes: form.doencasPreexistentes || null,
      observacoes: form.observacoes || null,
      ...(form.peso ? { peso: Number(form.peso) } : {}),
    };

    mutation.mutate(payload);
  }

  function submitWeight(event) {
    event.preventDefault();
    setWeightError("");
    if (!weightForm.peso || Number(weightForm.peso) <= 0) {
      setWeightError("Informe um peso válido.");
      return;
    }
    weightMutation.mutate({
      peso: Number(weightForm.peso),
      data: weightForm.data || null,
      origem: weightForm.origem || "MANUAL",
      observacao: weightForm.observacao || null,
    });
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="page-kicker">Cadastros</span>
          <h1>Pets</h1>
          <p>Cadastre animais, mantenha dados clínicos básicos e acompanhe o histórico de peso.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreate} disabled={!canCreate}>
          <Plus size={18} /> Novo pet
        </button>
      </section>

      <section className="panel table-panel">
        <div className="toolbar">
          <label className="search-box">
            <Search size={18} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pet, tutor, telefone ou microchip..." />
          </label>
          <span className="toolbar__count">{query.data?.paginacao?.total ?? 0} pets</span>
        </div>

        {query.isLoading ? (
          <div className="loading-state">Carregando pets...</div>
        ) : query.isError ? (
          <div className="empty-state"><PawPrint size={30} /><strong>Não foi possível carregar os pets</strong><p>{getApiErrorMessage(query.error)}</p></div>
        ) : pets.length === 0 ? (
          <div className="empty-state"><PawPrint size={30} /><strong>Nenhum pet encontrado</strong><p>Altere a busca ou cadastre um novo animal.</p></div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Pet</th><th>Espécie / Raça</th><th>Tutor</th><th>Contato</th><th>Peso recente</th><th className="table-actions-col">Ações</th></tr></thead>
              <tbody>
                {pets.map((pet) => (
                  <tr key={pet.id}>
                    <td><div className="person-cell"><span className="avatar-soft avatar-soft--pet"><PawPrint size={16} /></span><div><strong>{pet.nome}</strong><small>{pet.sexo === "MACHO" ? "Macho" : pet.sexo === "FEMEA" ? "Fêmea" : "Sexo não informado"}</small></div></div></td>
                    <td><strong className="table-main-text">{pet.especie?.nome || "—"}</strong><div className="table-subtext">{pet.raca?.nome || "Raça não informada"}</div></td>
                    <td>{pet.cliente?.nome || "—"}</td>
                    <td>{formatPhone(pet.cliente?.whatsapp || pet.cliente?.telefone)}</td>
                    <td>{pet.pesos?.[0]?.peso ? `${pet.pesos[0].peso} kg` : "—"}</td>
                    <td className="table-actions-col">
                      <div className="table-actions">
                        <button type="button" className="icon-button table-action" onClick={() => openWeight(pet)} disabled={!canEdit} title="Registrar peso"><Scale size={15} /></button>
                        <button type="button" className="icon-button table-action" onClick={() => openEdit(pet)} disabled={!canEdit} title="Editar pet"><Edit3 size={15} /></button>
                      </div>
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
        subtitle={editingPet ? "Atualize o cadastro sem perder o histórico do animal." : "Vincule o animal a um tutor e complete os dados essenciais."}
        onClose={closeModal}
        size="lg"
        footer={<><button type="button" className="ghost-button" onClick={closeModal} disabled={mutation.isPending}>Cancelar</button><button type="submit" form="pet-form" className="primary-button" disabled={mutation.isPending}>{mutation.isPending ? "Salvando..." : editingPet ? "Salvar alterações" : "Cadastrar pet"}</button></>}
      >
        <form id="pet-form" className="form-stack" onSubmit={submit}>
          <InlineNotice tone="error">{formError}</InlineNotice>

          <div className="form-section">
            <div className="form-section__heading"><strong>Identificação</strong><span>Informações principais do animal.</span></div>
            <div className="form-grid form-grid--3">
              <FormField label="Tutor" className="form-field--wide">
                <select className="form-control" value={form.clienteId} onChange={(e) => updateField("clienteId", e.target.value)} disabled={Boolean(editingPet)} required={!editingPet}>
                  <option value="">Selecione o tutor</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.nome}</option>)}
                </select>
              </FormField>
              <FormField label="Nome"><input className="form-control" value={form.nome} onChange={(e) => updateField("nome", e.target.value)} required /></FormField>
              <FormField label="Sexo"><select className="form-control" value={form.sexo} onChange={(e) => updateField("sexo", e.target.value)}><option value="NAO_INFORMADO">Não informado</option><option value="MACHO">Macho</option><option value="FEMEA">Fêmea</option></select></FormField>
              <FormField label="Espécie"><select className="form-control" value={form.especieId} onChange={(e) => setForm((current) => ({ ...current, especieId: e.target.value, racaId: "" }))} required><option value="">Selecione</option>{species.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></FormField>
              <FormField label="Raça"><select className="form-control" value={form.racaId} onChange={(e) => updateField("racaId", e.target.value)} disabled={!form.especieId}><option value="">Não informada / SRD</option>{breeds.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></FormField>
              <FormField label="Nascimento"><input className="form-control" type="date" value={form.dataNascimento} onChange={(e) => updateField("dataNascimento", e.target.value)} /></FormField>
              <FormField label="Castrado"><select className="form-control" value={form.castrado} onChange={(e) => updateField("castrado", e.target.value)}><option value="">Não informado</option><option value="true">Sim</option><option value="false">Não</option></select></FormField>
              <FormField label={editingPet ? "Novo peso (opcional)" : "Peso inicial (kg)"} hint={editingPet ? "Se preenchido, será criado um novo registro no histórico." : "Opcional."}><input className="form-control" type="number" min="0" step="0.01" value={form.peso} onChange={(e) => updateField("peso", e.target.value)} /></FormField>
              <FormField label="Cor"><input className="form-control" value={form.cor} onChange={(e) => updateField("cor", e.target.value)} /></FormField>
              <FormField label="Microchip"><input className="form-control" value={form.microchip} onChange={(e) => updateField("microchip", e.target.value)} /></FormField>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section__heading"><strong>Saúde e manejo</strong><span>Alertas básicos que devem acompanhar o animal em qualquer setor.</span></div>
            <div className="form-grid form-grid--2">
              <FormField label="Alergias"><textarea className="form-control form-control--textarea" rows={3} value={form.alergias} onChange={(e) => updateField("alergias", e.target.value)} /></FormField>
              <FormField label="Doenças preexistentes"><textarea className="form-control form-control--textarea" rows={3} value={form.doencasPreexistentes} onChange={(e) => updateField("doencasPreexistentes", e.target.value)} /></FormField>
              <FormField label="Observações" className="form-field--wide"><textarea className="form-control form-control--textarea" rows={3} value={form.observacoes} onChange={(e) => updateField("observacoes", e.target.value)} /></FormField>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={weightModalOpen}
        title={`Registrar peso${weightPet ? ` — ${weightPet.nome}` : ""}`}
        subtitle="O lançamento fica preservado no histórico do pet."
        onClose={() => !weightMutation.isPending && setWeightModalOpen(false)}
        footer={<><button className="ghost-button" type="button" onClick={() => setWeightModalOpen(false)} disabled={weightMutation.isPending}>Cancelar</button><button className="primary-button" type="submit" form="weight-form" disabled={weightMutation.isPending}>{weightMutation.isPending ? "Registrando..." : "Registrar peso"}</button></>}
      >
        <form id="weight-form" className="form-stack" onSubmit={submitWeight}>
          <InlineNotice tone="error">{weightError}</InlineNotice>
          <div className="form-grid form-grid--2">
            <FormField label="Peso (kg)"><input className="form-control" type="number" min="0.01" step="0.01" value={weightForm.peso} onChange={(e) => setWeightForm((current) => ({ ...current, peso: e.target.value }))} autoFocus /></FormField>
            <FormField label="Data"><input className="form-control" type="date" value={weightForm.data} onChange={(e) => setWeightForm((current) => ({ ...current, data: e.target.value }))} /></FormField>
            <FormField label="Origem"><select className="form-control" value={weightForm.origem} onChange={(e) => setWeightForm((current) => ({ ...current, origem: e.target.value }))}><option value="MANUAL">Manual</option><option value="CONSULTORIO">Consultório</option><option value="BANHO_TOSA">Banho e Tosa</option><option value="CADASTRO">Cadastro</option></select></FormField>
            <FormField label="Observação"><input className="form-control" value={weightForm.observacao} onChange={(e) => setWeightForm((current) => ({ ...current, observacao: e.target.value }))} /></FormField>
          </div>
        </form>
      </Modal>
    </div>
  );
}
