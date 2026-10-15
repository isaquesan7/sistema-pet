# PointVet M.5.25 — snapshot único e autorização atômica do diagnóstico de devoluções

## Problema corrigido
A M.5.24 reunia o fluxo de repasses M.5.16 e o histórico de declarações externas M.5.23 por meio de **duas transações RepeatableRead independentes**. Uma declaração de devolução ou correção interna concorrente poderia ser confirmada entre as consultas, produzindo divergência (409) mesmo sem corrupção dos dados. Uma comparação eventual de fontes independentes não era uma garantia de snapshot comum.

## Implementação (sem novas operações econômicas)
- A função `consultarDiagnosticoDevolucoesM524` agora usa **uma única** transação Prisma com isolamento `RepeatableRead`. A autorização M.5.7 (`usuario ATIVO`, organização e empresa ativas, associação, `financeiro.gerenciar`, preferência opt-in e comanda da organização) ocorre **dentro da mesma transação** das duas projeções e do confronto M.5.24.
- Três funções internas reutilizáveis recebem o cliente transacional já aberto: `consultarRecebiveisCartaoEmTransacaoM57`, `projetarEtapasRepassesEmTransacaoM516`, `projetarHistoricoDevolucoesEmTransacaoM523`. As funções públicas anteriores M.5.7, M.5.16 e M.5.23 preservam assinatura/saída e sua autorização. As projeções internas **não** são rotas HTTP nem contornam a autorização; quem as usar precisa executar M.5.7 dentro da mesma transação.
- Todas as leituras do diagnóstico M.5.24 compartilham o mesmo estado confirmado do PostgreSQL. Alterações que chegam após o snapshot somente aparecerão em consulta posterior; nenhuma confirmação financeira é inferida do relatório. Permanece rejeição `M524_*` por divergências reais, fontes adulteradas, limites excedidos e dados multiempresa incompatíveis.
- Endpoint permanece **GET**, `Cache-Control:no-store`, mesmas permissões, mesmos status HTTP e apresentação no Financeiro. Nenhuma mudança de schema/migration, criação de pagamento, entrada/saída, baixa, caixa, título, documento fiscal, integração bancária, TEF/PSP/maquininha ou reembolso.

## Aceite e evidência
- Testes de contrato M.5.16, M.5.23 e M.5.24, sintaxe dos serviços e `git diff --check` locais.
- `api/tests/pdv-unificado-integration.test.mjs`: diagnóstico em PostgreSQL **descartável CI** sem lançamento externo, leitura repetida estável e sem mutação de preparação/devolução/conciliação/auditoria; hash muda ao declarar R$20 de R$60, e novamente ao declarar R$40 restantes; nega acesso a organização cruzada e preserva estados de compensação.
- CI oficial: verificar **os dois jobs `validate` e `isolated-postgres` no mesmo SHA final** antes de marcar M.5.25 validada; teste de backup/restore é **sintético** e não prova restauração do banco Pet King.

## Limites e próximos gates
Snapshot único garante uma **leitura coerente**, não autenticidade de comprovante bancário, nem garantia de que um futuro comando de escrita continua atualizado; operações de escrita requerem revalidação própria com lock e versão financeira. Mantêm-se pendentes conferência HUMANA independente de comprovantes externos e histórico de devoluções, matriz fiscal/contábil por emissor, tratamento de taxas/antecipação/estorno, staging REAL segregado apenas com autorização específica, backup/restore e rollback reais, revisão LGPD e piloto opt-in.

**PR #36 permanece DRAFT e checkout unificado desabilitado.** Sem merge, deploy, migração de produção, modificação de `main`, Railway, Pet King, banco, adquirente, Open Finance, PSP, TEF ou maquininha.
