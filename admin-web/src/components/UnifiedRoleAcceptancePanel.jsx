/** M.5.63 — Homologação visual somente no staging, lendo autorização atual da API. */
import {POINTVET_IS_STAGING} from "../lib/stagingEnvironment.js";
import {buildUnifiedRoleAcceptanceMatrix} from "../lib/unifiedRoleAcceptance.js";
import {useAuth} from "../context/AuthContext.jsx";

const answer=value=>value?"Sim":"Não";
const availability=value=>value===null?"Aguardando consulta":value?"Disponível para a empresa atual":"Bloqueado para a empresa atual";

export default function UnifiedRoleAcceptancePanel({availability:serverAvailability,onRefresh,refreshing=false,errorMessage=null}){
 const {user,selectedCompany,selectedOrganization}=useAuth();
 if(!POINTVET_IS_STAGING)return null;
 const matrix=buildUnifiedRoleAcceptanceMatrix({
  user,organization:selectedOrganization,selectedCompany,availability:serverAvailability
 });
 return <section className="panel pv-detail-panel" aria-label="Conferência de perfis de homologação">
  <h2>Homologação de perfis — M.5.63</h2>
  <p><strong>Somente leitura.</strong> A API consulta agora os vínculos e permissões dos cargos no banco para cada CNPJ acessível. O nome da conta vem da sessão; esta tela não concede permissões, não fecha vendas nem registra estornos.</p>
  <p>Conta: <strong>{matrix.userName}</strong> · Organização: <strong>{matrix.organizationName}</strong></p>
  <button type="button" className="ghost-button" disabled={refreshing||typeof onRefresh!=="function"} onClick={onRefresh}>
   {refreshing?"Atualizando permissões...":"Atualizar permissões da API"}
  </button>
  {errorMessage&&<p className="alert alert--error" role="alert">Não foi possível conferir permissões atuais: {errorMessage}</p>}
  {!matrix.verified?<p className="alert" role="status">Permissões não verificadas. Aguarde a resposta da API ou atualize novamente; não utilize dados anteriores como aceite.</p>:<>
   <p>Papel na organização: <strong>{matrix.organizationRole||"Não informado"}</strong></p>
   {matrix.platformAdmin?<p className="alert alert--error" role="alert">Superadministrador da plataforma: esta sessão não serve como aceite independente de atendente ou supervisor.</p>:<p>Superadministrador da plataforma: não. O aceite requer contas de atendente e supervisor autenticadas separadamente.</p>}
   {matrix.organizationRole!=="MEMBRO"&&<p className="alert alert--error" role="alert">Para aceitar os perfis operacionais M.5.61, use contas com papel MEMBRO (não apenas uma conta administradora).</p>}
   <h3>Permissões atuais por CNPJ, segundo a API</h3>
   {matrix.companies.length?matrix.companies.map(company=><div className="pv-unified-manual-company" key={company.id}>
    <strong>{company.name}{company.selected?" — empresa selecionada":""}</strong>
    <small>{company.cnpj?"CNPJ: "+company.cnpj:"CNPJ não informado"}</small>
    <p>Acessar PDV: <strong>{answer(company.canAccess)}</strong> · Cancelar venda: <strong>{answer(company.canCancel)}</strong></p>
   </div>):<p className="alert alert--error">Nenhuma empresa habilitada para esta conta nesta organização.</p>}
   <h3>Gates consultados na API</h3>
   <p>Fechamento manual: <strong>{availability(matrix.checkoutAvailable)}</strong> · Estorno de contingência: <strong>{availability(matrix.reversalAvailable)}</strong></p>
  </>}
  <p><strong>Como validar:</strong> entre separadamente com a conta real de teste de atendente e depois de supervisor; confira os dois CNPJs, troque a empresa selecionada, use “Atualizar permissões da API” e registre capturas da tela. A permissão para cancelar na empresa selecionada NÃO prova autorização para cancelar a comanda inteira: o servidor exige todos os CNPJs. Não registre recebimento externo nem tente estornar na fase somente de simulação.</p>
 </section>;
}
