/**
 * PointVet 17.4 independent incident collector, intended for a separate
 * hourly Railway cron service. No tenant or backup worker dependencies.
 */
const targets=[
  {serviceKey:"admin",url:"https://petrise-admin-production.up.railway.app/health"},
  {serviceKey:"portal",url:"https://petrise-portal-production.up.railway.app/health"},
];
const token=process.env.MONITOR_INGEST_TOKEN;
const api=process.env.MONITOR_INGEST_URL;
if(!token || !api?.startsWith("https://")) {
  console.error("Incident collector not configured");process.exit(2);
}
let errors=0;
for(const target of targets){
  let status="error";let detail="Conectividade indisponível";
  try{
    const response=await fetch(target.url,{signal:AbortSignal.timeout(5000),redirect:"error"});
    status=response.ok?"healthy":"error";
    detail=response.ok?"Conectividade HTTP confirmada":`HTTP ${response.status}`;
  }catch{detail="Falha no teste HTTPS";}
  try{
    const result=await fetch(api,{method:"POST",signal:AbortSignal.timeout(10000),
      headers:{"content-type":"application/json","x-pointvet-monitor-token":token},
      body:JSON.stringify({serviceKey:target.serviceKey,status,detail})});
    if(!result.ok) throw Error(`collector ingest HTTP ${result.status}`);
    console.log(`${target.serviceKey}: observation accepted (${status})`);
  }catch(err){errors++;console.error(`${target.serviceKey}: unable to persist observation: ${err.message}`);}
}
if(errors)process.exitCode=1;
