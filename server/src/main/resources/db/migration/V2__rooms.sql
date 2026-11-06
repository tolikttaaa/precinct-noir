-- Live rooms (docs/ARCHITECTURE.md → Persistence). One row per room, rewritten after every change;
-- `snapshot` holds the room plus the engine's own JSON for the current game.
CREATE TABLE rooms (
    code           TEXT        PRIMARY KEY,
    status         TEXT        NOT NULL,
    snapshot       JSONB       NOT NULL,
    mode           TEXT        NOT NULL,
    schema_version INT,
    action_seq     BIGINT      NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every accepted game command, append-only (audit and replay). Rounds are the room's games.
CREATE TABLE room_commands (
    code       TEXT        NOT NULL REFERENCES rooms (code) ON DELETE CASCADE,
    round      INT         NOT NULL,
    action_seq BIGINT      NOT NULL,
    command    JSONB       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (code, round, action_seq)
);

-- The current game's case log with each event's audience, so reconnecting clients can catch up.
CREATE TABLE room_events (
    code     TEXT   NOT NULL REFERENCES rooms (code) ON DELETE CASCADE,
    seq      BIGINT NOT NULL,
    audience JSONB  NOT NULL,
    event    JSONB  NOT NULL,
    PRIMARY KEY (code, seq)
);
