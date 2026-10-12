-- PointVet 17.2: platform-only immutable backup evidence metadata.
-- Never store backup secrets, plaintext dumps, or full connection strings.
CREATE TABLE IF NOT EXISTS platform_backup_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 object_key text NOT NULL UNIQUE,
 completed_at timestamptz NOT NULL,
 size_bytes bigint NOT NULL CHECK (size_bytes > 0),
 status text NOT NULL DEFAULT 'confirmed' CHECK (status = 'confirmed'),
 source text NOT NULL DEFAULT 'worker-r2-head' CHECK (source = 'worker-r2-head'),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_backup_evidence_completed_idx
 ON platform_backup_evidence(completed_at DESC);
