/** Pré-conferência local de pagamentos MANUAIS, em centavos exatos.
 * Nunca representa dinheiro recebido, confirmação de operadora ou fechamento.
 * O servidor continua a única autoridade para valores, acesso e caixas.
 */
export const manualPaymentForms=["DINHEIRO","PIX","CARTAO_DEBITO","CARTAO_CREDITO","TRANSFERENCIA"];
const validForms=new Set(manualPaymentForms);

export function manualReaisToCents(raw){
 const normalized=String(raw??"").trim().replace(",",".");
 if(!/^(?:0|[1-9]\d{0,10})(?:\.\d{1,2})?$/.test(normalized))
  return {erro:"Informe reais e centavos válidos (ex.: 5,00), sem separador de milhar."};
 const [integer,fraction=""]=normalized.split(".");
 const cents=Number(integer)*100+Number(fraction.padEnd(2,"0"));
 if(!Number.isSafeInteger(cents)||cents<1||cents>99999999999)
  return {erro:"O valor deve ser positivo e respeitar o limite do caixa."};
 return {centavos:cents};
}

export function defaultManualPayment(op){
 return {id:"inicial",forma:"PIX",valor:String(op.valor)};
}

/** Constrói somente o payload da rota read-only conferencia-alocacao.
 * Exige cada empresa, caixa aberto da empresa e soma exata em centavos.
 */
export function previewManualAllocation(operacoes,caixas,formularios={}){
 const pendencias=[],alocacoes=[],companies=new Set();
 for(const op of operacoes||[]){
  if(companies.has(op.empresaId)){
   pendencias.push({empresaId:op.empresaId,codigo:"EMPRESA_DUPLICADA"});continue;
  }
  companies.add(op.empresaId);
  const own=(caixas||[]).filter(x=>x.empresaId===op.empresaId);
  const form=formularios[op.empresaId]||{};
  const sessaoCaixaId=form.sessaoCaixaId||own[0]?.sessaoCaixaId||"";
  if(!own.some(x=>x.sessaoCaixaId===sessaoCaixaId))
   pendencias.push({empresaId:op.empresaId,codigo:"CAIXA_INDISPONIVEL"});
  const expected=manualReaisToCents(op.valor);
  if(expected.erro)pendencias.push({empresaId:op.empresaId,codigo:"TOTAL_INVALIDO"});
  const rows=form.pagamentos??[defaultManualPayment(op)];
  if(!Array.isArray(rows)||rows.length<1||rows.length>10){
   pendencias.push({empresaId:op.empresaId,codigo:"QUANTIDADE_PAGAMENTOS_INVALIDA"});continue;
  }
  const pagamentos=[];
  for(const [index,row] of rows.entries()){
   const value=manualReaisToCents(row.valor);
   if(!validForms.has(row.forma)||value.erro){
    pendencias.push({empresaId:op.empresaId,codigo:"PAGAMENTO_INVALIDO",indice:index+1});
    continue;
   }
   pagamentos.push({forma:row.forma,valorCentavos:value.centavos});
  }
  const sum=pagamentos.reduce((total,row)=>total+row.valorCentavos,0);
  if(!Number.isSafeInteger(sum)||(!expected.erro&&sum!==expected.centavos))
   pendencias.push({empresaId:op.empresaId,codigo:"SOMA_DIVERGENTE",diferencaCentavos:expected.erro?null:sum-expected.centavos});
  alocacoes.push({empresaId:op.empresaId,sessaoCaixaId,pagamentos});
 }
 if(!companies.size)pendencias.push({empresaId:null,codigo:"SEM_OPERACOES"});
 return {pronto:pendencias.length===0,pendencias,alocacoes};
}

/** M.5.44: declarações simuladas APENAS sobre linhas do snapshot salvo no servidor.
 * Os valores/caixas nunca vêm de inputs editáveis depois da preparação.
 * Não persiste, não transmite e não atesta dinheiro recebido fora do sistema.
 */
export function previewManualReceipt(preparacao,versao,conferencias={}){
 const pendencias=[],alocacoes=[],seen=new Set();
 if(preparacao?.status!=="PREPARADA"||preparacao.versao!==versao||
    !Number.isSafeInteger(versao)||versao<1||!Array.isArray(preparacao.operacoes)||
    !preparacao.operacoes.length||preparacao.operacoes.length>30)
  return {pronto:false,pendencias:[{codigo:"PREPARACAO_INDISPONIVEL"}],dados:null,somentePrevia:true};
 for(const op of preparacao.operacoes){
  if(!op.empresaId||seen.has(op.empresaId)||!op.sessaoCaixaId){
   pendencias.push({codigo:"OPERACAO_INVALIDA",empresaId:op.empresaId});continue;
  }
  seen.add(op.empresaId);
  const total=manualReaisToCents(op.total);
  if(total.erro||!Array.isArray(op.pagamentos)||op.pagamentos.length<1||op.pagamentos.length>10){
   pendencias.push({codigo:"PREPARACAO_INVALIDA",empresaId:op.empresaId});continue;
  }
  let soma=0;
  const pagamentos=[];
  for(const [indice,p] of op.pagamentos.entries()){
   if(!validForms.has(p.forma)||!Number.isSafeInteger(p.valorCentavos)||
      p.valorCentavos<1||p.valorCentavos>99999999999){
    pendencias.push({codigo:"PREPARACAO_INVALIDA",empresaId:op.empresaId,indice:indice+1});continue;
   }
   soma+=p.valorCentavos;
   const input=conferencias[op.empresaId]?.[indice]||{};
   const confirmado=input.confirmadoPeloAtendente===true;
   if(!confirmado)pendencias.push({codigo:"RECEBIMENTO_NAO_CONFIRMADO",empresaId:op.empresaId,indice:indice+1});
   const referencia=input.referencia??"";
   if(typeof referencia!=="string"||referencia.trim().length>120)
    pendencias.push({codigo:"REFERENCIA_INVALIDA",empresaId:op.empresaId,indice:indice+1});
   const rawParcelas=input.parcelas??"1";
   const parcelas=Number(rawParcelas);
   if(!/^\d{1,2}$/.test(String(rawParcelas))||!Number.isInteger(parcelas)||parcelas<1||parcelas>24||
      (p.forma!=="CARTAO_CREDITO"&&parcelas!==1))
    pendencias.push({codigo:"PARCELAS_INVALIDAS",empresaId:op.empresaId,indice:indice+1});
   pagamentos.push({forma:p.forma,valorCentavos:p.valorCentavos,confirmadoPeloAtendente:confirmado,
    parcelas,referencia:typeof referencia==="string"?referencia.trim():""});
  }
  if(!Number.isSafeInteger(soma)||(!total.erro&&soma!==total.centavos))
   pendencias.push({codigo:"SOMA_DIVERGENTE",empresaId:op.empresaId});
  alocacoes.push({empresaId:op.empresaId,sessaoCaixaId:op.sessaoCaixaId,pagamentos});
 }
 return {pronto:pendencias.length===0,pendencias,
  dados:{versao,alocacoes},somentePrevia:true};
}
