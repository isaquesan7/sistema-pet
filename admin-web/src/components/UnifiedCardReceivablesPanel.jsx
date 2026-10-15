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

const textStatus={
 AGUARDANDO_REPASSE:"Aguardando repasse",
 REPASSE_PARCIAL_DECLARADO:"Repasse parcial declarado",
 REPASSE_INTEGRAL_DECLARADO:"Repasse integral declarado",
 ESTORNADO:"Estornado"
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
 const history=useQuery({
  queryKey:["unified-card-postings",companyId,selectedOrganization?.id,effectiveId],
  enabled:enabled&&Boolean(effectiveId),
  queryFn:async()=>(await api.get("/pdv-unificado/recebiveis-cartao/comandas/"+
   encodeURIComponent(effectiveId)+"/lancamentos")).data.dados||[]
 });
 if(!allowed)return <section className="panel"><h2>Repasses de cartão</h2>
  <p>Somente funcionários com acesso ao PDV e permissão de gestão financeira podem consultar os recebíveis.</p></section>;
 return <section className="panel">
  <div className="panel__heading"><div><h2>Repasses de cartão — PDV Unificado</h2>
   <p>Conferência por CNPJ selecionado, sem atualização de caixa, títulos ou saldo bancário.</p></div>
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
     disabled={!effectiveId||report.isFetching||history.isFetching} onClick={()=>{report.refetch();history.refetch();}}>
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
    <h3>Histórico financeiro manual — somente leitura</h3>
    <p>Estas entradas e correções refletem declarações de funcionários sobre valores conferidos fora do PointVet. O saldo é apenas o registro interno da empresa.</p>
    {history.isLoading?<p>Carregando histórico...</p>:null}
    {history.isError?<p className="alert alert--error" role="alert">{getApiErrorMessage(history.error)}</p>:null}
    {history.isSuccess&&!(history.data||[]).length?<p>Nenhum repasse contabilizado internamente para esta comanda.</p>:null}
    {history.data?.length?<div className="table-scroll"><table className="data-table">
     <thead><tr><th>Movimento</th><th>Conta interna</th><th>Valor líquido</th><th>Conferido por</th><th>Situação</th></tr></thead>
     <tbody>{history.data.map(item=><tr key={item.id}>
      <td>{item.tipo==="CORRECAO_MANUAL"?"Correção manual (saída)":"Repasse manual (entrada)"}</td>
      <td>{item.conta}</td><td>{money(item.valor)}</td><td>{item.operador}</td>
      <td>{item.tipo==="CORRECAO_MANUAL"?"Contralançamento registrado":item.possuiCorrecao?"Compensado":"Declarado pelo operador"}</td>
     </tr>)}</tbody>
    </table></div>:null}
   </div>:null}
  </div>:null}
 </section>;
}
