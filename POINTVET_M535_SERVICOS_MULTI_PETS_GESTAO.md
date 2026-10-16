# PointVet M.5.35 — Serviços repetidos para pets diferentes na mesma comanda

Data: 16/10/2026. Issue #37, PR #36 Draft.

## Problema de gestão

Antes da M.5.35, **Adicionar** no catálogo sempre agrupava linhas com o mesmo `itemCatalogoId`, inclusive serviços. Em uma clínica ou banho e tosa, isso impedia colocar dois banhos para **Bela** e **Tico**, pets do mesmo tutor, na mesma comanda. A atualização de pet, quantidade ou remoção identificava a linha apenas pelo catálogo e afetaria ambas após reabrir uma comanda com serviço duplicado.

## Correção funcional

- Produtos do mesmo catálogo **e empresa** continuam somando quantidade em uma linha.
- Cada adição de serviço (`tipo=SERVICO`) cria uma **nova linha independente**, mesmo quando os demais campos do catálogo coincidem. Essa linha recebe uma chave estável `nova:N`; linhas salvas usam `persistida:<id da ComandaItem>`.
- Pet (obrigatório ou opcional conforme o cadastro do serviço), quantidade e remoção alteram só a linha escolhida. Nunca usar `itemCatalogoId` como identidade de linha na interface.
- `listarRascunhos` devolve o `tipo` real do item de catálogo nas linhas previamente autorizadas, além do snapshot de M.5.34. A retomada preserva duas ocorrências do mesmo serviço, seus pets, quantidades e identificadores persistidos.
- O servidor continua exigindo pet ativo do **mesmo tutor/organização** quando fornecido e pet obrigatório para serviços marcados com `exigePet`, recalculando todos os valores. Uma seleção local **não** substitui a autorização nem o pré-fechamento do backend.

## Regressões

1. Teste puro `api/tests/pdv-unificado-servicos-multiplos-pets.contract.test.mjs`: serviço repetido cria duas linhas; edição e exclusão por chave não tocam a segunda; produto repetido agrega; a reabertura mantém duas linhas persistidas para pets distintos.
2. Integração PostgreSQL **descartável** `api/tests/pdv-unificado-integration.test.mjs`: dois pets reais do mesmo tutor na fixture, mesmo serviço com duas quantidades, simulação e rascunho em duas linhas, pré-fechamento sem pendências e total exato, recusa de pet estranho e checkout falso.
3. Build React e testes do workflow `PointVet Unified PDV Foundation` no SHA exato; até a conclusão da execução CI, **resultado remoto pendente**.

## Limites inalterados

Sem novo endpoint, migration, venda, cobrança, baixa de estoque, lançamento financeiro, PSP/maquininha, motor fiscal ou conexão externa. O PDV Unificado continua em **simulação e preparação**, sem checkout real. A primeira publicação planejada é de **gestão** e não depende de integrar emissor fiscal, mas o processo externo de cumprimento fiscal/contábil aplicável segue gate operacional humano. PRs #35/#36 Draft; nada de merge/deploy/main/produção Pet King/Railway, staging/restore real ou piloto sem autorização.
