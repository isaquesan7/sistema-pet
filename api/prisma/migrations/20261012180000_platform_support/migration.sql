-- PointVet 18.4: durable tenant-scoped support tickets and messages.
CREATE TABLE platform_support_tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id text NOT NULL REFERENCES organizacoes(id) ON DELETE RESTRICT,
 subject varchar(160) NOT NULL,
 category varchar(32) NOT NULL DEFAULT 'GERAL',
 status varchar(24) NOT NULL DEFAULT 'ABERTO' CHECK(status IN ('ABERTO','EM_ANALISE','AGUARDANDO_CLIENTE','RESOLVIDO')),
 opened_by text NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_tickets_org_idx ON platform_support_tickets(organization_id,created_at DESC);
CREATE INDEX support_tickets_status_idx ON platform_support_tickets(status,updated_at DESC);
CREATE TABLE platform_support_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ticket_id uuid NOT NULL REFERENCES platform_support_tickets(id) ON DELETE CASCADE,
 author_id text NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 is_staff boolean NOT NULL DEFAULT false,
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_ticket_idx ON platform_support_messages(ticket_id,created_at);
