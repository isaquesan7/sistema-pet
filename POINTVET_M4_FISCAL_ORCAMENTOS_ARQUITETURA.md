# PointVet — M.4A: arquitetura de Orçamentos, PDV e Fiscal
**Revisão:** 14/10/2026. **Ramo oficial:** \`feat/pointvet-20-1-unified-pdv-foundation\` (PR #36). **Issue #37** é a fonte principal do handoff. Base importada do PR #35 foi adaptada, não há merge entre PRs.

## 1. Implementado apenas na branch de testes, não liberado à Pet King
- Orçamentos associados a **uma** organização, **uma** empresa/CNPJ e um tutor. Itens e pets são verificados, preços preservados em centavos, quantidades em milésimos, aprovação serializável e auditada.
- Ficha do tutor tem aba de orçamentos e consulta do crédito pré-pago (separado de contas a receber). A carteira ainda **não permite entradas, utilização ou saque**; estorno de crédito sem vínculo causal torna saldo indisponível.
- API **somente leitura** \`POST /api/clientes-financeiro/:clienteId/orcamentos/:id/preview-pdv\`: exige \`financeiro.visualizar\` e \`pdv.acessar\`, orçamento aprovado na empresa selecionada e mapeamento explícito de **cada** item livre para item do catálogo, com mesma descrição, valor unitário, quantidade e total. Recalcula usando a simulação real do PDV. Não aceita desconto > 0 no estágio atual, item de outro CNPJ, orçamento vencido nem preços desatualizados.
- A resposta \`PREVIA_ORCAMENTO_SEM_CONVERSAO\` é um **diagnóstico visual sem efeitos**: \`podeCriarRascunho=false\`, \`podeFecharVenda=false\`, \`podeUsarCredito=false\`, sem venda, pagamento, reserva, estoque ou fiscal. Ainda não há seleção de mapeamento na interface; a API foi preparada para integração UI posterior.
- Proteção do PDV Unificado opcional (ativação por organização), legado e pagamentos manuais sem maquininha/PSP preservados.

## 2. Fiscal: fronteira técnica obrigatória
O módulo fiscal **legado** já contém validações para \`NFE\`, \`NFCE\`, \`NFSE\`, \`RECIBO\` e cadastro \`ConfiguracaoFiscalEmpresa\`. **Não significa que o fechamento unificado em CI emite documentos válidos.** Todo procedimento fiscal deve partir da **Venda filha da empresa emissora**, nunca da soma da comanda de vários CNPJs.

Antes de habilitar emissão no PDV Unificado:
1. **Matriz produto/serviço/documento por empresa/UF/município:** checar tipos aceitos, regime, código do serviço, NCM/CFOP/CST quando aplicável e requisitos atuais com a área fiscal responsável. Não supor que um recibo substitui documento fiscal exigível.
2. **Pré-conferência segregada:** cada venda filha deve manter \`empresaId\`, emissor fiscal, dados do cliente e itens originais; documentação de uma empresa não pode conter itens de outra.
3. **Mistura de produtos e serviços:** decidir explicitamente quais documentos são necessários e como ratear desconto/valores quando aplicável, sem nota única multiempresa. Reaproveitar as verificações do módulo legado com testes de fronteira.
4. **Autorização externa e evidência:** preparar, transmitir, consultar autorização/rejeição, armazenar protocolo/chave/arquivos seguros, contingência, inutilização/cancelamento e retentativas idempotentes. **Sem status "emitida" por simples intenção**. Provedores fiscais não se confundem com provedor de pagamento; nenhuma integração de maquininha é requerida.
5. **Estorno com documento emitido:** M.3C hoje **bloqueia** estorno automático ao identificar \`DocumentoFiscal\`; futuras compensações fiscais exigem processo formal por documento/empresa antes de restituir estoque, dinheiro ou crédito.
6. **Homologação local:** testes técnicos, regras de município/UF e autorização com credenciais de ambiente homologado, sem certificados reais em CI.

## 3. Mesmo CNPJ com múltiplas unidades
\`Empresa.cnpj @unique\` hoje equipara CNPJ a empresa/loja e impede cadastrar várias unidades sob a mesma pessoa jurídica. **Não retirar o índice sem redesign**.
- Próximo design propõe \`EntidadeFiscal\` (CNPJ, cadastro tributário, documentos, séries/certificados) + \`UnidadeOperacional\` (filial/loja/caixa/estoque/equipe) + vínculos de acesso, preservando \`organizacaoId\`.
- Uma mesma entidade fiscal poderá ter várias unidades **somente se permitido pelo cadastro e regras tributárias**; a segregação operacional não pode fingir vários emissores distintos.
- Fazer migração de dados retrocompatível, resolver cadastros e checar pertencimento por organização, índices de unicidade e rollback antes de alterar \`Empresa\`. Histórico antigo de vendas/documentos mantém emissor original.
- Contas, estoque e sessões de caixa seguem por unidade definida; autorização fiscal por entidade emissora e responsabilidades de caixa não se misturam.

## 4. Plano oficial M.4B e M.5 — NÃO INICIAR EM PRODUÇÃO
**M.4B:**
- Introduzir vínculo opcional porém confiável de item de orçamento ao catálogo e atualização concorrente; aprovação do tutor versus aprovação administrativa; validação de desconto, preço e validade; UX de seleção e aprovação.
- Permitir \`orçamento aprovado → rascunho PDV\` com chave idempotente, vínculo único, revisão por caixa/empresa e nenhuma duplicação; depois disso, a reserva/fechamento continua dependente dos gates M.3/M.4.
- Razão \`CreditoClienteMovimento\` com origem comprovada de pagamento externo, estorno causal, referências por empresa, concorrência \`Serializable\`, saldo não negativo, trilha imutável e consentimento explícito para gastar; não usar \`CREDITO_CLIENTE\` como forma de pagamento antes de todos os testes e permissões.
- Plano fiscal real e matriz de cenários por empresa; separar validação/preparo de transmissão/autorização.
**M.5:** validar restore real de backup em banco separado, política de migrações, staging, rollback e canário por organização, telemetria, suporte e autorização do proprietário antes da publicação.

## 5. Gates e integridade
A presença das rotas no código deste PR DRAFT **não autoriza acesso em produção**: não fazer merge/deploy nem executar migrations reais. Sem integração PSP de pagamento. Tests devem validar zero \`Venda\`/\`Pagamento\`/\`MovimentacaoEstoque\`/\`DocumentoFiscal\` na aprovação e na prévia de orçamento, isolamento por tenant, preço alterado, mapeamento, concorrência, crédito somente consulta.

**Handoff:** conferir SHA exato e GitHub Actions (\`validate\`, \`isolated-postgres\`) **após cada commit**. Issue #37 e PR #36 guardam a sequência. PR #35 não foi mesclado e deve continuar histórico isolado até decisão explícita de fechamento.


## 6. M.4B.1 — vínculo idempotente somente na base CI
Já implementados: `ConversaoOrcamentoPdv` (unique orçamento/comanda, operador, fingerprint e snapshot), `ConversaoOrcamentoPdvItem` (vínculo imutável a cada item/catálogo), transação de conversão CI com lock de orçamento e validação via simulação do PDV, e drawer de pesquisa/mapeamento do catálogo na ficha do tutor **apenas para prévia**. O serviço de conversão **não possui rota HTTP**; nenhuma migração ou checkout na produção. Próximos gates: razão causal de crédito pré-pago; distribuição/auditoria de descontos; segregação fiscal e modelo mesmo CNPJ/unidades; homologação de backup/restauração e rollout M.5. Não incluir integração de maquininha ou PSP.


## 7. M.4B.2 — Crédito pré-pago com causa e comprovante contábil
A `CreditoClienteMovimento` ganhou campos de prova `conciliacaoId`, reversão única `reverteMovimentoId`, autor, fingerprint e snapshot. O saldo público é **somente leitura** e só é considerado confiável se houver rastro contábil atual, inclusive título de adiantamento, baixa e conciliação de entrada na conta da própria empresa; mudança das evidências invalida o saldo. Entradas e estornos podem ser simulados só no PostgreSQL CI; qualquer utilização é teste contábil, não pagamento. Um estorno de entrada exige confirmação humana de devolução externa, mas não realiza Pix, banco ou maquininha. Para liberar crédito real será necessário conciliar a devolução financeira, vincular uso do crédito à venda e cumprir gates fiscais e M.5. `CREDITO_CLIENTE` permanece bloqueado.


## 8. M.4B.3 — comprovação contábil da devolução, sem transmissão
Antes de fazer baixa causal de crédito de cliente, a M.4B.3 exige conciliação preexistente `BAIXA_TITULO/SAIDA` de uma baixa integral de título PAGAR/PAGO `DEVOLUCAO ADIANTAMENTO CLIENTE`; vínculo é único e auditado, com nova verificação das fontes em cada consulta. Esta conciliação foi registrada pelo operador, não é prova independente bancária; nada transfere dinheiro, nenhum meio de pagamento é integrado ao crédito no PDV. Próximo M.4C: arquitetura fiscal por empresa emissora, classificação produto/serviço, documento fiscal e permissões por unidade/CNPJ, sem presumir regulamentação aplicável; ver documento de devoluções e handoff oficial.
