import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  Edit3,
  Eye,
  Gift,
  History,
  PackageOpen,
  Plus,
  Search,
  ShoppingBag,
  TicketCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import FormField from "../components/FormField.jsx";
import InlineNotice from "../components/InlineNotice.jsx";
import { formatCurrency, formatDate, formatDateTime } from "../lib/formatters.js";

const todayInput = () => new Date().toISOString().slice(0, 10);

const emptyModel = {
  nome: "",
  descricao: "",
  tipo: "FIXO",
  valorPacote: "",
  validadeDias: "30",
  inicioVigencia: "",
  fimVigencia: "",
  visivelPortal: false,
  ativo: true,
  itens: [],
};

const emptySale = {
  modo: "MODELO",
  modeloId: "",
  clienteId: "",
  petId: "",
  nome: "",
  valorPacote: "",
  inicioValidade: todayInput(),
  fimValidade: "",
  observacoes: "",
  itens: [],
};

const emptyConsume = {
  itemId: "",
  quantidade: "1",
  petId: "",
  observacao: "",
};

function n(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function dateInput(value) {
  return value ? String(value).slice(0, 10) : "";
}

function packageTypeLabel(type) {
  return {
    FIXO: "Fixo",
    TEMPORARIO: "Temporário",
    PERSONALIZADO: "Personalizado",
  }[type] || type || "—";
}

function statusLabel(status) {
  return {
    ATIVO: "Ativo",
    ESGOTADO: "Esgotado",
    EXPIRADO: "Expirado",
    CANCELADO: "Cancelado",
  }[status] || status || "—";
}

function statusTone(status) {
  if (status === "ATIVO") return "success";
  if (status === "EXPIRADO") return "warning";
  return "muted";
}

function normalizeModel(model) {
  if (!model) return { ...emptyModel, itens: [] };
  return {
    nome: model.nome || "",
    descricao: model.descricao || "",
    tipo: model.tipo || "FIXO",
    valorPacote: model.valorPacote ?? "",
    validadeDias: model.validadeDias ?? "",
    inicioVigencia: dateInput(model.inicioVigencia),
    fimVigencia: dateInput(model.fimVigencia),
    visivelPortal: Boolean(model.visivelPortal),
    ativo: model.ativo !== false,
    itens: (model.itens || []).map((item) => ({
      itemCatalogoId: item.itemCatalogoId || item.itemCatalogo?.id || "",
      quantidade: String(item.quantidade ?? 1),
    })),
  };
}

function totalNormal(model) {
  return (model?.itens || []).reduce(
    (sum, item) => sum + n(item.quantidade) * n(item.itemCatalogo?.precoVenda),
    0
  );
}

function packageProgress(pack) {
  const total = (pack?.itens || []).reduce((sum, item) => sum + n(item.quantidadeTotal), 0);
  const consumed = (pack?.itens || []).reduce((sum, item) => sum + n(item.quantidadeConsumida), 0);
  return {
    total,
    consumed,
    remaining: Math.max(0, total - consumed),
    percent: total > 0 ? Math.min(100, (consumed / total) * 100) : 0,
  };
}

function isExpiringSoon(pack) {
  if (pack.status !== "ATIVO" || !pack.fimValidade) return false;
  const end = new Date(pack.fimValidade).getTime();
  const now = Date.now();
  return end >= now && end <= now + 7 * 86400000;
}

function ItemEditor({ items, catalog, onChange }) {
  function update(index, field, value) {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function remove(index) {
    onChange(items.filter((_, i) => i !== index));
  }

  function add() {
    const firstAvailable = catalog.find(
      (item) => !items.some((current) => current.itemCatalogoId === item.id)
    );
    onChange([
      ...items,
      { itemCatalogoId: firstAvailable?.id || "", quantidade: "1" },
    ]);
  }

  const normalTotal = items.reduce((sum, item) => {
    const catalogItem = catalog.find((entry) => entry.id === item.itemCatalogoId);
    return sum + n(item.quantidade) * n(catalogItem?.precoVenda);
  }, 0);

  return (
    <div className="package-items-editor">
      <div className="package-items-editor__heading">
        <div>
          <strong>Itens e créditos</strong>
          <span>Defina quais produtos ou serviços fazem parte do pacote.</span>
        </div>
        <button className="ghost-button" type="button" onClick={add} disabled={!catalog.length}>
          <Plus size={14} /> Adicionar item
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mini-empty">Nenhum item adicionado ao pacote.</div>
      ) : (
        <div className="package-items-list">
          {items.map((item, index) => {
            const selected = catalog.find((entry) => entry.id === item.itemCatalogoId);
            return (
              <div className="package-item-edit-row" key={`${item.itemCatalogoId}-${index}`}>
                <select
                  className="form-control"
                  value={item.itemCatalogoId}
                  onChange={(event) => update(index, "itemCatalogoId", event.target.value)}
                >
                  <option value="">Selecione...</option>
                  {catalog.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.nome} · {entry.tipo === "PRODUTO" ? "Produto" : "Serviço"} · {formatCurrency(entry.precoVenda)}
                    </option>
                  ))}
                </select>
                <input
                  className="form-control"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={item.quantidade}
                  onChange={(event) => update(index, "quantidade", event.target.value)}
                  aria-label="Quantidade"
                />
                <span className="package-item-edit-row__subtotal">
                  {selected ? formatCurrency(n(selected.precoVenda) * n(item.quantidade)) : "—"}
                </span>
                <button className="icon-button table-action" type="button" onClick={() => remove(index)} title="Remover item">
                  <XCircle size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="package-normal-total">
        <span>Valor avulso dos itens</span>
        <strong>{formatCurrency(normalTotal)}</strong>
      </div>
    </div>
  );
}

export default function PackagesPage() {
  const { hasPermission, selectedCompany, selectedOrganization } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("CLIENTES");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState("TODOS");

  const [modelModal, setModelModal] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [modelForm, setModelForm] = useState(() => normalizeModel(null));
  const [modelError, setModelError] = useState("");

  const [saleModal, setSaleModal] = useState(false);
  const [saleForm, setSaleForm] = useState(() => ({ ...emptySale, itens: [] }));
  const [saleError, setSaleError] = useState("");

  const [detailModal, setDetailModal] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const [consumeModal, setConsumeModal] = useState(false);
  const [consumePackage, setConsumePackage] = useState(null);
  const [consumeForm, setConsumeForm] = useState(emptyConsume);
  const [consumeError, setConsumeError] = useState("");

  const canManage = hasPermission("pacotes.gerenciar");

  const modelsQuery = useQuery({
    queryKey: ["package-models", selectedCompany?.id],
    queryFn: async () => (await api.get("/pacotes/modelos")).data.dados || [],
  });

  const packagesQuery = useQuery({
    queryKey: ["client-packages", selectedCompany?.id],
    queryFn: async () => (await api.get("/pacotes/clientes")).data.dados || [],
  });

  const catalogQuery = useQuery({
    queryKey: ["package-catalog", selectedCompany?.id],
    queryFn: async () => (await api.get("/catalogo/itens", { params: { ativo: true } })).data.dados || [],
  });

  const clientsQuery = useQuery({
    queryKey: ["package-clients", selectedOrganization?.id],
    queryFn: async () => (await api.get("/clientes", { params: { limite: 100 } })).data.dados || [],
  });

  const detailQuery = useQuery({
    queryKey: ["client-package-detail", detailId],
    enabled: Boolean(detailId && detailModal),
    queryFn: async () => (await api.get(`/pacotes/clientes/${detailId}`)).data.pacote,
  });

  const models = modelsQuery.data || [];
  const clientPackages = packagesQuery.data || [];
  const catalog = catalogQuery.data || [];
  const clients = clientsQuery.data || [];

  const filteredModels = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    return models.filter((model) => {
      if (statusFilter === "ATIVOS" && !model.ativo) return false;
      if (statusFilter === "INATIVOS" && model.ativo) return false;
      return !needle || model.nome.toLowerCase().includes(needle) || (model.descricao || "").toLowerCase().includes(needle);
    });
  }, [models, deferredSearch, statusFilter]);

  const filteredClientPackages = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    return clientPackages.filter((pack) => {
      if (statusFilter !== "TODOS" && pack.status !== statusFilter) return false;
      if (!needle) return true;
      return [pack.nome, pack.cliente?.nome, pack.pet?.nome]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [clientPackages, deferredSearch, statusFilter]);

  const summary = useMemo(() => {
    const activeModels = models.filter((model) => model.ativo).length;
    const activePackages = clientPackages.filter((pack) => pack.status === "ATIVO");
    const credits = activePackages.reduce((sum, pack) => sum + packageProgress(pack).remaining, 0);
    const expiring = activePackages.filter(isExpiringSoon).length;
    return { activeModels, activePackages: activePackages.length, credits, expiring };
  }, [models, clientPackages]);

  const modelMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingModel?.id) return (await api.patch(`/pacotes/modelos/${editingModel.id}`, payload)).data;
      return (await api.post("/pacotes/modelos", payload)).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["package-models"] });
      closeModel();
    },
    onError: (error) => setModelError(getApiErrorMessage(error, "Não foi possível salvar o modelo.")),
  });

  const saleMutation = useMutation({
    mutationFn: async (payload) => (await api.post("/pacotes/clientes", payload)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["client-packages"] });
      setSaleModal(false);
      setSaleForm({ ...emptySale, itens: [] });
      setSaleError("");
    },
    onError: (error) => setSaleError(getApiErrorMessage(error, "Não foi possível criar o pacote do cliente.")),
  });

  const consumeMutation = useMutation({
    mutationFn: async (payload) =>
      (await api.post(`/pacotes/clientes/itens/${consumeForm.itemId}/consumir`, payload)).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["client-packages"] }),
        queryClient.invalidateQueries({ queryKey: ["client-package-detail"] }),
      ]);
      setConsumeModal(false);
      setConsumePackage(null);
      setConsumeForm(emptyConsume);
      setConsumeError("");
    },
    onError: (error) => setConsumeError(getApiErrorMessage(error, "Não foi possível consumir o crédito.")),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id) => (await api.post(`/pacotes/clientes/${id}/cancelar`)).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["client-packages"] }),
        queryClient.invalidateQueries({ queryKey: ["client-package-detail"] }),
      ]);
      setDetailModal(false);
      setDetailId(null);
    },
  });

  function switchTab(next) {
    setTab(next);
    setSearch("");
    setStatusFilter("TODOS");
  }

  function openModel(model = null) {
    setEditingModel(model);
    setModelForm(normalizeModel(model));
    setModelError("");
    setModelModal(true);
  }

  function closeModel() {
    if (modelMutation.isPending) return;
    setModelModal(false);
    setEditingModel(null);
    setModelForm(normalizeModel(null));
    setModelError("");
  }

  function submitModel(event) {
    event.preventDefault();
    setModelError("");
    if (!modelForm.nome.trim()) return setModelError("Informe o nome do pacote.");
    if (n(modelForm.valorPacote) <= 0) return setModelError("Informe um valor de pacote maior que zero.");
    if (!modelForm.itens.length || modelForm.itens.some((item) => !item.itemCatalogoId || n(item.quantidade) <= 0)) {
      return setModelError("Adicione pelo menos um item válido ao pacote.");
    }

    modelMutation.mutate({
      nome: modelForm.nome.trim(),
      descricao: modelForm.descricao || null,
      tipo: modelForm.tipo,
      valorPacote: n(modelForm.valorPacote),
      validadeDias: modelForm.validadeDias === "" ? null : Number(modelForm.validadeDias),
      inicioVigencia: modelForm.inicioVigencia || null,
      fimVigencia: modelForm.fimVigencia || null,
      visivelPortal: Boolean(modelForm.visivelPortal),
      ativo: Boolean(modelForm.ativo),
      itens: modelForm.itens.map((item) => ({
        itemCatalogoId: item.itemCatalogoId,
        quantidade: n(item.quantidade),
      })),
    });
  }

  function openSale() {
    const firstModel = models.find((model) => model.ativo);
    setSaleForm({
      ...emptySale,
      modo: firstModel ? "MODELO" : "PERSONALIZADO",
      modeloId: firstModel?.id || "",
      valorPacote: firstModel?.valorPacote ? String(firstModel.valorPacote) : "",
      inicioValidade: todayInput(),
      itens: [],
    });
    setSaleError("");
    setSaleModal(true);
  }

  function updateSale(name, value) {
    setSaleForm((current) => ({ ...current, [name]: value }));
  }

  function selectModelForSale(modelId) {
    const model = models.find((item) => item.id === modelId);
    setSaleForm((current) => ({
      ...current,
      modeloId,
      nome: "",
      valorPacote: model?.valorPacote ? String(model.valorPacote) : "",
      fimValidade: "",
    }));
  }

  const saleClient = clients.find((client) => client.id === saleForm.clienteId);
  const salePets = saleClient?.pets || [];

  function submitSale(event) {
    event.preventDefault();
    setSaleError("");
    if (!saleForm.clienteId) return setSaleError("Selecione o cliente.");
    if (!saleForm.inicioValidade) return setSaleError("Informe a data inicial.");

    if (saleForm.modo === "MODELO") {
      if (!saleForm.modeloId) return setSaleError("Selecione um modelo de pacote.");
      saleMutation.mutate({
        modeloId: saleForm.modeloId,
        clienteId: saleForm.clienteId,
        petId: saleForm.petId || null,
        valorPacote: saleForm.valorPacote ? n(saleForm.valorPacote) : undefined,
        inicioValidade: saleForm.inicioValidade,
        fimValidade: saleForm.fimValidade || null,
        observacoes: saleForm.observacoes || null,
      });
      return;
    }

    if (!saleForm.nome.trim()) return setSaleError("Informe o nome do pacote personalizado.");
    if (n(saleForm.valorPacote) <= 0) return setSaleError("Informe o valor do pacote.");
    if (!saleForm.itens.length || saleForm.itens.some((item) => !item.itemCatalogoId || n(item.quantidade) <= 0)) {
      return setSaleError("Adicione pelo menos um item válido ao pacote personalizado.");
    }

    saleMutation.mutate({
      clienteId: saleForm.clienteId,
      petId: saleForm.petId || null,
      nome: saleForm.nome.trim(),
      valorPacote: n(saleForm.valorPacote),
      inicioValidade: saleForm.inicioValidade,
      fimValidade: saleForm.fimValidade || null,
      observacoes: saleForm.observacoes || null,
      itens: saleForm.itens.map((item) => ({
        itemCatalogoId: item.itemCatalogoId,
        quantidade: n(item.quantidade),
      })),
    });
  }

  function openDetail(pack) {
    setDetailId(pack.id);
    setDetailModal(true);
  }

  function openConsume(pack) {
    const firstWithBalance = (pack.itens || []).find(
      (item) => n(item.quantidadeConsumida) < n(item.quantidadeTotal)
    );
    setConsumePackage(pack);
    setConsumeForm({
      itemId: firstWithBalance?.id || "",
      quantidade: "1",
      petId: pack.pet?.id || "",
      observacao: "",
    });
    setConsumeError("");
    setConsumeModal(true);
  }

  const consumeClient = clients.find((client) => client.id === consumePackage?.cliente?.id);
  const consumePets = consumeClient?.pets || [];
  const consumeItem = consumePackage?.itens?.find((item) => item.id === consumeForm.itemId);
  const consumeRemaining = consumeItem
    ? Math.max(0, n(consumeItem.quantidadeTotal) - n(consumeItem.quantidadeConsumida))
    : 0;

  function submitConsume(event) {
    event.preventDefault();
    setConsumeError("");
    if (!consumeForm.itemId) return setConsumeError("Selecione o item do pacote.");
    if (n(consumeForm.quantidade) <= 0) return setConsumeError("Informe uma quantidade válida.");
    if (n(consumeForm.quantidade) > consumeRemaining) return setConsumeError("A quantidade é maior que o saldo disponível.");

    consumeMutation.mutate({
      quantidade: n(consumeForm.quantidade),
      petId: consumeForm.petId || null,
      origemTipo: "PAINEL_ADMIN",
      observacao: consumeForm.observacao || null,
    });
  }

  const detail = detailQuery.data;
  const selectedSaleModel = models.find((model) => model.id === saleForm.modeloId);
  const selectedSaleNormalTotal = selectedSaleModel ? totalNormal(selectedSaleModel) : 0;

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="page-kicker">Créditos e recorrência</span>
          <h1>Pacotes</h1>
          <p>Crie modelos, venda pacotes personalizados e acompanhe cada crédito consumido.</p>
        </div>
        <div className="page-heading-actions">
          {tab === "MODELOS" ? (
            <button className="primary-button" type="button" onClick={() => openModel()} disabled={!canManage}>
              <Plus size={18} /> Novo modelo
            </button>
          ) : (
            <button className="primary-button" type="button" onClick={openSale} disabled={!canManage}>
              <Plus size={18} /> Novo pacote de cliente
            </button>
          )}
        </div>
      </section>

      <section className="package-summary-grid">
        <article className="package-summary-card">
          <span><PackageOpen size={18} /></span>
          <div><small>Modelos ativos</small><strong>{summary.activeModels}</strong><em>disponíveis para venda</em></div>
        </article>
        <article className="package-summary-card">
          <span><TicketCheck size={18} /></span>
          <div><small>Pacotes ativos</small><strong>{summary.activePackages}</strong><em>em uso por clientes</em></div>
        </article>
        <article className="package-summary-card">
          <span><Gift size={18} /></span>
          <div><small>Créditos disponíveis</small><strong>{summary.credits.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</strong><em>saldo total ativo</em></div>
        </article>
        <article className="package-summary-card">
          <span><CalendarDays size={18} /></span>
          <div><small>Vencem em 7 dias</small><strong>{summary.expiring}</strong><em>pacotes para acompanhar</em></div>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="package-toolbar">
          <div className="segmented package-view-toggle">
            <button type="button" className={tab === "CLIENTES" ? "is-active" : ""} onClick={() => switchTab("CLIENTES")}>
              <TicketCheck size={14} /> Pacotes de clientes
            </button>
            <button type="button" className={tab === "MODELOS" ? "is-active" : ""} onClick={() => switchTab("MODELOS")}>
              <PackageOpen size={14} /> Modelos
            </button>
          </div>

          <label className="search-box package-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tab === "MODELOS" ? "Buscar modelo..." : "Buscar pacote, cliente ou pet..."}
            />
          </label>

          <select className="compact-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="TODOS">Todos</option>
            {tab === "MODELOS" ? (
              <>
                <option value="ATIVOS">Ativos</option>
                <option value="INATIVOS">Inativos</option>
              </>
            ) : (
              <>
                <option value="ATIVO">Ativos</option>
                <option value="ESGOTADO">Esgotados</option>
                <option value="EXPIRADO">Expirados</option>
                <option value="CANCELADO">Cancelados</option>
              </>
            )}
          </select>
        </div>

        {tab === "MODELOS" ? (
          modelsQuery.isLoading ? (
            <div className="loading-state">Carregando modelos...</div>
          ) : filteredModels.length === 0 ? (
            <div className="empty-state">
              <PackageOpen size={30} />
              <strong>Nenhum modelo encontrado</strong>
              <p>Crie um pacote reutilizável para agilizar as vendas.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="package-table">
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Itens</th>
                    <th>Valor avulso</th>
                    <th>Pacote</th>
                    <th>Economia</th>
                    <th>Validade</th>
                    <th>Uso</th>
                    <th>Status</th>
                    <th className="table-actions-col">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModels.map((model) => {
                    const normal = totalNormal(model);
                    const saving = Math.max(0, normal - n(model.valorPacote));
                    return (
                      <tr key={model.id}>
                        <td>
                          <div className="catalog-item-cell">
                            <span className="catalog-item-icon"><PackageOpen size={16} /></span>
                            <div>
                              <strong>{model.nome}</strong>
                              <small>{packageTypeLabel(model.tipo)} {model.visivelPortal ? "· Portal" : ""}</small>
                            </div>
                          </div>
                        </td>
                        <td><span className="mini-label">{model.itens?.length || 0} itens</span></td>
                        <td>{formatCurrency(normal)}</td>
                        <td><strong className="table-main-text">{formatCurrency(model.valorPacote)}</strong></td>
                        <td>{saving > 0 ? <span className="package-saving">{formatCurrency(saving)}</span> : "—"}</td>
                        <td>{model.validadeDias ? `${model.validadeDias} dias` : "Sem prazo padrão"}</td>
                        <td>{model._count?.compras || 0} vendidos</td>
                        <td><span className={`badge ${model.ativo ? "badge--success" : "badge--muted"}`}>{model.ativo ? "Ativo" : "Inativo"}</span></td>
                        <td className="table-actions-col">
                          <div className="table-actions">
                            <button className="icon-button table-action" type="button" onClick={() => openModel(model)} disabled={!canManage} title="Editar">
                              <Edit3 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : packagesQuery.isLoading ? (
          <div className="loading-state">Carregando pacotes dos clientes...</div>
        ) : filteredClientPackages.length === 0 ? (
          <div className="empty-state">
            <TicketCheck size={30} />
            <strong>Nenhum pacote encontrado</strong>
            <p>Crie o primeiro pacote para um cliente ou altere os filtros.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="package-table package-table--clients">
              <thead>
                <tr>
                  <th>Cliente / Pet</th>
                  <th>Pacote</th>
                  <th>Validade</th>
                  <th>Créditos</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th className="table-actions-col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredClientPackages.map((pack) => {
                  const progress = packageProgress(pack);
                  return (
                    <tr key={pack.id}>
                      <td>
                        <div className="person-cell">
                          <span className="avatar-soft">{pack.cliente?.nome?.slice(0, 1).toUpperCase()}</span>
                          <div>
                            <strong>{pack.cliente?.nome}</strong>
                            <small>{pack.pet?.nome ? `Pet: ${pack.pet.nome}` : "Todos os pets do cliente"}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong className="table-main-text">{pack.nome}</strong>
                        <div className="table-subtext">{packageTypeLabel(pack.tipo)}</div>
                      </td>
                      <td>
                        <strong className="table-main-text">{formatDate(pack.inicioValidade)}</strong>
                        <div className="table-subtext">até {pack.fimValidade ? formatDate(pack.fimValidade) : "sem vencimento"}</div>
                      </td>
                      <td>
                        <div className="package-credit-cell">
                          <div><span>{progress.remaining.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} restantes</span><small>{progress.consumed.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}/{progress.total.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} usados</small></div>
                          <span className="package-progress"><i style={{ width: `${progress.percent}%` }} /></span>
                        </div>
                      </td>
                      <td>{formatCurrency(pack.valorPacote)}</td>
                      <td><span className={`badge badge--${statusTone(pack.status)}`}>{statusLabel(pack.status)}</span></td>
                      <td className="table-actions-col">
                        <div className="table-actions">
                          <button className="icon-button table-action" type="button" onClick={() => openDetail(pack)} title="Detalhes">
                            <Eye size={15} />
                          </button>
                          <button className="icon-button table-action" type="button" onClick={() => openConsume(pack)} disabled={!canManage || pack.status !== "ATIVO" || progress.remaining <= 0} title="Consumir crédito">
                            <CheckCircle2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={modelModal}
        onClose={closeModel}
        title={editingModel ? "Editar modelo de pacote" : "Novo modelo de pacote"}
        subtitle="Modelos podem ser reutilizados para vários clientes deste CNPJ."
        size="lg"
        footer={
          <>
            <button className="ghost-button" type="button" onClick={closeModel}>Cancelar</button>
            <button className="primary-button" type="submit" form="package-model-form" disabled={modelMutation.isPending}>
              {modelMutation.isPending ? "Salvando..." : "Salvar modelo"}
            </button>
          </>
        }
      >
        <form id="package-model-form" className="form-stack" onSubmit={submitModel}>
          <InlineNotice tone="error">{modelError}</InlineNotice>
          <div className="form-section">
            <div className="form-section__heading"><strong>Identificação</strong><span>Nome, tipo e disponibilidade do pacote.</span></div>
            <div className="form-grid form-grid--2">
              <FormField label="Nome" className="form-field--wide">
                <input className="form-control" value={modelForm.nome} onChange={(e) => setModelForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Pacote Mensal 4 Banhos" />
              </FormField>
              <FormField label="Tipo">
                <select className="form-control" value={modelForm.tipo} onChange={(e) => setModelForm((f) => ({ ...f, tipo: e.target.value }))}>
                  <option value="FIXO">Fixo</option>
                  <option value="TEMPORARIO">Temporário</option>
                </select>
              </FormField>
              <FormField label="Valor do pacote">
                <input className="form-control" type="number" min="0.01" step="0.01" value={modelForm.valorPacote} onChange={(e) => setModelForm((f) => ({ ...f, valorPacote: e.target.value }))} />
              </FormField>
              <FormField label="Descrição" className="form-field--wide">
                <textarea className="form-control form-control--textarea" value={modelForm.descricao} onChange={(e) => setModelForm((f) => ({ ...f, descricao: e.target.value }))} />
              </FormField>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section__heading"><strong>Vigência e validade</strong><span>Controle quando o modelo pode ser vendido e por quanto tempo o cliente poderá utilizar os créditos.</span></div>
            <div className="form-grid form-grid--3">
              <FormField label="Validade após compra" hint="Quantidade de dias. Deixe vazio para não calcular vencimento automaticamente.">
                <input className="form-control" type="number" min="1" value={modelForm.validadeDias} onChange={(e) => setModelForm((f) => ({ ...f, validadeDias: e.target.value }))} />
              </FormField>
              <FormField label="Início da oferta">
                <input className="form-control" type="date" value={modelForm.inicioVigencia} onChange={(e) => setModelForm((f) => ({ ...f, inicioVigencia: e.target.value }))} />
              </FormField>
              <FormField label="Fim da oferta">
                <input className="form-control" type="date" value={modelForm.fimVigencia} onChange={(e) => setModelForm((f) => ({ ...f, fimVigencia: e.target.value }))} />
              </FormField>
            </div>
            <div className="toggle-grid">
              <label className="check-card">
                <input type="checkbox" checked={modelForm.visivelPortal} onChange={(e) => setModelForm((f) => ({ ...f, visivelPortal: e.target.checked }))} />
                <span><strong>Visível no portal</strong><small>Prepara o pacote para futura contratação pelo cliente.</small></span>
              </label>
              <label className="check-card">
                <input type="checkbox" checked={modelForm.ativo} onChange={(e) => setModelForm((f) => ({ ...f, ativo: e.target.checked }))} />
                <span><strong>Modelo ativo</strong><small>Permite novas vendas enquanto estiver ativo e vigente.</small></span>
              </label>
            </div>
          </div>

          <div className="form-section">
            <ItemEditor items={modelForm.itens} catalog={catalog} onChange={(itens) => setModelForm((f) => ({ ...f, itens }))} />
            {modelForm.itens.length > 0 ? (
              <div className="package-price-comparison">
                <div><span>Valor avulso</span><strong>{formatCurrency(modelForm.itens.reduce((sum, item) => sum + n(item.quantidade) * n(catalog.find((entry) => entry.id === item.itemCatalogoId)?.precoVenda), 0))}</strong></div>
                <div><span>Valor do pacote</span><strong>{formatCurrency(modelForm.valorPacote)}</strong></div>
                <div><span>Economia do cliente</span><strong className="package-saving">{formatCurrency(Math.max(0, modelForm.itens.reduce((sum, item) => sum + n(item.quantidade) * n(catalog.find((entry) => entry.id === item.itemCatalogoId)?.precoVenda), 0) - n(modelForm.valorPacote)))}</strong></div>
              </div>
            ) : null}
          </div>
        </form>
      </Modal>

      <Modal
        open={saleModal}
        onClose={() => !saleMutation.isPending && setSaleModal(false)}
        title="Novo pacote de cliente"
        subtitle="Use um modelo existente ou monte um pacote exclusivo para este cliente."
        size="lg"
        footer={
          <>
            <button className="ghost-button" type="button" onClick={() => setSaleModal(false)}>Cancelar</button>
            <button className="primary-button" type="submit" form="package-sale-form" disabled={saleMutation.isPending}>
              {saleMutation.isPending ? "Criando..." : "Criar pacote"}
            </button>
          </>
        }
      >
        <form id="package-sale-form" className="form-stack" onSubmit={submitSale}>
          <InlineNotice tone="error">{saleError}</InlineNotice>

          <div className="segmented package-mode-toggle">
            <button type="button" className={saleForm.modo === "MODELO" ? "is-active" : ""} onClick={() => setSaleForm((f) => ({ ...f, modo: "MODELO", itens: [] }))}>Usar modelo</button>
            <button type="button" className={saleForm.modo === "PERSONALIZADO" ? "is-active" : ""} onClick={() => setSaleForm((f) => ({ ...f, modo: "PERSONALIZADO", modeloId: "", nome: "", valorPacote: "", itens: [] }))}>Personalizado</button>
          </div>

          <div className="form-section">
            <div className="form-section__heading"><strong>Cliente e pet</strong><span>O pet pode ficar em branco quando o pacote puder ser usado em qualquer pet do tutor.</span></div>
            <div className="form-grid form-grid--2">
              <FormField label="Cliente">
                <select className="form-control" value={saleForm.clienteId} onChange={(e) => setSaleForm((f) => ({ ...f, clienteId: e.target.value, petId: "" }))}>
                  <option value="">Selecione...</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.nome}</option>)}
                </select>
              </FormField>
              <FormField label="Pet" hint="Opcional">
                <select className="form-control" value={saleForm.petId} onChange={(e) => updateSale("petId", e.target.value)} disabled={!saleForm.clienteId}>
                  <option value="">Qualquer pet do cliente</option>
                  {salePets.map((pet) => <option key={pet.id} value={pet.id}>{pet.nome}</option>)}
                </select>
              </FormField>
            </div>
          </div>

          {saleForm.modo === "MODELO" ? (
            <div className="form-section">
              <div className="form-section__heading"><strong>Modelo</strong><span>Os créditos serão copiados do modelo escolhido.</span></div>
              <FormField label="Modelo de pacote">
                <select className="form-control" value={saleForm.modeloId} onChange={(e) => selectModelForSale(e.target.value)}>
                  <option value="">Selecione...</option>
                  {models.filter((model) => model.ativo).map((model) => (
                    <option key={model.id} value={model.id}>{model.nome} · {formatCurrency(model.valorPacote)}</option>
                  ))}
                </select>
              </FormField>
              {selectedSaleModel ? (
                <div className="package-model-preview">
                  <div className="package-model-preview__head">
                    <div><strong>{selectedSaleModel.nome}</strong><span>{selectedSaleModel.itens?.length || 0} itens · {selectedSaleModel.validadeDias ? `${selectedSaleModel.validadeDias} dias de validade` : "sem vencimento automático"}</span></div>
                    <div><small>Economia</small><strong>{formatCurrency(Math.max(0, selectedSaleNormalTotal - n(saleForm.valorPacote)))}</strong></div>
                  </div>
                  <div className="package-model-preview__items">
                    {(selectedSaleModel.itens || []).map((item) => <span key={item.id}>{n(item.quantidade)}× {item.itemCatalogo?.nome}</span>)}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="form-section">
              <div className="form-section__heading"><strong>Pacote personalizado</strong><span>Este pacote existirá apenas para o cliente selecionado.</span></div>
              <div className="form-grid form-grid--2">
                <FormField label="Nome">
                  <input className="form-control" value={saleForm.nome} onChange={(e) => updateSale("nome", e.target.value)} placeholder="Ex.: Pacote especial do Thor" />
                </FormField>
                <FormField label="Valor">
                  <input className="form-control" type="number" min="0.01" step="0.01" value={saleForm.valorPacote} onChange={(e) => updateSale("valorPacote", e.target.value)} />
                </FormField>
              </div>
              <ItemEditor items={saleForm.itens} catalog={catalog} onChange={(itens) => updateSale("itens", itens)} />
            </div>
          )}

          <div className="form-section">
            <div className="form-section__heading"><strong>Validade e condições</strong><span>O pagamento será integrado ao PDV em uma fase posterior; aqui criamos o contrato de créditos.</span></div>
            <div className="form-grid form-grid--3">
              <FormField label="Início da validade">
                <input className="form-control" type="date" value={saleForm.inicioValidade} onChange={(e) => updateSale("inicioValidade", e.target.value)} />
              </FormField>
              <FormField label="Fim da validade" hint="Opcional; modelos podem calcular automaticamente.">
                <input className="form-control" type="date" value={saleForm.fimValidade} onChange={(e) => updateSale("fimValidade", e.target.value)} />
              </FormField>
              <FormField label="Valor final">
                <input className="form-control" type="number" min="0.01" step="0.01" value={saleForm.valorPacote} onChange={(e) => updateSale("valorPacote", e.target.value)} />
              </FormField>
              <FormField label="Observações" className="form-field--wide">
                <textarea className="form-control form-control--textarea" value={saleForm.observacoes} onChange={(e) => updateSale("observacoes", e.target.value)} />
              </FormField>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={detailModal}
        onClose={() => { setDetailModal(false); setDetailId(null); }}
        title={detail?.nome || "Detalhes do pacote"}
        subtitle={detail ? `${detail.cliente?.nome}${detail.pet?.nome ? ` · ${detail.pet.nome}` : ""}` : "Carregando..."}
        size="lg"
        footer={detail?.status === "ATIVO" && canManage ? (
          <>
            <button
              className="ghost-button package-danger-button"
              type="button"
              onClick={() => {
                if (window.confirm("Cancelar este pacote? Os créditos restantes deixarão de ser utilizáveis.")) cancelMutation.mutate(detail.id);
              }}
              disabled={cancelMutation.isPending}
            >
              <XCircle size={15} /> Cancelar pacote
            </button>
            <button className="primary-button" type="button" onClick={() => { setDetailModal(false); openConsume(detail); }}>
              <CheckCircle2 size={15} /> Consumir crédito
            </button>
          </>
        ) : null}
      >
        {detailQuery.isLoading ? (
          <div className="loading-state">Carregando detalhes...</div>
        ) : detailQuery.isError ? (
          <InlineNotice tone="error">{getApiErrorMessage(detailQuery.error)}</InlineNotice>
        ) : detail ? (
          <div className="package-detail">
            <div className="package-detail__summary">
              <div><span>Status</span><strong><span className={`badge badge--${statusTone(detail.status)}`}>{statusLabel(detail.status)}</span></strong></div>
              <div><span>Valor</span><strong>{formatCurrency(detail.valorPacote)}</strong></div>
              <div><span>Início</span><strong>{formatDate(detail.inicioValidade)}</strong></div>
              <div><span>Vencimento</span><strong>{detail.fimValidade ? formatDate(detail.fimValidade) : "Sem vencimento"}</strong></div>
            </div>

            <div className="package-detail__section">
              <div className="form-section__heading"><strong>Créditos</strong><span>Saldo e consumo por produto ou serviço.</span></div>
              <div className="package-detail-items">
                {(detail.itens || []).map((item) => {
                  const total = n(item.quantidadeTotal);
                  const consumed = n(item.quantidadeConsumida);
                  const percent = total > 0 ? Math.min(100, consumed / total * 100) : 0;
                  return (
                    <article className="package-detail-item" key={item.id}>
                      <div className="package-detail-item__top">
                        <div><strong>{item.itemCatalogo?.nome}</strong><span>{item.itemCatalogo?.tipo === "PRODUTO" ? "Produto" : "Serviço"}</span></div>
                        <strong>{Math.max(0, total - consumed).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} restantes</strong>
                      </div>
                      <span className="package-progress package-progress--wide"><i style={{ width: `${percent}%` }} /></span>
                      <small>{consumed.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} consumidos de {total.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</small>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="package-detail__section">
              <div className="form-section__heading"><strong>Histórico de consumo</strong><span>Cada utilização fica registrada com data, pet e operador.</span></div>
              <div className="package-consumption-history">
                {(detail.itens || []).flatMap((item) => (item.consumos || []).map((consumo) => ({ ...consumo, itemName: item.itemCatalogo?.nome })))
                  .sort((a, b) => new Date(b.consumidoEm) - new Date(a.consumidoEm))
                  .map((consumo) => (
                    <div className="package-consumption-row" key={consumo.id}>
                      <span><History size={14} /></span>
                      <div><strong>{consumo.itemName}</strong><small>{consumo.pet?.nome || "Pet não informado"} · {consumo.usuario?.nome || "Sistema"}</small></div>
                      <div><strong>-{n(consumo.quantidade).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</strong><small>{formatDateTime(consumo.consumidoEm)}</small></div>
                    </div>
                  ))}
                {!detail.itens?.some((item) => item.consumos?.length) ? <div className="mini-empty">Nenhum crédito consumido ainda.</div> : null}
              </div>
            </div>

            {detail.observacoes ? <InlineNotice tone="info">{detail.observacoes}</InlineNotice> : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={consumeModal}
        onClose={() => !consumeMutation.isPending && setConsumeModal(false)}
        title="Consumir crédito"
        subtitle={consumePackage ? `${consumePackage.nome} · ${consumePackage.cliente?.nome}` : ""}
        footer={
          <>
            <button className="ghost-button" type="button" onClick={() => setConsumeModal(false)}>Cancelar</button>
            <button className="primary-button" type="submit" form="package-consume-form" disabled={consumeMutation.isPending}>
              {consumeMutation.isPending ? "Registrando..." : "Confirmar consumo"}
            </button>
          </>
        }
      >
        <form id="package-consume-form" className="form-stack" onSubmit={submitConsume}>
          <InlineNotice tone="error">{consumeError}</InlineNotice>
          <FormField label="Crédito / Item">
            <select className="form-control" value={consumeForm.itemId} onChange={(e) => setConsumeForm((f) => ({ ...f, itemId: e.target.value, quantidade: "1" }))}>
              <option value="">Selecione...</option>
              {(consumePackage?.itens || []).map((item) => {
                const remaining = Math.max(0, n(item.quantidadeTotal) - n(item.quantidadeConsumida));
                return <option key={item.id} value={item.id} disabled={remaining <= 0}>{item.itemCatalogo?.nome} · saldo {remaining.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</option>;
              })}
            </select>
          </FormField>
          <div className="form-grid form-grid--2">
            <FormField label="Quantidade" hint={`Saldo disponível: ${consumeRemaining.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`}>
              <input className="form-control" type="number" min="0.001" max={consumeRemaining || undefined} step="0.001" value={consumeForm.quantidade} onChange={(e) => setConsumeForm((f) => ({ ...f, quantidade: e.target.value }))} />
            </FormField>
            <FormField label="Pet">
              <select className="form-control" value={consumeForm.petId} onChange={(e) => setConsumeForm((f) => ({ ...f, petId: e.target.value }))}>
                <option value="">Não informar</option>
                {consumePets.map((pet) => <option key={pet.id} value={pet.id}>{pet.nome}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label="Observação">
            <textarea className="form-control form-control--textarea" value={consumeForm.observacao} onChange={(e) => setConsumeForm((f) => ({ ...f, observacao: e.target.value }))} placeholder="Ex.: Banho utilizado no atendimento de hoje." />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
