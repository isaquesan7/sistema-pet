/** Pure usage thresholds. No operations are blocked by these signals. */
export const RESOURCES=[
 ["empresas","limiteEmpresas","Empresas"],
 ["usuarios","limiteUsuarios","Usuários"],
 ["clientes","limiteClientes","Clientes"],
 ["pets","limitePets","Pets"],
 ["funcionarios","limiteFuncionarios","Funcionários"]
];
export function calculatePlanUsage(metrics,plan){
 return RESOURCES.map(([key,limitKey,label])=>{
  const used=Number(metrics[key]||0);
  const limit=plan?.[limitKey];
  if(limit==null)return {key,label,used,limit:null,percent:null,level:"UNLIMITED"};
  if(!Number.isFinite(Number(limit))||Number(limit)<=0)
   return {key,label,used,limit:Number(limit),percent:null,level:"UNDEFINED"};
  const percent=Math.round(used/Number(limit)*1000)/10;
  const level=percent>=100?"LIMIT":percent>=90?"HIGH":percent>=80?"WARNING":"NORMAL";
  return {key,label,used,limit:Number(limit),percent,level};
 });
}
