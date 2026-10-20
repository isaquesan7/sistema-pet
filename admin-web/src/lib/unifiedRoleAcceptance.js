/**
 * M.5.62 — Read-only staging evidence of permissions already present in the
 * authenticated session. This is never a grant or server authorization check:
 * every API request still revalidates tenant, company and cargo permissions.
 */
export function buildUnifiedRoleAcceptanceMatrix({user,organization,selectedCompany,availability}={}){
 const organizationId=organization?.id;
 const companies=(Array.isArray(user?.empresas)?user.empresas:[])
  .filter(company=>Boolean(organizationId)&&company?.organizacaoId===organizationId)
  .map(company=>{
   const permissions=Array.isArray(company.permissoes)?company.permissoes:[];
   return {
    id:company.id,
    name:company.nomeFantasia||company.razaoSocial||company.nome||"Empresa sem nome",
    cnpj:company.cnpj||null,
    selected:company.id===selectedCompany?.id,
    canAccess:permissions.includes("pdv.acessar"),
    canCancel:permissions.includes("pdv.cancelar_venda")
   };
  });
 return {
  userName:user?.nome||"Conta não identificada",
  platformAdmin:Boolean(user?.superAdmin),
  organizationName:organization?.nomeExibicao||organization?.nome||"Organização não selecionada",
  companies,
  // Availability is scoped to the currently selected company on the API.
  checkoutAvailable:availability==null?null:Boolean(availability.checkoutUnificadoDisponivel),
  reversalAvailable:availability==null?null:Boolean(availability.estornoUnificadoDisponivel)
 };
}
