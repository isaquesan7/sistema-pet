-- Acknowledgements are per detected event, not a fabricated availability history.
CREATE TABLE platform_alert_acknowledgements (
  alert_key text PRIMARY KEY,
  acknowledged_by text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_alert_key_size CHECK (length(alert_key) BETWEEN 1 AND 160)
);
CREATE INDEX platform_alert_ack_time_idx ON platform_alert_acknowledgements(acknowledged_at DESC);
