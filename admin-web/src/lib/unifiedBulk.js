/** PDV Unificado: conversão local de venda por peso/valor.
 * A quantidade enviada ao servidor permanece na unidade de estoque cadastrada.
 * Não representa pagamento, baixa de estoque ou autorização de preço.
 */
export const isBulkWeightProduct=item=>item?.tipo==="PRODUTO"&&["QUILOGRAMA","GRAMA"].includes(item?.unidade);

const gramsPerStockUnit=unit=>unit==="QUILOGRAMA"?1000:1;
const priceCents=price=>Math.round(Number(price)*100);
export const stockUnitLabel=unit=>({QUILOGRAMA:"kg",GRAMA:"g",LITRO:"L",MILILITRO:"mL",PACOTE:"pacote",CAIXA:"caixa",UNIDADE:"unidade"})[unit]||"unidade";

export function bulkGrams(item){
 if(!isBulkWeightProduct(item))return null;
 return Math.round(Number(item.quantidade)*gramsPerStockUnit(item.unidade));
}

export function bulkTotalCents(item){
 const milli=Math.round(Number(item.quantidade)*1000);
 return Math.round(priceCents(item.preco)*milli/1000);
}

/** Em gramas inteiros: nunca aceitar fração que Decimal(14,3) arredondaria. */
export function bulkFromGrams(raw,unit){
 const input=String(raw).trim();
 if(!/^\d+$/.test(input))return {erro:"Informe o peso em gramas inteiros."};
 const grams=Number(input);
 const quantity=grams/gramsPerStockUnit(unit);
 if(!Number.isSafeInteger(grams)||grams<1||quantity>10000)
  return {erro:"Informe um peso entre 1 g e o limite de 10.000 unidades de estoque."};
 return {quantidade:quantity,gramas:grams};
}

/** Entrada por R$: escolhe gramas inteiros e não altera o preço de catálogo.
 * Rejeita valores impossíveis de representar em centavos com a pesagem escolhida.
 */
export function bulkFromAmount(raw,price,unit){
 const input=String(raw).trim().replace(",",".");
 if(!/^\d+(?:\.\d{1,2})?$/.test(input))return {erro:"Informe o valor em reais com até duas casas decimais."};
 const desiredCents=Math.round(Number(input)*100),unitCents=priceCents(price);
 if(!Number.isSafeInteger(desiredCents)||desiredCents<1||!Number.isSafeInteger(unitCents)||unitCents<=0)
  return {erro:"O valor e o preço por unidade devem ser positivos."};
 const grams=Math.round(desiredCents*gramsPerStockUnit(unit)/unitCents);
 const result=bulkFromGrams(String(grams),unit);
 if(result.erro)return {erro:"Este valor não corresponde a pelo menos 1 g dentro do limite do produto."};
 const actualCents=Math.round(unitCents*Math.round(result.quantidade*1000)/1000);
 if(actualCents!==desiredCents)
  return {erro:"Esse valor não corresponde exatamente a gramas inteiros nesse preço. Ajuste o valor ou informe o peso."};
 return {...result,valorCentavos:actualCents};
}
