-- Notification delivery preparation: pending channel means nothing was sent.
CREATE TABLE platform_alert_delivery_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_key text NOT NULL UNIQUE,
 category text NOT NULL CHECK(category IN ('INCIDENT','BACKUP')),
 severity text NOT NULL CHECK(severity IN ('critical','info')),
 title text NOT NULL,
 state text NOT NULL DEFAULT 'AWAITING_CHANNEL' CHECK(state IN ('AWAITING_CHANNEL','QUEUED','SENT','FAILED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 last_attempt_at timestamptz,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts >= 0)
);
CREATE INDEX platform_alert_delivery_outbox_recent_idx ON platform_alert_delivery_outbox(created_at DESC);
