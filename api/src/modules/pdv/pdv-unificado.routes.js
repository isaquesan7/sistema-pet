/** Phase 20.1: read-only eligibility; no payment, sale or stock mutation. */
import {Router} from "express";
import prisma from "../../config/prisma.js";
import {autenticarUsuario,selecionarEmpresa,exigirModulo,exigirPermissao} from "../../middlewares/auth.middleware.js";
const r=Router();
r.use(autenticarUsuario,selecionarEmpresa,exigirModulo("PDV"),exigirPermissao("pdv.acessar"));
r.get("/disponibilidade",async(req,res,next)=>{
 try{
  const access=await prisma.usuarioEmpresa.findMany({where:{usuarioId:req.usuario.id,ativo:true,empresa:{ativo:true,organizacaoId:req.organizacao.id}},select:{empresaId:true,empresa:{select:{id:true,nomeFantasia:true,cnpj:true,tipo:true}}}});
  const pdvHabilitado=Boolean(req.organizacao.configuracao?.pdvUnificadoHabilitado);
  return res.json({success:true,dados:{
   preferenciaUnificado:pdvHabilitado,checkoutUnificadoDisponivel:false,
   modoEfetivo:"INDIVIDUAL",
   empresasAcessiveis:access.map(v=>v.empresa),
   aviso:"O PDV individual permanece em uso até a homologação do fechamento multiempresa."
  }});
 }catch(error){next(error);}
});
export default r;
