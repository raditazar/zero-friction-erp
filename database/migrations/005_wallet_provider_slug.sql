ALTER TABLE wallets ADD COLUMN provider_slug text;
CREATE INDEX wallets_user_provider_slug_idx ON wallets(user_id, provider_slug);
