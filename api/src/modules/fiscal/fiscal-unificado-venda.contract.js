/**
 * PointVet M.4C.2 — pure PREPARATION of an already persisted child sale.
 * Integer-cent allocation uses largest remainder (stable item-id tie breaker).
 * NEVER issues, transmits, authorizes or creates fiscal documents.
 */
import {createHash} from "node:crypto";
import {fiscalCents} from "./fiscal-unificado-planejamento.contract.js";

const bad=s=>{throw Error(s);};
const money=c=>(c/100).toFixed(2);
function thousandths(value){
 const s=String(value);
 if(!/^(0|[1-9]\d{0,7})(?:\.\d{1,3})?$/.test(s))bad("M4C2_QUANTIDADE_INVALIDA");
 const [a,b=""]=s.split(".");
 const n=Number(a)*1000+Number(b.padEnd(3,"0"));
 if(!Number.isSafeInteger(n)||n<=0)bad("M4C2_QUANTIDADE_INVALIDA");
 return n;
}
function sum(xs){const n=xs.reduce((a,x)=>a+x,0);if(!Number.isSafeInteger(n)||n>999999999999)bad("M4C2_TOTAL_INVALIDO");return n;}
/** Exact Hamilton apportionment, never lose or create a cent. */
export function ratearCentavosPorPeso(total,rows){
 if(!Number.isSafeInteger(total)||total<0||total>999999999999)bad("M4C2_RATEIO_INVALIDO");
 if(!Array.isArray(rows)||!rows.length)bad("M4C2_RATEIO_INVALIDO");
 const unique=new Set(rows.map(x=>x.id));
 if(unique.size!==rows.length||rows.some(x=>!x.id||!Number.isSafeInteger(x.peso)||x.peso<0))
  bad("M4C2_PESOS_INVALIDOS");
 const weight=sum(rows.map(x=>x.peso));
 if(weight===0){
  if(total!==0)bad("M4C2_PESO_ZERO");
  return Object.fromEntries(rows.map(x=>[x.id,0]));
 }
 if(total>weight)bad("M4C2_RATEIO_SUPERA_BASE");
 // BigInt multiplication avoids floating point errors for large values.
 const w=BigInt(weight),t=BigInt(total);
 const shares=rows.map(x=>{
  const numerator=t*BigInt(x.peso);
  return {id:x.id,parte:Number(numerator/w),resto:numerator%w};
 });
 const remainder=total-sum(shares.map(x=>x.parte));
 shares.sort((a,b)=>a.resto===b.resto?a.id.localeCompare(b.id):
  a.resto>b.resto?-1:1);
 for(let k=0;k<remainder;k++)shares[k].parte++;
 return Object.fromEntries(shares.map(x=>[x.id,x.parte]));
}
export function prepararFiscalPorVendaFilha({organizacaoId,venda,escolhas}){
 if(!organizacaoId||!venda?.id||!venda.empresa||!venda.clienteId||
    !venda.comandaId||venda.empresaId!==venda.empresa.id||
    venda.empresa.organizacaoId!==organizacaoId)
  bad("M4C2_EMISSOR_OU_CLIENTE_DIVERGENTE");
 if(venda.status!=="FINALIZADA"||!venda.operacaoUnificada||
    venda.operacaoUnificada.empresaId!==venda.empresaId||
    venda.operacaoUnificada.vendaId!==venda.id||
    venda.operacaoUnificada.status!=="CONCLUIDA")
  bad("M4C2_VENDA_FILHA_NAO_FINALIZADA");
 if(venda.documentosFiscais?.length)bad("M4C2_DOCUMENTO_JA_EXISTENTE");
 const cfg=venda.empresa.configuracaoFiscal;
 if(!Array.isArray(venda.itens)||!venda.itens.length)bad("M4C2_SEM_ITENS");
 const items=[...venda.itens].sort((a,b)=>a.id.localeCompare(b.id));
 const idset=new Set(items.map(x=>x.id));
 if(idset.size!==items.length)bad("M4C2_ITEM_DUPLICADO");
 const groups=new Map();
 for(const row of items){
  const cat=row.itemCatalogo;
  if(row.vendaId!==venda.id||!cat||!cat.ativo||
     cat.empresaId!==venda.empresaId||
     !["PRODUTO","SERVICO"].includes(cat.tipo))
   bad("M4C2_CATALOGO_FORA_EMISSOR");
  const unit=fiscalCents(row.valorUnitario),desc=fiscalCents(row.desconto);
  const qty=thousandths(row.quantidade);
  const calculated=(BigInt(unit)*BigInt(qty)+500n)/1000n;
  const gross=Number(calculated);
  const net=fiscalCents(row.valorTotal);
  if(!Number.isSafeInteger(gross)||gross<desc||gross-desc!==net)
   bad("M4C2_LINHA_TOTAL_DIVERGENTE");
  if(!groups.has(cat.tipo))groups.set(cat.tipo,[]);
  groups.get(cat.tipo).push({id:row.id,itemCatalogoId:cat.id,
   descricao:row.descricao,tipo:cat.tipo,quantidade:String(row.quantidade),
   precoUnitario:money(unit),descontoLinhaCentavos:desc,
   subtotalCentavos:net,fiscalConfig:cat.fiscalConfig||null});
 }
 const subtotal=sum(items.map(x=>fiscalCents(x.valorTotal)));
 const statedSubtotal=fiscalCents(venda.subtotal);
 const discount=fiscalCents(venda.desconto),surcharge=fiscalCents(venda.acrescimo);
 const actual=fiscalCents(venda.valorTotal);
 if(subtotal!==statedSubtotal||discount>subtotal||
    subtotal-discount+surcharge!==actual)
  bad("M4C2_VENDA_TOTAL_DIVERGENTE");
 const keys=[...groups.keys()].sort();
 if(!Array.isArray(escolhas)||escolhas.length!==keys.length||
    new Set(escolhas.map(x=>x.classe)).size!==keys.length||
    escolhas.some(x=>!keys.includes(x.classe)||
      Object.keys(x).some(k=>!["classe","tipoDocumento"].includes(k))))
  bad("M4C2_ESCOLHA_OBRIGATORIA");
 const choices=new Map(escolhas.map(x=>[x.classe,x.tipoDocumento]));
 for(const [type,doc] of choices){
  if(!(type==="PRODUTO"&&["NFE","NFCE"].includes(doc))&&
     !(type==="SERVICO"&&doc==="NFSE"))
   bad("M4C2_TIPO_DOCUMENTO_INCOMPATIVEL");
 }
 const discounts=ratearCentavosPorPeso(discount,items.map(x=>({
  id:x.id,peso:fiscalCents(x.valorTotal)
 })));
 const adjusted=items.map(x=>({id:x.id,peso:fiscalCents(x.valorTotal)-discounts[x.id]}));
 const extras=ratearCentavosPorPeso(surcharge,adjusted);
 const issuer={empresaId:venda.empresaId,cnpj:venda.empresa.cnpj,
  razaoSocial:venda.empresa.razaoSocial,uf:venda.empresa.estado||null,
  municipio:venda.empresa.cidade||null,regime:cfg?.regime||null,
  ambiente:cfg?.ambiente||null,
  codigoMunicipioIbge:cfg?.codigoMunicipioIbge||null,
  entidadeFiscalId:venda.empresa.unidadeOperacionalLegada?.entidadeFiscalId||null,
  unidadeOperacionalId:venda.empresa.unidadeOperacionalLegada?.id||null};
 const results=keys.map(classe=>{
  const tipoDocumento=choices.get(classe);
  const series=tipoDocumento==="NFE"?cfg?.serieNfe:
   tipoDocumento==="NFCE"?cfg?.serieNfce:cfg?.serieNfse;
  const pendencias=[];
  if(!/^\d{14}$/.test(String(issuer.cnpj||"")))pendencias.push("CNPJ_INVALIDO");
  if(!issuer.razaoSocial||!issuer.uf||!issuer.municipio)pendencias.push("EMISSOR_INCOMPLETO");
  if(!cfg||cfg.regime==="OUTRO"||!cfg.regime)pendencias.push("REGIME_NAO_CONFIGURADO");
  if(!series)pendencias.push("SERIE_NAO_CONFIGURADA");
  if(!cfg?.provedorFiscal)pendencias.push("PROVEDOR_FISCAL_NAO_CONFIGURADO");
  if(tipoDocumento==="NFSE"&&!cfg?.codigoMunicipioIbge)pendencias.push("CODIGO_MUNICIPIO_AUSENTE");
  const groupItems=groups.get(classe).map(item=>{
   const tax=item.fiscalConfig;
   if(!tax)pendencias.push("CLASSIFICACAO_FISCAL_AUSENTE:"+item.id);
   else if(classe==="PRODUTO"&&(!tax.ncm||!tax.cfop||!tax.origemMercadoria||!tax.cstCsosn))
    pendencias.push("TRIBUTACAO_PRODUTO_INCOMPLETA:"+item.id);
   else if(classe==="SERVICO"&&!tax.codigoServicoMunicipal)
    pendencias.push("CODIGO_SERVICO_AUSENTE:"+item.id);
   const {fiscalConfig,subtotalCentavos,descontoLinhaCentavos,...publicFields}=item;
   return {...publicFields,valorBase:money(subtotalCentavos),
    descontoLinha:money(descontoLinhaCentavos),
    descontoGlobalAlocado:money(discounts[item.id]),
    acrescimoGlobalAlocado:money(extras[item.id]),
    valorPlanejado:money(subtotalCentavos-discounts[item.id]+extras[item.id]),
    fiscalConfig:fiscalConfig?{
     ncm:tax.ncm||null,cfop:tax.cfop||null,
     cstCsosn:tax.cstCsosn||null,origemMercadoria:tax.origemMercadoria||null,
     codigoServicoMunicipal:tax.codigoServicoMunicipal||null}:null};
  });
  const gbase=sum(groupItems.map(x=>fiscalCents(x.valorBase)));
  const gd=sum(groupItems.map(x=>fiscalCents(x.descontoGlobalAlocado)));
  const ga=sum(groupItems.map(x=>fiscalCents(x.acrescimoGlobalAlocado)));
  return {classe,tipoDocumentoEscolhido:tipoDocumento,serieProposta:series||null,
   emissor:issuer,itens:groupItems,subtotal:money(gbase),
   descontoGlobal:money(gd),acrescimoGlobal:money(ga),
   total:money(gbase-gd+ga),pendencias:[...new Set(pendencias)].sort(),
   documentoCriado:false,emissaoHabilitada:false,autorizacaoFiscal:false};
 });
 if(sum(results.map(g=>fiscalCents(g.total)))!==actual||
    sum(results.map(g=>fiscalCents(g.descontoGlobal)))!==discount||
    sum(results.map(g=>fiscalCents(g.acrescimoGlobal)))!==surcharge)
  bad("M4C2_RATEIO_INCONSISTENTE");
 const snapshot={versaoContrato:1,vendaId:venda.id,comandaId:venda.comandaId,
  organizacaoId,emissor:issuer,
  subtotal:money(subtotal),desconto:money(discount),acrescimo:money(surcharge),
  total:money(actual),grupos:results};
 const fingerprint=createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
 return {modo:"PREPARACAO_FISCAL_NAO_EXECUTAVEL",...snapshot,fingerprint,
  precisaRevisaoFiscal:true,emissaoHabilitada:false,
  gerouDocumento:false,gerouVenda:false,transmitiu:false,autorizou:false};
}
