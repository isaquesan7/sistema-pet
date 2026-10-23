/** PointVet M.5.37 — impedir reinterpretação de quantidades históricas.
 * Executado dentro da transação do PATCH de catálogo; nunca converte estoque.
 */
export const FONTES_UNIDADE_EM_USO=Object.freeze([
 "estoqueSaldo","loteProduto","movimentacaoEstoque","entradaEstoqueItem",
 "inventarioEstoqueItem","comandaItem","vendaItem","conversaoOrcamentoPdvItem",
 "pacoteModeloItem","pacoteClienteItem"
]);

/** M.5.38 — obtenha as travas ANTES de ler a unidade, preço ou saldos para
 * criar o primeiro vínculo do produto. FOR SHARE permite várias comandas
 * simultâneas, mas conflita com o FOR UPDATE de uma alteração de unidade.
 * A ordenação impede inversão de locks em operações com múltiplos produtos.
 */
export async function travarUnidadesProdutos(tx,itemIds){
 const ids=[...new Set(itemIds.filter(Boolean))].sort();
 for(const itemId of ids){
  await tx.$queryRaw`SELECT "id" FROM "produtos" WHERE "itemId"=${itemId} FOR SHARE`;
 }
}

/** Quantidade de granel é representável apenas em gramas inteiros.
 * KG aceita milésimos de kg; GRAMA não aceita fração de grama.
 */
export function validarQuantidadeNaUnidade(unidade,quantidade,{permitirZero=false}={}){
 const value=Number(quantidade);
 if(!Number.isFinite(value)||value<0||(!permitirZero&&value===0))throw Error("QUANTIDADE_INVALIDA");
 if(!["GRAMA","QUILOGRAMA"].includes(unidade))return;
 const milli=Math.round(value*1000);
 if(Math.abs(milli/1000-value)>0.0000001||unidade==="GRAMA"&&milli%1000!==0)
  throw Error("QUANTIDADE_INVALIDA");
}

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
