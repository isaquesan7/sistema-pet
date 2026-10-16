/** Rebuild a saved management-PDV draft from its persisted, authorized snapshot.
 * Never depend on the current catalog search or treat old prices as approved. */
export function rehydrateUnifiedDraft(saved){
 return (saved.itens||[]).filter(i=>i.status==="ATIVO").map(i=>({
  rascunhoItemId:i.id,
  empresaId:i.empresaId,
  itemCatalogoId:i.itemCatalogoId,
  petId:i.petId||"",
  quantidade:Number(i.quantidade),
  nome:i.descricao,
  empresa:i.empresaNome,
  preco:Number(i.valorUnitario),
  exigePet:Boolean(i.exigePet)
 }));
}

export const unifiedPrecloseMessages={
 ITEM_INDISPONIVEL:"Item indisponível ou removido do catálogo da empresa",
 PET_INVALIDO:"Pet inativo ou não vinculado a este tutor",
 PET_OBRIGATORIO:"Serviço exige a seleção de um pet",
 VALOR_DIVERGENTE:"Total salvo inconsistente; revise a comanda",
 PRECO_ALTERADO:"Preço do catálogo mudou; revise e salve uma nova versão"
};
