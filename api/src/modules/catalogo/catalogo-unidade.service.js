/** PointVet M.5.37 — impedir reinterpretação de quantidades históricas.
 * Executado dentro da transação do PATCH de catálogo; nunca converte estoque.
 */
export const FONTES_UNIDADE_EM_USO=Object.freeze([
 "estoqueSaldo","loteProduto","movimentacaoEstoque","entradaEstoqueItem",
 "inventarioEstoqueItem","comandaItem","vendaItem","conversaoOrcamentoPdvItem",
 "pacoteModeloItem","pacoteClienteItem"
]);

export async function protegerUnidadeEstoque(tx,{itemId,produtoId,unidadeAnterior,unidadeNova}){
 if(!unidadeNova||unidadeNova===unidadeAnterior)return;
 // Uma alteração concorrente do mesmo produto precisa terminar antes de validar.
 await tx.$queryRaw`SELECT "id" FROM "produtos" WHERE "itemId"=${itemId} FOR UPDATE`;
 const atual=await tx.produto.findUnique({where:{itemId},select:{unidade:true}});
 if(!atual||atual.unidade!==unidadeAnterior)throw Error("UNIDADE_ESTOQUE_DESATUALIZADA");
 const queries={
  estoqueSaldo:{produtoId},loteProduto:{produtoId},movimentacaoEstoque:{produtoId},
  entradaEstoqueItem:{produtoId},inventarioEstoqueItem:{produtoId},
  comandaItem:{itemCatalogoId:itemId},vendaItem:{itemCatalogoId:itemId},
  conversaoOrcamentoPdvItem:{itemCatalogoId:itemId},
  pacoteModeloItem:{itemCatalogoId:itemId},pacoteClienteItem:{itemCatalogoId:itemId}
 };
 const usage=await Promise.all(FONTES_UNIDADE_EM_USO.map(model=>tx[model].count({where:queries[model]})));
 if(usage.some(quantity=>quantity>0))throw Error("UNIDADE_ESTOQUE_EM_USO");
}
