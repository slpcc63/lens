-- Run only against the separately configured Lens product database after review.
-- Stable IDs originate from the existing Better Auth service, never email matching.
CREATE TABLE lens_settings (
    auth_user_id text PRIMARY KEY,
    revision bigint NOT NULL CHECK (revision > 0),
    settings jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT NOW()
);
