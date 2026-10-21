/** M.5.69 — apresentação ÚNICA do PDV para os motores individual e multiempresa.
 * Recebe apenas elementos visuais; cálculo, autorização e mutações permanecem
 * nos respectivos controladores e na API. Não abre caixa nem processa vendas.
 */
import {Boxes,ShoppingCart} from "lucide-react";

export function PdvProductCard({item,onAdd,disabled=false,subtitle,extra}){
 return <button className="pdv-product-card" type="button"
  aria-label={`Adicionar ${item.nome} ao carrinho`}
  onClick={()=>onAdd(item)} disabled={disabled}>
  <span className={`badge ${item.tipo==="PRODUTO"?"badge--muted":"badge--success"}`}>
   {item.tipo==="PRODUTO"?"Produto":"Serviço"}
  </span>
  <strong>{item.nome}</strong>
  <small>{subtitle||item.categoria?.nome||"Sem categoria"}</small>
  <b>{item.valorFormatado}</b>
  {extra&&<em>{extra}</em>}
 </button>;
}

export function PdvEmptyCart({description="Clique em um item do catálogo para iniciar a venda."}){
 return <div className="pdv-empty-cart"><ShoppingCart size={25}/>
  <strong>Seu carrinho está vazio</strong><p>{description}</p></div>;
}

/** Mesmas colunas, títulos, componentes de catálogo/carrinho e responsividade. */
export default function PdvSaleLayout({
 catalogTitle="Catálogo do CNPJ",catalogDescription="Adicione os produtos e serviços do caixa selecionado.",
 searchControl,catalogContent,cartTitle="Carrinho de venda",
 cartDescription="Revise tutor, itens, valores e pagamentos.",cartCount=0,
 customerControl,cartContent,totalsContent,paymentsContent,actionsContent,noticesContent,
 afterCartContent
}){
 return <>
  <section className="pdv-sale-layout" aria-label="Registrar venda rápida">
   <div className="panel pdv-catalog-panel">
    <div className="panel__heading">
     <div><span>01 / Escolha os itens</span><h2>{catalogTitle}</h2><p>{catalogDescription}</p></div>
     <Boxes size={20}/>
    </div>
    {searchControl}
    <div className="pdv-product-grid">{catalogContent}</div>
   </div>
   <div className="panel pdv-cart-panel">
    <div className="panel__heading">
     <div><span>02 / Confira e receba</span><h2>{cartTitle}</h2><p>{cartDescription}</p></div>
     <span className="pdv-cart-count"><ShoppingCart size={16}/>{cartCount} {cartCount===1?"item":"itens"}</span>
    </div>
    {customerControl}
    <div className="pdv-cart-list" aria-label="Itens do carrinho">{cartContent}</div>
    {totalsContent}
    {paymentsContent}
    {noticesContent}
    {actionsContent}
    {afterCartContent}
   </div>
  </section>
 </>;
}
