# PointVet — Meu Usuário: checklist de liberação

## Implementado
- Menu superior e perfil por usuário (independente da pet shop atualmente selecionada).
- Nome, nome de exibição, telefone e foto JPG/PNG/WebP em data URI limitado a 250 KB.
- Troca de e-mail mediante confirmação da senha atual e revogação de sessões.
- Troca de senha com hash bcrypt e revogação de todas as sessões.
- Tokens de acesso de novas sessões incluem `sid`; middleware rejeita tokens vinculados a sessão revogada. Tokens legados sem `sid` só expiram pelo TTL atual (15 minutos por padrão).
- Os vínculos, permissões e `superAdmin` não são alteráveis pelo perfil.

## Antes de implantar na Pet King
1. Confirmar backup recuperável mais recente e plano de restauração.
2. Validar a migração aditiva `20261013050000_user_profile` em PostgreSQL isolado (não na base principal). Executar `prisma migrate status` e `prisma migrate deploy` nesse banco.
3. Homologar dois usuários de organizações diferentes, um usuário comum e um superadmin, com foto, nome, e-mail duplicado, senha errada, troca de senha, sessões simultâneas e encerramento de sessões.
4. Confirmar o comportamento do login após alteração do e-mail e a entrega de notificações. A confirmação por e-mail ainda não foi implementada: não liberar alterações de e-mail sem aprovação de produto para esse fluxo.
5. Executar smoke test em ambiente isolado, incluindo `/auth/me/perfil`, `/auth/me/senha`, rotas existentes de login/refresh e menu do Admin.
6. Aplicar a migração antes de implantar versões de API que consultem os novos campos, em janela controlada e com rollback.
7. Revalidar backups, alertas, Console Interno e acesso à Pet King após o deploy.

## Ainda pendente
- Testes de integração com banco isolado, além dos testes estáticos de contrato.
- Confirmação de novo e-mail por link ou código para prevenir perda de controle do login.
- Política de upload de fotos no armazenamento externo (atualmente base64 com limite no banco).
- Ajustes de UX e acessibilidade do menu via navegador real.

**Estado:** PR em rascunho; não publicar até concluir os itens bloqueantes.
