/** M.5.69 — apresentação ÚNICA do PDV para os motores individual e multiempresa.
 * Recebe apenas elementos visuais; cálculo, autorização e mutações permanecem
 * nos respectivos controladores e na API. Não abre caixa nem processa vendas.
 */
import {Boxes,ShoppingCart,Search} from "lucide-react";
import {useState} from "react";

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

/** Mesmo campo de cliente em ambos os modos. Busca opcional abre sob demanda,
 * sem obrigar dois campos permanentes ou alterar a identidade do cliente salvo. */
export function PdvCustomerPicker({
 clients=[],value="",onChange,search="",onSearch,disabled=false,
 label="Cliente (opcional, obrigatório para serviços com pet)",emptyLabel="Consumidor não identificado"
}){
 const [searchOpen,setSearchOpen]=useState(false);
 const options=clients.filter(c=>c&&typeof c.id==="string");
 return <div className="pdv-customer-picker">
  <div className="pdv-customer-picker__header">
   <label htmlFor="pdv-sale-customer-select">{label}</label>
   {onSearch&&<button type="button" className="pdv-customer-picker__search-toggle"
     aria-expanded={searchOpen} aria-label={searchOpen?"Fechar busca de cliente":"Buscar cliente"}
     onClick={()=>{setSearchOpen(v=>!v);if(searchOpen)onSearch("");}} disabled={disabled}>
     <Search size={14}/> {searchOpen?"Fechar busca":"Buscar"}
   </button>}
  </div>
  {searchOpen&&onSearch&&<input className="form-control pdv-customer-picker__search"
   type="search" aria-label="Buscar cliente pelo nome" placeholder="Nome do tutor..."
   autoComplete="off" value={search} onChange={e=>onSearch(e.target.value)} disabled={disabled}/>}
  <select id="pdv-sale-customer-select" className="form-control" value={value}
   onChange={e=>onChange(e.target.value)} disabled={disabled}>
   <option value="">{emptyLabel}</option>
   {options.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
  </select>
 </div>;
}

/** Totais idênticos no balcão, mas desconto/acréscimo podem estar bloqueados
 * no checkout inteligente até existir um rateio validado pela API. */
export function PdvTotals({subtotal,total,formatMoney,discount=0,addition=0,
 canDiscount=true,onDiscountChange,onAdditionChange,description}){
 const lockedDiscount=!canDiscount||typeof onDiscountChange!=="function";
 const lockedAddition=typeof onAdditionChange!=="function";
 return <div className="pdv-totals" aria-label="Resumo de valores">
  <div><span>Subtotal</span><strong>{subtotal===null?"—":formatMoney(subtotal)}</strong></div>
  <div><span>Desconto geral</span><input type="number" min="0" step="0.01"
   aria-label="Desconto geral" value={discount} disabled={lockedDiscount}
   title={lockedDiscount?"Desconto indisponível para este modo ou perfil":"Desconto geral"}
   onChange={e=>onDiscountChange?.(Number(e.target.value)||0)}/></div>
  <div><span>Acréscimo</span><input type="number" min="0" step="0.01"
   aria-label="Acréscimo" value={addition} disabled={lockedAddition}
   title={lockedAddition?"Acréscimo indisponível para este modo":"Acréscimo"}
   onChange={e=>onAdditionChange?.(Number(e.target.value)||0)}/></div>
  <div className="pdv-total-final"><span>Total da venda</span>
   <strong>{total===null?"—":formatMoney(total)}</strong></div>
  {description&&<small className="pdv-totals__hint">{description}</small>}
 </div>;
}

/** Envoltório visual igual, com conteúdo editável apenas quando o respectivo
 * motor realmente permite registrar pagamentos. */
export function PdvPaymentSection({children,description,action}){
 return <div className="pdv-payments" aria-label="Distribuição dos pagamentos">
  <div className="pdv-payments__heading">
   <div><strong>Pagamentos</strong>
    <span>{description||"Informe manualmente como o cliente pagou, inclusive em formas diferentes. Sem integração com bancos ou maquininhas."}</span>
   </div>
   {action}
  </div>
  {children}
 </div>;
}

export function PdvPaymentPending({message}){
 return <div className="pdv-payment-pending">
  <div className="pdv-payment-labels" aria-hidden="true">
   <span>Forma de pagamento</span><span>Valor (R$)</span><span>Parcelas / vencimento</span><span></span>
  </div>
  <div className="pdv-payment-row">
   <select className="form-control" aria-label="Forma de pagamento indisponível" disabled><option>PIX</option></select>
   <input className="form-control" aria-label="Valor do pagamento indisponível" value="0" readOnly disabled/>
   <span className="pdv-payment-spacer" aria-hidden="true"/>
  </div>
  <p className="pdv-payment-pending__notice">{message}</p>
 </div>;
}

export function PdvCheckoutButton({total,formatMoney,onClick,disabled=false,pending=false,reason}){
 return <div className="pdv-checkout-action">
  <button className="primary-button primary-button--large" type="button"
   disabled={disabled||pending} onClick={onClick}>
   {pending?"Finalizando...":`Finalizar venda · ${total===null?"—":formatMoney(total)}`}
  </button>
  {reason&&<small className="pdv-checkout-action__reason">{reason}</small>}
 </div>;
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
