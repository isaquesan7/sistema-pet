import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Boxes,
  CircleDollarSign,
  CreditCard,
  Eye,
  Minus,
  PackageOpen,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  WalletCards,
  XCircle,
} from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";
import { formatCurrency, formatDateTime } from "../lib/formatters.js";
import { useAuth } from "../context/AuthContext.jsx";
import Modal from "../components/Modal.jsx";
import FormField from "../components/FormField.jsx";
import InlineNotice from "../components/InlineNotice.jsx";

const paymentLabels = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  CARTAO_DEBITO: "Cartão de débito",
  CARTAO_CREDITO: "Cartão de crédito",
  TRANSFERENCIA: "Transferência",
  CREDITO_CLIENTE: "Fiado / conta do cliente",
  OUTRO: "Outro",
};

function money(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value) {
  return Math.round((money(value) + Number.EPSILON) * 100) / 100;
}


function datePlusDays(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function saleStatusLabel(status) {
  return {
    ABERTA: "Aberta",
    FINALIZADA: "Finalizada",
    CANCELADA: "Cancelada",
    ESTORNADA: "Estornada",
  }[status] || status;
}

function commandStatusLabel(status) {
  return {
    ABERTA: "Aberta",
    PARCIALMENTE_FECHADA: "Parcialmente fechada",
    FECHADA: "Fechada",
    CANCELADA: "Cancelada",
  }[status] || status;
}

function CartLine({ line, client, onUpdate, onRemove, canDiscount }) {
  const needsPet = line.item.tipo === "SERVICO" && line.item.servico?.exigePet;
  const pets = client?.pets || [];
  return (
    <div className="pdv-cart-line">
      <div className="pdv-cart-line__main">
        <strong>{line.item.nome}</strong>
        <span>{line.item.tipo === "PRODUTO" ? "Produto" : "Serviço"} · {formatCurrency(line.item.precoVenda)}</span>
        {needsPet ? (
          <select
            className="form-control pdv-line-pet"
            value={line.petId || ""}
            onChange={(event) => onUpdate({ petId: event.target.value || null })}
          >
            <option value="">Selecione o pet...</option>
            {pets.map((pet) => <option value={pet.id} key={pet.id}>{pet.nome}</option>)}
          </select>
        ) : null}
      </div>
      <div className="pdv-quantity">
        <button type="button" onClick={() => onUpdate({ quantidade: Math.max(0.001, round(line.quantidade - 1)) })}><Minus size={13} /></button>
        <input
          type="number"
          min="0.001"
          step="0.001"
          value={line.quantidade}
          onChange={(event) => onUpdate({ quantidade: Math.max(0.001, Number(event.target.value) || 1) })}
        />
        <button type="button" onClick={() => onUpdate({ quantidade: round(line.quantidade + 1) })}><Plus size={13} /></button>
      </div>
      {canDiscount ? (
        <label className="pdv-line-discount">
          <span>Desconto</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={line.desconto}
            onChange={(event) => onUpdate({ desconto: Math.max(0, Number(event.target.value) || 0) })}
          />
        </label>
      ) : null}
      <strong className="pdv-line-total">
        {formatCurrency(Math.max(0, money(line.item.precoVenda) * money(line.quantidade) - money(line.desconto)))}
      </strong>
      <button className="icon-button table-action" type="button" onClick={onRemove} title="Remover"><Trash2 size={15} /></button>
    </div>
  );
}

function PaymentEditor({ payments, total, onChange }) {
  const paid = round(payments.reduce((sum, item) => sum + money(item.valor), 0));
  const remaining = round(total - paid);

  function update(index, patch) {
    onChange(payments.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function remove(index) {
    onChange(payments.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...payments, { forma: "PIX", valor: Math.max(0, remaining), parcelas: 1 }]);
  }

  return (
    <div className="pdv-payments">
      <div className="pdv-payments__heading">
        <div>
          <strong>Pagamentos</strong>
          <span>Você pode dividir o valor entre várias formas.</span>
        </div>
        <button className="ghost-button" type="button" onClick={add}><Plus size={14} /> Adicionar</button>
      </div>
      <div className="pdv-payment-list">
        {payments.map((payment, index) => (
          <div className="pdv-payment-row" key={`${payment.forma}-${index}`}>
            <select className="form-control" value={payment.forma} onChange={(event) => {
              const forma = event.target.value;
              update(index, { forma, ...(forma === "CREDITO_CLIENTE" && !payment.vencimentoEm ? { vencimentoEm: datePlusDays(30) } : {}) });
            }}>
              {Object.entries(paymentLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
            <input
              className="form-control"
              type="number"
              min="0.01"
              step="0.01"
              value={payment.valor}
              onChange={(event) => update(index, { valor: Math.max(0, Number(event.target.value) || 0) })}
            />
            {payment.forma === "CARTAO_CREDITO" ? (
              <input
                className="form-control"
                type="number"
                min="1"
                max="36"
                value={payment.parcelas || 1}
                onChange={(event) => update(index, { parcelas: Math.max(1, Number(event.target.value) || 1) })}
                title="Parcelas"
              />
            ) : payment.forma === "CREDITO_CLIENTE" ? (
              <input
                className="form-control"
                type="date"
                value={payment.vencimentoEm || datePlusDays(30)}
                onChange={(event) => update(index, { vencimentoEm: event.target.value })}
                title="Vencimento do fiado"
              />
            ) : <span className="pdv-payment-spacer" />}
            <button type="button" className="icon-button table-action" onClick={() => remove(index)} disabled={payments.length === 1}><XCircle size={15} /></button>
          </div>
        ))}
      </div>
      <div className={`pdv-payment-balance ${Math.abs(remaining) < 0.01 ? "pdv-payment-balance--ok" : ""}`}>
        <span>Informado {formatCurrency(paid)}</span>
        <strong>{Math.abs(remaining) < 0.01 ? "Pagamento completo" : `Falta ${formatCurrency(remaining)}`}</strong>
      </div>
    </div>
  );
}

export default function PdvPage() {
  const { selectedCompany, selectedOrganization, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("VENDA");
  const [itemSearch, setItemSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [clientId, setClientId] = useState("");
  const [saleDiscount, setSaleDiscount] = useState(0);
  const [saleAddition, setSaleAddition] = useState(0);
  const [payments, setPayments] = useState([{ forma: "PIX", valor: 0, parcelas: 1 }]);
  const [saleError, setSaleError] = useState("");

  const [cashModal, setCashModal] = useState(null);
  const [cashForm, setCashForm] = useState({ caixaId: "", valor: "0", descricao: "" });
  const [cashError, setCashError] = useState("");

  const [commandModal, setCommandModal] = useState(false);
  const [commandClientId, setCommandClientId] = useState("");
  const [commandError, setCommandError] = useState("");
  const [commandDetailId, setCommandDetailId] = useState(null);
  const [commandItemId, setCommandItemId] = useState("");
  const [commandPetId, setCommandPetId] = useState("");
  const [commandPayments, setCommandPayments] = useState([{ forma: "PIX", valor: 0, parcelas: 1 }]);
  const [commandCloseError, setCommandCloseError] = useState("");

  const [packageReceive, setPackageReceive] = useState(null);
  const [packagePayments, setPackagePayments] = useState([{ forma: "PIX", valor: 0, parcelas: 1 }]);
  const [packageError, setPackageError] = useState("");

  const [saleDetailId, setSaleDetailId] = useState(null);
  const [cancelSale, setCancelSale] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  const canDiscount = hasPermission("pdv.aplicar_desconto");
  const canCancel = hasPermission("pdv.cancelar_venda");
  const canManageCash = hasPermission("financeiro.gerenciar");

  const summaryQuery = useQuery({
    queryKey: ["pdv-summary", selectedCompany?.id],
    queryFn: async () => (await api.get("/pdv/resumo")).data.resumo,
  });
  const cashQuery = useQuery({
    queryKey: ["pdv-cash", selectedCompany?.id],
    queryFn: async () => (await api.get("/pdv/caixas")).data.dados || [],
  });
  const sessionQuery = useQuery({
    queryKey: ["pdv-open-session", selectedCompany?.id],
    queryFn: async () => (await api.get("/pdv/caixa/aberta")).data.sessao,
  });
  const itemsQuery = useQuery({
    queryKey: ["pdv-items", selectedCompany?.id, itemSearch],
    queryFn: async () => (await api.get("/pdv/itens", { params: { busca: itemSearch || undefined } })).data.dados || [],
  });
  const clientsQuery = useQuery({
    queryKey: ["pdv-clients", selectedOrganization?.id],
    queryFn: async () => (await api.get("/clientes", { params: { limite: 100 } })).data.dados || [],
  });
  const salesQuery = useQuery({
    queryKey: ["pdv-sales", selectedCompany?.id],
    queryFn: async () => (await api.get("/pdv/vendas", { params: { limite: 60 } })).data.dados || [],
  });
  const commandsQuery = useQuery({
    queryKey: ["pdv-commands", selectedOrganization?.id],
    queryFn: async () => (await api.get("/pdv/comandas")).data.dados || [],
  });
  const pendingPackagesQuery = useQuery({
    queryKey: ["pdv-pending-packages", selectedCompany?.id],
    queryFn: async () => (await api.get("/pdv/pacotes-pendentes")).data.dados || [],
  });
  const commandDetailQuery = useQuery({
    queryKey: ["pdv-command-detail", commandDetailId],
    enabled: Boolean(commandDetailId),
    queryFn: async () => (await api.get(`/pdv/comandas/${commandDetailId}`)).data.comanda,
  });
  const saleDetailQuery = useQuery({
    queryKey: ["pdv-sale-detail", saleDetailId],
    enabled: Boolean(saleDetailId),
    queryFn: async () => (await api.get(`/pdv/vendas/${saleDetailId}`)).data.venda,
  });

  const summary = summaryQuery.data || {};
  const cashes = cashQuery.data || [];
  const openSession = sessionQuery.data || null;
  const catalog = itemsQuery.data || [];
  const clients = clientsQuery.data || [];
  const selectedClient = clients.find((client) => client.id === clientId) || null;
  const sales = salesQuery.data || [];
  const commands = commandsQuery.data || [];
  const pendingPackages = pendingPackagesQuery.data || [];
  const commandDetail = commandDetailQuery.data || null;

  const subtotal = useMemo(() => round(cart.reduce((sum, line) => sum + Math.max(0, money(line.item.precoVenda) * money(line.quantidade) - money(line.desconto)), 0)), [cart]);
  const total = round(Math.max(0, subtotal - money(saleDiscount) + money(saleAddition)));

  const currentCompanyCommandItems = useMemo(
    () => (commandDetail?.itens || []).filter((item) => item.empresaId === selectedCompany?.id && item.status === "ATIVO"),
    [commandDetail, selectedCompany]
  );
  const currentCompanyCommandTotal = round(currentCompanyCommandItems.reduce((sum, item) => sum + money(item.valorTotal), 0));

  function invalidatePdv() {
    queryClient.invalidateQueries({ queryKey: ["pdv-summary"] });
    queryClient.invalidateQueries({ queryKey: ["pdv-open-session"] });
    queryClient.invalidateQueries({ queryKey: ["pdv-cash"] });
    queryClient.invalidateQueries({ queryKey: ["pdv-sales"] });
    queryClient.invalidateQueries({ queryKey: ["pdv-commands"] });
    queryClient.invalidateQueries({ queryKey: ["pdv-command-detail"] });
    queryClient.invalidateQueries({ queryKey: ["pdv-items"] });
    queryClient.invalidateQueries({ queryKey: ["pdv-pending-packages"] });
    queryClient.invalidateQueries({ queryKey: ["client-packages"] });
  }

  const saleMutation = useMutation({
    mutationFn: async () => (await api.post("/pdv/vendas", {
      clienteId: clientId || null,
      sessaoCaixaId: openSession?.id,
      itens: cart.map((line) => ({
        itemCatalogoId: line.item.id,
        petId: line.petId || null,
        quantidade: line.quantidade,
        desconto: line.desconto || 0,
      })),
      pagamentos: payments,
      desconto: saleDiscount || 0,
      acrescimo: saleAddition || 0,
    })).data.venda,
    onSuccess: (venda) => {
      setCart([]);
      setClientId("");
      setSaleDiscount(0);
      setSaleAddition(0);
      setPayments([{ forma: "PIX", valor: 0, parcelas: 1 }]);
      setSaleError("");
      setSaleDetailId(venda.id);
      invalidatePdv();
    },
    onError: (error) => setSaleError(getApiErrorMessage(error, "Não foi possível finalizar a venda.")),
  });

  const cashMutation = useMutation({
    mutationFn: async () => {
      if (cashModal === "CREATE") return (await api.post("/pdv/caixas", { nome: cashForm.descricao || "Caixa principal" })).data;
      if (cashModal === "OPEN") return (await api.post(`/pdv/caixas/${cashForm.caixaId}/abrir`, { valorAbertura: money(cashForm.valor) })).data;
      if (cashModal === "SUPPLY" || cashModal === "WITHDRAW") return (await api.post(`/pdv/sessoes/${openSession.id}/movimentacoes`, {
        tipo: cashModal === "SUPPLY" ? "SUPRIMENTO" : "SANGRIA",
        valor: money(cashForm.valor),
        descricao: cashForm.descricao,
      })).data;
      if (cashModal === "CLOSE") return (await api.post(`/pdv/sessoes/${openSession.id}/fechar`, {
        valorFechamento: money(cashForm.valor),
        observacoes: cashForm.descricao || null,
      })).data;
      return null;
    },
    onSuccess: () => {
      setCashModal(null);
      setCashForm({ caixaId: "", valor: "0", descricao: "" });
      setCashError("");
      invalidatePdv();
    },
    onError: (error) => setCashError(getApiErrorMessage(error)),
  });

  const createCommandMutation = useMutation({
    mutationFn: async () => (await api.post("/pdv/comandas", { clienteId: commandClientId })).data.comanda,
    onSuccess: (comanda) => {
      setCommandModal(false);
      setCommandClientId("");
      setCommandError("");
      setCommandDetailId(comanda.id);
      invalidatePdv();
    },
    onError: (error) => setCommandError(getApiErrorMessage(error)),
  });

  const addCommandItemMutation = useMutation({
    mutationFn: async () => {
      const item = catalog.find((entry) => entry.id === commandItemId);
      return (await api.post(`/pdv/comandas/${commandDetailId}/itens`, {
        itemCatalogoId: commandItemId,
        petId: item?.tipo === "SERVICO" && item.servico?.exigePet ? (commandPetId || null) : null,
        quantidade: 1,
        desconto: 0,
      })).data;
    },
    onSuccess: () => {
      setCommandItemId("");
      setCommandPetId("");
      invalidatePdv();
    },
    onError: (error) => setCommandCloseError(getApiErrorMessage(error)),
  });

  const removeCommandItemMutation = useMutation({
    mutationFn: async (itemId) => (await api.delete(`/pdv/comandas/${commandDetailId}/itens/${itemId}`)).data,
    onSuccess: invalidatePdv,
    onError: (error) => setCommandCloseError(getApiErrorMessage(error)),
  });

  const closeCommandMutation = useMutation({
    mutationFn: async () => (await api.post(`/pdv/comandas/${commandDetailId}/fechar`, {
      sessaoCaixaId: openSession?.id,
      pagamentos: commandPayments,
      desconto: 0,
      acrescimo: 0,
    })).data.venda,
    onSuccess: (venda) => {
      setCommandPayments([{ forma: "PIX", valor: 0, parcelas: 1 }]);
      setCommandCloseError("");
      setSaleDetailId(venda.id);
      invalidatePdv();
    },
    onError: (error) => setCommandCloseError(getApiErrorMessage(error)),
  });

  const cancelSaleMutation = useMutation({
    mutationFn: async () => (await api.post(`/pdv/vendas/${cancelSale.id}/cancelar`, { motivo: cancelReason })).data,
    onSuccess: () => {
      setCancelSale(null);
      setCancelReason("");
      setSaleDetailId(null);
      invalidatePdv();
    },
  });

  const receivePackageMutation = useMutation({
    mutationFn: async () => (await api.post(`/pdv/pacotes/${packageReceive.id}/receber`, {
      sessaoCaixaId: openSession?.id,
      pagamentos: packagePayments,
    })).data.venda,
    onSuccess: (venda) => {
      setPackageReceive(null);
      setPackagePayments([{ forma: "PIX", valor: 0, parcelas: 1 }]);
      setPackageError("");
      setSaleDetailId(venda.id);
      invalidatePdv();
    },
    onError: (error) => setPackageError(getApiErrorMessage(error, "Não foi possível receber o pacote.")),
  });

  function addToCart(item) {
    setCart((current) => {
      const index = current.findIndex((line) => line.item.id === item.id && !line.petId);
      if (index >= 0 && item.tipo === "PRODUTO") {
        return current.map((line, i) => i === index ? { ...line, quantidade: round(line.quantidade + 1) } : line);
      }
      return [...current, { item, quantidade: 1, desconto: 0, petId: null }];
    });
  }

  function updateCart(index, patch) {
    setCart((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line));
  }

  function removeCart(index) {
    setCart((current) => current.filter((_, i) => i !== index));
  }

  function changeClient(value) {
    setClientId(value);
    setCart((current) => current.map((line) => ({ ...line, petId: null })));
  }

  function useSinglePaymentTotal(nextTotal = total) {
    if (payments.length === 1) {
      setPayments([{ ...payments[0], valor: round(nextTotal) }]);
    }
  }

  function finalizeSale() {
    setSaleError("");
    if (!openSession) return setSaleError("Abra um caixa antes de finalizar a venda.");
    if (!cart.length) return setSaleError("Adicione pelo menos um produto ou serviço.");
    const missingPet = cart.some((line) => line.item.tipo === "SERVICO" && line.item.servico?.exigePet && !line.petId);
    if (missingPet) return setSaleError("Selecione o pet dos serviços que exigem vínculo.");
    saleMutation.mutate();
  }

  const selectedCommandItem = catalog.find((item) => item.id === commandItemId);
  const commandClient = commandDetail?.cliente;

  return (
    <div className="page-stack pdv-page">
      <section className="page-heading page-heading--hero">
        <div>
          <span className="page-kicker">Operação comercial</span>
          <h1>PDV e Comandas</h1>
          <p>Venda, receba e acompanhe comandas mantendo cada CNPJ financeiro separado.</p>
        </div>
        <div className={`pdv-session-badge ${openSession ? "pdv-session-badge--open" : ""}`}>
          <Store size={18} />
          <div><span>Caixa</span><strong>{openSession ? `${openSession.caixa?.nome} aberto` : "Fechado"}</strong></div>
        </div>
      </section>

      <section className="pdv-summary-grid">
        <div className="pdv-summary-card"><CircleDollarSign size={19} /><div><span>Faturamento hoje</span><strong>{formatCurrency(summary.faturamentoHoje || 0)}</strong></div></div>
        <div className="pdv-summary-card"><ReceiptText size={19} /><div><span>Vendas hoje</span><strong>{summary.vendasHoje || 0}</strong></div></div>
        <div className="pdv-summary-card"><WalletCards size={19} /><div><span>Comandas pendentes</span><strong>{summary.comandasAbertas || 0}</strong></div></div>
        <div className="pdv-summary-card"><Banknote size={19} /><div><span>Saldo inicial</span><strong>{formatCurrency(openSession?.valorAbertura || 0)}</strong></div></div>
      </section>

      <div className="pdv-tabs">
        {[ ["VENDA", ShoppingCart, "Venda rápida"], ["COMANDAS", WalletCards, "Comandas"], ["PACOTES", PackageOpen, "Receber pacotes"], ["CAIXA", Store, "Caixa"], ["HISTORICO", ReceiptText, "Histórico"] ].map(([value, Icon, label]) => (
          <button className={tab === value ? "active" : ""} type="button" onClick={() => setTab(value)} key={value}><Icon size={15} /> {label}</button>
        ))}
      </div>

      {tab === "VENDA" ? (
        <section className="pdv-sale-layout">
          <div className="panel pdv-catalog-panel">
            <div className="panel__heading"><div><span>Catálogo do CNPJ</span><h2>Produtos e serviços</h2></div><Boxes size={18} /></div>
            <label className="search-box pdv-search"><Search size={17} /><input value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="Nome, SKU ou código de barras..." /></label>
            <div className="pdv-product-grid">
              {catalog.map((item) => (
                <button className="pdv-product-card" type="button" onClick={() => addToCart(item)} key={item.id}>
                  <span className={`badge ${item.tipo === "PRODUTO" ? "badge--muted" : "badge--success"}`}>{item.tipo === "PRODUTO" ? "Produto" : "Serviço"}</span>
                  <strong>{item.nome}</strong>
                  <small>{item.categoria?.nome || "Sem categoria"}</small>
                  <b>{formatCurrency(item.precoVenda)}</b>
                  {item.tipo === "PRODUTO" && item.produto?.controlaEstoque ? <em>Estoque: {money(item.produto?.estoque?.quantidade)}</em> : null}
                </button>
              ))}
              {!catalog.length ? <div className="mini-empty pdv-grid-empty">Nenhum item encontrado.</div> : null}
            </div>
          </div>

          <div className="panel pdv-cart-panel">
            <div className="panel__heading"><div><span>Venda atual</span><h2>Carrinho</h2></div><ShoppingCart size={18} /></div>
            <FormField label="Cliente (opcional, obrigatório para serviços com pet)">
              <select className="form-control" value={clientId} onChange={(event) => changeClient(event.target.value)}>
                <option value="">Consumidor não identificado</option>
                {clients.map((client) => <option value={client.id} key={client.id}>{client.nome}</option>)}
              </select>
            </FormField>

            <div className="pdv-cart-list">
              {cart.length ? cart.map((line, index) => (
                <CartLine key={`${line.item.id}-${index}`} line={line} client={selectedClient} canDiscount={canDiscount} onUpdate={(patch) => updateCart(index, patch)} onRemove={() => removeCart(index)} />
              )) : <div className="mini-empty">Clique em um produto ou serviço para adicioná-lo.</div>}
            </div>

            <div className="pdv-totals">
              <div><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
              {canDiscount ? <div><span>Desconto geral</span><input type="number" min="0" step="0.01" value={saleDiscount} onChange={(event) => { const value = Number(event.target.value) || 0; setSaleDiscount(value); setTimeout(() => useSinglePaymentTotal(round(subtotal - value + saleAddition)), 0); }} /></div> : null}
              <div><span>Acréscimo</span><input type="number" min="0" step="0.01" value={saleAddition} onChange={(event) => { const value = Number(event.target.value) || 0; setSaleAddition(value); setTimeout(() => useSinglePaymentTotal(round(subtotal - saleDiscount + value)), 0); }} /></div>
              <div className="pdv-total-final"><span>Total</span><strong>{formatCurrency(total)}</strong></div>
            </div>

            <PaymentEditor payments={payments} total={total} onChange={setPayments} />
            {payments.length === 1 && money(payments[0].valor) !== total ? <button className="ghost-button pdv-fill-payment" type="button" onClick={() => setPayments([{ ...payments[0], valor: total }])}>Preencher pagamento com {formatCurrency(total)}</button> : null}
            <InlineNotice tone="error">{saleError}</InlineNotice>
            {!openSession ? <InlineNotice>O caixa está fechado. Abra uma sessão na aba Caixa para vender.</InlineNotice> : null}
            <button className="primary-button primary-button--large" type="button" onClick={finalizeSale} disabled={saleMutation.isPending || !openSession}>{saleMutation.isPending ? "Finalizando..." : `Finalizar venda · ${formatCurrency(total)}`}</button>
          </div>
        </section>
      ) : null}

      {tab === "COMANDAS" ? (
        <section className="panel table-panel">
          <div className="toolbar">
            <div><strong className="table-main-text">Comandas da organização</strong><div className="table-subtext">Uma comanda pode reunir itens dos diferentes CNPJs; cada CNPJ fecha sua própria venda.</div></div>
            <button className="primary-button" type="button" onClick={() => setCommandModal(true)}><Plus size={16} /> Nova comanda</button>
          </div>
          <div className="table-scroll">
            <table className="pdv-command-table"><thead><tr><th>Nº</th><th>Cliente</th><th>Status</th><th>CNPJs envolvidos</th><th>Total</th><th>Ações</th></tr></thead>
              <tbody>{commands.map((command) => {
                const totalCommand = command.itens.reduce((sum, item) => sum + money(item.valorTotal), 0);
                const companies = [...new Set(command.itens.map((item) => item.empresa?.nomeFantasia).filter(Boolean))];
                return <tr key={command.id}><td>#{command.numero}</td><td><strong className="table-main-text">{command.cliente?.nome}</strong></td><td><span className="badge badge--muted">{commandStatusLabel(command.status)}</span></td><td>{companies.join(" + ") || "—"}</td><td>{formatCurrency(totalCommand)}</td><td><button className="icon-button table-action" type="button" onClick={() => setCommandDetailId(command.id)}><Eye size={15} /></button></td></tr>;
              })}</tbody></table>
          </div>
        </section>
      ) : null}


      {tab === "PACOTES" ? (
        <section className="panel table-panel">
          <div className="toolbar">
            <div><strong className="table-main-text">Pacotes aguardando recebimento</strong><div className="table-subtext">Pacotes contratados neste CNPJ que ainda não possuem venda vinculada.</div></div>
            <span className="toolbar__count">{pendingPackages.length} pendentes</span>
          </div>
          {pendingPackages.length ? <div className="table-scroll"><table><thead><tr><th>Pacote</th><th>Cliente</th><th>Pet</th><th>Valor</th><th>Contratado em</th><th>Ação</th></tr></thead><tbody>{pendingPackages.map((pack) => <tr key={pack.id}><td><strong className="table-main-text">{pack.nome}</strong></td><td>{pack.cliente?.nome}</td><td>{pack.pet?.nome || "Todos do tutor"}</td><td><strong>{formatCurrency(pack.valorPacote)}</strong></td><td>{formatDateTime(pack.createdAt)}</td><td><button className="primary-button pdv-receive-package" type="button" disabled={!openSession} onClick={() => { setPackageReceive(pack); setPackagePayments([{ forma: "PIX", valor: money(pack.valorPacote), parcelas: 1 }]); setPackageError(""); }}>Receber</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><PackageOpen size={30} /><strong>Nenhum pacote aguardando recebimento</strong><p>Pacotes já pagos deixam esta fila automaticamente.</p></div>}
          {!openSession && pendingPackages.length ? <div className="pdv-package-warning"><InlineNotice>Abra um caixa para receber os pacotes pendentes.</InlineNotice></div> : null}
        </section>
      ) : null}

      {tab === "CAIXA" ? (
        <section className="pdv-cash-layout">
          <div className="panel pdv-cash-status">
            <div className="panel__heading"><div><span>Sessão atual</span><h2>{openSession ? openSession.caixa?.nome : "Nenhum caixa aberto"}</h2></div><Store size={19} /></div>
            {openSession ? (
              <>
                <div className="pdv-cash-metrics"><div><span>Aberto em</span><strong>{formatDateTime(openSession.dataAbertura)}</strong></div><div><span>Valor inicial</span><strong>{formatCurrency(openSession.valorAbertura)}</strong></div><div><span>Operador</span><strong>{openSession.usuarioAbertura?.nome || "—"}</strong></div></div>
                <div className="pdv-cash-actions"><button className="ghost-button" type="button" onClick={() => { setCashForm({ caixaId: "", valor: "0", descricao: "Suprimento de caixa" }); setCashModal("SUPPLY"); }}><ArrowDownCircle size={16} /> Suprimento</button><button className="ghost-button" type="button" onClick={() => { setCashForm({ caixaId: "", valor: "0", descricao: "Sangria de caixa" }); setCashModal("WITHDRAW"); }}><ArrowUpCircle size={16} /> Sangria</button><button className="primary-button" type="button" onClick={() => { setCashForm({ caixaId: "", valor: "0", descricao: "" }); setCashModal("CLOSE"); }}>Fechar caixa</button></div>
              </>
            ) : (
              <div className="empty-state pdv-cash-empty"><Store size={30} /><strong>Caixa fechado</strong><p>Selecione um caixa cadastrado para iniciar as vendas.</p>{cashes.length ? <button className="primary-button" type="button" onClick={() => { setCashForm({ caixaId: cashes[0].id, valor: "0", descricao: "" }); setCashModal("OPEN"); }}>Abrir caixa</button> : canManageCash ? <button className="primary-button" type="button" onClick={() => { setCashForm({ caixaId: "", valor: "0", descricao: "Caixa principal" }); setCashModal("CREATE"); }}>Criar primeiro caixa</button> : null}</div>
            )}
          </div>
          <div className="panel">
            <div className="panel__heading"><div><span>Cadastros</span><h2>Caixas deste CNPJ</h2></div>{canManageCash ? <button className="ghost-button" type="button" onClick={() => { setCashForm({ caixaId: "", valor: "0", descricao: "" }); setCashModal("CREATE"); }}><Plus size={14} /> Novo caixa</button> : null}</div>
            <div className="pdv-cash-list">{cashes.map((cash) => <div className="pdv-cash-row" key={cash.id}><div><strong>{cash.nome}</strong><span>{cash.descricao || "Sem descrição"}</span></div><span className={`badge ${cash.sessoes?.length ? "badge--success" : "badge--muted"}`}>{cash.sessoes?.length ? "Aberto" : "Fechado"}</span></div>)}</div>
          </div>
        </section>
      ) : null}

      {tab === "HISTORICO" ? (
        <section className="panel table-panel">
          <div className="toolbar"><strong className="table-main-text">Últimas vendas do CNPJ selecionado</strong><span className="toolbar__count">{sales.length} registros</span></div>
          <div className="table-scroll"><table><thead><tr><th>Venda</th><th>Data</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Total</th><th>Status</th><th>Ações</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td>#{sale.numero}</td><td>{formatDateTime(sale.createdAt)}</td><td>{sale.cliente?.nome || "Consumidor"}</td><td>{sale._count?.itens || 0}</td><td>{sale.pagamentos?.map((p) => paymentLabels[p.forma]).join(" + ") || "—"}</td><td><strong>{formatCurrency(sale.valorTotal)}</strong></td><td><span className={`badge ${sale.status === "FINALIZADA" ? "badge--success" : "badge--muted"}`}>{saleStatusLabel(sale.status)}</span></td><td><button className="icon-button table-action" type="button" onClick={() => setSaleDetailId(sale.id)}><Eye size={15} /></button></td></tr>)}</tbody></table></div>
        </section>
      ) : null}

      <Modal open={Boolean(cashModal)} title={{ CREATE: "Novo caixa", OPEN: "Abrir caixa", SUPPLY: "Suprimento", WITHDRAW: "Sangria", CLOSE: "Fechar caixa" }[cashModal]} onClose={() => setCashModal(null)} footer={<><button className="ghost-button" type="button" onClick={() => setCashModal(null)}>Cancelar</button><button className="primary-button" type="button" onClick={() => cashMutation.mutate()} disabled={cashMutation.isPending}>Confirmar</button></>}>
        <InlineNotice tone="error">{cashError}</InlineNotice>
        {cashModal === "CREATE" ? <FormField label="Nome do caixa"><input className="form-control" value={cashForm.descricao} onChange={(event) => setCashForm((current) => ({ ...current, descricao: event.target.value }))} placeholder="Caixa principal" /></FormField> : null}
        {cashModal === "OPEN" ? <><FormField label="Caixa"><select className="form-control" value={cashForm.caixaId} onChange={(event) => setCashForm((current) => ({ ...current, caixaId: event.target.value }))}>{cashes.map((cash) => <option value={cash.id} key={cash.id}>{cash.nome}</option>)}</select></FormField><FormField label="Valor de abertura"><input className="form-control" type="number" min="0" step="0.01" value={cashForm.valor} onChange={(event) => setCashForm((current) => ({ ...current, valor: event.target.value }))} /></FormField></> : null}
        {["SUPPLY", "WITHDRAW", "CLOSE"].includes(cashModal) ? <FormField label={cashModal === "CLOSE" ? "Dinheiro contado no fechamento" : "Valor"}><input className="form-control" type="number" min="0" step="0.01" value={cashForm.valor} onChange={(event) => setCashForm((current) => ({ ...current, valor: event.target.value }))} /></FormField> : null}
        {["SUPPLY", "WITHDRAW", "CLOSE"].includes(cashModal) ? <FormField label={cashModal === "CLOSE" ? "Observação" : "Descrição"}><textarea className="form-control form-control--textarea" value={cashForm.descricao} onChange={(event) => setCashForm((current) => ({ ...current, descricao: event.target.value }))} /></FormField> : null}
      </Modal>

      <Modal open={commandModal} title="Nova comanda" subtitle="A comanda pertence ao cliente e pode receber lançamentos dos dois CNPJs." onClose={() => setCommandModal(false)} footer={<><button className="ghost-button" type="button" onClick={() => setCommandModal(false)}>Cancelar</button><button className="primary-button" type="button" disabled={!commandClientId || createCommandMutation.isPending} onClick={() => createCommandMutation.mutate()}>Criar comanda</button></>}>
        <InlineNotice tone="error">{commandError}</InlineNotice><FormField label="Cliente"><select className="form-control" value={commandClientId} onChange={(event) => setCommandClientId(event.target.value)}><option value="">Selecione...</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.nome}</option>)}</select></FormField>
      </Modal>

      <Modal open={Boolean(commandDetailId)} title={commandDetail ? `Comanda #${commandDetail.numero}` : "Comanda"} subtitle={commandDetail?.cliente?.nome} onClose={() => setCommandDetailId(null)} size="lg">
        {commandDetailQuery.isLoading ? <div className="loading-state">Carregando...</div> : commandDetail ? <div className="pdv-command-detail">
          <div className="pdv-command-companies">{Object.values((commandDetail.itens || []).reduce((acc, item) => { const key = item.empresaId; if (!acc[key]) acc[key] = { empresa: item.empresa, total: 0, pendente: 0 }; if (item.status !== "CANCELADO") acc[key].total += money(item.valorTotal); if (item.status === "ATIVO") acc[key].pendente += money(item.valorTotal); return acc; }, {})).map((group) => <div className={group.empresa.id === selectedCompany?.id ? "current" : ""} key={group.empresa.id}><span>{group.empresa.nomeFantasia}</span><strong>{formatCurrency(group.total)}</strong><small>Pendente {formatCurrency(group.pendente)}</small></div>)}</div>
          <div className="pdv-command-add"><select className="form-control" value={commandItemId} onChange={(event) => { setCommandItemId(event.target.value); setCommandPetId(""); }}><option value="">Adicionar produto/serviço deste CNPJ...</option>{catalog.map((item) => <option value={item.id} key={item.id}>{item.nome} · {formatCurrency(item.precoVenda)}</option>)}</select>{selectedCommandItem?.tipo === "SERVICO" && selectedCommandItem.servico?.exigePet ? <select className="form-control" value={commandPetId} onChange={(event) => setCommandPetId(event.target.value)}><option value="">Selecione o pet...</option>{(commandClient?.pets || []).map((pet) => <option value={pet.id} key={pet.id}>{pet.nome}</option>)}</select> : null}<button className="primary-button" type="button" onClick={() => addCommandItemMutation.mutate()} disabled={!commandItemId || addCommandItemMutation.isPending}><Plus size={15} /> Lançar</button></div>
          <InlineNotice tone="error">{commandCloseError}</InlineNotice>
          <div className="table-scroll"><table className="pdv-command-items"><thead><tr><th>CNPJ</th><th>Item</th><th>Pet</th><th>Qtd.</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>{commandDetail.itens.map((item) => <tr key={item.id}><td>{item.empresa?.nomeFantasia}</td><td>{item.descricao}</td><td>{item.pet?.nome || "—"}</td><td>{money(item.quantidade)}</td><td>{formatCurrency(item.valorTotal)}</td><td>{item.status}</td><td>{item.empresaId === selectedCompany?.id && item.status === "ATIVO" ? <button className="icon-button table-action" type="button" onClick={() => removeCommandItemMutation.mutate(item.id)}><Trash2 size={14} /></button> : null}</td></tr>)}</tbody></table></div>
          {currentCompanyCommandItems.length ? <div className="pdv-command-close"><div><span>Fechar itens de <strong>{selectedCompany?.nomeFantasia}</strong></span><b>{formatCurrency(currentCompanyCommandTotal)}</b></div>{openSession ? <><PaymentEditor payments={commandPayments} total={currentCompanyCommandTotal} onChange={setCommandPayments} />{commandPayments.length === 1 && money(commandPayments[0].valor) !== currentCompanyCommandTotal ? <button className="ghost-button" type="button" onClick={() => setCommandPayments([{ ...commandPayments[0], valor: currentCompanyCommandTotal }])}>Preencher pagamento</button> : null}<button className="primary-button" type="button" disabled={closeCommandMutation.isPending} onClick={() => closeCommandMutation.mutate()}>Fechar este CNPJ · {formatCurrency(currentCompanyCommandTotal)}</button></> : <InlineNotice>Abra o caixa deste CNPJ antes de fechar seus itens da comanda.</InlineNotice>}</div> : <InlineNotice>Não há itens pendentes do CNPJ atualmente selecionado.</InlineNotice>}
        </div> : null}
      </Modal>


      <Modal open={Boolean(packageReceive)} title="Receber pacote" subtitle={packageReceive ? `${packageReceive.nome} · ${packageReceive.cliente?.nome}` : ""} onClose={() => setPackageReceive(null)} footer={<><button className="ghost-button" type="button" onClick={() => setPackageReceive(null)}>Cancelar</button><button className="primary-button" type="button" disabled={!openSession || receivePackageMutation.isPending} onClick={() => receivePackageMutation.mutate()}>Confirmar recebimento</button></>}>
        <InlineNotice tone="error">{packageError}</InlineNotice>
        {packageReceive ? <><div className="pdv-package-receive-summary"><span>Valor do pacote</span><strong>{formatCurrency(packageReceive.valorPacote)}</strong></div><PaymentEditor payments={packagePayments} total={money(packageReceive.valorPacote)} onChange={setPackagePayments} /></> : null}
      </Modal>

      <Modal open={Boolean(saleDetailId)} title={saleDetailQuery.data ? `Venda #${saleDetailQuery.data.numero}` : "Venda"} onClose={() => setSaleDetailId(null)} size="lg" footer={saleDetailQuery.data?.status === "FINALIZADA" && canCancel ? <button className="ghost-button pdv-danger" type="button" onClick={() => { setCancelSale(saleDetailQuery.data); setSaleDetailId(null); }}>Cancelar venda</button> : null}>
        {saleDetailQuery.isLoading ? <div className="loading-state">Carregando...</div> : saleDetailQuery.data ? <div className="pdv-sale-detail"><div className="pdv-sale-detail__summary"><div><span>Cliente</span><strong>{saleDetailQuery.data.cliente?.nome || "Consumidor"}</strong></div><div><span>Data</span><strong>{formatDateTime(saleDetailQuery.data.createdAt)}</strong></div><div><span>Total</span><strong>{formatCurrency(saleDetailQuery.data.valorTotal)}</strong></div><div><span>Status</span><strong>{saleStatusLabel(saleDetailQuery.data.status)}</strong></div></div><div className="table-scroll"><table><thead><tr><th>Item</th><th>Pet</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>{saleDetailQuery.data.itens.map((item) => <tr key={item.id}><td>{item.descricao}</td><td>{item.pet?.nome || "—"}</td><td>{money(item.quantidade)}</td><td>{formatCurrency(item.valorUnitario)}</td><td>{formatCurrency(item.valorTotal)}</td></tr>)}</tbody></table></div><div className="pdv-sale-payment-tags">{saleDetailQuery.data.pagamentos.map((p) => <span key={p.id}><CreditCard size={13} /> {paymentLabels[p.forma]} · {formatCurrency(p.valor)}</span>)}</div></div> : null}
      </Modal>

      <Modal open={Boolean(cancelSale)} title="Cancelar venda" subtitle={cancelSale ? `Venda #${cancelSale.numero} · ${formatCurrency(cancelSale.valorTotal)}` : ""} onClose={() => setCancelSale(null)} footer={<><button className="ghost-button" type="button" onClick={() => setCancelSale(null)}>Voltar</button><button className="primary-button" type="button" disabled={cancelReason.trim().length < 3 || cancelSaleMutation.isPending} onClick={() => cancelSaleMutation.mutate()}>Confirmar cancelamento</button></>}>
        <InlineNotice tone="warning">O cancelamento estorna pagamentos, restaura o estoque e reabre os itens da comanda quando aplicável.</InlineNotice><FormField label="Motivo"><textarea className="form-control form-control--textarea" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Informe o motivo..." /></FormField>
      </Modal>
    </div>
  );
}
