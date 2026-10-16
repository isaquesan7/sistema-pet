/** PointVet M.3C — explicit manual reversal attestation; NO provider integration. */
import {createHash} from "node:crypto";
export function normalizarPedidoEstornoManual({motivo,referenciaExterna=null,confirmouDevolucaoExterna}={}){
 if(typeof motivo!=="string"||motivo.trim().length<10||motivo.trim().length>500)
  throw Error("M3C_MOTIVO_OBRIGATORIO");
 if(referenciaExterna!=null&&(typeof referenciaExterna!=="string"||referenciaExterna.trim().length>120))
  throw Error("M3C_REFERENCIA_INVALIDA");
 if(confirmouDevolucaoExterna!==true)throw Error("M3C_CONFIRMACAO_EXTERNA_OBRIGATORIA");
 return {motivo:motivo.trim(),referenciaExterna:referenciaExterna?.trim()||null,
  confirmouDevolucaoExterna:true};
}
export function fingerprintEstornoManual({reservaId,usuarioId,pedido}){
 if(!reservaId||!usuarioId||!pedido?.motivo||pedido.confirmouDevolucaoExterna!==true)
  throw Error("M3C_CONTEXTO_INVALIDO");
 return createHash("sha256").update(JSON.stringify({versao:1,reservaId,usuarioId,...pedido})).digest("hex");
}
export function validarReversaoPendente({parcelas=[],documentosFiscais=[],
 titulosFinanceiros=[],conciliacoes=[],pagamentos=[]}={}){
 if(documentosFiscais.length)throw Error("M3C_FISCAL_EXIGE_REVISAO");
 if(titulosFinanceiros.length||conciliacoes.length)
  throw Error("M3C_FINANCEIRO_CONCILIADO_OU_VINCULADO");
 if(parcelas.some(p=>p.status!=="AGUARDANDO_REPASSE"||p.conciliadoEm))
  throw Error("M3C_REPASSE_CONCILIADO_EXIGE_REVISAO");
 if(pagamentos.some(p=>!["PENDENTE","APROVADO"].includes(p.status)))
  throw Error("M3C_PAGAMENTO_NAO_ESTORNAVEL");
 return {aptoParaReversaoInterna:true,reembolsoAutomatico:false,
  dadosExternosVerificadosAutomaticamente:false};
}

/** M.5.39: uma compensação exata para CADA baixa, preservando produto, lote e 1 g. */
export function conferirCompensacoesEstoquePorLote(originais=[],compensacoes=[]){
 if(originais.length!==compensacoes.length)throw Error("M3C_REPLAY_INCONSISTENTE");
 const porOrigem=new Map();
 for(const mov of originais){
  if(!mov.id||porOrigem.has(mov.id))throw Error("M3C_REPLAY_INCONSISTENTE");
  porOrigem.set(mov.id,mov);
 }
 const verificados=new Set();
 for(const estorno of compensacoes){
  const referencia=estorno.observacao?.match(/^Compensa movimento (.+)$/)?.[1];
  const original=porOrigem.get(referencia);
  const emMil=valor=>Math.round(Number(valor)*1000);
  const quantidadeOriginal=original&&emMil(original.quantidade);
  if(!original||verificados.has(referencia)||
     !Number.isSafeInteger(quantidadeOriginal)||quantidadeOriginal<=0||
     quantidadeOriginal!==emMil(estorno.quantidade)||
     original.empresaId!==estorno.empresaId||
     original.produtoId!==estorno.produtoId||
     (original.loteId||null)!==(estorno.loteId||null))
   throw Error("M3C_REPLAY_INCONSISTENTE");
  verificados.add(referencia);
 }
 if(verificados.size!==porOrigem.size)throw Error("M3C_REPLAY_INCONSISTENTE");
 return true;
}
