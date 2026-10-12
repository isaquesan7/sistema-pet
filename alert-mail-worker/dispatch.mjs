/** Isolated hourly email dispatcher; does nothing unless the API channel is configured. */
const token=process.env.ALERT_DELIVERY_TOKEN;
const url=process.env.ALERT_DELIVERY_URL;
if(!token||!url?.startsWith("https://")){console.error("Email dispatcher not configured");process.exit(2);}
try{
 const response=await fetch(url,{method:"POST",signal:AbortSignal.timeout(25000),
  headers:{"x-pointvet-alert-token":token,"Content-Type":"application/json"},body:"{}"});
 if(response.status===503){console.log("Email channel not configured; no email sent");process.exit(0);}
 if(!response.ok)throw new Error("Dispatch HTTP "+response.status);
 const result=await response.json();
 console.log("PointVet email dispatch:",JSON.stringify({processed:result.processed,sent:result.sent,failed:result.failed}));
 if(result.failed)process.exitCode=1;
}catch(error){console.error("Alert dispatch failed:",error.message);process.exitCode=1;}
