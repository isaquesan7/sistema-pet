/**
 * M.5.63 — Evidência somente-leitura de permissões efetivas, consultadas na API
 * (banco/cargo/vínculo ativos). Nunca usa permissões potencialmente obsoletas
 * da sessão; esta função não concede acesso nem substitui a autorização da API.
 */
export function buildUnifiedRoleAcceptanceMatrix({user,organization,selectedCompany,availability}={}){
 const verified=Boolean(organization?.id&&selectedCompany?.id&&
  availability?.contextoAcesso?.organizacaoId===organization.id&&
  availability?.contextoAcesso?.empresaId===selectedCompany.id&&
  Array.isArray(availability.permissoesEmpresas)&&availability.perfilAcesso);
 const companies=verified?availability.permissoesEmpresas
  .filter(company=>Boolean(company?.id))
  .map(company=>({
   id:company.id,
   name:company.nomeFantasia||"Empresa sem nome",
   cnpj:company.cnpj||null,
   selected:company.id===selectedCompany?.id,
   canAccess:company.pdvAcessar===true,
   canCancel:company.pdvCancelarVenda===true
  })):[];
 return {
  verified,
  userName:user?.nome||"Conta não identificada",
  platformAdmin:verified?availability.perfilAcesso.superAdmin===true:null,
  organizationRole:verified?availability.perfilAcesso.papelOrganizacao||null:null,
  organizationName:organization?.nomeExibicao||organization?.nome||"Organização não selecionada",
  companies,
  // Gates sempre específicos à empresa selecionada no momento da consulta.
  checkoutAvailable:verified?Boolean(availability.checkoutUnificadoDisponivel):null,
  reversalAvailable:verified?Boolean(availability.estornoUnificadoDisponivel):null
 };
}
