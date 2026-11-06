-- Small key/value table for app-level metadata (e.g. snapshot format markers).
-- Game tables (rooms, commands, events) arrive in M3.
CREATE TABLE app_meta (
    key        TEXT PRIMARY KEY,
    value      TEXT        NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_meta (key, value) VALUES ('schema_owner', 'precinctnoir');
