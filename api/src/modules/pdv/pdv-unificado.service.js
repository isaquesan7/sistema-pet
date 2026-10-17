/** PointVet 20.1: read-only multi-company cart simulation.
 * Never saves a comanda, sells inventory, accepts payment or generates fiscal documents.
 */
import {z} from "zod";
import {createHash} from "node:crypto";
import prisma from "../../config/prisma.js";
import {travarUnidadesProdutos} from "../catalogo/catalogo-unidade.service.js";
const itemSchema=z.object({empresaId:z.string().min(1),itemCatalogoId:z.string().min(1),petId:z.string().nullable().optional(),quantidade:z.number().positive().max(10000)}).strict();
export const previewSchema=z.object({clienteId:z.string().min(1),itens:z.array(itemSchema).min(1).max(100)}).strict();
const cents=v=>Math.round(Number(v)*100);
const serialize=amount=>(amount/100).toFixed(2);
async function empresasAutorizadas({organizacaoId,usuarioId,empresaId},db=prisma){
 const vinculos=await db.usuarioEmpresa.findMany({where:{usuarioId,ativo:true,empresa:{organizacaoId,ativo:true}},include:{empresa:{select:{id:true,nomeFantasia:true,cnpj:true,tipo:true}},cargo:{include:{permissoes:{include:{permissao:true}}}}}});
 return vinculos.filter(v=>v.cargo?.ativo&&v.cargo?.permissoes?.some(p=>p.permissao.codigo==="pdv.acessar") || v.empresaId===empresaId).map(v=>v.empresa);
}
export async function buscarCatalogo({organizacaoId,usuarioId,empresaId,busca=""}){
 const companies=await empresasAutorizadas({organizacaoId,usuarioId,empresaId});
 const items=await prisma.itemCatalogo.findMany({where:{empresaId:{in:companies.map(c=>c.id)},ativo:true,empresa:{organizacaoId,ativo:true},...(busca?{OR:[{nome:{contains:busca,mode:"insensitive"}},{codigoInterno:{contains:busca,mode:"insensitive"}},{codigoBarras:{contains:busca,mode:"insensitive"}}]}:{})},select:{id:true,empresaId:true,nome:true,tipo:true,precoVenda:true,codigoInterno:true,produto:{select:{unidade:true}},servico:{select:{exigePet:true}}},take:100,orderBy:[{nome:"asc"}]});
 const byCompany=new Map(companies.map(c=>[c.id,c]));
 return items.map(({produto,...x})=>({...x,unidade:produto?.unidade||null,precoVenda:Number(x.precoVenda),empresa:byCompany.get(x.empresaId)}));
}
export async function simularComanda({organizacaoId,usuarioId,empresaId,clienteId,itens},db=prisma){
 const cliente=await db.cliente.findFirst({where:{id:clienteId,organizacaoId,ativo:true},select:{id:true,nome:true}});
 if(!cliente)throw Error("CLIENTE_NAO_ENCONTRADO");
 const companies=await empresasAutorizadas({organizacaoId,usuarioId,empresaId},db);
 const allowed=new Map(companies.map(c=>[c.id,c]));
 if(itens.some(x=>!allowed.has(x.empresaId)))throw Error("EMPRESA_SEM_ACESSO");
 const ids=[...new Set(itens.map(x=>x.itemCatalogoId))];
 const found=await db.itemCatalogo.findMany({where:{id:{in:ids},empresaId:{in:[...allowed.keys()]},ativo:true,empresa:{organizacaoId,ativo:true}},select:{id:true,empresaId:true,nome:true,tipo:true,precoVenda:true,produto:{select:{unidade:true}},servico:{select:{exigePet:true}}}});
 const map=new Map(found.map(i=>[i.id,i]));
 const petIds=[...new Set(itens.map(i=>i.petId).filter(Boolean))];
 const pets=petIds.length?await db.pet.findMany({where:{id:{in:petIds},clienteId,ativo:true,cliente:{organizacaoId}},select:{id:true}}):[];
 if(pets.length!==petIds.length)throw Error("PET_INVALIDO");
 const rows=itens.map(input=>{
  const item=map.get(input.itemCatalogoId);
  if(!item||item.empresaId!==input.empresaId)throw Error("ITEM_INVALIDO");
  if(item.tipo==="SERVICO"&&item.servico?.exigePet&&!input.petId)throw Error("PET_OBRIGATORIO");
  // money in integer cents, quantities up to 3 fractional digits.
  const quantityMilli=Math.round(input.quantidade*1000);
  if(Math.abs(quantityMilli/1000-input.quantidade)>0.0000001)throw Error("QUANTIDADE_INVALIDA");
  // Estoque de gramas usa unidades inteiras; o de kg usa 0,001 kg = 1 g.
  if(item.produto?.unidade==="GRAMA"&&quantityMilli%1000!==0)throw Error("QUANTIDADE_INVALIDA");
  const totalCents=Math.round(cents(item.precoVenda)*quantityMilli/1000);
  if(["QUILOGRAMA","GRAMA"].includes(item.produto?.unidade)&&totalCents<1)throw Error("TOTAL_GRANEL_ZERADO");
  return {empresaId:item.empresaId,empresa:allowed.get(item.empresaId).nomeFantasia,itemCatalogoId:item.id,descricao:item.nome,petId:input.petId||null,quantidade:quantityMilli/1000,valorUnitario:serialize(cents(item.precoVenda)),valorTotal:serialize(totalCents),totalCents};
 });
 const groups=new Map();
 for(const row of rows){const g=groups.get(row.empresaId)||{empresaId:row.empresaId,empresa:row.empresa,totalCents:0,itens:[]};g.totalCents+=row.totalCents;g.itens.push((({totalCents,...line})=>line)(row));groups.set(row.empresaId,g);}
 const subtotal=rows.reduce((sum,r)=>sum+r.totalCents,0);
 return {modo:"SIMULACAO_SEM_FECHAMENTO",cliente,quantidadeItens:rows.length,total:serialize(subtotal),empresas:[...groups.values()].map(({totalCents,...g})=>({...g,total:serialize(totalCents)})),observacao:"Nenhuma venda, cobrança, estoque ou nota fiscal foi alterada."};
}

/** Persist and revise unbilled unified drafts. Prices and authorization are recalculated
 * inside the database transaction; no inventory, sale or payment is created. */
export async function salvarRascunho(args,{id=null,versao=null}={}){
 return prisma.$transaction(async tx=>{
  // Uma mudança kg↔g nunca pode ocorrer entre a leitura da unidade e a
  // primeira linha persistida da comanda; bloqueie inclusive novos SKUs.
  await travarUnidadesProdutos(tx,args.itens.map(x=>x.itemCatalogoId));
  const previa=await simularComanda(args,tx);
  let comanda;
  if(id){
   const atual=await tx.comanda.findFirst({where:{id,rascunhoUnificado:true,cliente:{organizacaoId:args.organizacaoId}},include:{itens:true,vendas:{select:{id:true}}}});
   if(!atual)throw Error("RASCUNHO_NAO_ENCONTRADO");
   if(atual.status!=="ABERTA"||atual.vendas?.length)throw Error("RASCUNHO_BLOQUEADO");
   if(atual.versaoRascunho!==versao)throw Error("RASCUNHO_DESATUALIZADO");
   if(atual.clienteId!==args.clienteId)throw Error("RASCUNHO_CLIENTE_IMUTAVEL");
   const ativa=await tx.reservaFechamentoUnificado.findFirst({where:{comandaId:id,status:"RESERVADA"},select:{id:true}});
   if(ativa)throw Error("RASCUNHO_RESERVADO");
   const empresaIds=[...new Set(atual.itens.map(x=>x.empresaId))];
   const acessiveis=await empresasAutorizadas(args,tx);
   if(empresaIds.some(e=>!acessiveis.some(a=>a.id===e)))throw Error("EMPRESA_SEM_ACESSO");
   const updated=await tx.comanda.updateMany({where:{id,rascunhoUnificado:true,status:"ABERTA",versaoRascunho:versao},data:{versaoRascunho:{increment:1}}});
   if(updated.count!==1)throw Error("RASCUNHO_DESATUALIZADO");
   // Replaced lines are only draft lines. No comanda has been invoiced.
   await tx.comandaItem.deleteMany({where:{comandaId:id,status:"ATIVO"}});
   comanda=await tx.comanda.findUnique({where:{id}});
  }else{
   comanda=await tx.comanda.create({data:{clienteId:args.clienteId,rascunhoUnificado:true,status:"ABERTA"}});
  }
  const linhas=previa.empresas.flatMap(g=>g.itens.map(l=>({
    comandaId:comanda.id,empresaId:l.empresaId,itemCatalogoId:l.itemCatalogoId,petId:l.petId,
    descricao:l.descricao,quantidade:l.quantidade,valorUnitario:l.valorUnitario,valorTotal:l.valorTotal,desconto:"0.00"
  })));
  await tx.comandaItem.createMany({data:linhas});
  return {id:comanda.id,numero:comanda.numero,versao:comanda.versaoRascunho,cliente:previa.cliente,empresas:previa.empresas,total:previa.total,estado:"RASCUNHO_SEM_FECHAMENTO"};
 },{isolationLevel:"Serializable",maxWait:5000,timeout:12000});
}
export async function listarRascunhos({organizacaoId,usuarioId,empresaId}){
 const acessiveis=await empresasAutorizadas({organizacaoId,usuarioId,empresaId});
 const allowed=new Map(acessiveis.map(a=>[a.id,a]));
 const list=await prisma.comanda.findMany({where:{rascunhoUnificado:true,status:"ABERTA",cliente:{organizacaoId}},select:{id:true,numero:true,versaoRascunho:true,createdAt:true,cliente:{select:{id:true,nome:true}},itens:{select:{id:true,empresaId:true,itemCatalogoId:true,petId:true,quantidade:true,descricao:true,valorUnitario:true,valorTotal:true,status:true,itemCatalogo:{select:{tipo:true,produto:{select:{unidade:true}},servico:{select:{exigePet:true}}}}}}},orderBy:{createdAt:"desc"},take:100});
 // A linha salva é a fonte da retomada; buscas de catálogo podem estar filtradas,
 // ter sido renomeadas ou não devolver um item desativado. Pre-close revalida tudo.
 return list.filter(x=>x.itens.length&&x.itens.every(i=>allowed.has(i.empresaId))).slice(0,50).map(x=>({...x,itens:x.itens.map(({itemCatalogo,...i})=>({...i,quantidade:Number(i.quantidade),valorUnitario:Number(i.valorUnitario),valorTotal:Number(i.valorTotal),empresaNome:allowed.get(i.empresaId).nomeFantasia,tipo:itemCatalogo?.tipo,unidade:itemCatalogo?.produto?.unidade||null,exigePet:Boolean(itemCatalogo?.servico?.exigePet)}))}));
}

/** Pre-close verification only. Never mutates invoices, stock, credit or payments.
 * All seller allocations are evaluated from persisted draft rows, not client totals.
 */
export async function conferirPreFechamento({organizacaoId,usuarioId,empresaId,id,versao},db=prisma){
 const draft=await db.comanda.findFirst({where:{id,rascunhoUnificado:true,cliente:{organizacaoId}},
  include:{cliente:{select:{id:true,nome:true,ativo:true}},itens:{where:{status:"ATIVO"},include:{itemCatalogo:{select:{id:true,ativo:true,precoVenda:true,empresaId:true,servico:{select:{exigePet:true}}}},pet:{select:{id:true,clienteId:true,ativo:true}}}},vendas:{select:{id:true}}}});
 if(!draft)throw Error("RASCUNHO_NAO_ENCONTRADO");
 if(draft.versaoRascunho!==versao)throw Error("RASCUNHO_DESATUALIZADO");
 if(draft.status!=="ABERTA"||draft.vendas.length||!draft.cliente.ativo||!draft.itens.length)throw Error("RASCUNHO_BLOQUEADO");
 const acessiveis=await empresasAutorizadas({organizacaoId,usuarioId,empresaId},db);
 const allowed=new Map(acessiveis.map(e=>[e.id,e]));
 if(draft.itens.some(i=>!allowed.has(i.empresaId)))throw Error("EMPRESA_SEM_ACESSO");
 const issues=[],totals=new Map();
 for(const line of draft.itens){
  const cat=line.itemCatalogo;
  if(!cat?.ativo||cat.empresaId!==line.empresaId)issues.push({itemId:line.id,codigo:"ITEM_INDISPONIVEL"});
  if(line.petId&&(!line.pet?.ativo||line.pet.clienteId!==draft.clienteId))issues.push({itemId:line.id,codigo:"PET_INVALIDO"});
  if(cat?.servico?.exigePet&&!line.petId)issues.push({itemId:line.id,codigo:"PET_OBRIGATORIO"});
  const unit=cents(line.valorUnitario),qty=Math.round(Number(line.quantidade)*1000);
  const expected=Math.round(unit*qty/1000)-cents(line.desconto);
  if(expected!==cents(line.valorTotal)||expected<0)issues.push({itemId:line.id,codigo:"VALOR_DIVERGENTE"});
  if(cat&&cents(cat.precoVenda)!==unit)issues.push({itemId:line.id,codigo:"PRECO_ALTERADO"});
  totals.set(line.empresaId,(totals.get(line.empresaId)||0)+cents(line.valorTotal));
 }
 const empresas=[...totals.entries()].map(([companyId,value])=>({empresaId:companyId,nome:allowed.get(companyId).nomeFantasia,cnpj:allowed.get(companyId).cnpj,total:serialize(value)}));
 const total=[...totals.values()].reduce((a,b)=>a+b,0);
 return {rascunhoId:id,versao,draftStatus:draft.status,cliente:draft.cliente,empresas,total:serialize(total),pendencias:issues,aptoParaFechamentoFuturo:issues.length===0,
  checkoutHabilitado:false,pagamentosHabilitados:false,emissaoFiscalHabilitada:false,
  observacao:"Pré-conferência sem cobrança, faturamento, baixa de estoque ou emissão fiscal."};
}

/** Pure, deterministic allocation plan: one future sale per company, never an executed sale.
 * Keys are scoped to draft+revision+company; no payment or invoice is attempted here.
 */
export async function planejarFechamento({organizacaoId,usuarioId,empresaId,id,versao},db=prisma){
 const revisao=await conferirPreFechamento({organizacaoId,usuarioId,empresaId,id,versao},db);
 if(revisao.pendencias.length)throw Error("PRE_FECHAMENTO_COM_PENDENCIAS");
 const grupos=revisao.empresas.map(company=>({
  empresaId:company.empresaId,cnpj:company.cnpj,empresa:company.nome,total:company.total,
  chaveIdempotencia:createHash("sha256").update(["POINTVET20",organizacaoId,id,String(versao),company.empresaId].join(":")).digest("hex"),
  estado:"SOMENTE_PLANEJADO"
 }));
 if(new Set(grupos.map(g=>g.empresaId)).size!==grupos.length)throw Error("EMPRESA_DUPLICADA");
 return {rascunhoId:id,versao,estado:"PLANEJAMENTO_SEM_EXECUCAO",total:revisao.total,operacoes:grupos,
  podeExecutar:false,checkoutHabilitado:false,observacao:"Plano determinístico para futura idempotência. Nenhuma venda, cobrança, movimentação ou documento fiscal é criado."};
}

/** Explicit authorization in every company: selected-company permissions alone
 * are not enough to cancel the full multi-company closing reservation.
 */
async function empresasComPermissao({organizacaoId,usuarioId,codigo},db=prisma){
 const vinculos=await db.usuarioEmpresa.findMany({where:{usuarioId,ativo:true,empresa:{organizacaoId,ativo:true}},
  include:{cargo:{include:{permissoes:{include:{permissao:true}}}}}});
 return new Set(vinculos.filter(v=>v.cargo?.ativo&&v.cargo.permissoes.some(p=>p.permissao.codigo===codigo)).map(v=>v.empresaId));
}
/** Durable reservation: locks the parent comanda, revalidates the full pre-close plan
 * transactionally, and creates at most one immutable operation per company/revision.
 * Never creates a Venda/Pagamento/DocumentoFiscal or moves inventory.
 */
export async function reservarOperacoesFechamento({organizacaoId,usuarioId,empresaId,id,versao}){
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${id} FOR UPDATE`;
  const draft=await tx.comanda.findFirst({where:{id,rascunhoUnificado:true,cliente:{organizacaoId}},select:{id:true,clienteId:true,status:true,versaoRascunho:true}});
  if(!draft)throw Error("RASCUNHO_NAO_ENCONTRADO");
  if(draft.versaoRascunho!==versao)throw Error("RASCUNHO_DESATUALIZADO");
  if(draft.status!=="ABERTA")throw Error("RASCUNHO_BLOQUEADO");
  const existente=await tx.reservaFechamentoUnificado.findUnique({
   where:{comandaId_versaoRascunho:{comandaId:id,versaoRascunho:versao}},
   include:{operacoes:{include:{empresa:{select:{nomeFantasia:true,cnpj:true}}}}}
  });
  if(existente){
   const acessiveis=await empresasAutorizadas({organizacaoId,usuarioId,empresaId},tx);
   const allowed=new Set(acessiveis.map(e=>e.id));
   if(existente.operacoes.some(op=>!allowed.has(op.empresaId)))throw Error("EMPRESA_SEM_ACESSO");
   if(existente.status!=="RESERVADA")throw Error("RESERVA_CANCELADA");
   if(existente.operacoes.some(op=>op.vendaId||op.status!=="RESERVADA"))throw Error("RESERVA_NAO_EDITAVEL");
   return normalizarReserva(existente,true);
  }
  const plano=await planejarFechamento({organizacaoId,usuarioId,empresaId,id,versao},tx);
  if(!plano.operacoes.length)throw Error("RASCUNHO_BLOQUEADO");
  const criada=await tx.reservaFechamentoUnificado.create({
   data:{comandaId:id,versaoRascunho:versao,valorTotal:plano.total,criadoPorId:usuarioId,
    operacoes:{create:plano.operacoes.map(op=>({
      empresaId:op.empresaId,chaveIdempotencia:op.chaveIdempotencia,valorTotal:op.total
    }))}},
   include:{operacoes:{include:{empresa:{select:{nomeFantasia:true,cnpj:true}}}}}
  });
  return normalizarReserva(criada,false);
 },{isolationLevel:"Serializable",maxWait:5000,timeout:15000});
}
function normalizarReserva(reserva,reutilizada){
 return {id:reserva.id,comandaId:reserva.comandaId,versao:reserva.versaoRascunho,
  status:reserva.status,total:String(reserva.valorTotal),reutilizada,
  criadoPorId:reserva.criadoPorId,canceladoPorId:reserva.canceladoPorId,
  operacoes:reserva.operacoes.map(op=>({id:op.id,empresaId:op.empresaId,
   nome:op.empresa.nomeFantasia,cnpj:op.empresa.cnpj,valor:String(op.valorTotal),
   chaveIdempotencia:op.chaveIdempotencia,status:op.status,vendaId:op.vendaId})),
  checkoutHabilitado:false,pagamentosHabilitados:false,emissaoFiscalHabilitada:false};
}
/** Tenant and all-company authorization required even for reading a reservation. */
export async function consultarReservaFechamento({organizacaoId,usuarioId,empresaId,id,versao},db=prisma){
 const comanda=await db.comanda.findFirst({where:{id,rascunhoUnificado:true,cliente:{organizacaoId}},
  select:{id:true,itens:{select:{empresaId:true}}}});
 if(!comanda)throw Error("RASCUNHO_NAO_ENCONTRADO");
 const acessiveis=await empresasAutorizadas({organizacaoId,usuarioId,empresaId},db);
 const permitidos=new Set(acessiveis.map(e=>e.id));
 if(comanda.itens.some(i=>!permitidos.has(i.empresaId)))throw Error("EMPRESA_SEM_ACESSO");
 const reserva=await db.reservaFechamentoUnificado.findUnique({
  where:{comandaId_versaoRascunho:{comandaId:id,versaoRascunho:versao}},
  include:{operacoes:{include:{empresa:{select:{nomeFantasia:true,cnpj:true}}}}}
 });
 if(reserva?.operacoes.some(i=>!permitidos.has(i.empresaId)))throw Error("EMPRESA_SEM_ACESSO");
 return reserva?normalizarReserva(reserva,true):null;
}
/** Release only an unexecuted reservation; preserve its audit rows and key uniqueness.
 * A new revision is required before reserving again.
 */
export async function cancelarReservaFechamento({organizacaoId,usuarioId,empresaId,id,versao,motivo}){
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "comandas" WHERE "id"=${id} FOR UPDATE`;
  const draft=await tx.comanda.findFirst({where:{id,rascunhoUnificado:true,cliente:{organizacaoId}},select:{id:true,versaoRascunho:true}});
  if(!draft)throw Error("RASCUNHO_NAO_ENCONTRADO");
  if(draft.versaoRascunho!==versao)throw Error("RASCUNHO_DESATUALIZADO");
  const reserva=await tx.reservaFechamentoUnificado.findUnique({
   where:{comandaId_versaoRascunho:{comandaId:id,versaoRascunho:versao}},
   include:{operacoes:{include:{empresa:{select:{nomeFantasia:true,cnpj:true}}}}}
  });
  if(!reserva)throw Error("RESERVA_NAO_ENCONTRADA");
  const acessiveis=await empresasAutorizadas({organizacaoId,usuarioId,empresaId},tx);
  const permitidos=new Set(acessiveis.map(e=>e.id));
  if(reserva.operacoes.some(op=>!permitidos.has(op.empresaId)))throw Error("EMPRESA_SEM_ACESSO");
  const canceladores=await empresasComPermissao({organizacaoId,usuarioId,codigo:"pdv.cancelar_venda"},tx);
  if(reserva.operacoes.some(op=>!canceladores.has(op.empresaId)))throw Error("CANCELAMENTO_SEM_PERMISSAO");
  if(reserva.operacoes.some(op=>op.vendaId||op.status==="CONCLUIDA"))throw Error("RESERVA_NAO_EDITAVEL");
  if(await tx.registroRecebimentoManualUnificado.findUnique({where:{reservaId:reserva.id},select:{id:true}}))
   throw Error("REGISTRO_MANUAL_EXIGE_REVERSAO");
  if(reserva.status==="CANCELADA")return normalizarReserva(reserva,true);
  await tx.criacaoPreparacaoUnificada.updateMany({where:{reservaId:reserva.id,status:"PREPARADA"},data:{status:"INVALIDADA",invalidadaEm:new Date()}});
  const updated=await tx.reservaFechamentoUnificado.updateMany({
   where:{id:reserva.id,status:"RESERVADA"},
   data:{status:"CANCELADA",canceladaEm:new Date(),motivoCancelamento:motivo,canceladoPorId:usuarioId}
  });
  if(updated.count!==1)throw Error("RESERVA_NAO_EDITAVEL");
  await tx.reservaOperacaoUnificada.updateMany({where:{reservaId:reserva.id,status:"RESERVADA"},data:{status:"CANCELADA"}});
  const result=await tx.reservaFechamentoUnificado.findUnique({where:{id:reserva.id},
   include:{operacoes:{include:{empresa:{select:{nomeFantasia:true,cnpj:true}}}}}});
  return normalizarReserva(result,false);
 },{isolationLevel:"Serializable",maxWait:5000,timeout:15000});
}
