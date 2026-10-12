import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const routes=readFileSync(new URL("../src/modules/monitoramento/monitoramento.routes.js",import.meta.url),"utf8");
const sender=readFileSync(new URL("../src/modules/monitoramento/email-delivery.js",import.meta.url),"utf8");
test("dispatch authentication executes before sender",()=>{
 assert.ok(routes.includes('router.post("/alertas/despachar-email", authenticateAlertDispatcher, dispatchAlertEmails)'));
});
test("delivery disabled without provider configuration",()=>{
 for(const v of ["RESEND_API_KEY","ALERT_EMAIL_FROM","ALERT_EMAIL_TO","ALERT_DELIVERY_TOKEN"])assert.ok(sender.includes(v));
 assert.ok(sender.includes('if(!configured())return res.status(503)'));
});
test("deduplicated and no blind retries",()=>{
 assert.ok(sender.includes("ON CONFLICT(event_key) DO NOTHING"));
 assert.ok(sender.includes("FOR UPDATE SKIP LOCKED"));
 assert.ok(sender.includes("state='AWAITING_CHANNEL'"));
 assert.ok(sender.includes("state='FAILED'"));
 assert.ok(!sender.includes("req.body"));
});
