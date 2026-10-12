-- PointVet platform-wide audit, independent of tenant audit and backup services.
CREATE TABLE platform_admin_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id text NOT NULL,
 action text NOT NULL,
 resource_type text NOT NULL,
 resource_id text,
 http_method text NOT NULL,
 http_status integer NOT NULL CHECK (http_status BETWEEN 100 AND 599),
 result text NOT NULL CHECK (result IN ('SUCCESS','FAILED')),
 ip text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_admin_audit_created_idx ON platform_admin_audit(created_at DESC);
CREATE INDEX platform_admin_audit_actor_idx ON platform_admin_audit(actor_id,created_at DESC);
