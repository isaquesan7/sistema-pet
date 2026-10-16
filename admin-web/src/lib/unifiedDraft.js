/** Rebuild a saved management-PDV draft from its persisted, authorized snapshot.
 * Never depend on the current catalog search or treat old prices as approved. */
export function rehydrateUnifiedDraft(saved){
 return (saved.itens||[]).filter(i=>i.status==="ATIVO").map(i=>({
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
  exigePet:Boolean(i.exigePet)
 }));
}

/** Products can share a line. Each service is a separate pet-linked activity. */
export function addUnifiedCatalogItem(lines,item,lineKey){
 const existing=item.tipo!=="SERVICO"?lines.findIndex(x=>x.empresaId===item.empresaId&&x.itemCatalogoId===item.id):-1;
 if(existing>=0)return lines.map((row,index)=>index===existing?{...row,quantidade:row.quantidade+1}:row);
 return [...lines,{
  lineKey,itemCatalogoId:item.id,empresaId:item.empresaId,
  nome:item.nome,empresa:item.empresa?.nomeFantasia,quantidade:1,
  preco:Number(item.precoVenda),petId:"",tipo:item.tipo,
  exigePet:Boolean(item.servico?.exigePet)
 }];
}

export function updateUnifiedLine(lines,lineKey,patch){
 return lines.map(row=>row.lineKey===lineKey?{...row,...patch}:row);
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
