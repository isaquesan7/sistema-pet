/** PDV Unificado: preparação e fechamento manual restrito por autorização do servidor. */
import {useRef,useState} from "react";
import {useQuery,useMutation,useQueryClient} from "@tanstack/react-query";
import {Link} from "react-router-dom";
import {ArrowLeft,Plus,Trash2,ShieldCheck} from "lucide-react";
import api,{getApiErrorMessage} from "../lib/api.js";
import {formatCurrency} from "../lib/formatters.js";
import {buildUnifiedDraftPayload,unifiedScopedQueryKey,visibleUnifiedClients,rehydrateUnifiedDraft,addUnifiedCatalogItem,updateUnifiedLine,removeUnifiedLine,unifiedPrecloseMessages} from "../lib/unifiedDraft.js";
import {isBulkWeightProduct,stockUnitLabel,bulkGrams,bulkTotalCents,bulkFromGrams,bulkFromAmount,bulkScaleCheck} from "../lib/unifiedBulk.js";
import {manualPaymentForms,defaultManualPayment,previewManualAllocation,previewManualReceipt} from "../lib/unifiedManualAllocation.js";
import {useAuth} from "../context/AuthContext.jsx";
import UnifiedRoleAcceptancePanel from "../components/UnifiedRoleAcceptancePanel.jsx";
import "../clients.css";
export default function UnifiedPdvPreviewPage(){
 const {selectedOrganization}=useAuth();
 return <UnifiedPdvWorkspace key={selectedOrganization?.id||"sem-organizacao"}/>;
}
function UnifiedPdvWorkspace(){
 const {selectedOrganization,selectedCompany,hasPermission}=useAuth();
 const scopedKey=(name,...details)=>unifiedScopedQueryKey(name,selectedOrganization?.id,selectedCompany?.id,...details);
 const [motivoCancelar,setMotivoCancelar]=useState("Revisão da comanda");
 const queryClient=useQueryClient();
 const [draft,setDraft]=useState(null);
 const [savedNotice,setSavedNotice]=useState("");
 const [localChanges,setLocalChanges]=useState(false);
 const [clientSearch,setClientSearch]=useState(""),[clientId,setClientId]=useState("");
 const [selectedClient,setSelectedClient]=useState(null);
 const [search,setSearch]=useState(""),[lines,setLines]=useState([]);
 const hasBulkErrors=lines.some(row=>Boolean(row.erroEntradaGranel));
 const nextLineId=useRef(0);
 const eligibility=useQuery({queryKey:scopedKey("unified-eligibility"),queryFn:async()=>(await api.get("/pdv-unificado/disponibilidade")).data.dados});
 const enabled=Boolean(eligibility.data?.preferenciaUnificado);
 const manualCheckoutEnabled=Boolean(eligibility.data?.checkoutUnificadoDisponivel);
 const manualReversalEnabled=Boolean(eligibility.data?.estornoUnificadoDisponivel);
 const clients=useQuery({queryKey:scopedKey("unified-clients",clientSearch),enabled,queryFn:async()=>(await api.get("/clientes",{params:{busca:clientSearch,limite:30}})).data.dados||[]});
 const clientDetails=useQuery({queryKey:scopedKey("unified-client-pets",clientId),enabled:enabled&&Boolean(clientId),queryFn:async()=>(await api.get(`/clientes/${clientId}`)).data.cliente});
 const catalog=useQuery({queryKey:scopedKey("unified-catalog",search),enabled,queryFn:async()=>(await api.get("/pdv-unificado/catalogo",{params:{busca:search}})).data.dados||[]});
 const draftList=useQuery({queryKey:scopedKey("unified-drafts"),enabled,queryFn:async()=>(await api.get("/pdv-unificado/rascunhos")).data.dados||[]});
 const completedList=useQuery({queryKey:scopedKey("unified-completed"),enabled:manualReversalEnabled&&hasPermission("pdv.cancelar_venda"),queryFn:async()=>(await api.get("/pdv-unificado/rascunhos-concluidos")).data.dados||[]});
 const reversalHistory=useQuery({queryKey:scopedKey("unified-reversals"),enabled:enabled&&hasPermission("pdv.cancelar_venda"),queryFn:async()=>(await api.get("/pdv-unificado/rascunhos-estornados")).data.dados||[]});
 const save=useMutation({mutationFn:async()=>{
   const dados=buildUnifiedDraftPayload(clientId,lines);
   const response=draft?await api.put(`/pdv-unificado/rascunhos/${draft.id}`,{...dados,versao:draft.versao}):await api.post("/pdv-unificado/rascunhos",dados);
   return response.data.dados;
 },onSuccess:async data=>{setLocalChanges(false);setDraft({id:data.id,versao:data.versao});setSavedNotice(`Rascunho #${data.numero} salvo. Sem venda ou cobrança.`);await queryClient.invalidateQueries({queryKey:["unified-drafts"]});}});
 const closingReview=useQuery({queryKey:scopedKey("unified-preclose",draft?.id,draft?.versao),enabled:enabled&&Boolean(draft?.id)&&draft?.status!=="FECHADA",queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/pre-fechamento`,{params:{versao:draft.versao}})).data.dados});
 const closingPlan=useQuery({queryKey:scopedKey("unified-close-plan",draft?.id,draft?.versao),enabled:enabled&&Boolean(draft?.id)&&closingReview.data?.pendencias?.length===0,queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/plano-fechamento`,{params:{versao:draft.versao}})).data.dados});
 const reservation=useQuery({queryKey:scopedKey("unified-reservation",draft?.id,draft?.versao),enabled:enabled&&Boolean(draft?.id),queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/reserva`,{params:{versao:draft.versao}})).data.dados});
 const isReserved=draft?.status==="FECHADA"||reservation.data?.status==="RESERVADA"||Boolean(reservation.data?.operacoes?.some(op=>op.status==="CONCLUIDA"));
 const reserveMutation=useMutation({mutationFn:async()=>(await api.post(`/pdv-unificado/rascunhos/${draft.id}/reservar`,{versao:draft.versao})).data.dados,onSuccess:async()=>{setSavedNotice("Operações reservadas com segurança. Nenhuma cobrança foi realizada.");await queryClient.invalidateQueries({queryKey:["unified-reservation"]});}});
 const cancelReservation=useMutation({mutationFn:async()=>(await api.post(`/pdv-unificado/rascunhos/${draft.id}/cancelar-reserva`,{versao:draft.versao,motivo:motivoCancelar})).data.dados,onSuccess:async()=>{setSavedNotice("Reserva cancelada. Ajuste e salve uma nova versão da comanda.");await queryClient.invalidateQueries({queryKey:["unified-reservation"]});}});
 const preview=useMutation({mutationFn:async()=>(await api.post("/pdv-unificado/simulacao",buildUnifiedDraftPayload(clientId,lines))).data.dados});
 function reopen(saved){
   setLocalChanges(false);setClientId(saved.cliente.id);setSelectedClient(saved.cliente);setClientSearch(saved.cliente.nome);setDraft({id:saved.id,versao:saved.versaoRascunho,status:saved.status});setSavedNotice("");
   setLines(rehydrateUnifiedDraft(saved));preview.reset();save.reset();
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
  <section className="page-heading"><div><span className="page-kicker">PDV Unificado · Gestão manual</span><h1>Comanda multiempresa — {manualCheckoutEnabled?"Fechamento manual":"Simulação"}</h1><p>{manualCheckoutEnabled?"Após confirmar cada recebimento externo, você poderá registrar a venda com baixa de estoque. Nenhuma nota fiscal será emitida pelo PointVet.":"Confira itens e valores por empresa. Nenhuma venda ou pagamento novo será registrado nesta tela."}{!manualCheckoutEnabled&&manualReversalEnabled?" Estorno integral autorizado separadamente para vendas já concluídas.":""}</p></div></section>
  <UnifiedRoleAcceptancePanel availability={eligibility.data}/>
  {eligibility.isLoading?<p>Conferindo acesso...</p>:eligibility.isError?<p className="alert alert--error">{getApiErrorMessage(eligibility.error)}</p>:!enabled?<div className="panel pv-detail-panel"><h2>Preferência ainda desativada</h2><p>Um gestor pode habilitar a preferência em Configurações → Módulos. Isso libera somente a simulação e não altera o PDV tradicional.</p></div>:<>
   <section className="panel pv-detail-panel"><div className="pv-detail-section-actions"><h2>Rascunhos recentes</h2><button type="button" className="ghost-button" onClick={()=>{setDraft(null);setClientId("");setSelectedClient(null);setClientSearch("");setLines([]);setLocalChanges(false);setSavedNotice("");preview.reset();save.reset();}}>Nova comanda</button></div>{draftList.isError&&<p className="alert alert--error">{getApiErrorMessage(draftList.error)}</p>}{(draftList.data||[]).map(d=><button key={d.id} className="ghost-button" type="button" onClick={()=>reopen(d)}>#{d.numero} · {d.cliente.nome} · versão {d.versaoRascunho}</button>)}{manualReversalEnabled&&hasPermission("pdv.cancelar_venda")&&<div className="pv-unified-completed"><h3>Vendas unificadas concluídas — estorno integral</h3><p>Reabra uma venda já registrada para conferir seu estorno. Nenhum estorno parcial é permitido.</p>{completedList.isError&&<p className="alert alert--error">{getApiErrorMessage(completedList.error)}</p>}{(completedList.data||[]).map(d=><button key={d.id} className="ghost-button" type="button" onClick={()=>reopen(d)}>Venda #{d.numero} · {d.cliente.nome} · estorno integral</button>)}</div>}</section>
   {hasPermission("pdv.cancelar_venda")&&<section className="panel pv-detail-panel"><h2>Histórico de estornos integrais</h2><p>Somente leitura. Exibe estornos já registrados nas empresas autorizadas, inclusive quando o fechamento manual está desligado. Nenhuma devolução monetária é processada nesta consulta.</p>{reversalHistory.isError&&<p className="alert alert--error">{getApiErrorMessage(reversalHistory.error)}</p>}{!reversalHistory.isLoading&&!reversalHistory.isError&&!(reversalHistory.data||[]).length&&<p>Nenhum estorno unificado encontrado para as empresas selecionadas.</p>}{(reversalHistory.data||[]).map(registro=><div className="pv-unified-manual-company" key={registro.id}><strong>Comanda #{registro.comanda.numero} · {registro.comanda.cliente.nome} · {formatCurrency(registro.total)}</strong><small>Estornada em {new Date(registro.criadoEm).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})} · Auditoria #{registro.id.slice(0,8)}</small>{registro.empresas.map(empresa=><div key={empresa.id}>{empresa.nome} · {formatCurrency(empresa.total)}</div>)}</div>)}</section>}
   <section className="panel pv-detail-panel"><h2>Cliente</h2><input className="form-control" placeholder="Buscar tutor" value={clientSearch} disabled={isReserved} onChange={e=>{setClientSearch(e.target.value);setClientId("");setSelectedClient(null);setLocalChanges(true);preview.reset();}}/><select className="form-control" value={clientId} onChange={e=>{const id=e.target.value;setClientId(id);setSelectedClient((clients.data||[]).find(c=>c.id===id)||null);setLocalChanges(true);preview.reset();}} aria-label="Selecione cliente" disabled={isReserved}><option value="">Selecione um cliente ativo</option>{visibleUnifiedClients(clients.data,selectedClient).map(c=><option value={c.id} key={c.id}>{c.nome}</option>)}</select>{draft&&localChanges&&!clientId&&<small>Selecione novamente o tutor para atualizar a comanda.</small>}</section>
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
 {reservation.data&&<div className="pv-unified-total"><h3>Reserva #{reservation.data.id.slice(0,8)}</h3><p>Status: {reservation.data.status==="CANCELADA"?"Cancelada":reservation.data.operacoes.some(op=>op.status==="CONCLUIDA")?"Venda registrada — somente estorno integral":"Reservada — edição bloqueada"}. Nenhuma nota fiscal emitida pelo PDV Unificado.</p>{reservation.data.operacoes.map(op=><div key={op.id}><span>{op.nome} · {op.cnpj}</span><strong>{formatCurrency(Number(op.valor))}</strong></div>)}{isReserved&&reservation.data.status==="RESERVADA"&&!reservation.data.operacoes.some(op=>op.status==="CONCLUIDA")&&hasPermission("pdv.cancelar_venda")&&<><label>Motivo para cancelar a reserva<input className="form-control" value={motivoCancelar} onChange={e=>setMotivoCancelar(e.target.value)}/></label><button type="button" className="ghost-button" disabled={cancelReservation.isPending||motivoCancelar.trim().length<5} onClick={()=>cancelReservation.mutate()}>{cancelReservation.isPending?"Cancelando...":"Cancelar reserva e liberar edição"}</button></>}</div>}
 {isReserved&&reservation.data?.status==="RESERVADA"&&<UnifiedAllocationConference draft={draft} reservation={reservation.data} dirty={localChanges} checkoutEnabled={manualCheckoutEnabled} reversalEnabled={manualReversalEnabled} onEstorno={()=>setSavedNotice("Estorno integral registrado; estoque e lote recompostos. A devolução externa foi apenas declarada, não processada pelo PointVet.")}/>}
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
function UnifiedAllocationConference({draft,reservation,dirty,checkoutEnabled,reversalEnabled,onEstorno}){
 const {selectedOrganization,selectedCompany}=useAuth();
 const scopedKey=(name,...details)=>unifiedScopedQueryKey(name,selectedOrganization?.id,selectedCompany?.id,...details);
 const [forms,setForms]=useState({});
 const nextPaymentId=useRef(0);
 const completed=reservation.operacoes.length>0&&reservation.operacoes.every(op=>op.status==="CONCLUIDA"&&op.vendaId);
 const sessions=useQuery({
  queryKey:scopedKey("unified-cash-sessions",draft?.id,draft?.versao),
  enabled:!completed&&Boolean(draft?.id)&&reservation?.status==="RESERVADA",
  queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/caixas-disponiveis`,{params:{versao:draft.versao}})).data.dados||[]
 });
 const diagnosis=useQuery({
  queryKey:scopedKey("unified-recovery-diagnosis",draft?.id,draft?.versao),
  enabled:!completed&&Boolean(draft?.id)&&reservation?.status==="RESERVADA",
  queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/diagnostico-recuperacao`,{params:{versao:draft.versao}})).data.dados
 });
 const localCheck=previewManualAllocation(reservation.operacoes,sessions.data||[],forms);
 const payload=()=>({versao:draft.versao,alocacoes:localCheck.alocacoes});
 const conference=useMutation({
  mutationFn:async()=>(await api.post(`/pdv-unificado/rascunhos/${draft.id}/conferencia-alocacao`,payload())).data.dados
 });
 const preparation=useQuery({
  queryKey:scopedKey("unified-preparation",draft?.id,draft?.versao),
  enabled:Boolean(draft?.id)&&reservation?.status==="RESERVADA",
  queryFn:async()=>(await api.get(`/pdv-unificado/rascunhos/${draft.id}/preparacao-execucao`,{params:{versao:draft.versao}})).data.dados
 });
 const prepare=useMutation({
  mutationFn:async()=>(await api.post(`/pdv-unificado/rascunhos/${draft.id}/preparacao-execucao`,payload())).data.dados,
  onSuccess:async()=>{await preparation.refetch();}
 });
 function set(companyId,patch){setForms(current=>({...current,[companyId]:{...current[companyId],...patch}}));conference.reset();prepare.reset();}
 function paymentRows(op){return forms[op.empresaId]?.pagamentos??[defaultManualPayment(op)];}
 function changePayment(op,id,patch){set(op.empresaId,{pagamentos:paymentRows(op).map(p=>p.id===id?{...p,...patch}:p)});}
 function addPayment(op){set(op.empresaId,{pagamentos:[...paymentRows(op),{id:`novo:${++nextPaymentId.current}`,forma:"PIX",valor:""}]});}
 function removePayment(op,id){set(op.empresaId,{pagamentos:paymentRows(op).filter(p=>p.id!==id)});}
 if(completed)return <section className="panel pv-detail-panel"><h2>Venda concluída — estorno integral</h2>
  <p>Venda recuperada do histórico da organização. Nenhuma venda-filha poderá ser estornada isoladamente.</p>
  {preparation.isLoading&&<p>Recuperando preparação de recebimentos...</p>}
  {preparation.isError&&<p className="alert alert--error">{getApiErrorMessage(preparation.error)}</p>}
  {preparation.data?.status==="PREPARADA"&&<UnifiedManualReceiptPreview key={preparation.data.id} preparacao={preparation.data} versao={draft.versao} comandaId={draft.id} checkoutEnabled={checkoutEnabled} reversalEnabled={reversalEnabled} onEstorno={onEstorno} operacoesFechadas={reservation.operacoes}/>}
 </section>;
 return <section className="panel pv-detail-panel"><h2>Conferência de pagamentos por empresa</h2>
  <p>Informe a distribuição MANUAL por empresa: dinheiro, Pix, cartões ou transferência, inclusive pagamentos mistos. A soma deve bater exatamente com a comanda. Esta tela apenas confere: não registra recebimento, parcela, caixa, estoque ou nota fiscal.</p>
  {sessions.isError&&<p className="alert alert--error">{getApiErrorMessage(sessions.error)}</p>}
  {reservation.operacoes.map(op=>{
   const opts=(sessions.data||[]).filter(x=>x.empresaId===op.empresaId);
   const current=forms[op.empresaId]||{};
   const rows=paymentRows(op);
   return <div key={op.empresaId} className="pv-unified-manual-company">
    <div className="pv-detail-section-actions"><strong>{op.nome} — {formatCurrency(Number(op.valor))}</strong><small>CNPJ: {op.cnpj}</small></div>
    <label>Caixa aberto desta empresa<select className="form-control" value={current.sessaoCaixaId||opts[0]?.sessaoCaixaId||""} onChange={e=>set(op.empresaId,{sessaoCaixaId:e.target.value})}>
      {!opts.length&&<option value="">Nenhum caixa aberto</option>}
      {opts.map(x=><option key={x.sessaoCaixaId} value={x.sessaoCaixaId}>{x.caixa}</option>)}
     </select></label>
    {rows.map((p,index)=><div className="pv-unified-manual-payment" key={p.id}>
     <label>Forma {index+1}<select className="form-control" value={p.forma} onChange={e=>changePayment(op,p.id,{forma:e.target.value})}>
      {manualPaymentForms.map(forma=><option key={forma} value={forma}>{({DINHEIRO:"Dinheiro",PIX:"Pix",CARTAO_DEBITO:"Débito",CARTAO_CREDITO:"Crédito",TRANSFERENCIA:"Transferência"})[forma]}</option>)}
     </select></label>
     <label>Valor (R$)<input className="form-control" type="text" inputMode="decimal" placeholder="Ex.: 5,00" value={p.valor} onChange={e=>changePayment(op,p.id,{valor:e.target.value})}/></label>
     <button type="button" className="ghost-button" disabled={rows.length===1} onClick={()=>removePayment(op,p.id)}>Remover forma</button>
    </div>)}
    <button className="ghost-button" type="button" disabled={rows.length>=10} onClick={()=>addPayment(op)}><Plus size={16}/> Adicionar forma</button>
   </div>;
  })}
  {!sessions.isLoading&&localCheck.pendencias.length>0&&<div className="alert alert--error" role="alert"><strong>Revise a divisão antes de conferir:</strong>
   {localCheck.pendencias.map((p,i)=><p key={`${p.empresaId}-${p.codigo}-${i}`}>{reservation.operacoes.find(op=>op.empresaId===p.empresaId)?.nome||"Comanda"}: {({CAIXA_INDISPONIVEL:"Selecione um caixa aberto desta empresa",TOTAL_INVALIDO:"Total da empresa inválido",PAGAMENTO_INVALIDO:"Forma ou valor inválido",SOMA_DIVERGENTE:"A soma dos pagamentos não corresponde ao total",QUANTIDADE_PAGAMENTOS_INVALIDA:"Informe de 1 a 10 formas de pagamento",EMPRESA_DUPLICADA:"Empresa repetida",SEM_OPERACOES:"Não há empresas para conferir"})[p.codigo]||p.codigo}{p.indice?` (forma ${p.indice})`:""}</p>)}
  </div>}
  <button className="ghost-button" type="button" disabled={dirty||!localCheck.pronto||sessions.isLoading||conference.isPending} onClick={()=>conference.mutate()}>{conference.isPending?"Conferindo...":"Conferir alocação (sem cobrar)"}</button>
  {dirty&&<p>Salve as alterações locais antes de conferir a alocação.</p>}
  {conference.isError&&<p className="alert alert--error">{getApiErrorMessage(conference.error)}</p>}
  {conference.data?.preConferenciaAprovada&&!preparation.data&&<div className="pv-unified-total">
   <strong>Próximo estágio: preparação imutável</strong>
   <p>Grava a distribuição validada por empresa para recuperação segura. Continua sem vendas, pagamentos, baixa de estoque ou notas.</p>
   <button className="ghost-button" type="button" disabled={dirty||!localCheck.pronto||prepare.isPending} onClick={()=>prepare.mutate()}>{prepare.isPending?"Preparando...":"Salvar preparação (sem vender)"}</button>
  </div>}
  {prepare.isError&&<p className="alert alert--error">{getApiErrorMessage(prepare.error)}</p>}
  {preparation.isError&&<p className="alert alert--error">{getApiErrorMessage(preparation.error)}</p>}
  {preparation.data&&<div className="pv-unified-total">
   <strong>Preparação {preparation.data.status==="PREPARADA"?"registrada":"invalidada"} — {preparation.data.id.slice(0,8)}</strong>
   <p>Snapshot auditável de {preparation.data.operacoes.length} operação(ões). Nenhum pagamento ou venda executado.</p>
   {preparation.data.operacoes.map(op=><div key={op.empresaId}><span>{op.cnpj}</span><strong>{formatCurrency(Number(op.total))}</strong></div>)}
  </div>}
  {preparation.data?.status==="PREPARADA"&&!dirty&&!diagnosis.data?.exigeRevisaoManual&&
   <UnifiedManualReceiptPreview key={preparation.data.id} preparacao={preparation.data} versao={draft.versao} comandaId={draft.id} checkoutEnabled={checkoutEnabled} onEstorno={onEstorno} operacoesFechadas={reservation.operacoes.filter(op=>op.status==="CONCLUIDA"&&op.vendaId)}/>}
  {conference.data&&<div className="pv-unified-total">
   <strong>{conference.data.preConferenciaAprovada?"Alocações consistentes — execução ainda desativada":"Alocações com pendências"}</strong>
   {conference.data.pendencias.map((e,i)=><p key={i}>{e.codigo} — empresa {e.empresaId}</p>)}
   <p>Nenhuma venda ou pagamento foi registrado.</p>
  </div>}
  {diagnosis.data?.exigeRevisaoManual&&<p className="alert alert--error">Diagnóstico de recuperação identificou divergência de estado. Não efetue cobranças; encaminhe para revisão.</p>}
 </section>;
}

/** A confirmação parte somente de linhas imutáveis do servidor; apenas o endpoint
 * autenticado/permitido pode registrar a venda ou consumir estoque.
 */
function UnifiedManualReceiptPreview({preparacao,versao,comandaId,checkoutEnabled,reversalEnabled,onEstorno,operacoesFechadas=[]}){
 const {hasPermission}=useAuth();
 const [conferencias,setConferencias]=useState({});
 const [mostrarResumo,setMostrarResumo]=useState(false);
 const [motivoEstorno,setMotivoEstorno]=useState("");
 const [referenciaEstorno,setReferenciaEstorno]=useState("");
 const [devolucaoConferida,setDevolucaoConferida]=useState(false);
 const resultado=previewManualReceipt(preparacao,versao,conferencias);
 const queryClient=useQueryClient();
 const fechar=useMutation({
  mutationFn:async()=>(await api.post(`/pdv-unificado/rascunhos/${comandaId}/fechar-manual`,resultado.dados)).data.dados,
  onSuccess:async()=>{await queryClient.invalidateQueries({queryKey:["unified-drafts"]});}
 });
 const vendaRegistrada=fechar.isSuccess||operacoesFechadas.length===preparacao.operacoes.length;
 const estornar=useMutation({
  mutationFn:async()=>(await api.post(`/pdv-unificado/rascunhos/${comandaId}/estornar-manual`,{
   versao,motivo:motivoEstorno.trim(),referenciaExterna:referenciaEstorno.trim()||null,
   confirmouDevolucaoExterna:devolucaoConferida
  })).data.dados,
  onSuccess:async()=>{onEstorno();await Promise.all([
   queryClient.invalidateQueries({queryKey:["unified-drafts"]}),
   queryClient.invalidateQueries({queryKey:["unified-completed"]}),
   queryClient.invalidateQueries({queryKey:["unified-reversals"]}),
   queryClient.invalidateQueries({queryKey:["unified-reservation"]}),
   queryClient.invalidateQueries({queryKey:["unified-preparation"]})
  ]);}
 });
 function alterar(empresaId,indice,patch){
  if(vendaRegistrada)return;
  setConferencias(current=>({
   ...current,[empresaId]:{...current[empresaId],
    [indice]:{...current[empresaId]?.[indice],...patch}}
  }));
  setMostrarResumo(false);
 }
 const nomes={DINHEIRO:"Dinheiro",PIX:"Pix",CARTAO_DEBITO:"Cartão de débito",
  CARTAO_CREDITO:"Cartão de crédito",TRANSFERENCIA:"Transferência"};
 return <div className="pv-unified-total pv-unified-manual-receipt-preview">
  <h3>Declaração manual de recebimento</h3>
  {!vendaRegistrada&&<>
  <p>Confira o recebimento <strong>fora do PointVet</strong> e marque cada forma individualmente. Os valores e caixas abaixo vêm da preparação salva no servidor e não podem ser alterados aqui. {checkoutEnabled?"Ao finalizar, serão registradas vendas e baixas de estoque, sem emissão fiscal pelo PointVet.":"A confirmação é somente prévia local: não grava declaração nem venda."}</p>
  {preparacao.operacoes.map(op=><div key={op.empresaId} className="pv-unified-manual-company">
   <strong>CNPJ {op.cnpj} · Total {formatCurrency(Number(op.total))}</strong>
   <small>Caixa da preparação: {op.sessaoCaixaId}</small>
   {op.pagamentos.map((pagamento,indice)=>{
    const atual=conferencias[op.empresaId]?.[indice]||{};
    return <div key={`${op.empresaId}:${indice}`} className="pv-unified-manual-payment">
     <div><strong>{nomes[pagamento.forma]||pagamento.forma}</strong><span>{formatCurrency(pagamento.valorCentavos/100)}</span></div>
     {pagamento.forma==="CARTAO_CREDITO"&&<label>Parcelas declaradas (1 a 24)
      <input className="form-control" type="text" inputMode="numeric" maxLength={2} disabled={fechar.isSuccess} value={atual.parcelas??"1"}
       onChange={e=>alterar(op.empresaId,indice,{parcelas:e.target.value})}/>
     </label>}
     <label>Referência externa (opcional, até 120 caracteres)
      <input className="form-control" type="text" maxLength={120} disabled={fechar.isSuccess} placeholder="Anotação do atendente" value={atual.referencia??""}
       onChange={e=>alterar(op.empresaId,indice,{referencia:e.target.value})}/>
     </label>
     <label><input type="checkbox" disabled={fechar.isSuccess} checked={atual.confirmadoPeloAtendente===true}
      onChange={e=>alterar(op.empresaId,indice,{confirmadoPeloAtendente:e.target.checked})}/>
      Conferi manualmente este recebimento externo{checkoutEnabled?"":" (simulação, sem registro)"}
     </label>
    </div>;
   })}
  </div>)}
  {resultado.pendencias.length>0&&<div className="alert" role="status">
   <strong>Prévia ainda incompleta:</strong>
   {resultado.pendencias.map((p,i)=><p key={`${p.empresaId}-${p.indice}-${p.codigo}-${i}`}>
    {p.empresaId||"Preparação"}{p.indice?` · forma ${p.indice}`:""}: {({
     PREPARACAO_INDISPONIVEL:"Preparação ou versão indisponível",OPERACAO_INVALIDA:"Empresa ou caixa inválido",
     PREPARACAO_INVALIDA:"Pagamento salvo inválido",SOMA_DIVERGENTE:"Total divergente",
     RECEBIMENTO_NAO_CONFIRMADO:"Falta conferência do atendente",REFERENCIA_INVALIDA:"Referência inválida",
     PARCELAS_INVALIDAS:"Confira as parcelas do cartão"
    })[p.codigo]||p.codigo}
   </p>)}
  </div>}
  <button className="ghost-button" type="button" disabled={!resultado.pronto} onClick={()=>setMostrarResumo(true)}>
   Verificar declaração (sem registrar)
  </button>
  {mostrarResumo&&resultado.pronto&&<p className="alert alert--success" role="status">
   Prévia local consistente: {resultado.dados.alocacoes.reduce((total,op)=>total+op.pagamentos.length,0)} forma(s) conferida(s). <strong>Nada foi enviado ou registrado por esta conferência.</strong>
  </p>}
  </>}
  {checkoutEnabled&&<>
   {!vendaRegistrada&&<><p><strong>Antes de concluir:</strong> confirme que os valores foram efetivamente recebidos fora do sistema. A emissão fiscal, quando exigida, deverá ocorrer no processo externo aplicável.</p>
   <button type="button" className="primary-button" disabled={!resultado.pronto||fechar.isPending||vendaRegistrada} onClick={()=>fechar.mutate()}>
    {fechar.isPending?"Registrando venda...":"Confirmar recebimentos e registrar venda"}
   </button></>}
   {fechar.isError&&<p className="alert alert--error" role="alert">{getApiErrorMessage(fechar.error)} Verifique a situação da comanda antes de tentar novamente.</p>}
  </>}
   {vendaRegistrada&&<div className="alert alert--success" role="status">
    <strong>Venda registrada com sucesso.</strong> Estoque e caixa atualizados por empresa. Sem emissão fiscal pelo PointVet.
    {(fechar.data?.vendas||operacoesFechadas.map(op=>({vendaId:op.vendaId,empresaId:op.empresaId}))).map(v=><p key={v.vendaId}>Empresa {v.empresaId} · Venda {v.vendaId}</p>)}
    <p>Não é possível cancelar vendas-filhas isoladas. O cancelamento deve ser integral, com permissão em todos os CNPJs.</p>
   </div>}
   {vendaRegistrada&&reversalEnabled&&hasPermission("pdv.cancelar_venda")&&<section className="pv-unified-manual-company">
    <h4>Estorno integral desta comanda</h4>
    {!checkoutEnabled&&<p className="alert" role="status">Contingência: novas vendas continuam bloqueadas. Apenas o estorno integral desta venda já concluída está autorizado.</p>}
    <p>Use somente após devolver ou acertar efetivamente os valores <strong>fora do PointVet</strong>. O sistema registra a declaração, estorna pagamentos e vendas e repõe o estoque por lote; não transfere dinheiro nem cancela documentos fiscais.</p>
    {!estornar.isSuccess?<>
     <label>Motivo obrigatório (10 a 500 caracteres)
      <textarea className="form-control" rows={2} maxLength={500} disabled={estornar.isPending}
       value={motivoEstorno} onChange={e=>setMotivoEstorno(e.target.value)}/>
     </label>
     <label>Referência da devolução externa (opcional)
      <input className="form-control" maxLength={120} disabled={estornar.isPending}
       value={referenciaEstorno} onChange={e=>setReferenciaEstorno(e.target.value)}/>
     </label>
     <label><input type="checkbox" disabled={estornar.isPending} checked={devolucaoConferida}
      onChange={e=>setDevolucaoConferida(e.target.checked)}/>
      Confirmo que a devolução ou o acerto externo dos valores de todos os CNPJs já foi realizado e conferido.
     </label>
     <button type="button" className="ghost-button" disabled={estornar.isPending||motivoEstorno.trim().length<10||!devolucaoConferida}
      onClick={()=>estornar.mutate()}>{estornar.isPending?"Estornando...":"Registrar estorno integral"}</button>
     {estornar.isError&&<p className="alert alert--error" role="alert">{getApiErrorMessage(estornar.error)} Nenhum estorno parcial foi confirmado. Solicite revisão se necessário.</p>}
    </>:<p className="alert alert--success" role="status"><strong>Estorno integral registrado.</strong> Estoque recomposto conforme os movimentos originais. A devolução externa foi declarada, não realizada pelo PointVet. Auditoria #{estornar.data.id}.</p>}
   </section>}
  <small>Sem comunicação com balança, maquininha, PSP, banco ou provedor fiscal. A referência digitada {checkoutEnabled?"será armazenada como declaração do atendente, sem comprovar liquidação bancária.":"não é armazenada nem comprova pagamento."}</small>
 </div>;
}
