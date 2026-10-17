/** Fase 20.1 — preview only; no stock, financial or fiscal mutation. */
import {useRef,useState} from "react";
import {useQuery,useMutation,useQueryClient} from "@tanstack/react-query";
import {Link} from "react-router-dom";
import {ArrowLeft,Plus,Trash2,ShieldCheck} from "lucide-react";
import api,{getApiErrorMessage} from "../lib/api.js";
import {formatCurrency} from "../lib/formatters.js";
import {rehydrateUnifiedDraft,addUnifiedCatalogItem,updateUnifiedLine,removeUnifiedLine,unifiedPrecloseMessages} from "../lib/unifiedDraft.js";
import {isBulkWeightProduct,stockUnitLabel,bulkGrams,bulkTotalCents,bulkFromGrams,bulkFromAmount,bulkScaleCheck} from "../lib/unifiedBulk.js";
import {useAuth} from "../context/AuthContext.jsx";
import "../clients.css";
export default function UnifiedPdvPreviewPage(){
 const {selectedOrganization,hasPermission}=useAuth();
 const [motivoCancelar,setMotivoCancelar]=useState("Revisão da comanda");
 const queryClient=useQueryClient();
 const [draft,setDraft]=useState(null);
 const [savedNotice,setSavedNotice]=useState("");
 const [localChanges,setLocalChanges]=useState(false);
 const [clientSearch,setClientSearch]=useState(""),[clientId,setClientId]=useState("");
 const [search,setSearch]=useState(""),[lines,setLines]=useState([]);
 const hasBulkErrors=lines.some(row=>Boolean(row.erroEntradaGranel));
 const nextLineId=useRef(0);
 const eligibility=useQuery({queryKey:["unified-eligibility",selectedOrganization?.id],queryFn:async()=>(await api.get("/pdv-unificado/disponibilidade")).data.dados});
 const enabled=Boolean(eligibility.data?.preferenciaUnificado);
 const clients=useQuery({queryKey:["unified-clients",clientSearch],enabled,queryFn:async()=>(await api.get("/clientes",{params:{busca:clientSearch,limite:30}})).data.dados||[]});
 const clientDetails=useQuery({queryKey:["unified-client-pets",clientId],enabled:enabled&&Boolean(clientId),queryFn:async()=>(await api.get(`/clientes/${clientId}`)).data.cliente});
 const catalog=useQuery({queryKey:["unified-catalog",search],enabled,queryFn:async()=>(await api.get("/pdv-unificado/catalogo",{params:{busca:search}})).data.dados||[]});
 const draftList=useQuery({queryKey:["unified-drafts",selectedOrganization?.id],enabled,queryFn:async()=>(await api.get("/pdv-unificado/rascunhos")).data.dados||[]});
 const save=useMutation({mutationFn:async()=>{
   const dados={clienteId,itens:lines.map(x=>({empresaId:x.empresaId,itemCatalogoId:x.itemCatalogoId,quantidade:x.quantidade,petId:x.petId||null}))};
   const response=draft?await api.put(`/pdv-unificado/rascunhos/${draft.id}`,{...dados,versao:draft.versao}):await api.post("/pdv-unificado/rascunhos",dados);
   return response.data.dados;
 },onSuccess:async data=>{setLocalChanges(false);setDraft({id:data.id,versao:data.versao});setSavedNotice(`Rascunho #${data.numero} salvo. Sem venda ou cobrança.`);await queryClient.invalidateQueries({queryKey:["unified-drafts"]});}});
 const closingReview=useQuery({queryKey:["unified-preclose",draft?.id,draft?.versao],enabled:enabled&&Boolean(draft?.id),queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/pre-fechamento`,{params:{versao:draft.versao}})).data.dados});
 const closingPlan=useQuery({queryKey:["unified-close-plan",draft?.id,draft?.versao],enabled:enabled&&Boolean(draft?.id)&&closingReview.data?.pendencias?.length===0,queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/plano-fechamento`,{params:{versao:draft.versao}})).data.dados});
 const reservation=useQuery({queryKey:["unified-reservation",draft?.id,draft?.versao],enabled:enabled&&Boolean(draft?.id),queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/reserva`,{params:{versao:draft.versao}})).data.dados});
 const isReserved=reservation.data?.status==="RESERVADA";
 const reserveMutation=useMutation({mutationFn:async()=>(await api.post(`/pdv-unificado/rascunhos/${draft.id}/reservar`,{versao:draft.versao})).data.dados,onSuccess:async()=>{setSavedNotice("Operações reservadas com segurança. Nenhuma cobrança foi realizada.");await queryClient.invalidateQueries({queryKey:["unified-reservation"]});}});
 const cancelReservation=useMutation({mutationFn:async()=>(await api.post(`/pdv-unificado/rascunhos/${draft.id}/cancelar-reserva`,{versao:draft.versao,motivo:motivoCancelar})).data.dados,onSuccess:async()=>{setSavedNotice("Reserva cancelada. Ajuste e salve uma nova versão da comanda.");await queryClient.invalidateQueries({queryKey:["unified-reservation"]});}});
 const preview=useMutation({mutationFn:async()=>(await api.post("/pdv-unificado/simulacao",{clienteId,itens:lines.map(x=>({empresaId:x.empresaId,itemCatalogoId:x.itemCatalogoId,quantidade:x.quantidade,petId:x.petId||null}))})).data.dados});
 function reopen(saved){
   setLocalChanges(false);setClientId(saved.cliente.id);setClientSearch(saved.cliente.nome);setDraft({id:saved.id,versao:saved.versaoRascunho});setSavedNotice("");
   setLines(rehydrateUnifiedDraft(saved));preview.reset();
 }
 function add(item){const key=`nova:${++nextLineId.current}`;setLocalChanges(true);setSavedNotice("");setLines(rows=>addUnifiedCatalogItem(rows,item,key));preview.reset();}
 function editBulk(row,raw){
  const parsed=row.modoGranel==="VALOR"?bulkFromAmount(raw,row.preco,row.unidade):bulkFromGrams(raw,row.unidade);
  const totalZero=!parsed.erro&&bulkTotalCents({...row,quantidade:parsed.quantidade})<1;
  setLines(ls=>updateUnifiedLine(ls,row.lineKey,{
   entradaGranel:raw,erroEntradaGranel:parsed.erro||(totalZero?"Esse peso gera total de R$ 0,00. Ajuste o peso ou o preço cadastrado.":null),
   ...(parsed.erro||totalZero?{}:{quantidade:parsed.quantidade})
  }));
  setLocalChanges(true);preview.reset();
 }
 return <div className="page-stack pv-unified-preview">
  <Link className="ghost-button pv-back" to="/pdv"><ArrowLeft size={18}/> Voltar ao PDV</Link>
  <section className="page-heading"><div><span className="page-kicker">Fase 20.1 · Homologação</span><h1>Comanda multiempresa — Simulação</h1><p>Confira itens e valores por empresa. Nenhuma venda ou pagamento será registrado nesta tela.</p></div></section>
  {eligibility.isLoading?<p>Conferindo acesso...</p>:eligibility.isError?<p className="alert alert--error">{getApiErrorMessage(eligibility.error)}</p>:!enabled?<div className="panel pv-detail-panel"><h2>Preferência ainda desativada</h2><p>Um gestor pode habilitar a preferência em Configurações → Módulos. Isso libera somente a simulação e não altera o PDV tradicional.</p></div>:<>
   <section className="panel pv-detail-panel"><div className="pv-detail-section-actions"><h2>Rascunhos recentes</h2><button type="button" className="ghost-button" onClick={()=>{setDraft(null);setClientId("");setLines([]);setLocalChanges(false);setSavedNotice("");preview.reset();}}>Nova comanda</button></div>{draftList.isError&&<p className="alert alert--error">{getApiErrorMessage(draftList.error)}</p>}{(draftList.data||[]).map(d=><button key={d.id} className="ghost-button" type="button" onClick={()=>reopen(d)}>#{d.numero} · {d.cliente.nome} · versão {d.versaoRascunho}</button>)}</section>
   <section className="panel pv-detail-panel"><h2>Cliente</h2><input className="form-control" placeholder="Buscar tutor" value={clientSearch} onChange={e=>setClientSearch(e.target.value)}/><select className="form-control" value={clientId} onChange={e=>{setClientId(e.target.value);setLocalChanges(true);preview.reset();}} aria-label="Selecione cliente" disabled={isReserved}><option value="">Selecione um cliente ativo</option>{(clients.data||[]).map(c=><option value={c.id} key={c.id}>{c.nome}</option>)}</select></section>
   <section className="panel pv-detail-panel"><h2>Produtos e serviços autorizados</h2><input className="form-control" placeholder="Buscar em suas empresas" value={search} onChange={e=>setSearch(e.target.value)}/>{catalog.isError&&<p className="alert alert--error">{getApiErrorMessage(catalog.error)}</p>}<div className="pv-unified-catalog">{(catalog.data||[]).map(item=><div key={item.id}><div><strong>{item.nome}</strong><span>{item.empresa?.nomeFantasia} · {formatCurrency(item.precoVenda)} por {stockUnitLabel(item.unidade)}</span></div><button className="ghost-button" disabled={isReserved} onClick={()=>add(item)}><Plus size={16}/> Adicionar</button></div>)}</div></section>
   <section className="panel pv-detail-panel"><h2>Itens da simulação</h2>
    {lines.map(row=><div className="pv-unified-line" key={row.lineKey}>
     <div><strong>{row.nome}</strong><small>{row.empresa} · {formatCurrency(row.preco)} por {stockUnitLabel(row.unidade)} {row.rascunhoItemId?"(valor salvo)":""}</small></div>
     {row.tipo==="SERVICO"&&<label>{row.exigePet?"Pet obrigatório":"Pet (opcional)"}
      <select className="form-control" value={row.petId||""} disabled={isReserved} onChange={e=>{setLines(ls=>updateUnifiedLine(ls,row.lineKey,{petId:e.target.value}));setLocalChanges(true);preview.reset();}}>
       <option value="">Selecione o pet</option>{(clientDetails.data?.pets||[]).map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
     </label>}
     {isBulkWeightProduct(row)?<div className="pv-unified-bulk">
      <label>Registrar por
       <select className="form-control" value={row.modoGranel||"PESO"} disabled={isReserved} onChange={e=>{setLines(ls=>updateUnifiedLine(ls,row.lineKey,{modoGranel:e.target.value,entradaGranel:null,erroEntradaGranel:null}));setLocalChanges(true);preview.reset();}}>
        <option value="PESO">Peso (gramas)</option><option value="VALOR">Valor (R$)</option>
       </select>
      </label>
      <label>{row.modoGranel==="VALOR"?"Valor desejado (R$)":"Peso na balança (g)"}
       <input className="form-control" type="text" inputMode={row.modoGranel==="VALOR"?"decimal":"numeric"} value={row.entradaGranel??(row.modoGranel==="VALOR"?(bulkTotalCents(row)/100).toFixed(2):String(bulkGrams(row)))} disabled={isReserved} onChange={e=>editBulk(row,e.target.value)} aria-invalid={Boolean(row.erroEntradaGranel)}/>
      </label>
      <small>{bulkGrams(row)?.toLocaleString("pt-BR")} g · {formatCurrency(bulkTotalCents(row)/100)} (prévia, estoque em {stockUnitLabel(row.unidade)})</small>
      {row.erroEntradaGranel&&<small className="pv-unified-bulk-error" role="alert">{row.erroEntradaGranel}</small>}
      <UnifiedBulkScaleCheck row={row}/>
     </div>:<label>Quantidade<input type="number" min="0.001" max="10000" step="0.001" className="form-control" value={row.quantidade} disabled={isReserved} onChange={e=>{setLines(ls=>updateUnifiedLine(ls,row.lineKey,{quantidade:Number(e.target.value)}));setLocalChanges(true);preview.reset();}}/></label>}
     <button className="icon-button" title="Remover esta linha" disabled={isReserved} onClick={()=>{setLines(ls=>removeUnifiedLine(ls,row.lineKey));setLocalChanges(true);preview.reset();}}><Trash2 size={18}/></button>
    </div>)}
    {!lines.length&&<p className="pv-empty">Adicione produtos e serviços para simular.</p>}
    <div className="pv-pet-card-actions"><button className="primary-button" disabled={!clientId||!lines.length||hasBulkErrors||preview.isPending||isReserved} onClick={()=>preview.mutate()}><ShieldCheck size={17}/> Validar e calcular sem cobrar</button><button type="button" className="ghost-button" disabled={!clientId||!lines.length||hasBulkErrors||save.isPending||isReserved} onClick={()=>{setSavedNotice("");save.mutate();}}> {save.isPending?"Salvando...":draft?"Atualizar rascunho":"Salvar rascunho"} </button></div>
    {save.isError&&<p className="alert alert--error">{getApiErrorMessage(save.error)}</p>}{savedNotice&&<p className="alert alert--success">{savedNotice}</p>}{closingReview.isError&&<p className="alert alert--error">{getApiErrorMessage(closingReview.error)}</p>}{closingPlan.isError&&<p className="alert alert--error">{getApiErrorMessage(closingPlan.error)}</p>}
    {closingPlan.data&&!localChanges&&<div className="pv-unified-total"><h3>Planejamento por empresa — sem executar</h3>{closingPlan.data.operacoes.map(op=><div key={op.empresaId}><span>{op.empresa} · {op.cnpj}</span><strong>{formatCurrency(Number(op.total))}</strong></div>)}<p>Operações apenas planejadas. O sistema não cria vendas, não movimenta caixa e não emite notas fiscais.</p></div>}{reservation.isError&&<p className="alert alert--error">{getApiErrorMessage(reservation.error)}</p>}
 {reserveMutation.isError&&<p className="alert alert--error">{getApiErrorMessage(reserveMutation.error)}</p>}
 {cancelReservation.isError&&<p className="alert alert--error">{getApiErrorMessage(cancelReservation.error)}</p>}
 {closingPlan.data&&!reservation.data&&<div className="pv-unified-total"><h3>Reserva do fechamento (sem cobrança)</h3><p>Registra as operações planejadas e bloqueia a edição até a reserva ser cancelada. Nenhuma venda é criada. {localChanges?"Salve as alterações antes de reservar.":""}</p><button type="button" className="ghost-button" disabled={reserveMutation.isPending||localChanges} onClick={()=>reserveMutation.mutate()}>{reserveMutation.isPending?"Reservando...":"Reservar operações por empresa"}</button></div>}
 {reservation.data&&<div className="pv-unified-total"><h3>Reserva #{reservation.data.id.slice(0,8)}</h3><p>Status: {reservation.data.status==="RESERVADA"?"Reservada — edição bloqueada":"Cancelada — edição liberada"}. Sem pagamentos ou notas fiscais.</p>{reservation.data.operacoes.map(op=><div key={op.id}><span>{op.nome} · {op.cnpj}</span><strong>{formatCurrency(Number(op.valor))}</strong></div>)}{isReserved&&hasPermission("pdv.cancelar_venda")&&<><label>Motivo para cancelar a reserva<input className="form-control" value={motivoCancelar} onChange={e=>setMotivoCancelar(e.target.value)}/></label><button type="button" className="ghost-button" disabled={cancelReservation.isPending||motivoCancelar.trim().length<5} onClick={()=>cancelReservation.mutate()}>{cancelReservation.isPending?"Cancelando...":"Cancelar reserva e liberar edição"}</button></>}</div>}
 {isReserved&&<UnifiedAllocationConference draft={draft} reservation={reservation.data} dirty={localChanges}/>}
 {localChanges&&draft&&<p className="alert">A comanda tem alterações não salvas. O pré-fechamento abaixo só será atualizado após salvar uma nova versão.</p>}
 {closingReview.data&&!localChanges&&<div className="pv-unified-total"><h3>Pré-fechamento (somente conferência)</h3>{closingReview.data.empresas.map(e=><div key={e.empresaId}><span>{e.nome} · {e.cnpj}</span><strong>{formatCurrency(Number(e.total))}</strong></div>)}<div><strong>Total por empresas</strong><strong>{formatCurrency(Number(closingReview.data.total))}</strong></div>{closingReview.data.pendencias.length?<div><strong>Revise antes de seguir:</strong>{closingReview.data.pendencias.map((p,i)=><p key={`${p.itemId}-${p.codigo}-${i}`}>{lines.find(l=>l.rascunhoItemId===p.itemId)?.nome||"Item da comanda"}: {unifiedPrecloseMessages[p.codigo]||p.codigo}</p>)}</div>:<p>Itens conferidos. Fechamento e pagamento continuam desabilitados; a emissão fiscal é uma integração futura independente.</p>}</div>}{preview.isError&&<p className="alert alert--error">{getApiErrorMessage(preview.error)}</p>}{preview.data&&<div className="pv-unified-total"><h3>Resumo por empresa</h3>{preview.data.empresas.map(e=><div key={e.empresaId}><strong>{e.empresa}</strong><span>{formatCurrency(Number(e.total))}</span></div>)}<div><strong>Total consolidado</strong><strong>{formatCurrency(Number(preview.data.total))}</strong></div><p>Prévia validada. Nenhuma venda, estoque ou documento fiscal foi movimentado.</p></div>}</section>
  </>}
 </div>;
}

/** Dupla leitura digitada pelo atendente: sem integração, gravação ou autorização. */
function UnifiedBulkScaleCheck({row}){
 const [reading,setReading]=useState("");
 const [labelAmount,setLabelAmount]=useState("");
 const check=bulkScaleCheck(row,reading,labelAmount);
 return <details className="pv-unified-scale-check">
  <summary>Conferir balança e etiqueta (assistido)</summary>
  <p>Digite o peso inteiro indicado na balança para comparar com a comanda. O valor da etiqueta é opcional. Esta conferência é local e não comprova uma pesagem física.</p>
  <div className="pv-unified-scale-fields">
   <label>Leitura da balança (g)<input className="form-control" type="text" inputMode="numeric" placeholder="Ex.: 333" value={reading} onChange={e=>setReading(e.target.value)}/></label>
   <label>Valor na etiqueta (R$), se houver<input className="form-control" type="text" inputMode="decimal" placeholder="Ex.: 5,00" value={labelAmount} onChange={e=>setLabelAmount(e.target.value)}/></label>
  </div>
  <p>Comanda: <strong>{check.expectedGrams?.toLocaleString("pt-BR")??"—"} g</strong> · <strong>{Number.isSafeInteger(check.expectedCents)?formatCurrency(check.expectedCents/100):"—"}</strong></p>
  {check.status==="PENDENTE"&&<p role="status">Aguardando leitura da balança, em gramas inteiros.</p>}
  {check.status==="INVALIDO"&&<p className="pv-unified-bulk-error" role="alert">{check.erro}</p>}
  {check.status==="CONFERIDO"&&<p className="pv-unified-scale-ok" role="status">Peso confere com a comanda{check.labelCents!==null?" e valor da etiqueta confere":""}. Verificação apenas informativa.</p>}
  {check.status==="DIVERGENTE"&&<div className="pv-unified-bulk-error" role="alert">
   <strong>Diferença encontrada — confira antes de atender.</strong>
   {check.gramsDifference!==0&&<p>Leitura: {check.measuredGrams.toLocaleString("pt-BR")} g ({check.gramsDifference>0?"+":""}{check.gramsDifference} g vs. comanda). Pelo peso lido: {formatCurrency(check.measuredCents/100)}.</p>}
   {check.labelDifferenceCents!==null&&check.labelDifferenceCents!==0&&<p>Etiqueta: {formatCurrency(check.labelCents/100)} ({check.labelDifferenceCents>0?"+":""}{check.labelDifferenceCents} centavo(s) vs. comanda).</p>}
   <p>Reconfira a pesagem, o preço ou a quantidade antes de salvar a comanda.</p>
  </div>}
  <small>Não salva a leitura, não altera o peso da comanda, o estoque, o caixa ou documentos fiscais; nenhuma conexão com a balança.</small>
 </details>;
}


/** Pure payment-allocation conference; absolutely no charges or finance writes. */
function UnifiedAllocationConference({draft,reservation,dirty}){
 const [forms,setForms]=useState({});
 const sessions=useQuery({
  queryKey:["unified-cash-sessions",draft?.id,draft?.versao],
  enabled:Boolean(draft?.id)&&reservation?.status==="RESERVADA",
  queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/caixas-disponiveis`,{params:{versao:draft.versao}})).data.dados||[]
 });
 const diagnosis=useQuery({
  queryKey:["unified-recovery-diagnosis",draft?.id,draft?.versao],
  enabled:Boolean(draft?.id)&&reservation?.status==="RESERVADA",
  queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/diagnostico-recuperacao`,{params:{versao:draft.versao}})).data.dados
 });
 function alocar(){
  return reservation.operacoes.map(op=>{
   const own=(sessions.data||[]).filter(s=>s.empresaId===op.empresaId);
   const fields=forms[op.empresaId]||{};
   return {empresaId:op.empresaId,sessaoCaixaId:fields.sessaoCaixaId||own[0]?.sessaoCaixaId||"",
    pagamentos:[{forma:fields.forma||"PIX",valorCentavos:Math.round(Number(fields.valor??op.valor)*100)}]};
  });
 }
 const payload=()=>({versao:draft.versao,alocacoes:alocar()});
 const conference=useMutation({
  mutationFn:async()=>(await api.post(`/pdv-unificado/rascunhos/${draft.id}/conferencia-alocacao`,payload())).data.dados
 });
 const preparation=useQuery({
  queryKey:["unified-preparation",draft?.id,draft?.versao],
  enabled:Boolean(draft?.id)&&reservation?.status==="RESERVADA",
  queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/preparacao-execucao`,{params:{versao:draft.versao}})).data.dados
 });
 const prepare=useMutation({
  mutationFn:async()=>(await api.post(`/pdv-unificado/rascunhos/${draft.id}/preparacao-execucao`,payload())).data.dados,
  onSuccess:async()=>{await preparation.refetch();}
 });
 function set(companyId,patch){setForms(current=>({...current,[companyId]:{...current[companyId],...patch}}));conference.reset();prepare.reset();}
 return <section className="panel pv-detail-panel"><h2>Conferência de pagamentos por empresa</h2>
  <p>Simulação somente leitura. Selecione um caixa aberto para cada empresa. Não existe cobrança, split, utilização de crédito nem emissão fiscal nesta etapa.</p>
  {sessions.isError&&<p className="alert alert--error">{getApiErrorMessage(sessions.error)}</p>}
  {reservation.operacoes.map(op=>{
   const opts=(sessions.data||[]).filter(x=>x.empresaId===op.empresaId);
   const current=forms[op.empresaId]||{};
   return <div key={op.empresaId} className="pv-unified-line">
    <div><strong>{op.nome} — {formatCurrency(Number(op.valor))}</strong><small>CNPJ: {op.cnpj}</small></div>
    <label>Caixa aberto<select className="form-control" value={current.sessaoCaixaId||opts[0]?.sessaoCaixaId||""} onChange={e=>set(op.empresaId,{sessaoCaixaId:e.target.value})}>
     {!opts.length&&<option value="">Nenhum caixa aberto</option>}
     {opts.map(x=><option key={x.sessaoCaixaId} value={x.sessaoCaixaId}>{x.caixa}</option>)}
    </select></label>
    <label>Forma<select className="form-control" value={current.forma||"PIX"} onChange={e=>set(op.empresaId,{forma:e.target.value})}>
     <option value="PIX">Pix</option><option value="DINHEIRO">Dinheiro</option><option value="CARTAO_DEBITO">Débito</option><option value="CARTAO_CREDITO">Crédito</option><option value="TRANSFERENCIA">Transferência</option>
    </select></label>
    <label>Valor simulado<input className="form-control" type="number" min="0.01" step="0.01" value={current.valor??op.valor} onChange={e=>set(op.empresaId,{valor:e.target.value})}/></label>
   </div>;
  })}
  <button className="ghost-button" type="button" disabled={dirty||sessions.isLoading||conference.isPending||!(sessions.data||[]).length} onClick={()=>conference.mutate()}>{conference.isPending?"Conferindo...":"Conferir alocação (sem cobrar)"}</button>
  {dirty&&<p>Salve as alterações locais antes de conferir a alocação.</p>}
  {conference.isError&&<p className="alert alert--error">{getApiErrorMessage(conference.error)}</p>}
  {conference.data?.preConferenciaAprovada&&!preparation.data&&<div className="pv-unified-total">
   <strong>Próximo estágio: preparação imutável</strong>
   <p>Grava a distribuição validada por empresa para recuperação segura. Continua sem vendas, pagamentos, baixa de estoque ou notas.</p>
   <button className="ghost-button" type="button" disabled={dirty||prepare.isPending} onClick={()=>prepare.mutate()}>{prepare.isPending?"Preparando...":"Salvar preparação (sem vender)"}</button>
  </div>}
  {prepare.isError&&<p className="alert alert--error">{getApiErrorMessage(prepare.error)}</p>}
  {preparation.isError&&<p className="alert alert--error">{getApiErrorMessage(preparation.error)}</p>}
  {preparation.data&&<div className="pv-unified-total">
   <strong>Preparação {preparation.data.status==="PREPARADA"?"registrada":"invalidada"} — {preparation.data.id.slice(0,8)}</strong>
   <p>Snapshot auditável de {preparation.data.operacoes.length} operação(ões). Nenhum pagamento ou venda executado.</p>
   {preparation.data.operacoes.map(op=><div key={op.empresaId}><span>{op.cnpj}</span><strong>{formatCurrency(Number(op.total))}</strong></div>)}
  </div>}
  {conference.data&&<div className="pv-unified-total">
   <strong>{conference.data.preConferenciaAprovada?"Alocações consistentes — execução ainda desativada":"Alocações com pendências"}</strong>
   {conference.data.pendencias.map((e,i)=><p key={i}>{e.codigo} — empresa {e.empresaId}</p>)}
   <p>Nenhuma venda ou pagamento foi registrado.</p>
  </div>}
  {diagnosis.data?.exigeRevisaoManual&&<p className="alert alert--error">Diagnóstico de recuperação identificou divergência de estado. Não efetue cobranças; encaminhe para revisão.</p>}
 </section>;
}
