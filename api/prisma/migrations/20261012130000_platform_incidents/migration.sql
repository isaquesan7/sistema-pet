-- PointVet 17.4: persistent outage/recovery ledger, platform-only.
CREATE TABLE platform_service_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key text NOT NULL CHECK (service_key IN ('admin', 'portal')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  last_failed_at timestamptz NOT NULL DEFAULT now(),
  recovered_at timestamptz,
  failure_count integer NOT NULL DEFAULT 1 CHECK (failure_count > 0),
  last_reason text NOT NULL,
  CHECK (recovered_at IS NULL OR recovered_at >= opened_at)
);
CREATE UNIQUE INDEX platform_incident_one_open_per_service
  ON platform_service_incidents(service_key) WHERE recovered_at IS NULL;
CREATE INDEX platform_incident_recent_idx ON platform_service_incidents(opened_at DESC);
