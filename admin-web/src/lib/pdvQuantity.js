/** M.5.71 — regras de quantidade no balcão.
 * Serviços: sempre inteiros positivos. Produtos a granel: frações existentes
 * permanecem válidas conforme a unidade/precisão reconhecida pelo motor.
 * A API revalida antes de persistir, independente do controle do navegador.
 */
export function isValidPdvQuantity(item,raw){
 const n=Number(raw);
 if(!Number.isFinite(n)||n<=0)return false;
 if(item?.tipo==="SERVICO")return Number.isSafeInteger(n)&&n>=1;
 return n>=0.001;
}

export function sanitizePdvQuantity(item,raw,current=1){
 const value=Number(raw);
 if(!isValidPdvQuantity(item,value))return current;
 return item?.tipo==="SERVICO"?value:Math.round((value+Number.EPSILON)*1000)/1000;
}
export function stepPdvQuantity(item,current,delta){
 const min=item?.tipo==="SERVICO"?1:0.001;
 const next=Number(current)+Number(delta);
 return item?.tipo==="SERVICO"?Math.max(min,Math.trunc(next)):Math.max(min,Math.round((next+Number.EPSILON)*1000)/1000);
}

export function serviceNeedsTutorAndPet(item){
 return item?.tipo==="SERVICO";
}
