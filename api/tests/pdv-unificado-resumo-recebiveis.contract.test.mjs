import {test} from "node:test";
import assert from "node:assert/strict";
import {consolidarRecebiveisCartaoM56} from "../src/modules/pdv/pdv-unificado-resumo-recebiveis.contract.js";
const context=()=>({organizacaoId:"org1",empresaId:"co1",comandaId:"cmd1"});
function fixture(){
 const p=[1,2,3].map(i=>({id:"part"+i,linhaId:"line1",indice:i,quantidadeTotal:3,
  valor:"60.00",status:"AGUARDANDO_REPASSE",conciliadoEm:null}));
 return {...context(),linhas:[{id:"line1",forma:"CARTAO_CREDITO",parcelas:3,
  valor:"180.00",pagamentoId:"payment1",
  pagamento:{id:"payment1",forma:"CARTAO_CREDITO",status:"PENDENTE",
   vendaId:"sale1",valor:"180.00",parcelas:3},
  registro:{status:"REGISTRADO"},comandaStatus:"FECHADA",
  operacao:{empresaId:"co1",vendaId:"sale1",status:"CONCLUIDA",
   reserva:{comandaId:"cmd1",status:"RESERVADA"},
   venda:{id:"sale1",empresaId:"co1",status:"FINALIZADA"}},
  parcelasRecebiveis:p}],auditorias:[]};
}
function settled(f,id="part1"){
 const p=f.linhas[0].parcelasRecebiveis.find(x=>x.id===id);
 p.status="CONCILIADA";p.conciliadoEm=new Date("2026-10-15T12:00:00Z");
 f.auditorias.push({entidade:"ParcelaRecebivelManualUnificado",entidadeId:id,
  acao:"REPASSE_CARTAO_CONCILIADO_MANUAL_CI",organizacaoId:"org1",empresaId:"co1",
  dadosNovos:{status:"CONCILIADA",confirmouRepasseExterno:true,
   provaBancariaIndependente:false,origem:"DECLARACAO_DO_OPERADOR",
   valorCentavos:6000,referenciaExterna:"CI-REPASS-01",
   contaFinanceiraId:"bank1",fingerprint:"f".repeat(64)}});
}
test("M5.6 pending, partial and full operator-declared settlement totals",()=>{
 const f=fixture();
 const start=consolidarRecebiveisCartaoM56(f);
 assert.deepEqual(start.totais,{original:"180.00",pendente:"180.00",
  conciliadoDeclarado:"0.00",estornado:"0.00"});
 assert.equal(start.linhas[0].situacao,"AGUARDANDO_REPASSE");
 settled(f);const partial=consolidarRecebiveisCartaoM56(f);
 assert.equal(partial.totais.pendente,"120.00");
 assert.equal(partial.totais.conciliadoDeclarado,"60.00");
 assert.equal(partial.linhas[0].situacao,"REPASSE_PARCIAL_DECLARADO");
 settled(f,"part2");settled(f,"part3");
 const full=consolidarRecebiveisCartaoM56(f);
 assert.equal(full.totais.conciliadoDeclarado,"180.00");
 assert.equal(full.totais.pendente,"0.00");
 assert.equal(full.linhas[0].situacao,"REPASSE_INTEGRAL_DECLARADO");
 assert.equal(full.provaBancariaIndependente,false);
 assert.equal(full.gerouPagamento,false);assert.equal(full.autorizarProducao,false);
 assert.equal(full.statusPagamentoAlterado,false);
});
test("M5.6 double counted, orphan audit, missing proof or unauthorized company fail closed",()=>{
 const f=fixture();settled(f);
 const cases=[
  ()=>f.auditorias.push({...f.auditorias[0]}),
  ()=>f.auditorias[0].empresaId="co2",
  ()=>f.auditorias[0].dadosNovos.valorCentavos=5999,
  ()=>f.linhas[0].parcelasRecebiveis[1].indice=1,
  ()=>f.linhas[0].parcelasRecebiveis[0].status="AGUARDANDO_REPASSE",
  ()=>f.linhas[0].operacao.empresaId="co2",
  ()=>f.linhas[0].pagamento.status="APROVADO"
 ];
 for(const change of cases){
  const before=structuredClone(f);
  change.call(null);
  assert.throws(()=>consolidarRecebiveisCartaoM56(f),/M56_/);
  Object.assign(f,before);
 }
});
test("M5.6 forbids partial reversals; allows fully reversed cards with no false proceeds",()=>{
 const f=fixture();
 f.linhas[0].parcelasRecebiveis.forEach(p=>p.status="ESTORNADA");
 f.linhas[0].pagamento.status="ESTORNADO";
 f.linhas[0].operacao.status="ESTORNADA";
 f.linhas[0].operacao.venda.status="ESTORNADA";
 f.linhas[0].operacao.reserva.status="CANCELADA";
 f.linhas[0].comandaStatus="CANCELADA";
 const out=consolidarRecebiveisCartaoM56(f);
 assert.equal(out.totais.estornado,"180.00");
 assert.equal(out.totais.conciliadoDeclarado,"0.00");
 assert.equal(out.linhas[0].situacao,"ESTORNADO");
 f.linhas[0].parcelasRecebiveis[0].status="AGUARDANDO_REPASSE";
 assert.throws(()=>consolidarRecebiveisCartaoM56(f),/M56_/);
});
test("M5.6 empty company summary is zero and read-only",()=>{
 const r=consolidarRecebiveisCartaoM56({...context(),linhas:[],auditorias:[]});
 assert.equal(r.totais.original,"0.00");
 assert.deepEqual(r.linhas,[]);
 assert.equal(r.leituraSomente,true);
});
