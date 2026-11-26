BEGIN;
CREATE TABLE IF NOT EXISTS lens_recipe_votes (
    site text NOT NULL CHECK (site = 'sniffies'),
    version integer NOT NULL CHECK (version = 1),
    contributor text NOT NULL CHECK (contributor ~ '^[a-f0-9]{64}$'),
    fields text[] NOT NULL CHECK (
        cardinality(fields) BETWEEN 1 AND 8 AND
        fields <@ ARRAY['map:age','map:height','map:weight','map:position',
                        'profile:age','profile:height','profile:weight','profile:position']::text[]
    ),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (site, version, contributor)
);
COMMIT;
