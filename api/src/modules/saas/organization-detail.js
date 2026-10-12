/**
 * Read-only platform-wide organization detail, restricted by its mounting route
 * to superadministrators. Aggregate counts are scoped via tenant relations.
 */
import prisma from "../../config/prisma.js";
import {calculatePlanUsage} from "./plan-usage.js";

export async function organizationDetail(req,res,next){
 try{
  const id=req.params.organizacaoId;
  if(typeof id!=="string"||id.length>100)return res.status(400).json({success:false,message:"ID inválido"});
  const organization=await prisma.organizacao.findUnique({
   where:{id},
   select:{id:true,nome:true,slug:true,ativo:true,createdAt:true,
    configuracao:{select:{nomeExibicao:true}},
    assinaturaSaaS:{select:{status:true,ciclo:true,trialFimEm:true,proximaCobrancaEm:true,
     plano:{select:{nome:true,limiteEmpresas:true,limiteUsuarios:true,limiteClientes:true,limitePets:true,limiteFuncionarios:true,modulos:{select:{modulo:true}}}}}},
    empresas:{select:{id:true,nomeFantasia:true,ativo:true,cidade:true,estado:true},orderBy:{nomeFantasia:"asc"}},
    modulos:{select:{modulo:true,habilitado:true,contratado:true}},
    _count:{select:{empresas:true,usuarios:true,clientes:true,funcionarios:true}}
   }
  });
  if(!organization)return res.status(404).json({success:false,message:"Organização não encontrada"});
  // Pet has no direct organizacaoId; its tenant is inherited from Cliente.
  const [pets,activeUsers]=await Promise.all([
   prisma.pet.count({where:{cliente:{organizacaoId:id}}}),
   prisma.usuarioOrganizacao.count({where:{organizacaoId:id,ativo:true}})
  ]);
  res.set("Cache-Control","no-store");
  return res.json({success:true,dados:{...organization,metricas:{
   empresas:organization._count.empresas,usuarios:organization._count.usuarios,
   usuariosAtivos:activeUsers,clientes:organization._count.clientes,
   pets,funcionarios:organization._count.funcionarios
  },consumoPlano:calculatePlanUsage({empresas:organization._count.empresas,usuarios:organization._count.usuarios,clientes:organization._count.clientes,pets,funcionarios:organization._count.funcionarios},organization.assinaturaSaaS?.plano)}});
 }catch(error){next(error);}
}
