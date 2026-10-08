import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  History,
  PackagePlus,
  Plus,
  Search,
  Truck,
  Warehouse,
  XCircle,
} from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { formatCurrency, formatDate, formatDateTime, formatDocument } from "../lib/formatters.js";
import Modal from "../components/Modal.jsx";
import FormField from "../components/FormField.jsx";
import InlineNotice from "../components/InlineNotice.jsx";

const emptySupplier = { nomeFantasia: "", razaoSocial: "", cpfCnpj: "", telefone: "", whatsapp: "", email: "", cidade: "", estado: "", observacoes: "", ativo: true };
const emptyEntry = { fornecedorId: "", numeroDocumento: "", dataEntrada: new Date().toISOString().slice(0, 10), observacao: "", itens: [] };
const emptyAdjustment = { itemCatalogoId: "", tipo: "AJUSTE_POSITIVO", quantidade: "1", loteId: "", observacao: "" };

const movementLabels = {
  ENTRADA: "Entrada",
  VENDA: "Venda",
  CONSUMO_INTERNO: "Consumo interno",
  AJUSTE_POSITIVO: "Ajuste +",
  AJUSTE_NEGATIVO: "Ajuste -",
  PERDA: "Perda",
  DEVOLUCAO_CLIENTE: "Devolução cliente",
  DEVOLUCAO_FORNECEDOR: "Devolução fornecedor",
  CANCELAMENTO: "Cancelamento",
};

function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function stockTone(product) {
  const q = num(product?.produto?.estoque?.quantidade);
  const min = num(product?.produto?.estoqueMinimo);
  if (q <= 0) return ["Sem estoque", "danger"];
  if (min > 0 && q <= min) return ["Estoque baixo", "warning"];
  return ["Normal", "success"];
}

export default function StockPage() {
  const { selectedCompany, hasPermission } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("ESTOQUE");
  const [search, setSearch] = useState("");
  const [supplierModal, setSupplierModal] = useState(false);
  const [supplierEditing, setSupplierEditing] = useState(null);
  const [supplierForm, setSupplierForm] = useState(emptySupplier);
  const [entryModal, setEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState(emptyEntry);
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState(emptyAdjustment);
  const [inventoryModal, setInventoryModal] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({ descricao: "", observacao: "" });
  const [inventoryDetailId, setInventoryDetailId] = useState(null);
  const [error, setError] = useState("");
  const canManage = hasPermission("estoque.gerenciar");

  const invalidate = () => Promise.all([
    qc.invalidateQueries({ queryKey: ["stock-summary"] }),
    qc.invalidateQueries({ queryKey: ["stock-products"] }),
    qc.invalidateQueries({ queryKey: ["stock-entries"] }),
    qc.invalidateQueries({ queryKey: ["stock-movements"] }),
    qc.invalidateQueries({ queryKey: ["stock-inventories"] }),
    qc.invalidateQueries({ queryKey: ["catalog-items"] }),
  ]);

  const summaryQuery = useQuery({ queryKey: ["stock-summary", selectedCompany?.id], queryFn: async () => (await api.get("/estoque/resumo")).data.resumo });
  const productsQuery = useQuery({ queryKey: ["stock-products", selectedCompany?.id, search], queryFn: async () => (await api.get("/estoque/produtos", { params: { busca: search || undefined } })).data.dados || [] });
  const suppliersQuery = useQuery({ queryKey: ["stock-suppliers", selectedCompany?.id], queryFn: async () => (await api.get("/estoque/fornecedores")).data.dados || [] });
  const entriesQuery = useQuery({ queryKey: ["stock-entries", selectedCompany?.id], queryFn: async () => (await api.get("/estoque/entradas")).data.dados || [] });
  const movementsQuery = useQuery({ queryKey: ["stock-movements", selectedCompany?.id], queryFn: async () => (await api.get("/estoque/movimentacoes", { params: { limite: 150 } })).data.dados || [] });
  const inventoriesQuery = useQuery({ queryKey: ["stock-inventories", selectedCompany?.id], queryFn: async () => (await api.get("/estoque/inventarios")).data.dados || [] });
  const inventoryQuery = useQuery({ queryKey: ["stock-inventory", inventoryDetailId], enabled: Boolean(inventoryDetailId), queryFn: async () => (await api.get(`/estoque/inventarios/${inventoryDetailId}`)).data.inventario });

  const products = productsQuery.data || [];
  const summary = summaryQuery.data || {};

  const supplierMutation = useMutation({
    mutationFn: async () => supplierEditing ? (await api.patch(`/estoque/fornecedores/${supplierEditing.id}`, supplierForm)).data : (await api.post("/estoque/fornecedores", supplierForm)).data,
    onSuccess: async () => { setSupplierModal(false); setSupplierEditing(null); setSupplierForm(emptySupplier); setError(""); await qc.invalidateQueries({ queryKey: ["stock-suppliers"] }); },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const entryMutation = useMutation({
    mutationFn: async () => (await api.post("/estoque/entradas", { ...entryForm, fornecedorId: entryForm.fornecedorId || null })).data,
    onSuccess: async () => { setEntryModal(false); setEntryForm(emptyEntry); setError(""); await invalidate(); },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const adjustmentMutation = useMutation({
    mutationFn: async () => (await api.post("/estoque/ajustes", { ...adjustForm, loteId: adjustForm.loteId || null })).data,
    onSuccess: async () => { setAdjustModal(false); setAdjustForm(emptyAdjustment); setError(""); await invalidate(); },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const inventoryCreate = useMutation({
    mutationFn: async () => (await api.post("/estoque/inventarios", inventoryForm)).data.inventario,
    onSuccess: async (inv) => { setInventoryModal(false); setInventoryForm({ descricao: "", observacao: "" }); setInventoryDetailId(inv.id); await qc.invalidateQueries({ queryKey: ["stock-inventories"] }); },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const inventoryCount = useMutation({
    mutationFn: async ({ inventoryId, itemId, quantidadeContada }) => (await api.patch(`/estoque/inventarios/${inventoryId}/itens/${itemId}`, { quantidadeContada })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock-inventory", inventoryDetailId] }),
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const inventoryFinish = useMutation({
    mutationFn: async (id) => (await api.post(`/estoque/inventarios/${id}/concluir`)).data,
    onSuccess: async () => { setInventoryDetailId(null); setError(""); await invalidate(); },
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  const cancelEntry = useMutation({
    mutationFn: async (id) => (await api.post(`/estoque/entradas/${id}/cancelar`, { motivo: "Entrada cancelada pelo usuário." })).data,
    onSuccess: invalidate,
    onError: (e) => setError(getApiErrorMessage(e)),
  });

  function openSupplier(supplier = null) {
    setSupplierEditing(supplier); setSupplierForm(supplier ? { ...emptySupplier, ...supplier, cpfCnpj: supplier.cpfCnpj || "", email: supplier.email || "" } : emptySupplier); setError(""); setSupplierModal(true);
  }
  function addEntryLine() {
    const first = products.find((p) => !entryForm.itens.some((i) => i.itemCatalogoId === p.id));
    setEntryForm((f) => ({ ...f, itens: [...f.itens, { itemCatalogoId: first?.id || "", quantidade: "1", custoUnitario: first?.produto?.custoMedio ?? first?.custoReferencia ?? "", numeroLote: "", dataFabricacao: "", dataValidade: "" }] }));
  }
  function updateEntryLine(index, patch) { setEntryForm((f) => ({ ...f, itens: f.itens.map((i, n) => n === index ? { ...i, ...patch } : i) })); }
  function removeEntryLine(index) { setEntryForm((f) => ({ ...f, itens: f.itens.filter((_, n) => n !== index) })); }
  const entryTotal = useMemo(() => entryForm.itens.reduce((s, i) => s + num(i.quantidade) * num(i.custoUnitario), 0), [entryForm.itens]);
  const selectedAdjustmentProduct = products.find((p) => p.id === adjustForm.itemCatalogoId);

  const tabs = [
    ["ESTOQUE", "Estoque", Warehouse], ["ENTRADAS", "Entradas", PackagePlus], ["FORNECEDORES", "Fornecedores", Truck], ["INVENTARIO", "Inventário", ClipboardCheck], ["MOVIMENTACOES", "Movimentações", History],
  ];

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div><span className="page-kicker">Operação</span><h1>Estoque</h1><p>Controle de saldo, lotes, validade, entradas e inventário do CNPJ atual.</p></div>
        {canManage ? <div className="page-actions"><button className="secondary-button" onClick={() => { setAdjustForm(emptyAdjustment); setAdjustModal(true); }}><AlertTriangle size={15}/> Ajuste</button><button className="primary-button" onClick={() => { setEntryForm(emptyEntry); setEntryModal(true); }}><PackagePlus size={15}/> Nova entrada</button></div> : null}
      </div>

      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}

      <div className="stock-summary-grid">
        <div className="stat-card"><span className="stat-card__icon"><Boxes/></span><div><small>PRODUTOS CONTROLADOS</small><strong>{summary.produtos ?? 0}</strong><span>no CNPJ atual</span></div></div>
        <div className="stat-card"><span className="stat-card__icon"><AlertTriangle/></span><div><small>ESTOQUE BAIXO</small><strong>{summary.estoqueBaixo ?? 0}</strong><span>{summary.semEstoque ?? 0} sem estoque</span></div></div>
        <div className="stat-card"><span className="stat-card__icon"><ClipboardCheck/></span><div><small>LOTES / VALIDADE</small><strong>{summary.lotesVencendo ?? 0}</strong><span>{summary.lotesVencidos ?? 0} vencidos</span></div></div>
        <div className="stat-card"><span className="stat-card__icon"><Warehouse/></span><div><small>VALOR EM ESTOQUE</small><strong className="stat-card__text-value">{formatCurrency(summary.valorEstoque ?? 0)}</strong><span>pelo custo médio</span></div></div>
      </div>

      <div className="settings-tabs stock-tabs">
        {tabs.map(([value,label,Icon]) => <button key={value} className={`settings-tab ${tab===value?"settings-tab--active":""}`} onClick={() => setTab(value)}><Icon size={14}/>{label}</button>)}
      </div>

      {tab === "ESTOQUE" ? <section className="panel">
        <div className="catalog-toolbar"><div className="search-input catalog-search"><Search size={15}/><input placeholder="Buscar produto, SKU ou código de barras..." value={search} onChange={(e)=>setSearch(e.target.value)}/></div></div>
        <div className="table-scroll"><table className="data-table stock-table"><thead><tr><th>Produto</th><th>Categoria</th><th>Saldo</th><th>Mínimo</th><th>Custo médio</th><th>Lotes</th><th>Status</th></tr></thead><tbody>
          {products.map((item) => { const [label,tone]=stockTone(item); return <tr key={item.id}><td><strong>{item.nome}</strong><small>{item.codigoInterno || item.codigoBarras || "Sem código"}</small></td><td>{item.categoria?.nome || "—"}</td><td><b>{num(item.produto?.estoque?.quantidade).toLocaleString("pt-BR")}</b> {item.produto?.unidade}</td><td>{num(item.produto?.estoqueMinimo).toLocaleString("pt-BR")}</td><td>{formatCurrency(item.produto?.custoMedio || 0)}</td><td>{item.produto?.lotes?.length || 0}</td><td><span className={`badge badge--${tone}`}>{label}</span></td></tr> })}
          {!products.length ? <tr><td colSpan="7"><div className="mini-empty">Nenhum produto encontrado.</div></td></tr> : null}
        </tbody></table></div>
      </section> : null}

      {tab === "ENTRADAS" ? <section className="panel"><div className="panel__heading"><div><h2>Entradas de mercadoria</h2><p>Histórico de compras e reposições registradas.</p></div>{canManage?<button className="primary-button" onClick={()=>setEntryModal(true)}><Plus size={14}/> Registrar entrada</button>:null}</div><div className="table-scroll"><table className="data-table"><thead><tr><th>Data</th><th>Documento</th><th>Fornecedor</th><th>Itens</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>{(entriesQuery.data||[]).map(e=><tr key={e.id}><td>{formatDateTime(e.dataEntrada)}</td><td>{e.numeroDocumento||"—"}</td><td>{e.fornecedor?.nomeFantasia||"Sem fornecedor"}</td><td>{e.itens?.length||0}</td><td>{formatCurrency(e.valorTotal)}</td><td><span className={`badge badge--${e.status==="CONCLUIDA"?"success":"muted"}`}>{e.status}</span></td><td>{canManage&&e.status==="CONCLUIDA"?<button className="icon-button table-action" title="Cancelar entrada" onClick={()=>{if(confirm("Cancelar esta entrada e devolver as quantidades do estoque?")) cancelEntry.mutate(e.id)}}><XCircle size={15}/></button>:null}</td></tr>)}</tbody></table></div></section> : null}

      {tab === "FORNECEDORES" ? <section className="panel"><div className="panel__heading"><div><h2>Fornecedores</h2><p>Cadastro compartilhado pela organização e vínculo com este CNPJ.</p></div>{canManage?<button className="primary-button" onClick={()=>openSupplier()}><Plus size={14}/> Novo fornecedor</button>:null}</div><div className="table-scroll"><table className="data-table"><thead><tr><th>Nome</th><th>Documento</th><th>Contato</th><th>Cidade</th><th>Status</th><th></th></tr></thead><tbody>{(suppliersQuery.data||[]).map(f=><tr key={f.id}><td><strong>{f.nomeFantasia}</strong><small>{f.razaoSocial||""}</small></td><td>{formatDocument(f.cpfCnpj)}</td><td>{f.whatsapp||f.telefone||f.email||"—"}</td><td>{[f.cidade,f.estado].filter(Boolean).join(" / ")||"—"}</td><td><span className={`badge badge--${f.ativo?"success":"muted"}`}>{f.ativo?"Ativo":"Inativo"}</span></td><td>{canManage?<button className="icon-button table-action" onClick={()=>openSupplier(f)}><Eye size={15}/></button>:null}</td></tr>)}</tbody></table></div></section> : null}

      {tab === "INVENTARIO" ? <section className="panel"><div className="panel__heading"><div><h2>Inventários</h2><p>Contagem física e ajuste automático das diferenças.</p></div>{canManage?<button className="primary-button" onClick={()=>setInventoryModal(true)}><Plus size={14}/> Novo inventário</button>:null}</div><div className="table-scroll"><table className="data-table"><thead><tr><th>Início</th><th>Descrição</th><th>Responsável</th><th>Itens</th><th>Status</th><th></th></tr></thead><tbody>{(inventoriesQuery.data||[]).map(i=><tr key={i.id}><td>{formatDateTime(i.iniciadoEm)}</td><td>{i.descricao||"Inventário geral"}</td><td>{i.usuario?.nome||"—"}</td><td>{i._count?.itens||0}</td><td><span className={`badge badge--${i.status==="ABERTO"?"warning":i.status==="CONCLUIDO"?"success":"muted"}`}>{i.status}</span></td><td><button className="icon-button table-action" onClick={()=>setInventoryDetailId(i.id)}><Eye size={15}/></button></td></tr>)}</tbody></table></div></section> : null}

      {tab === "MOVIMENTACOES" ? <section className="panel"><div className="panel__heading"><div><h2>Movimentações</h2><p>Trilha completa de entradas, vendas, ajustes, perdas e cancelamentos.</p></div></div><div className="table-scroll"><table className="data-table stock-movements"><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtd.</th><th>Saldo anterior</th><th>Saldo posterior</th><th>Lote</th><th>Usuário</th></tr></thead><tbody>{(movementsQuery.data||[]).map(m=><tr key={m.id}><td>{formatDateTime(m.createdAt)}</td><td>{m.produto?.item?.nome||"—"}</td><td>{movementLabels[m.tipo]||m.tipo}</td><td>{num(m.quantidade).toLocaleString("pt-BR")}</td><td>{num(m.saldoAnterior).toLocaleString("pt-BR")}</td><td><b>{num(m.saldoPosterior).toLocaleString("pt-BR")}</b></td><td>{m.lote?.numeroLote||"—"}</td><td>{m.usuario?.nome||"Sistema"}</td></tr>)}</tbody></table></div></section> : null}

      <Modal open={supplierModal} onClose={()=>setSupplierModal(false)} title={supplierEditing?"Editar fornecedor":"Novo fornecedor"} subtitle="Dados do fornecedor da organização." size="lg" footer={<><button className="secondary-button" onClick={()=>setSupplierModal(false)}>Cancelar</button><button className="primary-button" disabled={supplierMutation.isPending} onClick={()=>supplierMutation.mutate()}>{supplierMutation.isPending?"Salvando...":"Salvar"}</button></>}>
        {error?<InlineNotice tone="error">{error}</InlineNotice>:null}<div className="form-grid form-grid--2"><FormField label="Nome fantasia"><input className="form-control" value={supplierForm.nomeFantasia} onChange={e=>setSupplierForm({...supplierForm,nomeFantasia:e.target.value})}/></FormField><FormField label="Razão social"><input className="form-control" value={supplierForm.razaoSocial||""} onChange={e=>setSupplierForm({...supplierForm,razaoSocial:e.target.value})}/></FormField><FormField label="CPF/CNPJ"><input className="form-control" value={supplierForm.cpfCnpj||""} onChange={e=>setSupplierForm({...supplierForm,cpfCnpj:e.target.value})}/></FormField><FormField label="WhatsApp"><input className="form-control" value={supplierForm.whatsapp||""} onChange={e=>setSupplierForm({...supplierForm,whatsapp:e.target.value})}/></FormField><FormField label="E-mail"><input className="form-control" value={supplierForm.email||""} onChange={e=>setSupplierForm({...supplierForm,email:e.target.value})}/></FormField><FormField label="Cidade"><input className="form-control" value={supplierForm.cidade||""} onChange={e=>setSupplierForm({...supplierForm,cidade:e.target.value})}/></FormField></div>
      </Modal>

      <Modal open={entryModal} onClose={()=>setEntryModal(false)} title="Registrar entrada de mercadoria" subtitle="Atualiza saldo, lote, validade e custo médio dos produtos." size="lg" footer={<><button className="secondary-button" onClick={()=>setEntryModal(false)}>Cancelar</button><button className="primary-button" disabled={entryMutation.isPending||!entryForm.itens.length} onClick={()=>entryMutation.mutate()}>{entryMutation.isPending?"Registrando...":`Registrar ${formatCurrency(entryTotal)}`}</button></>}>
        {error?<InlineNotice tone="error">{error}</InlineNotice>:null}<div className="form-grid form-grid--3"><FormField label="Fornecedor"><select className="form-control" value={entryForm.fornecedorId} onChange={e=>setEntryForm({...entryForm,fornecedorId:e.target.value})}><option value="">Sem fornecedor</option>{(suppliersQuery.data||[]).filter(f=>f.ativo).map(f=><option key={f.id} value={f.id}>{f.nomeFantasia}</option>)}</select></FormField><FormField label="Documento / NF"><input className="form-control" value={entryForm.numeroDocumento} onChange={e=>setEntryForm({...entryForm,numeroDocumento:e.target.value})}/></FormField><FormField label="Data"><input className="form-control" type="date" value={entryForm.dataEntrada} onChange={e=>setEntryForm({...entryForm,dataEntrada:e.target.value})}/></FormField></div><div className="stock-entry-heading"><strong>Itens da entrada</strong><button className="ghost-button" onClick={addEntryLine}><Plus size={14}/> Item</button></div>{!entryForm.itens.length?<div className="mini-empty">Adicione os produtos recebidos.</div>:<div className="stock-entry-lines">{entryForm.itens.map((line,index)=>{const product=products.find(p=>p.id===line.itemCatalogoId);return <div className="stock-entry-line" key={index}><select className="form-control" value={line.itemCatalogoId} onChange={e=>updateEntryLine(index,{itemCatalogoId:e.target.value})}><option value="">Produto...</option>{products.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select><input className="form-control" type="number" step="0.001" min="0.001" placeholder="Qtd." value={line.quantidade} onChange={e=>updateEntryLine(index,{quantidade:e.target.value})}/><input className="form-control" type="number" step="0.01" min="0" placeholder="Custo" value={line.custoUnitario} onChange={e=>updateEntryLine(index,{custoUnitario:e.target.value})}/><input className="form-control" placeholder="Lote" value={line.numeroLote} onChange={e=>updateEntryLine(index,{numeroLote:e.target.value})}/><input className="form-control" type="date" title="Validade" value={line.dataValidade} onChange={e=>updateEntryLine(index,{dataValidade:e.target.value})}/><span>{formatCurrency(num(line.quantidade)*num(line.custoUnitario))}</span><button className="icon-button table-action" onClick={()=>removeEntryLine(index)}><XCircle size={15}/></button>{product?.produto?.controlaLote?<small className="stock-entry-line__hint">Lote obrigatório</small>:null}</div>})}</div>}
      </Modal>

      <Modal open={adjustModal} onClose={()=>setAdjustModal(false)} title="Ajuste de estoque" subtitle="Use para perdas, consumo interno, devoluções ou correções manuais." footer={<><button className="secondary-button" onClick={()=>setAdjustModal(false)}>Cancelar</button><button className="primary-button" disabled={adjustmentMutation.isPending} onClick={()=>adjustmentMutation.mutate()}>Registrar ajuste</button></>}>
        {error?<InlineNotice tone="error">{error}</InlineNotice>:null}<div className="form-grid"><FormField label="Produto"><select className="form-control" value={adjustForm.itemCatalogoId} onChange={e=>setAdjustForm({...adjustForm,itemCatalogoId:e.target.value,loteId:""})}><option value="">Selecione...</option>{products.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></FormField><div className="form-grid form-grid--2"><FormField label="Tipo"><select className="form-control" value={adjustForm.tipo} onChange={e=>setAdjustForm({...adjustForm,tipo:e.target.value})}><option value="AJUSTE_POSITIVO">Ajuste positivo</option><option value="AJUSTE_NEGATIVO">Ajuste negativo</option><option value="PERDA">Perda</option><option value="CONSUMO_INTERNO">Consumo interno</option><option value="DEVOLUCAO_CLIENTE">Devolução cliente</option><option value="DEVOLUCAO_FORNECEDOR">Devolução fornecedor</option></select></FormField><FormField label="Quantidade"><input className="form-control" type="number" min="0.001" step="0.001" value={adjustForm.quantidade} onChange={e=>setAdjustForm({...adjustForm,quantidade:e.target.value})}/></FormField></div>{selectedAdjustmentProduct?.produto?.controlaLote?<FormField label="Lote"><select className="form-control" value={adjustForm.loteId} onChange={e=>setAdjustForm({...adjustForm,loteId:e.target.value})}><option value="">Selecione...</option>{(selectedAdjustmentProduct.produto.lotes||[]).map(l=><option key={l.id} value={l.id}>{l.numeroLote} · {num(l.quantidadeAtual)} · val. {formatDate(l.dataValidade)}</option>)}</select></FormField>:null}<FormField label="Motivo"><textarea className="form-control" rows="3" value={adjustForm.observacao} onChange={e=>setAdjustForm({...adjustForm,observacao:e.target.value})}/></FormField></div>
      </Modal>

      <Modal open={inventoryModal} onClose={()=>setInventoryModal(false)} title="Novo inventário" subtitle="O BichOne captura o saldo atual para iniciar a contagem física." footer={<><button className="secondary-button" onClick={()=>setInventoryModal(false)}>Cancelar</button><button className="primary-button" disabled={inventoryCreate.isPending} onClick={()=>inventoryCreate.mutate()}>Iniciar inventário</button></>}><FormField label="Descrição"><input className="form-control" placeholder="Ex.: Inventário mensal" value={inventoryForm.descricao} onChange={e=>setInventoryForm({...inventoryForm,descricao:e.target.value})}/></FormField></Modal>

      <Modal open={Boolean(inventoryDetailId)} onClose={()=>setInventoryDetailId(null)} title={inventoryQuery.data?.descricao||"Inventário de estoque"} subtitle={inventoryQuery.data?`Iniciado em ${formatDateTime(inventoryQuery.data.iniciadoEm)}`:"Carregando..."} size="lg" footer={inventoryQuery.data?.status==="ABERTO"&&canManage?<><button className="secondary-button" onClick={()=>setInventoryDetailId(null)}>Fechar</button><button className="primary-button" disabled={inventoryFinish.isPending} onClick={()=>inventoryFinish.mutate(inventoryDetailId)}><CheckCircle2 size={14}/> Concluir inventário</button></>:<button className="secondary-button" onClick={()=>setInventoryDetailId(null)}>Fechar</button>}>
        {error?<InlineNotice tone="error">{error}</InlineNotice>:null}<div className="table-scroll"><table className="data-table stock-inventory-table"><thead><tr><th>Produto / lote</th><th>Sistema</th><th>Contado</th><th>Diferença</th></tr></thead><tbody>{(inventoryQuery.data?.itens||[]).map(i=><tr key={i.id}><td><strong>{i.produto?.item?.nome}</strong><small>{i.lote?`Lote ${i.lote.numeroLote} · Val. ${formatDate(i.lote.dataValidade)}`:"Sem lote"}</small></td><td>{num(i.saldoSistema).toLocaleString("pt-BR")}</td><td>{inventoryQuery.data.status==="ABERTO"&&canManage?<input className="form-control inventory-count-input" type="number" min="0" step="0.001" defaultValue={i.quantidadeContada??""} onBlur={e=>{if(e.target.value!=="") inventoryCount.mutate({inventoryId:inventoryDetailId,itemId:i.id,quantidadeContada:Number(e.target.value)})}}/>:(i.quantidadeContada??"—")}</td><td><b className={num(i.diferenca)<0?"is-negative":num(i.diferenca)>0?"is-positive":""}>{i.diferenca===null?"—":num(i.diferenca).toLocaleString("pt-BR")}</b></td></tr>)}</tbody></table></div>
      </Modal>
    </div>
  );
}
