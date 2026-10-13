/** Read-only, auditable prepaid client balance until confirmed-payment integration is available. */
import {useQuery} from "@tanstack/react-query";
import api,{getApiErrorMessage} from "../lib/api.js";
import {formatCurrency} from "../lib/formatters.js";
export default function ClientCreditTab({clientId}){
 const q=useQuery({queryKey:["client-credit",clientId],queryFn:async()=>(await api.get(`/clientes-financeiro/${clientId}/credito`)).data.dados});
 return <div className="pv-client-credit"><div className="pv-client-finance-cards"><div><span>Crédito disponível</span><strong>{q.data?formatCurrency(q.data.saldo):"—"}</strong></div><div><span>Movimentações registradas</span><strong>{q.data?.movimentos?.length??"—"}</strong></div></div><p className="pv-dashboard-note">Crédito pré-pago é diferente de contas a receber ou fiado. Entradas e utilização ficarão disponíveis após integração segura com pagamentos confirmados e PDV.</p>{q.isLoading?<p>Consultando saldo...</p>:q.isError?<div className="alert alert--error">{getApiErrorMessage(q.error)}</div>:<div className="pv-detail-ledger">{q.data.movimentos.map(row=><div key={row.id}><strong>{({ENTRADA:"Crédito recebido",UTILIZACAO:"Crédito utilizado",ESTORNO:"Estorno"})[row.tipo]}</strong><span>{new Date(row.createdAt).toLocaleString("pt-BR")}</span><strong>{formatCurrency(row.valor)}</strong><small>{row.motivo||"Sem observações"}</small></div>)}{!q.data.movimentos.length&&<p className="pv-empty">Nenhuma movimentação registrada.</p>}</div>}</div>;
}
