import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Edit3, Palette, Plus, Puzzle, Tags } from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import FormField from "../components/FormField.jsx";
import InlineNotice from "../components/InlineNotice.jsx";

const tabs = [
  ["marca", "Marca", Palette],
  ["especies", "Espécies", Tags],
  ["racas", "Raças", Tags],
  ["categorias", "Categorias", Tags],
  ["modulos", "Módulos", Puzzle],
];

const moduleLabels = {
  PDV: "PDV",
  ESTOQUE: "Estoque",
  CONSULTORIO: "Consultório",
  BANHO_TOSA: "Banho e Tosa",
  FINANCEIRO: "Financeiro",
  PORTAL_CLIENTE: "Portal do cliente",
  PONTO: "Ponto eletrônico",
  FISCAL: "Fiscal",
  RELATORIOS: "Relatórios",
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { selectedCompany, selectedOrganization, hasPermission, updateOrganizationConfig, updateOrganizationModules } = useAuth();
  const [activeTab, setActiveTab] = useState("marca");
  const canManageOrg = hasPermission("organizacao.gerenciar");
  const canManageAux = hasPermission("cadastros.gerenciar");
  const canManageCatalog = hasPermission("catalogo.gerenciar");

  const organizationQuery = useQuery({
    queryKey: ["organization", selectedOrganization?.id],
    queryFn: async () => (await api.get("/organizacao/atual")).data.organizacao,
  });

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="page-kicker">Administração</span>
          <h1>Configurações</h1>
          <p>Personalize a organização e alimente os cadastros auxiliares do BichOne.</p>
        </div>
        <div className="company-badge"><Building2 size={18} /><div><strong>{selectedCompany?.nomeFantasia}</strong><span>Configurações compartilhadas da organização</span></div></div>
      </section>

      <div className="settings-tabs" role="tablist">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} type="button" className={`settings-tab ${activeTab === id ? "settings-tab--active" : ""}`} onClick={() => setActiveTab(id)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {activeTab === "marca" && <BrandSettings organization={organizationQuery.data} loading={organizationQuery.isLoading} canManage={canManageOrg} onUpdated={(config) => {
        updateOrganizationConfig(selectedOrganization.id, config);
        queryClient.invalidateQueries({ queryKey: ["organization"] });
      }} />}
      {activeTab === "especies" && <SpeciesSettings canManage={canManageAux} />}
      {activeTab === "racas" && <BreedsSettings canManage={canManageAux} />}
      {activeTab === "categorias" && <CategoriesSettings canManage={canManageCatalog} />}
      {activeTab === "modulos" && <ModulesSettings canManage={canManageOrg} organizationId={selectedOrganization?.id} onModulesChanged={updateOrganizationModules} />}
    </div>
  );
}

function BrandSettings({ organization, loading, canManage, onUpdated }) {
  const config = organization?.configuracao || {};
  const [form, setForm] = useState({
    nomeExibicao: "", logoUrl: "", corPrimaria: "#5b5bd6", corSecundaria: "#14b8a6",
    telefone: "", whatsapp: "", email: "", site: "", timezone: "America/Bahia", locale: "pt-BR", moeda: "BRL",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!organization) return;
    setForm({
      nomeExibicao: config.nomeExibicao || organization.nome || "",
      logoUrl: config.logoUrl || "",
      corPrimaria: config.corPrimaria || "#5b5bd6",
      corSecundaria: config.corSecundaria || "#14b8a6",
      telefone: config.telefone || "",
      whatsapp: config.whatsapp || "",
      email: config.email || "",
      site: config.site || "",
      timezone: config.timezone || "America/Bahia",
      locale: config.locale || "pt-BR",
      moeda: config.moeda || "BRL",
    });
  }, [organization]);

  const mutation = useMutation({
    mutationFn: async () => (await api.patch("/organizacao/configuracao", form)).data.configuracao,
    onSuccess: (next) => { setError(""); setSuccess("Configurações salvas com sucesso."); onUpdated(next); },
    onError: (e) => { setSuccess(""); setError(getApiErrorMessage(e)); },
  });

  if (loading) return <div className="panel loading-state">Carregando configurações...</div>;

  return (
    <section className="panel settings-section">
      <div className="panel__heading"><div><span>Identidade</span><h2>Marca da organização</h2></div></div>
      <InlineNotice tone="error">{error}</InlineNotice><InlineNotice tone="success">{success}</InlineNotice>
      <div className="brand-preview" style={{ "--preview-primary": form.corPrimaria, "--preview-secondary": form.corSecundaria }}>
        <div className="brand-preview__logo">{form.logoUrl ? <img src={form.logoUrl} alt="" /> : (form.nomeExibicao || "O").slice(0,1).toUpperCase()}</div>
        <div><strong>{form.nomeExibicao || "Sua organização"}</strong><span>Operando dentro do BichOne</span></div>
      </div>
      <div className="form-grid form-grid--2">
        <FormField label="Nome de exibição"><input className="form-control" value={form.nomeExibicao} onChange={(e) => setForm({ ...form, nomeExibicao: e.target.value })} disabled={!canManage} /></FormField>
        <FormField label="URL da logomarca"><input className="form-control" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} disabled={!canManage} /></FormField>
        <FormField label="Cor principal"><div className="color-field"><input type="color" value={form.corPrimaria} onChange={(e) => setForm({ ...form, corPrimaria: e.target.value })} disabled={!canManage} /><input className="form-control" value={form.corPrimaria} onChange={(e) => setForm({ ...form, corPrimaria: e.target.value })} disabled={!canManage} /></div></FormField>
        <FormField label="Cor secundária"><div className="color-field"><input type="color" value={form.corSecundaria} onChange={(e) => setForm({ ...form, corSecundaria: e.target.value })} disabled={!canManage} /><input className="form-control" value={form.corSecundaria} onChange={(e) => setForm({ ...form, corSecundaria: e.target.value })} disabled={!canManage} /></div></FormField>
        <FormField label="WhatsApp"><input className="form-control" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} disabled={!canManage} /></FormField>
        <FormField label="Telefone"><input className="form-control" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} disabled={!canManage} /></FormField>
        <FormField label="E-mail"><input className="form-control" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!canManage} /></FormField>
        <FormField label="Site"><input className="form-control" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} disabled={!canManage} /></FormField>
        <FormField label="Fuso horário"><input className="form-control" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} disabled={!canManage} /></FormField>
        <FormField label="Moeda"><input className="form-control" maxLength={3} value={form.moeda} onChange={(e) => setForm({ ...form, moeda: e.target.value.toUpperCase() })} disabled={!canManage} /></FormField>
      </div>
      <div className="form-actions"><button className="primary-button" type="button" onClick={() => mutation.mutate()} disabled={!canManage || mutation.isPending}>{mutation.isPending ? "Salvando..." : "Salvar identidade"}</button></div>
    </section>
  );
}

function SpeciesSettings({ canManage }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const query = useQuery({ queryKey: ["species"], queryFn: async () => (await api.get("/pets/catalogos/especies")).data.dados || [] });
  const mutation = useMutation({
    mutationFn: async () => modal?.id ? api.patch(`/pets/catalogos/especies/${modal.id}`, { nome: name }) : api.post("/pets/catalogos/especies", { nome: name }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["species"] }); setModal(null); setName(""); setError(""); },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  return <SettingsList title="Espécies" description="Cadastre as espécies utilizadas por esta organização." icon={Tags} actionLabel="Nova espécie" canManage={canManage} onAdd={() => { setModal({}); setName(""); setError(""); }}>
    {(query.data || []).map((item) => <SettingsRow key={item.id} title={item.nome} meta="Espécie ativa" onEdit={canManage ? () => { setModal(item); setName(item.nome); setError(""); } : null} />)}
    {!query.isLoading && (query.data || []).length === 0 ? <MiniEmpty text="Nenhuma espécie cadastrada. Cadastre a primeira para liberar o cadastro de pets." /> : null}
    <Modal open={Boolean(modal)} title={modal?.id ? "Editar espécie" : "Nova espécie"} onClose={() => setModal(null)} footer={<><button className="ghost-button" onClick={() => setModal(null)}>Cancelar</button><button className="primary-button" onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>{mutation.isPending ? "Salvando..." : "Salvar"}</button></>}>
      <InlineNotice tone="error">{error}</InlineNotice><FormField label="Nome"><input className="form-control" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></FormField>
    </Modal>
  </SettingsList>;
}

function BreedsSettings({ canManage }) {
  const qc = useQueryClient();
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ especieId: "", nome: "" });
  const [error, setError] = useState("");
  const speciesQuery = useQuery({ queryKey: ["species"], queryFn: async () => (await api.get("/pets/catalogos/especies")).data.dados || [] });
  const breedsQuery = useQuery({ queryKey: ["breeds", speciesFilter], queryFn: async () => (await api.get("/pets/catalogos/racas", { params: { especieId: speciesFilter || undefined } })).data.dados || [] });
  const mutation = useMutation({
    mutationFn: async () => modal?.id ? api.patch(`/pets/catalogos/racas/${modal.id}`, { nome: form.nome }) : api.post("/pets/catalogos/racas", form),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["breeds"] }); setModal(null); setError(""); },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  return <SettingsList title="Raças" description="As raças são vinculadas a uma espécie e podem ser adicionadas aos poucos." icon={Tags} actionLabel="Nova raça" canManage={canManage && (speciesQuery.data || []).length > 0} onAdd={() => { setModal({}); setForm({ especieId: speciesFilter || speciesQuery.data?.[0]?.id || "", nome: "" }); setError(""); }} extra={<select className="compact-select" value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value)}><option value="">Todas as espécies</option>{(speciesQuery.data || []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>}>
    {(breedsQuery.data || []).map((item) => <SettingsRow key={item.id} title={item.nome} meta={item.especie?.nome || "Espécie"} onEdit={canManage ? () => { setModal(item); setForm({ especieId: item.especieId || item.especie?.id || "", nome: item.nome }); setError(""); } : null} />)}
    {!breedsQuery.isLoading && (breedsQuery.data || []).length === 0 ? <MiniEmpty text="Nenhuma raça cadastrada para este filtro." /> : null}
    <Modal open={Boolean(modal)} title={modal?.id ? "Editar raça" : "Nova raça"} onClose={() => setModal(null)} footer={<><button className="ghost-button" onClick={() => setModal(null)}>Cancelar</button><button className="primary-button" onClick={() => mutation.mutate()} disabled={!form.nome.trim() || !form.especieId || mutation.isPending}>{mutation.isPending ? "Salvando..." : "Salvar"}</button></>}>
      <InlineNotice tone="error">{error}</InlineNotice><div className="form-grid form-grid--2"><FormField label="Espécie"><select className="form-control" value={form.especieId} disabled={Boolean(modal?.id)} onChange={(e) => setForm({ ...form, especieId: e.target.value })}>{(speciesQuery.data || []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></FormField><FormField label="Nome da raça"><input className="form-control" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></FormField></div>
    </Modal>
  </SettingsList>;
}

function CategoriesSettings({ canManage }) {
  const qc = useQueryClient();
  const [type, setType] = useState("PRODUTO");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ tipo: "PRODUTO", nome: "", descricao: "", parentId: "", ordem: 0 });
  const [error, setError] = useState("");
  const query = useQuery({ queryKey: ["categories", type], queryFn: async () => (await api.get("/catalogo/categorias", { params: { tipo: type } })).data.dados || [] });
  const categories = query.data || [];
  const mutation = useMutation({
    mutationFn: async () => modal?.id ? api.patch(`/catalogo/categorias/${modal.id}`, { nome: form.nome, descricao: form.descricao || null, parentId: form.parentId || null, ordem: Number(form.ordem) || 0 }) : api.post("/catalogo/categorias", { ...form, tipo: type, parentId: form.parentId || null, ordem: Number(form.ordem) || 0 }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["categories"] }); setModal(null); setError(""); },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  return <SettingsList title="Categorias do catálogo" description="Separe produtos e serviços por categorias criadas pela própria organização." icon={Tags} actionLabel="Nova categoria" canManage={canManage} onAdd={() => { setModal({}); setForm({ tipo: type, nome: "", descricao: "", parentId: "", ordem: 0 }); setError(""); }} extra={<div className="segmented"><button className={type === "PRODUTO" ? "is-active" : ""} onClick={() => setType("PRODUTO")}>Produtos</button><button className={type === "SERVICO" ? "is-active" : ""} onClick={() => setType("SERVICO")}>Serviços</button></div>}>
    {categories.map((item) => <SettingsRow key={item.id} title={item.nome} meta={`${item.pai ? `Subcategoria de ${item.pai.nome}` : type === "PRODUTO" ? "Produto" : "Serviço"} · ${item._count?.itens ?? 0} item(ns)`} onEdit={canManage ? () => { setModal(item); setForm({ tipo: item.tipo, nome: item.nome, descricao: item.descricao || "", parentId: item.parentId || item.pai?.id || "", ordem: item.ordem || 0 }); setError(""); } : null} />)}
    {!query.isLoading && categories.length === 0 ? <MiniEmpty text={`Nenhuma categoria de ${type === "PRODUTO" ? "produto" : "serviço"} cadastrada.`} /> : null}
    <Modal open={Boolean(modal)} title={modal?.id ? "Editar categoria" : "Nova categoria"} onClose={() => setModal(null)} footer={<><button className="ghost-button" onClick={() => setModal(null)}>Cancelar</button><button className="primary-button" onClick={() => mutation.mutate()} disabled={!form.nome.trim() || mutation.isPending}>{mutation.isPending ? "Salvando..." : "Salvar"}</button></>}>
      <InlineNotice tone="error">{error}</InlineNotice><div className="form-stack"><div className="form-grid form-grid--2"><FormField label="Tipo"><select className="form-control" value={type} disabled><option value="PRODUTO">Produto</option><option value="SERVICO">Serviço</option></select></FormField><FormField label="Ordem"><input className="form-control" type="number" min="0" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} /></FormField><FormField label="Nome" className="form-field--wide"><input className="form-control" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></FormField><FormField label="Categoria pai" className="form-field--wide"><select className="form-control" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}><option value="">Sem categoria pai</option>{categories.filter((c) => c.id !== modal?.id).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></FormField></div><FormField label="Descrição"><textarea className="form-control form-control--textarea" rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></FormField></div>
    </Modal>
  </SettingsList>;
}

function ModulesSettings({ canManage, organizationId, onModulesChanged }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["organization-modules"], queryFn: async () => (await api.get("/organizacao/modulos")).data.dados || [] });
  const mutation = useMutation({
    mutationFn: async ({ modulo, habilitado }) => api.patch(`/organizacao/modulos/${modulo}`, { habilitado }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["organization-modules"] });
      const fresh = (await api.get("/organizacao/modulos")).data.dados || [];
      onModulesChanged?.(organizationId, fresh.filter((item) => item.habilitado).map((item) => item.modulo));
    },
  });
  return <section className="panel settings-section"><div className="panel__heading"><div><span>Recursos</span><h2>Módulos habilitados</h2></div></div><div className="module-grid">{(query.data || []).map((item) => <label className="module-toggle" key={item.modulo}><div><strong>{moduleLabels[item.modulo] || item.modulo}</strong><span>{item.habilitado ? "Disponível para a organização" : "Módulo desativado"}</span></div><input type="checkbox" checked={item.habilitado} disabled={!canManage || mutation.isPending} onChange={(e) => mutation.mutate({ modulo: item.modulo, habilitado: e.target.checked })} /></label>)}</div></section>;
}

function SettingsList({ title, description, icon: Icon, actionLabel, canManage, onAdd, extra, children }) {
  return <section className="panel settings-section"><div className="settings-section__top"><div className="settings-section__title"><span className="settings-section__icon"><Icon size={18} /></span><div><h2>{title}</h2><p>{description}</p></div></div><div className="settings-section__actions">{extra}{onAdd ? <button className="primary-button" type="button" onClick={onAdd} disabled={!canManage}><Plus size={16} /> {actionLabel}</button> : null}</div></div><div className="settings-list">{children}</div></section>;
}

function SettingsRow({ title, meta, onEdit }) {
  return <div className="settings-row"><div><strong>{title}</strong><span>{meta}</span></div>{onEdit ? <button className="icon-button" type="button" onClick={onEdit} title="Editar"><Edit3 size={15} /></button> : null}</div>;
}

function MiniEmpty({ text }) { return <div className="mini-empty">{text}</div>; }
