/**
 * PointVet 17.2 — Central de Monitoramento do Console Interno.
 * Show only server-verified state; missing integrations remain "Não verificado".
 */
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Clock3, DatabaseBackup, RefreshCw, Server, ShieldCheck } from "lucide-react";
import api, { getApiErrorMessage } from "../lib/api.js";

const label = { healthy: "Operacional", error: "Falha", unverified: "Não verificado", unknown: "Indisponível" };
const IconByType = { api: Activity, database: Server, backup: DatabaseBackup, infrastructure: Server, security: ShieldCheck };

function Indicator({ name, type, item }) {
  const Icon = IconByType[type] || Activity;
  const current = item || { status: "unknown", detail: "Sem dados" };
  const verified = current.status === "healthy";
  return (
    <article className="platform-metric" style={{ alignItems: "flex-start", minHeight: 140 }}>
      <span><Icon size={20}/></span>
      <div>
        <small>{name}</small>
        <strong style={{ fontSize: 18, display: "flex", alignItems: "center", gap: 8 }}>
          {verified ? <CheckCircle2 size={17} color="#16a34a"/> : <AlertTriangle size={17} color={current.status === "error" ? "#dc2626" : "#a16207"}/>}
          {label[current.status] || "Indisponível"}
        </strong>
        <em style={{ fontStyle: "normal", lineHeight: 1.5 }}>{current.detail}</em>
      </div>
    </article>
  );
}

export default function MonitoringPage() {
  const query = useQuery({
    queryKey: ["platform-monitoring"],
    queryFn: async () => (await api.get("/plataforma/monitoramento/resumo")).data.dados,
    staleTime: 0,
    refetchInterval: 60000
  });
  const history = useQuery({ queryKey: ["platform-backup-history"], queryFn: async () => (await api.get("/plataforma/monitoramento/backups")).data, refetchInterval: 60000 });
  const d = query.data || {};
  return <div className="page-stack">
    <section className="panel">
      <div className="panel__heading">
        <div><span>Saúde da plataforma</span><h2>Verificações do PointVet</h2></div>
        <button className="ghost-button" type="button" disabled={query.isFetching} onClick={() => { query.refetch(); history.refetch(); }}>
          <RefreshCw size={16}/> {query.isFetching ? "Verificando..." : "Verificar agora"}
        </button>
      </div>
      {query.isError && <div className="alert alert--error">{getApiErrorMessage(query.error, "Não foi possível consultar o monitoramento.")}</div>}
      {query.isLoading && <p>Consultando os serviços...</p>}
      {d.checkedAt && <p style={{ opacity: 0.72 }}>Última consulta: {new Date(d.checkedAt).toLocaleString("pt-BR", { timeZone: "America/Bahia" })} (Salvador)</p>}
      <div className="platform-metrics" style={{ marginTop: 16 }}>
        <Indicator name="API" type="api" item={d.api}/>
        <Indicator name="PostgreSQL" type="database" item={d.database}/>
        <Indicator name="Backup R2" type="backup" item={d.backup}/>
        <Indicator name="Infraestrutura" type="infrastructure" item={d.infrastructure}/>
        <Indicator name="Segurança" type="security" item={d.security}/>
      </div>
    </section>
    <section className="panel">
      <div className="panel__heading"><div><span>Proteção de dados</span><h2>Backups e recuperação</h2></div></div>
      <p><Clock3 size={16} style={{ verticalAlign: "middle", marginRight: 6 }}/>Agendamento esperado: <strong>03h (Salvador)</strong> — retenção prevista: <strong>90 dias</strong>.</p>
      {history.isError && <div className="alert alert--error">Erro ao consultar histórico: {getApiErrorMessage(history.error)}</div>}
      {history.data && !history.data.integrationReady && <p>Histórico aguardando migração do banco e integração do worker.</p>}
      {history.data?.integrationReady && history.data.dados.length === 0 && <p>Nenhuma execução com evidência registrada.</p>}
      {history.data?.dados?.length > 0 && <div style={{overflowX:"auto"}}><table style={{width:"100%"}}><thead><tr><th>Concluído (Salvador)</th><th>Resultado</th><th>Tamanho</th><th>Arquivo R2</th></tr></thead><tbody>{history.data.dados.map(item => <tr key={item.id}><td>{new Date(item.completedAt).toLocaleString("pt-BR",{timeZone:"America/Bahia"})}</td><td>{item.status === "confirmed" ? "Confirmado" : "Não verificado"}</td><td>{(Number(item.sizeBytes)/1048576).toFixed(2)} MB</td><td style={{wordBreak:"break-all"}}>{item.objectKey}</td></tr>)}</tbody></table></div>}
      <p>Mostramos somente evidências efetivamente registradas. Esta listagem não substitui testes de restauração.</p>
    </section>
  </div>;
}
