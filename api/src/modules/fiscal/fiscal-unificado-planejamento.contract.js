/**
 * PointVet M.4C.1 — PURE fiscal segregation for draft planning.
 * This is NOT a tax calculation, invoice, transmission or legal determination.
 * Each issuer and each merchandise/service class stays separate.
 * Every possible emission remains blocked until review/approval/staging.
 */
export function fiscalCents(value,{allowZero=true}={}){
 const txt=String(value);
 if(!/^(0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(txt))throw Error("M4C_VALOR_MONETARIO_INVALIDO");
 const [whole,frac=""]=txt.split(".");
 const amount=Number(whole)*100+Number(frac.padEnd(2,"0"));
 if(!Number.isSafeInteger(amount)||amount<0||(!allowZero&&amount===0))
  throw Error("M4C_VALOR_MONETARIO_INVALIDO");
 return amount;
}
function quantityMillis(value){
 const txt=String(value);
 if(!/^(0|[1-9]\d{0,7})(?:\.\d{1,3})?$/.test(txt))throw Error("M4C_QUANTIDADE_INVALIDA");
 const [whole,frac=""]=txt.split(".");
 const amount=Number(whole)*1000+Number(frac.padEnd(3,"0"));
 if(!Number.isSafeInteger(amount)||amount<=0)throw Error("M4C_QUANTIDADE_INVALIDA");
 return amount;
}
const fmt=c=>(c/100).toFixed(2);
const push=(issues,code,lineId=null)=>issues.push({codigo:code,...(lineId?{itemId:lineId}:{})});
function topology(company){
 const unit=company.unidadeOperacionalLegada;
 if(!unit)return {vinculo:"PENDENTE_MIGRACAO",unidadeOperacionalId:null,entidadeFiscalId:null,alerta:"TOPOLOGIA_LEGADA_SEM_MIGRACAO"};
 const issuer=unit.entidadeFiscal;
 if(!issuer||!issuer.ativo||!unit.ativa||unit.empresaLegadaId!==company.id||
    issuer.organizacaoId!==company.organizacaoId||
    unit.organizacaoId!==company.organizacaoId||
    unit.entidadeFiscalId!==issuer.id||issuer.cnpj!==company.cnpj)
  return {vinculo:"DIVERGENTE",unidadeOperacionalId:unit.id,
   entidadeFiscalId:issuer?.id||null,alerta:"TOPOLOGIA_FISCAL_DIVERGENTE"};
 return {vinculo:"COMPATIVEL_CI",unidadeOperacionalId:unit.id,entidadeFiscalId:issuer.id,
  alerta:null};
}
export function planejarMatrizFiscalRascunho({organizacaoId,clienteId,comandaId,versao,
 empresas,linhas}){
 if(!organizacaoId||!clienteId||!comandaId||!Number.isInteger(versao)||versao<1||
    !Array.isArray(empresas)||!empresas.length||!Array.isArray(linhas)||!linhas.length)
  throw Error("M4C_ENTRADA_INCOMPLETA");
 const byId=new Map(empresas.map(e=>[e.id,e]));
 if(byId.size!==empresas.length||empresas.some(e=>e.organizacaoId!==organizacaoId))
  throw Error("M4C_ISOLAMENTO_EMPRESA_INVALIDO");
 const result=new Map();
 let total=0;
 for(const line of linhas){
  const company=byId.get(line.empresaId);
  if(!company)throw Error("M4C_LINHA_EMPRESA_NAO_AUTORIZADA");
  const item=line.itemCatalogo;
  const tipo=item?.tipo==="PRODUTO"?"PRODUTO":item?.tipo==="SERVICO"?"SERVICO":"INDEFINIDO";
  const groupId=company.id+"::"+tipo;
  if(!result.has(groupId)){
   const config=company.configuracaoFiscal;
   const issues=[];
   if(!company.ativo)push(issues,"EMISSOR_INATIVO");
   if(!/^\d{14}$/.test(String(company.cnpj||"")))push(issues,"CNPJ_FORMATO_INCOMPLETO");
   if(!company.razaoSocial?.trim())push(issues,"RAZAO_SOCIAL_AUSENTE");
   if(!/^[A-Z]{2}$/.test(String(company.estado||"").toUpperCase())||
      !company.cidade?.trim())push(issues,"LOCALIDADE_EMISSOR_AUSENTE");
   if(!config)push(issues,"CONFIGURACAO_FISCAL_EMISSOR_AUSENTE");
   else {
    if(config.regime==="OUTRO"||!config.regime)push(issues,"REGIME_TRIBUTARIO_PENDENTE");
    if(!config.provedorFiscal)push(issues,"PROVEDOR_FISCAL_NAO_CONFIGURADO");
    if(config.certificadoValidoAte&&
       new Date(config.certificadoValidoAte).getTime()<Date.now())
     push(issues,"CERTIFICADO_FISCAL_VENCIDO");
   }
   const topo=topology(company);
   if(topo.vinculo==="DIVERGENTE")push(issues,"TOPOLOGIA_FISCAL_DIVERGENTE");
   if(tipo==="PRODUTO"&&config&&!config.serieNfe&&!config.serieNfce)
    push(issues,"SERIE_DOCUMENTO_PRODUTO_AUSENTE");
   if(tipo==="SERVICO"&&config&&(!config.codigoMunicipioIbge||!config.serieNfse))
    push(issues,"MUNICIPIO_OU_SERIE_SERVICO_AUSENTE");
   if(tipo==="INDEFINIDO")push(issues,"TIPO_CATALOGO_INDEFINIDO");
   result.set(groupId,{
    empresaId:company.id,cnpj:company.cnpj,razaoSocial:company.razaoSocial,
    uf:company.estado||null,municipio:company.cidade||null,
    classe:tipo,
    documentosPossiveis:tipo==="PRODUTO"?["NFE","NFCE"]:tipo==="SERVICO"?["NFSE"]:[],
    documentoEscolhido:null,
    exigeValidacaoFiscalMunicipalOuEstadual:true,
    entidadeFiscalId:topo.entidadeFiscalId,
    unidadeOperacionalId:topo.unidadeOperacionalId,
    topologiaVinculo:topo.vinculo,topologiaAlerta:topo.alerta,
    itens:[],totalCentavos:0,pendencias:issues
   });
  }
  const group=result.get(groupId),issues=group.pendencias;
  if(line.status!=="ATIVO")push(issues,"LINHA_NAO_ATIVA",line.id);
  if(!item||!item.ativo||item.empresaId!==company.id)push(issues,"CATALOGO_EMPRESA_INVALIDO",line.id);
  let value=0;
  try{
   const unit=fiscalCents(line.valorUnitario),discount=fiscalCents(line.desconto);
   const q=quantityMillis(line.quantidade);
   const expected=Math.round(unit*q/1000)-discount;
   value=fiscalCents(line.valorTotal);
   if(expected<0||expected!==value)push(issues,"VALOR_LINHA_DIVERGENTE",line.id);
   if(item&&fiscalCents(item.precoVenda)!==unit)push(issues,"PRECO_CATALOGO_ALTERADO",line.id);
  }catch{push(issues,"VALOR_OU_QUANTIDADE_INVALIDO",line.id);}
  const tax=item?.fiscalConfig;
  if(!tax)push(issues,"CLASSIFICACAO_FISCAL_ITEM_AUSENTE",line.id);
  else if(tipo==="PRODUTO"){
   if(!tax.ncm||!tax.cfop||!tax.origemMercadoria||!tax.cstCsosn)
    push(issues,"CLASSIFICACAO_PRODUTO_INCOMPLETA",line.id);
  }else if(tipo==="SERVICO"&&!tax.codigoServicoMunicipal)
   push(issues,"CODIGO_SERVICO_MUNICIPAL_AUSENTE",line.id);
  group.itens.push({itemId:line.id,itemCatalogoId:item?.id||null,
   tipo:tipo,valor:fmt(value)});
  group.totalCentavos+=value;total+=value;
  if(!Number.isSafeInteger(total)||total>999999999999)throw Error("M4C_TOTAL_INVALIDO");
 }
 const grupos=[...result.values()].sort((a,b)=>a.empresaId.localeCompare(b.empresaId)||a.classe.localeCompare(b.classe))
  .map(({totalCentavos,...g})=>({...g,total:fmt(totalCentavos),
    prontoParaEmissao:false,emissaoHabilitada:false}));
 const companyIds=new Set(grupos.map(g=>g.empresaId));
 return {modo:"PLANO_FISCAL_RASCUNHO_NAO_EXECUTAVEL",
  organizacaoId,clienteId,comandaId,versao,numeroEmpresas:companyIds.size,
  numeroGrupos:grupos.length,grupos,total:fmt(total),
  todasClassificacoesCompletas:grupos.every(g=>g.pendencias.length===0),
  documentoEmitido:false,gerouVenda:false,houveTransmissao:false,
  emissaoHabilitada:false,liberacaoAutomatica:false,
  observacao:"Plano técnico apenas; NFE/NFCE exigem escolha fiscal autorizada, NFSE depende do município. RECIBO não substitui obrigação fiscal."};
}
