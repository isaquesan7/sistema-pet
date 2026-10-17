# PointVet M.5.4.3 — barreira HTTP pré-publicação em PostgreSQL isolado

**Escopo:** teste de segurança operacional do PDV Unificado real (Express), exclusivo da pipeline de CI; não é homologação de staging nem autorização para publicar.

## Evidência executável
- `api/tests/pointvet-m543-http-checkout-barrier.integration.test.mjs`: executa apenas com `GITHUB_ACTIONS=true`, `NODE_ENV=test`, `POINTVET_UNIFIED_SALES_SANDBOX=1` e a URL **exata** `pointvet_unified_ci`, depois confirma `current_database()` e `current_user`.
- Cria exclusivamente duas organizações e duas empresas **sintéticas** no banco descartável, uma assinatura ativa sintética e um operador vinculado somente à empresa A. Token de teste local com segredo CI substituído/restaurado em memória; jamais usa login, segredo, token ou cliente de produção.
- Abre a aplicação Express real somente em `127.0.0.1` numa porta efêmera; cobre GET/POST das rotas protegidas sem token, token de usuário inexistente, falta de `X-Empresa-Id`, empresa fora do vínculo e permissão normal na empresa A.
- Mesmo com preferência de visualização habilitada, a disponibilidade informa `checkoutUnificadoDisponivel=false` e `modoEfetivo=INDIVIDUAL`, e o usuário não consegue acessar empresa B.
- Bloqueia regressões que exponham rotas hipotéticas de checkout/efetivação `/checkout`, `/finalizar`, `/rascunhos/:id/executar` e `/pagamentos`: devem permanecer 404 autenticadas até que novos contratos de segurança sejam homologados.
- Ao desligar a preferência de PDV Unificado, confirma indisponibilidade de listagem, simulação e criação de rascunho (403).
- Confere igualdade de contagens de `Venda`, `Pagamento`, `MovimentacaoCaixa`, `MovimentacaoEstoque`, `DocumentoFiscal`, `CreditoClienteMovimento` e `ReservaFechamentoUnificado` antes/depois.
- Integra a pipeline `.github/workflows/pointvet-unified-pdv-foundation.yml` no job `isolated-postgres`, após smoke M.5.3 e antes do ensaio sintético de backup/restauração M.5.1.

## Limites e gates restantes
Os testes não simulam o checkout real pela web; não validam integração fiscal oficial, recebimentos reais, orçamento/crédito comerciais, concorrência com serviços externos, DNS/TLS de staging, RTO/RPO real, rollback de release nem operação de usuários-piloto. Não criam nem alteram infraestrutura Railway, Resend, R2, Hostinger, Pet King ou domínio público.

**Próximo:** confirmar no SHA exato os jobs `validate` e `isolated-postgres`. Com autorização separada, prover e homologar staging **efetivamente segregado** usando dados sintéticos, antes de qualquer decisão sobre restauração de backup real ou canário opt-in. Não mesclar PR #36, não alterar `Empresa.cnpj @unique`, não liberar fiscal real nem maquininha/PSP. O fechamento MANUAL multiempresa permanece a direção oficial.
