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
  const d = query.data || {};
  return <div className="page-stack">
    <section className="panel">
      <div className="panel__heading">
        <div><span>Saúde da plataforma</span><h2>Verificações do PointVet</h2></div>
        <button className="ghost-button" type="button" disabled={query.isFetching} onClick={() => query.refetch()}>
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
      <p>Histórico de execuções, arquivos R2, resultados de restauração e alertas externos serão integrados nesta seção em etapas seguintes. Até lá, o painel não declara backups como saudáveis sem evidência auditável.</p>
    </section>
  </div>;
}
