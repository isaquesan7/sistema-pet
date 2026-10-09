# PetRise — Hotfix 14.1 — Relatórios resilientes

## Motivo
A Fase 14 agregava Vendas, Clientes, Operação, Estoque, Financeiro e Fiscal no mesmo endpoint. Uma falha em qualquer consulta fazia `Promise.all` rejeitar e a rota inteira `/api/relatorios/painel` respondia HTTP 500, deixando a tela toda vazia.

Isso é especialmente sensível em desenvolvimento com PostgreSQL remoto e também quando alguma migration anterior ainda não foi aplicada no banco.

## Correções
- Cada seção do relatório agora é isolada com tratamento próprio de erro.
- A tela continua carregando os demais indicadores quando uma seção específica falha.
- As consultas de grandes blocos passaram a ser executadas por seção, reduzindo picos simultâneos de acesso ao PostgreSQL remoto.
- Erros Prisma P2021/P2022 geram aviso de migration/tabela/coluna pendente sem derrubar a tela inteira.
- Fiscal possui leitura compatível com a estrutura fiscal legada quando a coluna `simulado` ainda não existe.
- O backend registra no terminal exatamente qual seção falhou: `[Relatórios:<seção>] falha isolada`.
- O frontend exibe um aviso amarelo com a seção indisponível em vez de `Erro interno do servidor` para toda a página.

## Banco de dados
Não há migration nova neste hotfix.

Se o aviso indicar coluna/tabela pendente, execute na API:

```powershell
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
```

## Teste
1. Reinicie API e admin-web.
2. Abra Relatórios.
3. Teste Este mês e Hoje.
4. Teste cada aba.
5. Se aparecer aviso amarelo, confira o terminal; ele agora mostra qual seção e o código Prisma exatos.
