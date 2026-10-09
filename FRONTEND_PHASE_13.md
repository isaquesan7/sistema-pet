# PetRise — Fase 13 — Fiscal

## O que entrou

### Correção definitiva da marca
- O componente visual principal ainda montava o nome antigo em JSX dividido, por isso buscas pelo texto completo não o encontravam.
- `BrandMark.jsx` agora renderiza `PetRise`.
- Foi feita uma varredura textual pela marca anterior no projeto ativo e não restaram ocorrências.
- A documentação histórica da Fase 10 também foi neutralizada para não manter a marca anterior no repositório atual.

### Configuração fiscal por CNPJ
- Regime tributário.
- Ambiente `HOMOLOGACAO` ou `PRODUCAO`.
- Provedor fiscal e referência da conta no provedor.
- Séries separadas para NF-e, NFC-e e NFS-e.
- Código IBGE do município.
- Natureza da operação padrão.
- Referência e validade de certificado.
- Documento padrão e criação automática da fila após vendas.

### Tributação do catálogo
Produtos:
- NCM;
- CEST;
- CFOP;
- origem da mercadoria;
- CST/CSOSN;
- alíquota ICMS.

Serviços:
- código de serviço municipal;
- alíquota ISS.

O painel mostra itens prontos e pendentes por CNPJ.

### Vendas e documentos
- Vendas finalizadas aparecem na área Fiscal.
- NF-e/NFC-e usam apenas linhas de produto.
- NFS-e usa apenas linhas de serviço.
- Venda mista pode gerar documentos separados, sem misturar os tipos de operação.
- Desconto/acréscimo global da venda é rateado proporcionalmente no valor estimado de cada documento.
- Cada documento guarda snapshots do destinatário, itens e pagamentos para auditoria.
- Histórico de tentativas, mensagem de erro, protocolo e referência do provedor.

### Fila e processamento
Status suportados:
- `PENDENTE`
- `PROCESSANDO`
- `AUTORIZADO`
- `REJEITADO`
- `ERRO`
- `CANCELADO`

O provedor `development` pode ser usado **somente em HOMOLOGAÇÃO** para simular o fluxo de autorização. O documento recebe marca explícita de simulação e nenhuma chave fiscal oficial é fabricada.

Em `PRODUCAO`, o simulador é bloqueado. Se um provedor real for informado mas ainda não houver adaptador conectado, o PetRise registra o erro e não afirma que houve autorização.

### Recibo interno
- Pode ser gerado pelo próprio PetRise.
- É identificado como **recibo interno**.
- A interface avisa que ele não substitui NF-e/NFC-e/NFS-e quando a legislação exigir documento fiscal.

### Integração com PDV
- Se `emissaoAutomaticaVenda` estiver ligada e houver um `tipoDocumentoPadrao`, toda venda finalizada tenta criar um documento `PENDENTE` na fila Fiscal.
- A venda continua sendo concluída mesmo se a preparação fiscal falhar; a pendência permanece visível para correção.
- Venda com documento `AUTORIZADO` não pode ser cancelada no PDV até o documento correspondente ser cancelado.

## Segurança e limites desta fase

A Fase 13 deliberadamente não armazena token/senha de provedor fiscal em campos comuns do banco e não simula autorização oficial em Produção.

A transmissão oficial depende da escolha do provedor fiscal (por exemplo, um serviço homologado que atenda a UF e/ou prefeitura do CNPJ), credenciais e regras locais. O core do PetRise está preparado para receber esse adaptador sem acoplar PDV, Financeiro ou Catálogo ao fornecedor externo.

## Novas permissões

- `fiscal.visualizar`
- `fiscal.gerenciar`
- `fiscal.emitir`
- `fiscal.cancelar`

O seed atribui automaticamente as novas permissões aos cargos `Administrador` existentes.

## Migration

Nova migration:

`20261009030000_fiscal_operations`

Ela amplia:
- `configuracoes_fiscais_empresas`;
- `documentos_fiscais`.

A base fiscal existente é preservada.

## Aplicação

Preserve `api/.env` e faça snapshot do PostgreSQL antes da migration.

```powershell
cd api
npm ci
npx prisma validate
```

Somente se o schema for validado:

```powershell
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm run dev
```

Em outro terminal:

```powershell
cd admin-web
npm ci
npm run dev
```

Depois do `db:seed`, faça logout/login para o token/contexto carregar as novas permissões.

## Checklist recomendado

1. Abra `Fiscal > Configuração` no CNPJ desejado.
2. Para teste, selecione `HOMOLOGACAO`, provedor `development` e série `1`.
3. Salve a configuração.
4. Em `Fiscal > Tributação`, configure um produto de teste e/ou um serviço de teste.
5. Finalize uma venda no PDV.
6. Abra `Fiscal > Vendas` e crie o documento compatível.
7. Marque `Processar agora` e confirme que ele fica `AUTORIZADO` com indicação `SIMULADO`.
8. Confirme que não foi criada chave fiscal oficial na simulação.
9. Gere um `Recibo interno` e confira o aviso de que não substitui nota fiscal.
10. Tente colocar provedor `development` em `PRODUCAO` e confirme que o PetRise bloqueia o processamento.
11. Autorize uma simulação e tente cancelar a venda no PDV; o PDV deve exigir o cancelamento do documento primeiro.
12. Cancele o documento simulado e só então cancele a venda.
13. Ative criação automática, escolha documento padrão e finalize outra venda; confira o rascunho `PENDENTE` criado na fila.

## Validação feita neste pacote
- `node --check` nos arquivos JS de backend alterados.
- Parsing dos JSX alterados com TypeScript em modo sem resolução.
- Busca recursiva por referências da marca anterior sem ocorrências no projeto ativo.
- O `npm ci` do backend excedeu o limite do ambiente de geração; por isso `npx prisma validate` deve ser executado obrigatoriamente na máquina de desenvolvimento antes da migration.
