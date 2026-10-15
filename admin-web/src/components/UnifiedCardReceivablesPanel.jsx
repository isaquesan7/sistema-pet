/**
 * PointVet M.5.7 — painel de conferência estritamente read-only.
 * Só dados do CNPJ selecionado, com acesso ao PDV e financeiro.gerenciar.
 * Não oferece liquidar, fechar, baixar, estornar ou emitir fiscal.
 */
import {useMemo,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {ShieldCheck,RefreshCw,WalletCards} from "lucide-react";
import api,{getApiErrorMessage} from "../lib/api.js";
import {useAuth} from "../context/AuthContext.jsx";
import {formatCurrency} from "../lib/formatters.js";
import UnifiedCardManualDryRun from "./UnifiedCardManualDryRun.jsx";
import UnifiedCardRefundDryRun from "./UnifiedCardRefundDryRun.jsx";

const textStatus={
 AGUARDANDO_REPASSE:"Aguardando repasse",
 REPASSE_PARCIAL_DECLARADO:"Repasse parcial declarado",
 REPASSE_INTEGRAL_DECLARADO:"Repasse integral declarado",
 ESTORNADO:"Estornado"
};
const operationStatus={
 AGUARDANDO_SEGUNDA_CONFERENCIA:"Aguardando segunda conferência documental",
 SEGUNDA_CONFERENCIA_DOCUMENTAL_DECLARADA:"Conferência documental registrada; repasse ainda não lançado",
 REPASSE_INTERNO_CONFIRMADO_MANUALMENTE:"Repasse registrado manualmente no saldo interno",
 CORRECAO_INTERNA_REGISTRADA:"Correção registrada por contralançamento"
};
const money=x=>formatCurrency(Number(x||0));
export default function UnifiedCardReceivablesPanel(){
 const {selectedCompany,selectedOrganization,hasPermission}=useAuth();
 const [selectedId,setSelectedId]=useState("");
 const allowed=hasPermission("financeiro.gerenciar")&&hasPermission("pdv.acessar");
 const companyId=selectedCompany?.id;
 const eligibility=useQuery({
  queryKey:["unified-card-eligibility",selectedOrganization?.id,companyId],
  enabled:allowed&&Boolean(companyId),
  queryFn:async()=>(await api.get("/pdv-unificado/disponibilidade")).data.dados
 });
 const enabled=allowed&&eligibility.data?.preferenciaUnificado===true;
 const commands=useQuery({
  queryKey:["unified-card-commands",companyId,selectedOrganization?.id],
  enabled,
  queryFn:async()=>(await api.get("/pdv-unificado/recebiveis-cartao/comandas")).data.dados||[]
 });
 const options=commands.data||[];
 const effectiveId=useMemo(()=>options.some(x=>x.id===selectedId)?selectedId:
  (options[0]?.id||""),[selectedId,options]);
 const report=useQuery({
  queryKey:["unified-card-summary",companyId,selectedOrganization?.id,effectiveId],
  enabled:enabled&&Boolean(effectiveId),
  queryFn:async()=>(await api.get("/pdv-unificado/recebiveis-cartao/comandas/"+encodeURIComponent(effectiveId))).data.dados
 });
 const workflow=useQuery({
  queryKey:["unified-card-m516-stages",companyId,selectedOrganization?.id,effectiveId],
  enabled:enabled&&Boolean(effectiveId),
  queryFn:async()=>(await api.get("/pdv-unificado/recebiveis-cartao/comandas/"+
   encodeURIComponent(effectiveId)+"/etapas")).data.dados
 });
 const breakdown=useQuery({
  queryKey:["unified-card-m520-fees",companyId,selectedOrganization?.id,effectiveId],
  enabled:enabled&&Boolean(effectiveId),
  queryFn:async()=>(await api.get("/pdv-unificado/recebiveis-cartao/comandas/"+
   encodeURIComponent(effectiveId)+"/discriminacao")).data.dados
 });
 const dryRun=useQuery({
  queryKey:["unified-card-m517-preview",companyId,selectedOrganization?.id,effectiveId],
  enabled:enabled&&Boolean(effectiveId),
  queryFn:async()=>(await api.get("/pdv-unificado/recebiveis-cartao/comandas/"+
   encodeURIComponent(effectiveId)+"/simulacao-manual")).data.dados
 });
 const refundPlan=useQuery({
  queryKey:["unified-card-m521-refund-plan",companyId,selectedOrganization?.id,effectiveId],
  enabled:enabled&&Boolean(effectiveId),
  queryFn:async()=>(await api.get("/pdv-unificado/recebiveis-cartao/comandas/"+
   encodeURIComponent(effectiveId)+"/devolucao-previa")).data.dados
 });
 const history=useQuery({
  queryKey:["unified-card-m515",companyId,selectedOrganization?.id,effectiveId],
  enabled:enabled&&Boolean(effectiveId),
  queryFn:async()=>(await api.get("/pdv-unificado/recebiveis-cartao/comandas/"+
   encodeURIComponent(effectiveId)+"/conferencia")).data.dados
 });
 async function revalidarVersaoM519({preparacaoId,codigoRevisao}){
  // An explicit GET bypasses cached data. The form never sends values or
  // confirmation statements and changing the SHA remounts its local fields.
  if(!preparacaoId||!codigoRevisao)return "INDETERMINADA";
  const result=await dryRun.refetch();
  if(result.isError||!result.data?.leituraSomente)return "INDETERMINADA";
  const current=result.data.planos?.find(p=>p.preparacaoId===preparacaoId);
  return current?.revisaoFinanceira?.codigoRevisao===codigoRevisao?"ATUAL":"ALTERADA";
 }
 if(!allowed)return <section className="panel"><h2>Repasses de cartão</h2>
  <p>Somente funcionários com acesso ao PDV e permissão de gestão financeira podem consultar os recebíveis.</p></section>;
 return <section className="panel">
  <div className="panel__heading"><div><h2>Repasses de cartão — PDV Unificado</h2>
   <p>Conferência manual por CNPJ selecionado. Esta tela não movimenta caixa, títulos nem saldo de contas.</p></div>
   <ShieldCheck size={20} aria-hidden="true"/>
  </div>
  {eligibility.isLoading?<p>Verificando disponibilidade…</p>:null}
  {eligibility.isError?<p className="alert alert--error" role="alert">{getApiErrorMessage(eligibility.error)}</p>:null}
  {eligibility.data&&!eligibility.data.preferenciaUnificado?
   <p>O PDV Unificado é opcional e está desativado nesta organização. O PDV atual permanece funcionando.</p>:null}
  {enabled?<div>
   <p><strong>Atenção:</strong> o valor conciliado é uma declaração humana de repasse externo, não comprovante bancário independente. A consulta não recebe dinheiro nem realiza baixa.</p>
   <div className="finance-filterbar">
    <label>Comanda com recebíveis de cartão
     <select className="form-control" value={effectiveId} onChange={e=>setSelectedId(e.target.value)}>
      {!options.length?<option value="">Nenhuma comanda disponível</option>:null}
      {options.map(c=><option key={c.id} value={c.id}>Comanda #{c.numero} · {c.status}</option>)}
     </select>
    </label>
    <button className="secondary-button" type="button"
     disabled={!effectiveId||report.isFetching||history.isFetching||workflow.isFetching||dryRun.isFetching||breakdown.isFetching||refundPlan.isFetching} onClick={()=>{report.refetch();history.refetch();workflow.refetch();dryRun.refetch();breakdown.refetch();refundPlan.refetch();}}>
     <RefreshCw size={14}/> Atualizar leitura
    </button>
   </div>
   {commands.isLoading?<p>Buscando comandas…</p>:null}
   {commands.isError?<p className="alert alert--error" role="alert">{getApiErrorMessage(commands.error)}</p>:null}
   {commands.isSuccess&&!options.length?<div className="mini-empty">Ainda não existem recebíveis de cartão de crédito unificado para este CNPJ.</div>:null}
   {report.isLoading?<p>Conferindo parcelas…</p>:null}
   {report.isError?<p className="alert alert--error" role="alert">Não foi possível validar os recebíveis. Nenhum valor foi alterado. {getApiErrorMessage(report.error)}</p>:null}
   {report.data?<div>
    <div className="finance-open-grid">
     <div className="panel finance-open-card"><span>Total original</span><strong>{money(report.data.totais.original)}</strong></div>
     <div className="panel finance-open-card"><span>Pendente</span><strong>{money(report.data.totais.pendente)}</strong></div>
     <div className="panel finance-open-card"><span>Repasse declarado</span><strong>{money(report.data.totais.conciliadoDeclarado)}</strong></div>
     <div className="panel finance-open-card"><span>Estornado</span><strong>{money(report.data.totais.estornado)}</strong></div>
    </div>
    <div className="table-scroll"><table className="data-table">
     <thead><tr><th>Pagamento</th><th>Parcelas</th><th>Valor original</th><th>Pendente</th><th>Repasse declarado</th><th>Situação</th></tr></thead>
     <tbody>{report.data.linhas.map(row=><tr key={row.linhaId}>
      <td>Cartão de crédito</td><td>{row.quantidadeParcelas}x</td>
      <td>{money(row.totais.original)}</td><td>{money(row.totais.pendente)}</td>
      <td>{money(row.totais.conciliadoDeclarado)}</td>
      <td>{textStatus[row.situacao]||row.situacao}</td>
     </tr>)}</tbody>
    </table></div>
    <p><WalletCards size={14} aria-hidden="true"/> Recebíveis de cartão informados manualmente. O PointVet não se conecta ao banco nem à maquininha.</p>
    <h3>Composição dos repasses — sem lançar despesas</h3>
    <p>Taxas de cartão e antecipação informadas pelo estabelecimento. A tabela é apenas demonstrativa: nenhum valor abaixo constitui despesa paga, novo faturamento ou dinheiro confirmado automaticamente pelo banco.</p>
    {breakdown.isLoading?<p>Conferindo taxas e antecipações...</p>:null}
    {breakdown.isError?<p className="alert alert--error" role="alert">Não foi possível validar a composição financeira. {getApiErrorMessage(breakdown.error)}</p>:null}
    {breakdown.data?.leituraSomente&&breakdown.data?.autorizaCheckout===false?
     <div className="table-scroll"><table className="data-table">
      <thead><tr><th>Conjunto</th><th>Bruto vinculado</th><th>Taxas informadas</th><th>Desconto por antecipação</th><th>Líquido</th></tr></thead>
      <tbody>
       <tr><td>Pré-baixas preparadas (inclui pendentes e corrigidas)</td>
        <td>{money(breakdown.data.preparacoes.bruto)}</td>
        <td>{money(breakdown.data.preparacoes.tarifasInformadas)}</td>
        <td>{money(breakdown.data.preparacoes.descontosAntecipacaoInformados)}</td>
        <td>{money(breakdown.data.preparacoes.liquidoPrevisto)}</td></tr>
       <tr><td>Repasses internos ativos (exclui correções)</td>
        <td>{money(breakdown.data.repassesAtivos.brutoCorrespondente)}</td>
        <td>{money(breakdown.data.repassesAtivos.tarifasInformadas)}</td>
        <td>{money(breakdown.data.repassesAtivos.descontosAntecipacaoInformados)}</td>
        <td>{money(breakdown.data.repassesAtivos.liquidoNoSaldoInterno)}</td></tr>
      </tbody>
     </table></div>:null}
    {breakdown.data?<p>Entradas internas: <strong>{money(breakdown.data.movimentosInternos.entradasLiquidas)}</strong> · Correções: <strong>{money(breakdown.data.movimentosInternos.correcoesLiquidas)}</strong> · Efeito líquido: <strong>{money(breakdown.data.movimentosInternos.efeitoLiquido)}</strong>.</p>:null}
    <h3>Etapas da conferência manual — somente consulta</h3>
    <p>O fluxo mostra exclusivamente eventos registrados no PointVet. Uma etapa documental concluída não significa depósito confirmado automaticamente pela instituição financeira.</p>
    {workflow.isLoading?<p>Verificando etapas...</p>:null}
    {workflow.isError?<p className="alert alert--error" role="alert">Não foi possível validar as etapas. {getApiErrorMessage(workflow.error)}</p>:null}
    {workflow.isSuccess&&!workflow.data?.quantidade?<p>Nenhuma pré-baixa preparada nesta comanda.</p>:null}
    {workflow.data?.preparacoes?.length?<div className="table-scroll"><table className="data-table">
      <thead><tr><th>Referência informada</th><th>Valor bruto</th><th>Taxa</th><th>Antecipação</th><th>Líquido</th><th>Etapa registrada</th></tr></thead>
      <tbody>{workflow.data.preparacoes.map(p=><tr key={p.preparacaoId}>
       <td>{p.referenciaExtrato}</td>
       <td>{money(p.valorBruto)}</td><td>{money(p.tarifaCartao)}</td>
       <td>{money(p.descontoAntecipacao)}</td><td>{money(p.valorLiquido)}</td>
       <td>{operationStatus[p.etapa]||"Revisão financeira necessária"}</td>
      </tr>)}</tbody>
    </table></div>:null}
    {dryRun.isLoading?<p>Preparando simulação local...</p>:null}
    {dryRun.isError?<p className="alert alert--error" role="alert">O simulador não está disponível porque os dados não puderam ser validados. {getApiErrorMessage(dryRun.error)}</p>:null}
    {dryRun.data?.leituraSomente&&dryRun.data?.permitePostFinanceiro===false?
     <UnifiedCardManualDryRun
      key={[selectedOrganization?.id,companyId,effectiveId].join(":")}
      planos={dryRun.data.planos} empresaId={companyId} comandaId={effectiveId}
      onRevalidar={revalidarVersaoM519}/>:null}
    <p><strong>Controles de segurança:</strong> a preparação, a segunda conferência e os lançamentos são feitos por funcionários autorizados. As ações de confirmação e correção não estão disponíveis nesta tela nem foram publicadas.</p>
    {refundPlan.isLoading?<p>Preparando simulação de devolução pós-repasse...</p>:null}
    {refundPlan.isError?<p className="alert alert--error" role="alert">A prévia de devolução está indisponível. {getApiErrorMessage(refundPlan.error)}</p>:null}
    {refundPlan.data?.leituraSomente&&refundPlan.data?.permiteEstornoAutomatico===false?
     <UnifiedCardRefundDryRun
      key={[selectedOrganization?.id,companyId,effectiveId,
       (refundPlan.data.preparacoes||[]).map(x=>x.codigoRevisao).join(":")].join(":")}
      plano={refundPlan.data} empresaId={companyId} comandaId={effectiveId}/>:null}
    <h3>Histórico financeiro manual — somente leitura</h3>
    <p>Estas entradas e correções refletem declarações de funcionários sobre valores conferidos fora do PointVet. O saldo é apenas o registro interno da empresa.</p>
    {history.isLoading?<p>Carregando histórico...</p>:null}
    {history.isError?<p className="alert alert--error" role="alert">{getApiErrorMessage(history.error)}</p>:null}
    {history.data?.resumo?<div>
     <div className="finance-open-grid" aria-label="Resumo do efeito no saldo interno desta comanda">
      <div className="panel finance-open-card"><span>Entradas líquidas manuais</span><strong>{money(history.data.resumo.entradaLiquidaDeclarada)}</strong></div>
      <div className="panel finance-open-card"><span>Correções manuais</span><strong>{money(history.data.resumo.correcoesLiquidas)}</strong></div>
      <div className="panel finance-open-card"><span>Efeito líquido no saldo interno</span><strong>{money(history.data.resumo.efeitoLiquidoNoSaldoInterno)}</strong></div>
     </div>
     <p><strong>Escopo:</strong> apenas os repasses desta comanda e deste CNPJ. Não corresponde ao saldo total da conta, ao faturamento, à receita nova nem a depósito confirmado automaticamente pelo banco.</p>
     <h3>Como conferir um repasse manualmente</h3>
     <ol>
      <li>Consulte o comprovante ou extrato na instituição de sua escolha, fora do PointVet.</li>
      <li>Compare empresa, comanda, parcelas, valor bruto, taxa, antecipação e líquido.</li>
      <li>Uma pessoa autorizada deve registrar a confirmação; correções exigem revisão de outro funcionário e preservam o histórico.</li>
     </ol>
     <p><strong>Confirmação e correção nesta tela ainda não estão habilitadas.</strong> O checkout unificado permanece bloqueado até a homologação operacional.</p>
    </div>:null}
    {history.isSuccess&&!(history.data?.movimentos||[]).length?<p>Nenhum repasse contabilizado internamente para esta comanda.</p>:null}
    {history.data?.movimentos?.length?<div className="table-scroll"><table className="data-table">
     <thead><tr><th>Movimento</th><th>Conta interna</th><th>Valor líquido</th><th>Conferido por</th><th>Situação</th></tr></thead>
     <tbody>{history.data.movimentos.map(item=><tr key={item.id}>
      <td>{item.tipo==="CORRECAO_MANUAL"?"Correção manual (saída)":"Repasse manual (entrada)"}</td>
      <td>{item.conta}</td><td>{money(item.valor)}</td><td>{item.operador}</td>
      <td>{item.tipo==="CORRECAO_MANUAL"?"Contralançamento registrado":item.possuiCorrecao?"Compensado":"Declarado pelo operador"}</td>
     </tr>)}</tbody>
    </table></div>:null}
   </div>:null}
  </div>:null}
 </section>;
}
