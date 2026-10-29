-- One-time claim of Lookout's pre-account portfolio by its former dashboard owner.
-- No claim is created and no project access is granted by this migration.
CREATE TABLE IF NOT EXISTS lookout_legacy_portfolio_claim (
  id smallint PRIMARY KEY CHECK (id = 1),
  organisation_id bigint NOT NULL REFERENCES lookout_organisations(id),
  claimed_by_user_id bigint NOT NULL REFERENCES lookout_users(id),
  claimed_at timestamptz NOT NULL DEFAULT now()
);
