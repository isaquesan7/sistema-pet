import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Eye,
  FileCheck2,
  PackageCheck,
  Plus,
  ReceiptText,
  Search,
  Send,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { formatCurrency, formatDateTime } from "../lib/formatters.js";
import Modal from "../components/Modal.jsx";
import FormField from "../components/FormField.jsx";
import InlineNotice from "../components/InlineNotice.jsx";

const docLabels = { NFCE: "NFC-e", NFE: "NF-e", NFSE: "NFS-e", RECIBO: "Recibo interno" };
const statusLabels = { PENDENTE: "Pendente", PROCESSANDO: "Processando", AUTORIZADO: "Autorizado", REJEITADO: "Rejeitado", CANCELADO: "Cancelado", ERRO: "Erro" };
const statusTones = { PENDENTE: "warning", PROCESSANDO: "info", AUTORIZADO: "success", REJEITADO: "danger", CANCELADO: "muted", ERRO: "danger" };
const regimeLabels = { SIMPLES_NACIONAL: "Simples Nacional", LUCRO_PRESUMIDO: "Lucro Presumido", LUCRO_REAL: "Lucro Real", MEI: "MEI", OUTRO: "Outro / não definido" };

function str(value) { return value === null || value === undefined ? "" : String(value); }
function toNumberOrNull(value) { if (value === "" || value === null || value === undefined) return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
function inputDate(value) { return value ? String(value).slice(0, 10) : ""; }
function availableTypes(sale) {
  const active = (sale?.documentosFiscais || []).filter((doc) => doc.status !== "CANCELADO");
  const used = new Set(active.map((doc) => doc.tipo));
  const merchandiseDocumentExists = active.some((doc) => ["NFE", "NFCE"].includes(doc.tipo));
  return (sale?.tiposPossiveis || ["RECIBO"]).filter((type) => {
    if (["NFE", "NFCE"].includes(type) && merchandiseDocumentExists) return false;
    return !used.has(type);
  });
}

const blankConfig = {
  regime: "OUTRO", ambiente: "HOMOLOGACAO", provedorFiscal: "", provedorContaReferencia: "",
  serieNfe: "1", serieNfce: "1", serieNfse: "", tipoDocumentoPadrao: "", emissaoAutomaticaVenda: false,
  naturezaOperacaoPadrao: "", codigoMunicipioIbge: "", certificadoReferencia: "", certificadoValidoAte: "",
};

function configFromApi(data) {
  if (!data) return blankConfig;
  return {
    regime: data.regime || "OUTRO",
    ambiente: data.ambiente || "HOMOLOGACAO",
    provedorFiscal: data.provedorFiscal || "",
    provedorContaReferencia: data.provedorContaReferencia || "",
    serieNfe: data.serieNfe || "",
    serieNfce: data.serieNfce || "",
    serieNfse: data.serieNfse || "",
    tipoDocumentoPadrao: data.tipoDocumentoPadrao || "",
    emissaoAutomaticaVenda: Boolean(data.emissaoAutomaticaVenda),
    naturezaOperacaoPadrao: data.naturezaOperacaoPadrao || "",
    codigoMunicipioIbge: data.codigoMunicipioIbge || "",
    certificadoReferencia: data.certificadoReferencia || "",
    certificadoValidoAte: inputDate(data.certificadoValidoAte),
  };
}

function fiscalForm(item) {
  const f = item?.fiscalConfig || {};
  return {
    ncm: f.ncm || "", cest: f.cest || "", cfop: f.cfop || "", origemMercadoria: f.origemMercadoria || "",
    cstCsosn: f.cstCsosn || "", codigoServicoMunicipal: f.codigoServicoMunicipal || "",
    aliquotaIcms: str(f.aliquotaIcms), aliquotaIss: str(f.aliquotaIss),
  };
}

export default function FiscalPage() {
  const { selectedCompany, hasPermission } = useAuth();
  const qc = useQueryClient();
  const canManage = hasPermission("fiscal.gerenciar");
  const canIssue = hasPermission("fiscal.emitir");
  const canCancel = hasPermission("fiscal.cancelar");
  const [tab, setTab] = useState("RESUMO");
  const [search, setSearch] = useState("");
  const [itemPendingOnly, setItemPendingOnly] = useState(false);
  const [itemModal, setItemModal] = useState(null);
  const [itemForm, setItemForm] = useState(fiscalForm());
  const [issueSale, setIssueSale] = useState(null);
  const [issueType, setIssueType] = useState("RECIBO");
  const [processNow, setProcessNow] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [cancelDoc, setCancelDoc] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [configForm, setConfigForm] = useState(blankConfig);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const summaryQuery = useQuery({ queryKey: ["fiscal-summary", selectedCompany?.id], queryFn: async () => (await api.get("/fiscal/resumo")).data.resumo });
  const configQuery = useQuery({ queryKey: ["fiscal-config", selectedCompany?.id], queryFn: async () => (await api.get("/fiscal/configuracao")).data.configuracao });
  const itemsQuery = useQuery({ queryKey: ["fiscal-items", selectedCompany?.id, search, itemPendingOnly], enabled: tab === "ITENS", queryFn: async () => (await api.get("/fiscal/itens", { params: { busca: search || undefined, pendente: itemPendingOnly || undefined } })).data.dados || [] });
  const salesQuery = useQuery({ queryKey: ["fiscal-sales", selectedCompany?.id, search], enabled: tab === "VENDAS", queryFn: async () => (await api.get("/fiscal/vendas", { params: { busca: search || undefined } })).data.dados || [] });
  const docsQuery = useQuery({ queryKey: ["fiscal-documents", selectedCompany?.id, search], enabled: tab === "DOCUMENTOS", queryFn: async () => (await api.get("/fiscal/documentos", { params: { busca: search || undefined } })).data.dados || [] });
  const detailQuery = useQuery({ queryKey: ["fiscal-document", detailId], enabled: Boolean(detailId), queryFn: async () => (await api.get(`/fiscal/documentos/${detailId}`)).data.documento });
  const validationQuery = useQuery({ queryKey: ["fiscal-validation", issueSale?.id, issueType], enabled: Boolean(issueSale?.id && issueType), queryFn: async () => (await api.get(`/fiscal/vendas/${issueSale.id}/validacao`, { params: { tipo: issueType } })).data.validacao });

  useEffect(() => {
    if (configQuery.data) setConfigForm(configFromApi(configQuery.data));
  }, [configQuery.data]);

  function invalidate() {
    ["fiscal-summary", "fiscal-config", "fiscal-items", "fiscal-sales", "fiscal-documents", "pdv-sales"].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
  }

  const configMutation = useMutation({
    mutationFn: async () => (await api.put("/fiscal/configuracao", { ...configForm, tipoDocumentoPadrao: configForm.tipoDocumentoPadrao || null, codigoMunicipioIbge: configForm.codigoMunicipioIbge || null, certificadoValidoAte: configForm.certificadoValidoAte || null })).data,
    onSuccess: () => { setError(""); setSuccess("Configuração fiscal salva."); invalidate(); },
    onError: (e) => { setSuccess(""); setError(getApiErrorMessage(e)); },
  });

  const itemMutation = useMutation({
    mutationFn: async () => (await api.put(`/fiscal/itens/${itemModal.id}`, { ...itemForm, aliquotaIcms: toNumberOrNull(itemForm.aliquotaIcms), aliquotaIss: toNumberOrNull(itemForm.aliquotaIss) })).data,
    onSuccess: () => { setItemModal(null); setError(""); setSuccess("Tributação do item atualizada."); invalidate(); },
    onError: (e) => { setSuccess(""); setError(getApiErrorMessage(e)); },
  });

  const issueMutation = useMutation({
    mutationFn: async () => {
      const created = (await api.post("/fiscal/documentos", { vendaId: issueSale.id, tipo: issueType, processarAgora: false })).data;
      if (!processNow) return created;
      try {
        return (await api.post(`/fiscal/documentos/${created.documento.id}/processar`)).data;
      } catch (error) {
        error.petriseDocumentId = created.documento.id;
        throw error;
      }
    },
    onSuccess: (data) => { setIssueSale(null); setError(""); setSuccess(processNow ? "Documento processado." : "Documento adicionado à fila fiscal."); invalidate(); if (data?.documento?.id) setDetailId(data.documento.id); },
    onError: (e) => { setSuccess(""); setError(getApiErrorMessage(e)); invalidate(); if (e.petriseDocumentId) { setIssueSale(null); setDetailId(e.petriseDocumentId); } },
  });

  const processMutation = useMutation({
    mutationFn: async (id) => (await api.post(`/fiscal/documentos/${id}/processar`)).data,
    onSuccess: () => { setError(""); setSuccess("Processamento concluído."); invalidate(); if (detailId) qc.invalidateQueries({ queryKey: ["fiscal-document", detailId] }); },
    onError: (e) => { setSuccess(""); setError(getApiErrorMessage(e)); },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => (await api.post(`/fiscal/documentos/${cancelDoc.id}/cancelar`, { motivo: cancelReason })).data,
    onSuccess: () => { setCancelDoc(null); setCancelReason(""); setError(""); setSuccess("Documento cancelado."); invalidate(); if (detailId) qc.invalidateQueries({ queryKey: ["fiscal-document", detailId] }); },
    onError: (e) => { setSuccess(""); setError(getApiErrorMessage(e)); },
  });

  const summary = summaryQuery.data || {};
  const config = configQuery.data || {};
  const docs = docsQuery.data || [];
  const items = itemsQuery.data || [];
  const sales = salesQuery.data || [];
  const validation = validationQuery.data;
  const detail = detailQuery.data;

  const readiness = useMemo(() => {
    const points = [];
    if (!summary.configurado) points.push("Configuração fiscal do CNPJ ainda não foi salva.");
    if (summary.itens?.pendentes) points.push(`${summary.itens.pendentes} item(ns) ainda precisam de tributação.`);
    if (!summary.provedor) points.push("Provedor fiscal não configurado para documentos oficiais.");
    return points;
  }, [summary]);

  function openItem(item) { setItemModal(item); setItemForm(fiscalForm(item)); setError(""); setSuccess(""); }
  function openIssue(sale) { const options = availableTypes(sale); const first = options.find((t) => t !== "RECIBO") || options[0] || "RECIBO"; setIssueSale(sale); setIssueType(first); setProcessNow(false); setError(""); setSuccess(""); }

  return (
    <div className="page-stack fiscal-page">
      <section className="page-heading">
        <div><span className="page-kicker">Fiscal</span><h1>Documentos fiscais</h1><p>Prepare a tributação, acompanhe a fila e mantenha cada documento vinculado ao CNPJ correto.</p></div>
        <div className="page-heading__actions"><span className={`badge badge--${summary.ambiente === "PRODUCAO" ? "danger" : "info"}`}>{summary.ambiente === "PRODUCAO" ? "Produção" : "Homologação"}</span></div>
      </section>

      <InlineNotice tone="warning">O PetRise organiza e prepara a emissão, mas NF-e/NFC-e/NFS-e só possuem validade quando transmitidas e autorizadas por um provedor fiscal homologado. O provedor <b>development</b> serve exclusivamente para simulação em homologação.</InlineNotice>
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      {success && <InlineNotice tone="success">{success}</InlineNotice>}

      <div className="settings-tabs fiscal-tabs">
        {[['RESUMO','Visão geral'],['VENDAS','Vendas'],['ITENS','Tributação'],['DOCUMENTOS','Documentos'],['CONFIG','Configuração']].map(([id,label]) => <button key={id} className={`settings-tab ${tab===id?'settings-tab--active':''}`} onClick={() => { setTab(id); setSearch(""); }}>{label}</button>)}
      </div>

      {tab === "RESUMO" && <>
        <section className="fiscal-summary-grid">
          <article className="panel fiscal-stat"><span><FileCheck2 size={18}/></span><div><small>Autorizados</small><strong>{summary.documentos?.autorizados || 0}</strong><em>documentos</em></div></article>
          <article className="panel fiscal-stat"><span><ReceiptText size={18}/></span><div><small>Na fila</small><strong>{summary.documentos?.pendentes || 0}</strong><em>pendentes</em></div></article>
          <article className={`panel fiscal-stat ${(summary.documentos?.erros||0)>0?'has-warning':''}`}><span><AlertTriangle size={18}/></span><div><small>Erros / rejeições</small><strong>{summary.documentos?.erros || 0}</strong><em>revisar</em></div></article>
          <article className={`panel fiscal-stat ${(summary.itens?.pendentes||0)>0?'has-warning':''}`}><span><PackageCheck size={18}/></span><div><small>Itens fiscais</small><strong>{summary.itens?.configurados || 0}/{summary.itens?.total || 0}</strong><em>{summary.itens?.pendentes || 0} pendente(s)</em></div></article>
        </section>
        <section className="fiscal-overview-grid">
          <div className="panel">
            <div className="panel__heading"><div><span>Prontidão</span><h2>Checklist do CNPJ</h2></div><ShieldCheck size={19}/></div>
            <div className="fiscal-checklist">
              {readiness.length === 0 ? <div className="fiscal-check fiscal-check--ok"><CheckCircle2 size={17}/><div><strong>Base fiscal pronta</strong><span>Revise cada venda antes da transmissão em produção.</span></div></div> : readiness.map((text) => <div className="fiscal-check" key={text}><AlertTriangle size={17}/><div><strong>Pendente</strong><span>{text}</span></div></div>)}
            </div>
          </div>
          <div className="panel">
            <div className="panel__heading"><div><span>Operação</span><h2>Configuração atual</h2></div><Settings2 size={19}/></div>
            <div className="fiscal-config-summary">
              <div><span>Regime</span><strong>{regimeLabels[config.regime] || config.regime || "Não definido"}</strong></div>
              <div><span>Provedor</span><strong>{config.provedorFiscal || "Não configurado"}</strong></div>
              <div><span>Documento padrão</span><strong>{docLabels[config.tipoDocumentoPadrao] || "Manual"}</strong></div>
              <div><span>Emissão automática</span><strong>{config.emissaoAutomaticaVenda ? "Fila automática" : "Desativada"}</strong></div>
            </div>
          </div>
        </section>
      </>}

      {tab === "VENDAS" && <section className="panel fiscal-list-panel">
        <div className="panel__heading fiscal-toolbar"><div><h2>Vendas finalizadas</h2><p>Escolha o documento compatível com os itens da venda.</p></div><label className="search-input"><Search size={15}/><input placeholder="Cliente ou item..." value={search} onChange={(e)=>setSearch(e.target.value)}/></label></div>
        <div className="table-scroll"><table className="data-table fiscal-table"><thead><tr><th>Venda</th><th>Data</th><th>Cliente</th><th>Total</th><th>Documentos</th><th></th></tr></thead><tbody>
          {sales.map((sale)=><tr key={sale.id}><td><b>#{sale.numero}</b></td><td>{formatDateTime(sale.finalizadaEm)}</td><td>{sale.cliente?.nome || "Consumidor não identificado"}</td><td><b>{formatCurrency(sale.valorTotal)}</b></td><td><div className="fiscal-doc-chips">{sale.documentosFiscais?.length ? sale.documentosFiscais.map((doc)=><span key={doc.id} className={`badge badge--${statusTones[doc.status]||'muted'}`}>{docLabels[doc.tipo]||doc.tipo}: {statusLabels[doc.status]||doc.status}</span>) : <span className="muted-text">Sem documento</span>}</div></td><td>{canIssue && <button className="primary-button fiscal-mini" disabled={!availableTypes(sale).length} onClick={()=>openIssue(sale)}><Plus size={13}/> Documento</button>}</td></tr>)}
          {!sales.length && <tr><td colSpan="6" className="empty-cell">Nenhuma venda encontrada.</td></tr>}
        </tbody></table></div>
      </section>}

      {tab === "ITENS" && <section className="panel fiscal-list-panel">
        <div className="panel__heading fiscal-toolbar"><div><h2>Tributação do catálogo</h2><p>Produtos usam NCM/CFOP/CST ou CSOSN; serviços usam o código municipal.</p></div><div className="fiscal-toolbar-actions"><label className="search-input"><Search size={15}/><input placeholder="Buscar item..." value={search} onChange={(e)=>setSearch(e.target.value)}/></label><label className="fiscal-check-inline"><input type="checkbox" checked={itemPendingOnly} onChange={(e)=>setItemPendingOnly(e.target.checked)}/> Só pendentes</label></div></div>
        <div className="table-scroll"><table className="data-table fiscal-table"><thead><tr><th>Item</th><th>Tipo</th><th>Dados fiscais</th><th>Status</th><th></th></tr></thead><tbody>
          {items.map((item)=><tr key={item.id}><td><b>{item.nome}</b><small className="table-subline">{item.codigoInterno || item.codigoBarras || "Sem código"}</small></td><td>{item.tipo === "PRODUTO" ? "Produto" : "Serviço"}</td><td>{item.tipo === "PRODUTO" ? `NCM ${item.fiscalConfig?.ncm || '—'} · CFOP ${item.fiscalConfig?.cfop || '—'} · ${item.fiscalConfig?.cstCsosn || 'CST/CSOSN —'}` : `Serviço ${item.fiscalConfig?.codigoServicoMunicipal || '—'} · ISS ${item.fiscalConfig?.aliquotaIss ?? '—'}%`}</td><td><span className={`badge badge--${item.fiscalPronto?'success':'warning'}`}>{item.fiscalPronto?'Pronto':'Pendente'}</span></td><td>{canManage && <button className="icon-button table-action" title="Editar tributação" onClick={()=>openItem(item)}><Settings2 size={15}/></button>}</td></tr>)}
        </tbody></table></div>
      </section>}

      {tab === "DOCUMENTOS" && <section className="panel fiscal-list-panel">
        <div className="panel__heading fiscal-toolbar"><div><h2>Fila e histórico</h2><p>Rastreabilidade por documento, venda e CNPJ.</p></div><label className="search-input"><Search size={15}/><input placeholder="Número, chave ou cliente..." value={search} onChange={(e)=>setSearch(e.target.value)}/></label></div>
        <div className="table-scroll"><table className="data-table fiscal-table"><thead><tr><th>Documento</th><th>Venda</th><th>Cliente</th><th>Valor</th><th>Ambiente</th><th>Status</th><th></th></tr></thead><tbody>
          {docs.map((doc)=><tr key={doc.id}><td><b>{docLabels[doc.tipo] || doc.tipo}</b><small className="table-subline">{doc.numero || "Aguardando número"}{doc.simulado ? " · SIMULADO" : ""}</small></td><td>#{doc.venda?.numero || "—"}</td><td>{doc.venda?.cliente?.nome || "Consumidor"}</td><td>{formatCurrency(doc.valorTotal)}</td><td>{doc.ambiente === "PRODUCAO" ? "Produção" : "Homologação"}</td><td><span className={`badge badge--${statusTones[doc.status]||'muted'}`}>{statusLabels[doc.status]||doc.status}</span></td><td><div className="table-actions"><button className="icon-button table-action" onClick={()=>setDetailId(doc.id)} title="Detalhes"><Eye size={15}/></button>{canIssue && ["PENDENTE","ERRO","REJEITADO"].includes(doc.status) && <button className="icon-button table-action" onClick={()=>processMutation.mutate(doc.id)} title="Processar"><Send size={15}/></button>}{canCancel && ["PENDENTE","ERRO","REJEITADO","AUTORIZADO"].includes(doc.status) && <button className="icon-button table-action fiscal-cancel" onClick={()=>{setCancelDoc(doc);setCancelReason("");}} title="Cancelar"><Ban size={15}/></button>}</div></td></tr>)}
          {!docs.length && <tr><td colSpan="7" className="empty-cell">Nenhum documento encontrado.</td></tr>}
        </tbody></table></div>
      </section>}

      {tab === "CONFIG" && <section className="panel fiscal-config-panel">
        <div className="panel__heading"><div><span>CNPJ selecionado</span><h2>{config.empresa?.nomeFantasia || selectedCompany?.nomeFantasia}</h2><p>{config.empresa?.razaoSocial || ""} · {config.empresa?.cnpj || selectedCompany?.cnpj || "CNPJ não informado"}</p></div><Settings2 size={20}/></div>
        <div className="fiscal-config-form">
          <FormField label="Regime tributário"><select className="form-control" value={configForm.regime} onChange={(e)=>setConfigForm({...configForm,regime:e.target.value})} disabled={!canManage}>{Object.entries(regimeLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></FormField>
          <FormField label="Ambiente"><select className="form-control" value={configForm.ambiente} onChange={(e)=>setConfigForm({...configForm,ambiente:e.target.value})} disabled={!canManage}><option value="HOMOLOGACAO">Homologação</option><option value="PRODUCAO">Produção</option></select></FormField>
          <FormField label="Provedor fiscal"><input className="form-control" placeholder="Ex.: development" value={configForm.provedorFiscal} onChange={(e)=>setConfigForm({...configForm,provedorFiscal:e.target.value})} disabled={!canManage}/></FormField>
          <FormField label="Referência da conta no provedor"><input className="form-control" value={configForm.provedorContaReferencia} onChange={(e)=>setConfigForm({...configForm,provedorContaReferencia:e.target.value})} disabled={!canManage}/></FormField>
          <FormField label="Série NF-e"><input className="form-control" value={configForm.serieNfe} onChange={(e)=>setConfigForm({...configForm,serieNfe:e.target.value})} disabled={!canManage}/></FormField>
          <FormField label="Série NFC-e"><input className="form-control" value={configForm.serieNfce} onChange={(e)=>setConfigForm({...configForm,serieNfce:e.target.value})} disabled={!canManage}/></FormField>
          <FormField label="Série NFS-e"><input className="form-control" value={configForm.serieNfse} onChange={(e)=>setConfigForm({...configForm,serieNfse:e.target.value})} disabled={!canManage}/></FormField>
          <FormField label="Código IBGE do município"><input className="form-control" maxLength="7" value={configForm.codigoMunicipioIbge} onChange={(e)=>setConfigForm({...configForm,codigoMunicipioIbge:e.target.value.replace(/\D/g,'')})} disabled={!canManage}/></FormField>
          <FormField label="Natureza da operação" className="fiscal-wide"><input className="form-control" placeholder="Ex.: Venda de mercadorias" value={configForm.naturezaOperacaoPadrao} onChange={(e)=>setConfigForm({...configForm,naturezaOperacaoPadrao:e.target.value})} disabled={!canManage}/></FormField>
          <FormField label="Referência do certificado"><input className="form-control" placeholder="Alias / ID no provedor" value={configForm.certificadoReferencia} onChange={(e)=>setConfigForm({...configForm,certificadoReferencia:e.target.value})} disabled={!canManage}/></FormField>
          <FormField label="Validade do certificado"><input className="form-control" type="date" value={configForm.certificadoValidoAte} onChange={(e)=>setConfigForm({...configForm,certificadoValidoAte:e.target.value})} disabled={!canManage}/></FormField>
          <FormField label="Documento padrão"><select className="form-control" value={configForm.tipoDocumentoPadrao} onChange={(e)=>setConfigForm({...configForm,tipoDocumentoPadrao:e.target.value})} disabled={!canManage}><option value="">Manual</option>{Object.entries(docLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></FormField>
          <label className="fiscal-auto"><input type="checkbox" checked={configForm.emissaoAutomaticaVenda} onChange={(e)=>setConfigForm({...configForm,emissaoAutomaticaVenda:e.target.checked})} disabled={!canManage}/><span><strong>Adicionar documento automaticamente à fila após a venda</strong><small>O PetRise prepara o rascunho. A transmissão oficial continua dependendo do provedor.</small></span></label>
        </div>
        {configForm.ambiente === "PRODUCAO" && <InlineNotice tone="warning">Antes de usar Produção, conecte e homologue o provedor fiscal escolhido. O simulador <b>development</b> é bloqueado em Produção.</InlineNotice>}
        {canManage && <div className="fiscal-config-actions"><button className="primary-button" onClick={()=>configMutation.mutate()} disabled={configMutation.isPending}>Salvar configuração</button></div>}
      </section>}

      <Modal open={Boolean(itemModal)} onClose={()=>setItemModal(null)} title={itemModal ? `Tributação — ${itemModal.nome}` : "Tributação"} subtitle={itemModal?.tipo === "PRODUTO" ? "Dados usados para NF-e/NFC-e." : "Dados usados para NFS-e."} footer={<><button className="secondary-button" onClick={()=>setItemModal(null)}>Cancelar</button><button className="primary-button" onClick={()=>itemMutation.mutate()} disabled={itemMutation.isPending}>Salvar</button></>}>
        <div className="modal-body form-stack">
          {itemModal?.tipo === "PRODUTO" ? <div className="fiscal-item-grid"><FormField label="NCM"><input className="form-control" maxLength="8" value={itemForm.ncm} onChange={(e)=>setItemForm({...itemForm,ncm:e.target.value.replace(/\D/g,'')})}/></FormField><FormField label="CEST"><input className="form-control" maxLength="7" value={itemForm.cest} onChange={(e)=>setItemForm({...itemForm,cest:e.target.value.replace(/\D/g,'')})}/></FormField><FormField label="CFOP"><input className="form-control" maxLength="4" value={itemForm.cfop} onChange={(e)=>setItemForm({...itemForm,cfop:e.target.value.replace(/\D/g,'')})}/></FormField><FormField label="Origem"><input className="form-control" maxLength="1" value={itemForm.origemMercadoria} onChange={(e)=>setItemForm({...itemForm,origemMercadoria:e.target.value.replace(/\D/g,'')})}/></FormField><FormField label="CST / CSOSN"><input className="form-control" maxLength="4" value={itemForm.cstCsosn} onChange={(e)=>setItemForm({...itemForm,cstCsosn:e.target.value.replace(/\D/g,'')})}/></FormField><FormField label="Alíquota ICMS (%)"><input className="form-control" type="number" min="0" max="100" step="0.01" value={itemForm.aliquotaIcms} onChange={(e)=>setItemForm({...itemForm,aliquotaIcms:e.target.value})}/></FormField></div> : <div className="fiscal-item-grid"><FormField label="Código do serviço municipal"><input className="form-control" value={itemForm.codigoServicoMunicipal} onChange={(e)=>setItemForm({...itemForm,codigoServicoMunicipal:e.target.value})}/></FormField><FormField label="Alíquota ISS (%)"><input className="form-control" type="number" min="0" max="100" step="0.01" value={itemForm.aliquotaIss} onChange={(e)=>setItemForm({...itemForm,aliquotaIss:e.target.value})}/></FormField></div>}
        </div>
      </Modal>

      <Modal open={Boolean(issueSale)} onClose={()=>setIssueSale(null)} title={issueSale ? `Venda #${issueSale.numero}` : "Novo documento"} subtitle="Selecione o documento e revise a validação antes de enviar." footer={<><button className="secondary-button" onClick={()=>setIssueSale(null)}>Cancelar</button><button className="primary-button" onClick={()=>issueMutation.mutate()} disabled={issueMutation.isPending || (validation && !validation.ok)}>{processNow ? "Criar e processar" : "Adicionar à fila"}</button></>}>
        <div className="modal-body form-stack">
          <FormField label="Tipo de documento"><select className="form-control" value={issueType} onChange={(e)=>setIssueType(e.target.value)}>{availableTypes(issueSale).map((type)=><option key={type} value={type}>{docLabels[type]}</option>)}</select></FormField>
          {validationQuery.isLoading ? <InlineNotice tone="info">Validando venda...</InlineNotice> : validation ? <><InlineNotice tone={validation.ok ? "success" : "error"}>{validation.ok ? `Venda pronta para ${docLabels[issueType]}. Valor estimado: ${formatCurrency(validation.valorDocumento)}.` : "Há pendências antes de processar este documento."}</InlineNotice>{validation.issues?.map((x)=><div className="fiscal-validation fiscal-validation--error" key={x}><AlertTriangle size={14}/>{x}</div>)}{validation.warnings?.map((x)=><div className="fiscal-validation" key={x}><AlertTriangle size={14}/>{x}</div>)}</> : null}
          <label className="fiscal-auto"><input type="checkbox" checked={processNow} onChange={(e)=>setProcessNow(e.target.checked)}/><span><strong>Processar agora</strong><small>Em homologação com provedor development, gera apenas uma autorização simulada sem validade fiscal.</small></span></label>
        </div>
      </Modal>

      <Modal open={Boolean(detailId)} onClose={()=>setDetailId(null)} title={detail ? `${docLabels[detail.tipo] || detail.tipo} ${detail.numero || ''}` : "Documento fiscal"} subtitle={detail ? `Venda #${detail.venda?.numero || '—'} · ${statusLabels[detail.status] || detail.status}` : "Carregando..."} footer={<><button className="secondary-button" onClick={()=>setDetailId(null)}>Fechar</button>{detail && canIssue && ["PENDENTE","ERRO","REJEITADO"].includes(detail.status) && <button className="primary-button" onClick={()=>processMutation.mutate(detail.id)}><Send size={14}/> Processar</button>}</>}>
        <div className="modal-body fiscal-detail">
          {detail && <><div className="fiscal-detail-grid"><div><span>Status</span><strong>{statusLabels[detail.status] || detail.status}</strong></div><div><span>Ambiente</span><strong>{detail.ambiente}</strong></div><div><span>Valor</span><strong>{formatCurrency(detail.valorTotal)}</strong></div><div><span>Emissão</span><strong>{detail.emitidoEm ? formatDateTime(detail.emitidoEm) : "—"}</strong></div><div><span>Protocolo</span><strong>{detail.protocolo || "—"}</strong></div><div><span>Chave</span><strong className="fiscal-break">{detail.chave || (detail.simulado ? "Simulação sem chave oficial" : "—")}</strong></div></div>{detail.simulado && <InlineNotice tone="warning">Documento simulado em homologação. Não possui validade fiscal.</InlineNotice>}{detail.tipo === "RECIBO" && <InlineNotice tone="info">Recibo interno do PetRise. Não substitui NF-e, NFC-e ou NFS-e quando a legislação exigir documento fiscal.</InlineNotice>}{detail.mensagemErro && <InlineNotice tone="error">{detail.mensagemErro}</InlineNotice>}<section><h3>Itens</h3><div className="fiscal-detail-items">{Array.isArray(detail.itensSnapshot) ? detail.itensSnapshot.map((item,index)=><div key={item.vendaItemId||index}><span>{item.descricao} × {item.quantidade}</span><strong>{formatCurrency(item.valorTotal)}</strong></div>) : <span className="muted-text">Snapshot não disponível.</span>}</div></section>{detail.canceladoEm && <section><h3>Cancelamento</h3><p>{detail.motivoCancelamento || "Sem motivo informado."} · {formatDateTime(detail.canceladoEm)}</p></section>}</>}
        </div>
      </Modal>

      <Modal open={Boolean(cancelDoc)} onClose={()=>setCancelDoc(null)} title="Cancelar documento" subtitle={cancelDoc ? `${docLabels[cancelDoc.tipo]} · Venda #${cancelDoc.venda?.numero || '—'}` : ""} footer={<><button className="secondary-button" onClick={()=>setCancelDoc(null)}>Voltar</button><button className="primary-button fiscal-danger" onClick={()=>cancelMutation.mutate()} disabled={cancelMutation.isPending || cancelReason.trim().length < 5}><Ban size={14}/> Confirmar cancelamento</button></>}>
        <div className="modal-body form-stack"><InlineNotice tone="warning">Documentos oficiais autorizados só podem ser cancelados depois que o provedor fiscal confirmar o cancelamento. Nesta fase, o cancelamento local automático é permitido apenas para recibos e simulações de homologação.</InlineNotice><FormField label="Motivo"><textarea className="form-control form-control--textarea" rows="4" value={cancelReason} onChange={(e)=>setCancelReason(e.target.value)} placeholder="Informe o motivo do cancelamento..."/></FormField></div>
      </Modal>
    </div>
  );
}
