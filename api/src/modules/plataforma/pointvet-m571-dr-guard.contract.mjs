/** PointVet M.5.71 — guarda PURA para ensaio DR em banco descartável.
 * IDs de projeto são declarações do operador, não identidade autenticada pelo Postgres.
 * Nunca aprova produção nem comprova que um restore aconteceu.
 */
const STAGING='9564acfc-1582-45d8-8ac3-f0bc2d998530';
const COMMERCIAL='aab52927-a8c1-4158-80bf-bd22af504e72';
const SYNTHETIC='11a9be9f-7635-4e74-96f9-0c48d77242c9';
export const DR_CONFIRM='I_AUTHORIZE_STAGING_READONLY_TO_FRESH_INDEPENDENT_DR';
/** Normaliza inventarios do psql com linhas LF (Linux) e CRLF (Windows). */
export function parsePgTableInventory(output){
 return String(output).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
}
const reject=msg=>{throw Error('POINTVET_M571_DR_BLOCKED: '+msg)};
export function parseDbConnection(input){
 if(typeof input!=='string'||!input)reject('URL de banco ausente');
 let u;
 try{u=new URL(input)}catch{reject('URL de banco invalida')}
 if(!['postgres:','postgresql:'].includes(u.protocol)||!u.hostname||!u.username||
    !u.password||!u.pathname||u.pathname==='/'||u.hash)
  reject('PostgreSQL exige host, usuario, senha e banco');
 const port=u.port?Number(u.port):5432;
 if(!Number.isInteger(port)||port<1||port>65535)reject('porta invalida');
 if(['options','host','service'].some(key=>u.searchParams.has(key)))
  reject('opcoes arbitrarias de conexao bloqueadas');
 const db=decodeURIComponent(u.pathname.slice(1));
 if(!/^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$/.test(db))reject('nome do banco invalido');
 const sslmode=u.searchParams.get('sslmode')||'require';
 if(!['require','verify-full','verify-ca'].includes(sslmode))reject('TLS obrigatorio');
 return {hostname:u.hostname.toLowerCase(),port,username:decodeURIComponent(u.username),
  password:decodeURIComponent(u.password),database:db,sslmode};
}
export function validarPlanoDR({sourceUrl,targetUrl,sourceProjectId,targetProjectId,
 confirmacao,sourceServiceId,targetServiceId}={}){
 if(sourceProjectId!==STAGING)reject('origem deve ser staging Pet King PDV Homologacao');
 if(!/^[0-9a-f-]{36}$/.test(targetProjectId||'')||
    [STAGING,COMMERCIAL,SYNTHETIC].includes(targetProjectId))
  reject('destino deve ser projeto DR dedicado, nao comercial nem sintetico');
 if(!/^[0-9a-f-]{36}$/.test(sourceServiceId||'')||
    !/^[0-9a-f-]{36}$/.test(targetServiceId||'')||sourceServiceId===targetServiceId)
  reject('identidade distinta dos servicos obrigatoria');
 if(sourceServiceId!=='a8e97777-25dc-4fe0-b9b0-00effb9c951d')
  reject('Postgres origem nao e o staging conhecido');
 if(confirmacao!==DR_CONFIRM)reject('declaracao explicita ausente');
 const source=parseDbConnection(sourceUrl),target=parseDbConnection(targetUrl);
 // Railway CLI --tunnel-only can forward TWO independent projects to 127.0.0.1
 // on distinct local ports. Actual cluster identities must still be checked
 // on both connections by the runner via pg_control_system().
 const loopbackHost=x=>["127.0.0.1","localhost","[::1]","::1"].includes(x);
 if(source.hostname===target.hostname&&
    !(loopbackHost(source.hostname)&&source.port!==target.port))
  reject("origem e destino nao podem apontar para o mesmo endereco e porta");
 if(loopbackHost(source.hostname)!==loopbackHost(target.hostname))
  reject("mistura de tunel local e host remoto bloqueada");
 return {source,target,originProject:STAGING,targetProject:targetProjectId,
  possibleToTest:true,confirmedActualIdentity:false,restorePerformed:false,
  readyForProduction:false};
}
