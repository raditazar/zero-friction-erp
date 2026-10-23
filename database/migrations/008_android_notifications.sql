-- 1. Penambahan nilai enum PostgreSQL (di luar blok transaksi)
ALTER TYPE webhook_source ADD VALUE IF NOT EXISTS 'android';
ALTER TYPE input_source ADD VALUE IF NOT EXISTS 'android';
ALTER TYPE input_mode ADD VALUE IF NOT EXISTS 'notification';

BEGIN;

-- 2. Tabel registrasi perangkat untuk heartbeat dan monitoring
CREATE TABLE IF NOT EXISTS device_registrations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id     text NOT NULL,
  device_label  text,
  platform      text NOT NULL DEFAULT 'android',
  last_seen_at  timestamptz,
  events_count  integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_registrations_device_id_not_blank
    CHECK (length(trim(device_id)) > 0),
  CONSTRAINT device_registrations_user_device_unique
    UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS device_registrations_user_idx
  ON device_registrations(user_id);

-- 3. Kolom pendukung anti-duplikasi pada webhook_events
ALTER TABLE webhook_events
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS dedup_hash text,
  ADD COLUMN IF NOT EXISTS duplicate_of_id uuid REFERENCES webhook_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS webhook_events_dedup_hash_idx
  ON webhook_events(user_id, dedup_hash)
  WHERE dedup_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS webhook_events_device_id_idx
  ON webhook_events(user_id, device_id)
  WHERE device_id IS NOT NULL;

-- 4. Kolom pendukung anti-duplikasi pada transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS dedup_hash text,
  ADD COLUMN IF NOT EXISTS duplicate_of_id uuid REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS transactions_dedup_hash_idx
  ON transactions(user_id, dedup_hash)
  WHERE dedup_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_duplicate_of_idx
  ON transactions(duplicate_of_id)
  WHERE duplicate_of_id IS NOT NULL;

COMMIT;
