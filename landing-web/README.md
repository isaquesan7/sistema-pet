# PointVet — Site comercial

Aplicação estática, independente de `admin-web`, `client-web` e `api`. Sem novas dependências de frontend.

## Desenvolvimento
```bash
cd landing-web
node server.mjs
```
Abra http://localhost:4174.

## Configuração antes da publicação
Edite `config.js` (ou injete este arquivo durante o deploy), preenchendo exclusivamente URLs públicas:
- `apiUrl`: origem pública da API **com prefixo `/api`**, por exemplo `https://api.pointvet.com.br/api`.
- `appUrl`: origem pública do Admin Web, por exemplo `https://app.pointvet.com.br`.

O site consulta `GET /saas/publico/planos` para nomes, preços, limites, módulos e dias de trial **reais**. Falhas ou catálogo vazio exibem estados explícitos sem inventar planos.

Os CTAs encaminham para `/comecar` no Admin Web e o botão Entrar para `/login`. O parâmetro `plano` acompanha a escolha, mas o formulário atual do Admin Web ainda não processa esse parâmetro automaticamente — etapa de integração a revisar antes de ativar comercialmente.

## Deploy
Pode ser hospedado como novo serviço Railway com diretório raiz `landing-web` e comando `node server.mjs`, ou serviço de arquivos estáticos. Não substituir `petrise-admin`, `petrise-portal` ou `petrise-api`. Não vincular `pointvet.com.br` até validar HTTPS, DNS e links.

## Segurança
Não incluir secrets neste site. A API precisa permitir CORS da origem do novo domínio para consulta pública. Cadastro efetivo permanece no Admin Web com validações de backend. Não usar pagamentos simulados como promessa comercial.
