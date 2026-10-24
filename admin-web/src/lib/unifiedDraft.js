import {isValidPdvQuantity} from "./pdvQuantity.js";

/** Rebuild a saved management-PDV draft from its persisted, authorized snapshot.
 * Never depend on the current catalog search or treat old prices as approved. */
export function buildUnifiedDraftPayload(clientId, lines) {
 for(const item of lines) {
  if(!isValidPdvQuantity(item,item.quantidade)) {
   throw new Error(item.tipo==="SERVICO"?"Serviços aceitam somente quantidades inteiras maiores que zero.":"Quantidade inválida: confira o peso ou unidade do produto.");
  }
 }
 if (lines.some(item=>item.tipo==="SERVICO"&&(!clientId||!item.petId))) {
  throw new Error("Tutor e pet são obrigatórios para qualquer serviço.");
 }
 return {
  clienteId: clientId || null,
  itens: lines.map(item => ({
   empresaId: item.empresaId,
   itemCatalogoId: item.itemCatalogoId,
   quantidade: item.quantidade,
   petId: item.petId || null
  }))
 };
}

/** Cache entries for the unified PDV must never be shared across company
 * contexts: API authorization depends on the X-Empresa-Id header. */
export function unifiedScopedQueryKey(resource, organizationId, companyId, ...parts) {
 return [resource, organizationId ?? null, companyId ?? null, ...parts];
}

/** The unified workspace spans companies, but never organizations or missing PDV access. */
export function keepUnifiedPdvRouteOnCompanyChange(pathname, organizationId, nextCompany, intelligentPreference=false) {
 // Na tela única, preservar comanda local SOMENTE no modo inteligente e dentro
 // da mesma organização. No individual, redirecionar para limpar o carrinho.
 const eligiblePath = pathname === "/pdv/unificado/simulacao"
  || (pathname === "/pdv" && intelligentPreference === true);
 return eligiblePath
  && Boolean(organizationId)
  && nextCompany?.organizacaoId === organizationId
  && nextCompany?.permissoes?.includes("pdv.acessar") === true;
}

/** Keep the persisted tutor visible while a filtered client search reloads. */
export function visibleUnifiedClients(clients, selectedClient) {
 const results = Array.isArray(clients) ? clients : [];
 if (!selectedClient?.id || results.some(client => client.id === selectedClient.id)) return results;
 return [selectedClient, ...results];
}

export function rehydrateUnifiedDraft(saved){
 return (saved.itens||[]).filter(i=>i.status==="ATIVO"||(saved.status==="FECHADA"&&i.status==="FATURADO")).map(i=>({
  lineKey:`persistida:${i.id}`,
  rascunhoItemId:i.id,
  empresaId:i.empresaId,
  itemCatalogoId:i.itemCatalogoId,
  petId:i.petId||"",
  quantidade:Number(i.quantidade),
  nome:i.descricao,
  empresa:i.empresaNome,
  preco:Number(i.valorUnitario),
  tipo:i.tipo,
  unidade:i.unidade||null,
  exigePet:Boolean(i.exigePet)
 }));
}

/** Products can share a line. Each service is a separate pet-linked activity. */
export function addUnifiedCatalogItem(lines,item,lineKey){
 const existing=item.tipo!=="SERVICO"?lines.findIndex(x=>x.empresaId===item.empresaId&&x.itemCatalogoId===item.id):-1;
 if(existing>=0)return lines.map((row,index)=>index===existing?{...row,quantidade:row.quantidade+1,entradaGranel:null,erroEntradaGranel:null}:row);
 return [...lines,{
  lineKey,itemCatalogoId:item.id,empresaId:item.empresaId,
  nome:item.nome,empresa:item.empresa?.nomeFantasia,quantidade:1,
  preco:Number(item.precoVenda),petId:"",tipo:item.tipo,unidade:item.unidade||null,
  exigePet:Boolean(item.servico?.exigePet)
 }];
}

/** Aplica o pet escolhido na abertura apenas a um novo serviço desse mesmo tutor.
 * Nunca associa um pet a um rascunho reaberto, outro tutor ou cadastro não carregado. */
export function initialPetForUnifiedService(item,{clientId,initialClientId,initialPetId,pets}={}){
 if(item?.tipo!=="SERVICO"||!clientId||clientId!==initialClientId||!initialPetId)return "";
 return Array.isArray(pets)&&pets.some(p=>p.id===initialPetId&&p.ativo!==false)?initialPetId:"";
}

export function updateUnifiedLine(lines,lineKey,patch){
 return lines.map(row=>{
  if(row.lineKey!==lineKey)return row;
  if(row.tipo==="SERVICO" && Object.prototype.hasOwnProperty.call(patch,"quantidade")){
    const q=Number(patch.quantidade);
    if(!Number.isSafeInteger(q)||q<1)return row;
  }
  return {...row,...patch};
 });
}

export function removeUnifiedLine(lines,lineKey){
 return lines.filter(row=>row.lineKey!==lineKey);
}

export const unifiedPrecloseMessages={
 ITEM_INDISPONIVEL:"Item indisponível ou removido do catálogo da empresa",
 PET_INVALIDO:"Pet inativo ou não vinculado a este tutor",
 PET_OBRIGATORIO:"Serviço exige a seleção de um pet",
 VALOR_DIVERGENTE:"Total salvo inconsistente; revise a comanda",
 PRECO_ALTERADO:"Preço do catálogo mudou; revise e salve uma nova versão"
};
