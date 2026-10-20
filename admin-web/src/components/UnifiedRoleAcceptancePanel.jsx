/** M.5.62 — Staging-only role evidence, without buttons, grants or checkout. */
import {POINTVET_IS_STAGING} from "../lib/stagingEnvironment.js";
import {buildUnifiedRoleAcceptanceMatrix} from "../lib/unifiedRoleAcceptance.js";
import {useAuth} from "../context/AuthContext.jsx";

const answer=value=>value?"Sim":"Não";
const availability=value=>value===null?"Aguardando consulta":value?"Disponível para a empresa atual":"Bloqueado para a empresa atual";

export default function UnifiedRoleAcceptancePanel({availability:serverAvailability}){
 const {user,selectedCompany,selectedOrganization}=useAuth();
 if(!POINTVET_IS_STAGING)return null;
 const matrix=buildUnifiedRoleAcceptanceMatrix({
  user,organization:selectedOrganization,selectedCompany,availability:serverAvailability
 });
 return <section className="panel pv-detail-panel" aria-label="Conferência de perfis de homologação">
  <h2>Homologação de perfis — M.5.62</h2>
  <p><strong>Somente leitura.</strong> Permissões exibidas conforme a sessão autenticada; a API confere todas novamente. Este painel não ativa fechamento, estorno, pagamento nem altera cargos.</p>
  <p>Conta: <strong>{matrix.userName}</strong> · Organização: <strong>{matrix.organizationName}</strong></p>
  {matrix.platformAdmin?<p className="alert alert--error" role="alert">Superadministrador da plataforma: esta sessão não serve como aceite independente de atendente ou supervisor.</p>:<p>Superadministrador da plataforma: não. Confirme também o cargo da pessoa antes de registrar o aceite.</p>}
  <h3>Permissões declaradas por CNPJ na sessão</h3>
  {matrix.companies.length?matrix.companies.map(company=><div className="pv-unified-manual-company" key={company.id}>
   <strong>{company.name}{company.selected?" — empresa selecionada":""}</strong>
   <small>{company.cnpj?"CNPJ: "+company.cnpj:"CNPJ não informado nesta sessão"}</small>
   <p>Acessar PDV: <strong>{answer(company.canAccess)}</strong> · Cancelar venda: <strong>{answer(company.canCancel)}</strong></p>
  </div>):<p className="alert alert--error">Nenhuma empresa desta organização foi encontrada na sessão. Verifique o login antes de testar.</p>}
  <h3>Gates consultados na API</h3>
  <p>Fechamento manual: <strong>{availability(matrix.checkoutAvailable)}</strong> · Estorno de contingência: <strong>{availability(matrix.reversalAvailable)}</strong></p>
  <p><strong>Como validar:</strong> entre separadamente com a conta real de teste de atendente e depois de supervisor; confira os dois CNPJs, troque a empresa selecionada, salve e reabra uma comanda fictícia e registre capturas desta tela. A permissão para cancelar na empresa selecionada NÃO prova autorização para cancelar a comanda inteira: o servidor exige todos os CNPJs. Não registre recebimento externo nem tente estornar na fase somente de simulação.</p>
 </section>;
}
