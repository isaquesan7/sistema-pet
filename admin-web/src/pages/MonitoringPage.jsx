/**
 * PointVet 17.2 — Central de Monitoramento do Console Interno.
 * Show only server-verified state; missing integrations remain "Não verificado".
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Clock3, DatabaseBackup, RefreshCw, Server, ShieldCheck } from "lucide-react";
import "../monitoring.css";
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
  const [period, setPeriod] = useState("30");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const d = query.data || {};
  const checks = [d.api, d.database, d.backup, d.infrastructure, d.security];
  const ok = checks.filter(x=>x?.status==="healthy").length;
  const failed = checks.filter(x=>x?.status==="error").length;
  const pending = 5 - ok - failed;
  const rows = history.data?.dados || [];
  const visibleRows = useMemo(()=>rows.filter(x=>
    (period === "all" || Date.now()-new Date(x.completedAt).getTime() <= Number(period)*86400000) &&
    x.objectKey.toLowerCase().includes(search.toLowerCase())
  ),[rows,period,search]);
  function exportCsv(){
    const quote=x=>'"'+String(x??"").replaceAll('"','""')+'"';
    const data=[["Data UTC","Status","Bytes","Objeto R2"],...visibleRows.map(x=>[x.completedAt,x.status,x.sizeBytes,x.objectKey])];
    const blob=new Blob(["\uFEFF",data.map(r=>r.map(quote).join(";")).join("\n")],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");link.href=url;link.download="pointvet-backups.csv";link.click();URL.revokeObjectURL(url);
  }
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
      {query.data && <p><strong>{failed ? "Falha detectada" : pending ? "Monitoramento parcial" : "Sistema monitorado"}</strong> — {ok} operacionais, {failed} falhas, {pending} não monitorados.</p>}
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
      {rows.length > 0 && <>
        <p><strong>{rows.length}</strong> evidência(s) disponíveis. Última: {new Date(rows[0].completedAt).toLocaleString("pt-BR",{timeZone:"America/Bahia"})}.</p>
        <div className="monitoring-filters">
          <label>Período <select value={period} onChange={e=>setPeriod(e.target.value)}><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="all">Todos</option></select></label>
          <label>Buscar objeto <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Arquivo no R2"/></label>
          <button className="ghost-button" type="button" onClick={exportCsv} disabled={!visibleRows.length}>Exportar CSV</button>
        </div>
        <div className="monitoring-scroll"><table className="monitoring-table"><thead><tr><th>Conclusão (Salvador)</th><th>Resultado informado</th><th>Tamanho</th><th>Detalhes</th></tr></thead><tbody>{visibleRows.map(item=><tr key={item.id}>
          <td>{new Date(item.completedAt).toLocaleString("pt-BR",{timeZone:"America/Bahia"})}</td>
          <td>{item.status === "confirmed"?"Upload informado como confirmado":"Não verificado"}</td>
          <td>{(Number(item.sizeBytes)/1048576).toFixed(2)} MB</td>
          <td><button className="ghost-button" type="button" onClick={()=>setSelectedId(selectedId===item.id?null:item.id)}>{selectedId===item.id?"Ocultar":"Detalhes"}</button>{selectedId===item.id && <div className="monitoring-object"><strong>Arquivo cifrado:</strong> {item.objectKey}<div>Fonte: {item.source||"Não informada"}</div></div>}</td>
        </tr>)}</tbody></table></div>
        {!visibleRows.length && <p>Nenhuma evidência encontrada para os filtros selecionados.</p>}
      </>}
      <p>Mostramos somente evidências efetivamente registradas. Esta listagem não substitui testes de restauração.</p>
    </section>
  </div>;
}
