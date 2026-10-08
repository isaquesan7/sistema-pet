import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  Edit3,
  Package,
  Plus,
  Search,
  Stethoscope,
  TrendingUp,
} from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import FormField from "../components/FormField.jsx";
import InlineNotice from "../components/InlineNotice.jsx";
import {
  formatCurrency,
  formatDateTime,
  formatPercent,
} from "../lib/formatters.js";

const unitOptions = [
  ["UNIDADE", "Unidade"],
  ["QUILOGRAMA", "Quilograma (kg)"],
  ["GRAMA", "Grama (g)"],
  ["LITRO", "Litro (L)"],
  ["MILILITRO", "Mililitro (mL)"],
  ["PACOTE", "Pacote"],
  ["CAIXA", "Caixa"],
];

const emptyForm = {
  tipo: "PRODUTO",
  categoriaId: "",
  nome: "",
  descricao: "",
  codigoInterno: "",
  codigoBarras: "",
  custoReferencia: "0.00",
  precoVenda: "0.00",
  markupPercentual: "0.00",
  ativo: true,
  produto: {
    unidade: "UNIDADE",
    marca: "",
    estoqueMinimo: "0",
    controlaEstoque: true,
    controlaLote: false,
    controlaValidade: false,
  },
  servico: {
    duracaoMinutos: "",
    geraComissao: false,
    percentualComissao: "",
    permiteAgendamento: true,
    exigePet: true,
    exigeProfissional: false,
  },
};

function n(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function calculateFromPrice(costValue, priceValue) {
  const custo = n(costValue);
  const preco = n(priceValue);
  const lucro = preco - custo;
  return {
    custo,
    preco,
    lucro: round(lucro),
    markup: custo > 0 ? round((lucro / custo) * 100, 4) : 0,
    margem: preco > 0 ? round((lucro / preco) * 100, 4) : 0,
  };
}

function calculateFromMarkup(costValue, markupValue) {
  const custo = n(costValue);
  const markup = n(markupValue);
  const preco = custo * (1 + markup / 100);
  return calculateFromPrice(custo, round(preco));
}

function normalizeItem(item) {
  if (!item) return { ...emptyForm, produto: { ...emptyForm.produto }, servico: { ...emptyForm.servico } };
  return {
    tipo: item.tipo || "PRODUTO",
    categoriaId: item.categoriaId || "",
    nome: item.nome || "",
    descricao: item.descricao || "",
    codigoInterno: item.codigoInterno || "",
    codigoBarras: item.codigoBarras || "",
    custoReferencia: String(item.custoReferencia ?? 0),
    precoVenda: String(item.precoVenda ?? 0),
    markupPercentual: String(item.markupPercentual ?? 0),
    ativo: item.ativo !== false,
    produto: {
      unidade: item.produto?.unidade || "UNIDADE",
      marca: item.produto?.marca || "",
      estoqueMinimo: String(item.produto?.estoqueMinimo ?? 0),
      controlaEstoque: item.produto?.controlaEstoque ?? true,
      controlaLote: item.produto?.controlaLote ?? false,
      controlaValidade: item.produto?.controlaValidade ?? false,
    },
    servico: {
      duracaoMinutos: item.servico?.duracaoMinutos ? String(item.servico.duracaoMinutos) : "",
      geraComissao: item.servico?.geraComissao ?? false,
      percentualComissao: item.servico?.percentualComissao !== null && item.servico?.percentualComissao !== undefined
        ? String(item.servico.percentualComissao)
        : "",
      permiteAgendamento: item.servico?.permiteAgendamento ?? true,
      exigePet: item.servico?.exigePet ?? true,
      exigeProfissional: item.servico?.exigeProfissional ?? false,
    },
  };
}

async function loadItems({ type, search, active }) {
  const { data } = await api.get("/catalogo/itens", {
    params: {
      tipo: type,
      busca: search || undefined,
      ativo: active === "TODOS" ? undefined : active === "ATIVOS",
    },
  });
  return data.dados || [];
}

async function loadCategories(type) {
  const { data } = await api.get("/catalogo/categorias", { params: { tipo: type } });
  return data.dados || [];
}

export default function CatalogPage() {
  const { hasPermission, selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  const [type, setType] = useState("PRODUTO");
  const [statusFilter, setStatusFilter] = useState("ATIVOS");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState(() => normalizeItem(null));
  const [pricingBasis, setPricingBasis] = useState("price");
  const [formError, setFormError] = useState("");

  const itemsQuery = useQuery({
    queryKey: ["catalog-items", selectedCompany?.id, type, deferredSearch, statusFilter],
    queryFn: () => loadItems({ type, search: deferredSearch, active: statusFilter }),
  });

  const categoryType = modalOpen ? form.tipo : type;
  const categoriesQuery = useQuery({
    queryKey: ["categories", categoryType],
    queryFn: () => loadCategories(categoryType),
  });

  const canManage = hasPermission("catalogo.gerenciar");
  const items = itemsQuery.data || [];
  const categories = categoriesQuery.data || [];

  const pricing = useMemo(
    () => pricingBasis === "markup"
      ? calculateFromMarkup(form.custoReferencia, form.markupPercentual)
      : calculateFromPrice(form.custoReferencia, form.precoVenda),
    [form.custoReferencia, form.precoVenda, form.markupPercentual, pricingBasis]
  );

  const summary = useMemo(() => {
    const active = items.filter((item) => item.ativo).length;
    const margins = items
      .map((item) => Number(item.margemBrutaPercentual))
      .filter((value) => Number.isFinite(value));
    const avgMargin = margins.length ? margins.reduce((acc, value) => acc + value, 0) / margins.length : 0;
    return { total: items.length, active, avgMargin };
  }, [items]);

  const mutation = useMutation({
    mutationFn: async (payload) => {
      if (editing?.id) return (await api.patch(`/catalogo/itens/${editing.id}`, payload)).data;
      return (await api.post("/catalogo/itens", payload)).data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["catalog-items"] });
      closeModal();
    },
    onError: (error) => setFormError(getApiErrorMessage(error, "Não foi possível salvar o item.")),
  });

  function switchType(nextType) {
    if (nextType === type) return;
    setType(nextType);
    setSearch("");
  }

  function openCreate() {
    setEditing(null);
    setDetails(null);
    const initial = normalizeItem(null);
    initial.tipo = type;
    setForm(initial);
    setPricingBasis("price");
    setFormError("");
    setModalOpen(true);
  }

  async function openEdit(item) {
    if (!canManage) return;
    setFormError("");
    try {
      const { data } = await api.get(`/catalogo/itens/${item.id}`);
      setEditing(data.item);
      setDetails(data.item);
      setForm(normalizeItem(data.item));
      setPricingBasis("price");
      setModalOpen(true);
    } catch (error) {
      setFormError(getApiErrorMessage(error, "Não foi possível abrir o item."));
      setEditing(item);
      setDetails(item);
      setForm(normalizeItem(item));
      setModalOpen(true);
    }
  }

  function closeModal() {
    if (mutation.isPending) return;
    setModalOpen(false);
    setEditing(null);
    setDetails(null);
    setFormError("");
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateNested(section, name, value) {
    setForm((current) => ({
      ...current,
      [section]: { ...current[section], [name]: value },
    }));
  }

  function handleCost(value) {
    setForm((current) => {
      const next = { ...current, custoReferencia: value };
      const calc = pricingBasis === "markup"
        ? calculateFromMarkup(value, current.markupPercentual)
        : calculateFromPrice(value, current.precoVenda);
      if (pricingBasis === "markup") next.precoVenda = String(calc.preco);
      else next.markupPercentual = String(calc.markup);
      return next;
    });
  }

  function handlePrice(value) {
    setPricingBasis("price");
    setForm((current) => {
      const calc = calculateFromPrice(current.custoReferencia, value);
      return { ...current, precoVenda: value, markupPercentual: String(calc.markup) };
    });
  }

  function handleMarkup(value) {
    setPricingBasis("markup");
    setForm((current) => {
      const calc = calculateFromMarkup(current.custoReferencia, value);
      return { ...current, markupPercentual: value, precoVenda: String(calc.preco) };
    });
  }

  function submit(event) {
    event.preventDefault();
    setFormError("");

    if (!form.nome.trim()) {
      setFormError("Informe o nome do produto ou serviço.");
      return;
    }

    if (n(form.precoVenda) < 0 || n(form.custoReferencia) < 0) {
      setFormError("Custo e preço não podem ser negativos.");
      return;
    }

    const payload = {
      categoriaId: form.categoriaId || null,
      nome: form.nome.trim(),
      descricao: form.descricao || null,
      codigoInterno: form.codigoInterno || null,
      codigoBarras: form.codigoBarras || null,
      custoReferencia: n(form.custoReferencia),
      precoVenda: n(form.precoVenda),
      ativo: Boolean(form.ativo),
    };

    if (!editing) payload.tipo = form.tipo;

    if (form.tipo === "PRODUTO") {
      payload.produto = {
        unidade: form.produto.unidade,
        marca: form.produto.marca || null,
        estoqueMinimo: n(form.produto.estoqueMinimo),
        controlaEstoque: Boolean(form.produto.controlaEstoque),
        controlaLote: Boolean(form.produto.controlaLote),
        controlaValidade: Boolean(form.produto.controlaValidade),
      };
    } else {
      payload.servico = {
        duracaoMinutos: form.servico.duracaoMinutos ? Number(form.servico.duracaoMinutos) : null,
        geraComissao: Boolean(form.servico.geraComissao),
        percentualComissao:
          form.servico.geraComissao && form.servico.percentualComissao !== ""
            ? n(form.servico.percentualComissao)
            : null,
        permiteAgendamento: Boolean(form.servico.permiteAgendamento),
        exigePet: Boolean(form.servico.exigePet),
        exigeProfissional: Boolean(form.servico.exigeProfissional),
      };
    }

    mutation.mutate(payload);
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <span className="page-kicker">Catálogo comercial</span>
          <h1>Produtos e serviços</h1>
          <p>Cadastre itens por CNPJ, defina categorias e acompanhe custo, preço, markup e margem.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreate} disabled={!canManage}>
          <Plus size={18} /> {type === "PRODUTO" ? "Novo produto" : "Novo serviço"}
        </button>
      </section>

      <section className="catalog-summary-grid">
        <article className="catalog-summary-card">
          <span><Boxes size={18} /></span>
          <div><small>Itens exibidos</small><strong>{summary.total}</strong><em>{type === "PRODUTO" ? "produtos" : "serviços"}</em></div>
        </article>
        <article className="catalog-summary-card">
          <span><Package size={18} /></span>
          <div><small>Ativos</small><strong>{summary.active}</strong><em>disponíveis no catálogo</em></div>
        </article>
        <article className="catalog-summary-card">
          <span><TrendingUp size={18} /></span>
          <div><small>Margem média</small><strong>{formatPercent(summary.avgMargin)}</strong><em>dos itens exibidos</em></div>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="catalog-toolbar">
          <div className="segmented catalog-type-toggle">
            <button type="button" className={type === "PRODUTO" ? "is-active" : ""} onClick={() => switchType("PRODUTO")}>
              <Package size={14} /> Produtos
            </button>
            <button type="button" className={type === "SERVICO" ? "is-active" : ""} onClick={() => switchType("SERVICO")}>
              <Stethoscope size={14} /> Serviços
            </button>
          </div>

          <label className="search-box catalog-search">
            <Search size={18} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, código ou código de barras..." />
          </label>

          <select className="compact-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ATIVOS">Ativos</option>
            <option value="INATIVOS">Inativos</option>
            <option value="TODOS">Todos</option>
          </select>
        </div>

        {itemsQuery.isLoading ? (
          <div className="loading-state">Carregando catálogo...</div>
        ) : itemsQuery.isError ? (
          <div className="empty-state">
            <Boxes size={30} />
            <strong>Não foi possível carregar o catálogo</strong>
            <p>{getApiErrorMessage(itemsQuery.error)}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <Boxes size={30} />
            <strong>Nenhum {type === "PRODUTO" ? "produto" : "serviço"} encontrado</strong>
            <p>Cadastre o primeiro item ou altere os filtros.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Categoria</th>
                  <th>Custo</th>
                  <th>Venda</th>
                  <th>Markup</th>
                  <th>Margem</th>
                  <th>{type === "PRODUTO" ? "Controle" : "Duração"}</th>
                  <th>Status</th>
                  <th className="table-actions-col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="catalog-item-cell">
                        <span className="catalog-item-icon">{item.tipo === "PRODUTO" ? <Package size={16} /> : <Stethoscope size={16} />}</span>
                        <div>
                          <strong>{item.nome}</strong>
                          <small>{item.codigoInterno || item.codigoBarras || "Sem código"}</small>
                        </div>
                      </div>
                    </td>
                    <td>{item.categoria?.nome || <span className="muted-inline">Sem categoria</span>}</td>
                    <td>{formatCurrency(item.custoReferencia)}</td>
                    <td><strong>{formatCurrency(item.precoVenda)}</strong></td>
                    <td>{formatPercent(item.markupPercentual)}</td>
                    <td>{formatPercent(item.margemBrutaPercentual)}</td>
                    <td>
                      {item.tipo === "PRODUTO"
                        ? <span className="mini-label">{item.produto?.controlaEstoque ? "Estoque" : "Sem estoque"}</span>
                        : item.servico?.duracaoMinutos ? `${item.servico.duracaoMinutos} min` : "—"}
                    </td>
                    <td><span className={`badge ${item.ativo ? "badge--success" : "badge--muted"}`}>{item.ativo ? "Ativo" : "Inativo"}</span></td>
                    <td className="table-actions-col">
                      <button className="icon-button table-action" type="button" onClick={() => openEdit(item)} disabled={!canManage} title="Editar item">
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
        title={editing ? `Editar ${form.tipo === "PRODUTO" ? "produto" : "serviço"}` : `Novo ${form.tipo === "PRODUTO" ? "produto" : "serviço"}`}
        subtitle={editing ? "Atualize o cadastro sem perder o histórico de precificação." : "Defina os dados comerciais e operacionais do item."}
        onClose={closeModal}
        size="lg"
        footer={
          <>
            <button className="ghost-button" type="button" onClick={closeModal} disabled={mutation.isPending}>Cancelar</button>
            <button className="primary-button" type="submit" form="catalog-item-form" disabled={mutation.isPending || !canManage}>
              {mutation.isPending ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar item"}
            </button>
          </>
        }
      >
        <form id="catalog-item-form" className="form-stack" onSubmit={submit}>
          <InlineNotice tone="error">{formError}</InlineNotice>

          <div className="form-section">
            <div className="form-section__heading"><strong>Identificação</strong><span>Dados que aparecem no catálogo e no PDV.</span></div>
            <div className="form-grid form-grid--2">
              <FormField label="Tipo">
                <select
                  className="form-control"
                  value={form.tipo}
                  disabled
                  onChange={() => {}}
                >
                  <option value="PRODUTO">Produto</option>
                  <option value="SERVICO">Serviço</option>
                </select>
              </FormField>
              <FormField label="Categoria" hint={!categories.length ? "Crie categorias em Configurações → Categorias." : undefined}>
                <select className="form-control" value={form.categoriaId} onChange={(e) => updateField("categoriaId", e.target.value)}>
                  <option value="">Sem categoria</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.pai ? `${category.pai.nome} › ` : ""}{category.nome}</option>)}
                </select>
              </FormField>
              <FormField label="Nome" className="form-field--wide">
                <input className="form-control" value={form.nome} onChange={(e) => updateField("nome", e.target.value)} required />
              </FormField>
              <FormField label="Código interno / SKU">
                <input className="form-control" value={form.codigoInterno} onChange={(e) => updateField("codigoInterno", e.target.value)} />
              </FormField>
              <FormField label="Código de barras">
                <input className="form-control" value={form.codigoBarras} onChange={(e) => updateField("codigoBarras", e.target.value)} />
              </FormField>
            </div>
            <FormField label="Descrição">
              <textarea className="form-control form-control--textarea" rows={3} value={form.descricao} onChange={(e) => updateField("descricao", e.target.value)} />
            </FormField>
          </div>

          <div className="form-section">
            <div className="form-section__heading"><strong>Precificação</strong><span>Preço e markup se atualizam entre si. A margem bruta é calculada sobre o preço de venda.</span></div>
            <div className="form-grid form-grid--3">
              <FormField label="Custo (R$)">
                <input className="form-control" type="number" min="0" step="0.01" value={form.custoReferencia} onChange={(e) => handleCost(e.target.value)} />
              </FormField>
              <FormField label="Markup sobre custo (%)" hint="Ex.: custo 10 + markup 50% = venda 15.">
                <input className="form-control" type="number" step="0.01" value={form.markupPercentual} onChange={(e) => handleMarkup(e.target.value)} />
              </FormField>
              <FormField label="Preço de venda (R$)">
                <input className="form-control" type="number" min="0" step="0.01" value={form.precoVenda} onChange={(e) => handlePrice(e.target.value)} />
              </FormField>
            </div>

            <div className="pricing-preview-grid">
              <div><span>Lucro bruto unitário</span><strong className={pricing.lucro < 0 ? "is-negative" : ""}>{formatCurrency(pricing.lucro)}</strong></div>
              <div><span>Markup</span><strong>{formatPercent(pricing.markup)}</strong></div>
              <div><span>Margem bruta</span><strong>{formatPercent(pricing.margem)}</strong></div>
            </div>
          </div>

          {form.tipo === "PRODUTO" ? (
            <div className="form-section">
              <div className="form-section__heading"><strong>Produto e estoque</strong><span>Configurações operacionais do produto.</span></div>
              <div className="form-grid form-grid--3">
                <FormField label="Unidade">
                  <select className="form-control" value={form.produto.unidade} onChange={(e) => updateNested("produto", "unidade", e.target.value)}>
                    {unitOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </FormField>
                <FormField label="Marca">
                  <input className="form-control" value={form.produto.marca} onChange={(e) => updateNested("produto", "marca", e.target.value)} />
                </FormField>
                <FormField label="Estoque mínimo">
                  <input className="form-control" type="number" min="0" step="0.001" value={form.produto.estoqueMinimo} onChange={(e) => updateNested("produto", "estoqueMinimo", e.target.value)} />
                </FormField>
              </div>
              <div className="toggle-grid">
                <label className="check-card"><input type="checkbox" checked={form.produto.controlaEstoque} onChange={(e) => updateNested("produto", "controlaEstoque", e.target.checked)} /><span><strong>Controlar estoque</strong><small>Baixar saldo quando houver venda.</small></span></label>
                <label className="check-card"><input type="checkbox" checked={form.produto.controlaLote} onChange={(e) => updateNested("produto", "controlaLote", e.target.checked)} /><span><strong>Controlar lote</strong><small>Indicado para medicamentos e vacinas.</small></span></label>
                <label className="check-card"><input type="checkbox" checked={form.produto.controlaValidade} onChange={(e) => updateNested("produto", "controlaValidade", e.target.checked)} /><span><strong>Controlar validade</strong><small>Acompanhar vencimento de lotes.</small></span></label>
              </div>
            </div>
          ) : (
            <div className="form-section">
              <div className="form-section__heading"><strong>Configurações do serviço</strong><span>Defina duração, agenda e comissão.</span></div>
              <div className="form-grid form-grid--2">
                <FormField label="Duração estimada (min)">
                  <input className="form-control" type="number" min="1" step="1" value={form.servico.duracaoMinutos} onChange={(e) => updateNested("servico", "duracaoMinutos", e.target.value)} />
                </FormField>
                <FormField label="Comissão (%)" hint={!form.servico.geraComissao ? "Ative a comissão para utilizar este campo." : undefined}>
                  <input className="form-control" type="number" min="0" step="0.01" disabled={!form.servico.geraComissao} value={form.servico.percentualComissao} onChange={(e) => updateNested("servico", "percentualComissao", e.target.value)} />
                </FormField>
              </div>
              <div className="toggle-grid">
                <label className="check-card"><input type="checkbox" checked={form.servico.permiteAgendamento} onChange={(e) => updateNested("servico", "permiteAgendamento", e.target.checked)} /><span><strong>Permite agendamento</strong><small>Disponibilizar na agenda.</small></span></label>
                <label className="check-card"><input type="checkbox" checked={form.servico.exigePet} onChange={(e) => updateNested("servico", "exigePet", e.target.checked)} /><span><strong>Exige pet</strong><small>Obrigar vínculo com um animal.</small></span></label>
                <label className="check-card"><input type="checkbox" checked={form.servico.exigeProfissional} onChange={(e) => updateNested("servico", "exigeProfissional", e.target.checked)} /><span><strong>Exige profissional</strong><small>Associar responsável pela execução.</small></span></label>
                <label className="check-card"><input type="checkbox" checked={form.servico.geraComissao} onChange={(e) => updateNested("servico", "geraComissao", e.target.checked)} /><span><strong>Gera comissão</strong><small>Usar percentual de comissão.</small></span></label>
              </div>
            </div>
          )}

          <div className="form-section">
            <div className="form-section__heading"><strong>Disponibilidade</strong><span>Itens inativos permanecem no histórico, mas deixam de ser ofertados.</span></div>
            <label className="check-card check-card--compact"><input type="checkbox" checked={form.ativo} onChange={(e) => updateField("ativo", e.target.checked)} /><span><strong>Item ativo</strong><small>Disponível para uso operacional.</small></span></label>
          </div>

          {editing && details?.historicosPreco?.length ? (
            <div className="form-section">
              <div className="form-section__heading"><strong>Histórico de precificação</strong><span>Últimas alterações registradas pelo BichOne.</span></div>
              <div className="price-history">
                {details.historicosPreco.map((entry) => (
                  <div className="price-history__row" key={entry.id}>
                    <div><strong>{formatCurrency(entry.precoVenda)}</strong><span>{formatDateTime(entry.createdAt)}</span></div>
                    <div><span>Custo</span><strong>{formatCurrency(entry.custoReferencia)}</strong></div>
                    <div><span>Markup</span><strong>{formatPercent(entry.markupPercentual)}</strong></div>
                    <div><span>Margem</span><strong>{formatPercent(entry.margemBrutaPercentual)}</strong></div>
                    <div><span>Alterado por</span><strong>{entry.usuario?.nome || "Sistema"}</strong></div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
