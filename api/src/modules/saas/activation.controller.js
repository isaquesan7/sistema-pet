/** Tenant-scoped, read-only first-use progress. Never changes clinical records. */
import prisma from "../../config/prisma.js";
export async function activationProgress(req,res,next){
 try {
  const id=req.organizacao.id;
  const [organization,clients,pets,users,staff,products]=await Promise.all([
   prisma.organizacao.findUnique({where:{id},select:{nome:true,configuracao:{select:{telefone:true,whatsapp:true,logoUrl:true}},empresas:{select:{id:true,nomeFantasia:true,ativo:true},take:10},modulos:{select:{modulo:true,habilitado:true,contratado:true}}}}),
   prisma.cliente.count({where:{organizacaoId:id}}),
   prisma.pet.count({where:{cliente:{organizacaoId:id}}}),
   prisma.usuarioOrganizacao.count({where:{organizacaoId:id,ativo:true}}),
   prisma.funcionario.count({where:{organizacaoId:id}}),
   prisma.itemCatalogo.count({where:{empresaId:req.empresa.id}})
  ]);
  const steps=[
   {id:"company",label:"Primeira unidade cadastrada",done:organization.empresas.length>0,href:"/configuracoes"},
   {id:"profile",label:"Contato da organização configurado",done:Boolean(organization.configuracao?.telefone||organization.configuracao?.whatsapp),href:"/configuracoes"},
   {id:"team",label:"Equipe com mais de um usuário",done:users>1,href:"/funcionarios"},
   {id:"clients",label:"Primeiro tutor cadastrado",done:clients>0,href:"/clientes"},
   {id:"pets",label:"Primeiro pet cadastrado",done:pets>0,href:"/pets"},
   {id:"catalog",label:"Primeiro produto ou serviço cadastrado nesta unidade",done:products>0,href:"/catalogo"}
  ];
  res.set("Cache-Control","no-store");
  return res.json({success:true,dados:{organizacao:organization.nome,empresaId:req.empresa.id,steps,completed:steps.filter(s=>s.done).length,total:steps.length,summary:{clients,pets,users,staff,products},modules:organization.modulos.filter(m=>m.habilitado&&m.contratado).map(m=>m.modulo)}});
 }catch(error){next(error);}
}
