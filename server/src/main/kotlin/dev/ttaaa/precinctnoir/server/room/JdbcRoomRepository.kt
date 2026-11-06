package dev.ttaaa.precinctnoir.server.room

import dev.ttaaa.precinctnoir.engine.core.events.Audience
import dev.ttaaa.precinctnoir.server.protocol.ProtocolJson
import kotlinx.serialization.json.JsonElement
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import org.springframework.transaction.support.TransactionTemplate

/** Rooms in Postgres via `JdbcClient` (no JPA). JSON is written with the engine's canonical settings. */
@Repository
class JdbcRoomRepository(private val jdbc: JdbcClient, private val tx: TransactionTemplate) : RoomRepository {

    override fun loadAll(): List<LoadedRoom> =
        jdbc.sql("SELECT snapshot::text AS snapshot FROM rooms ORDER BY code").query { rs, _ -> rs.getString("snapshot") }.list().map { json ->
            val room = ProtocolJson.decodeFromString(PersistedRoom.serializer(), json)
            LoadedRoom(room, events(room.room.code))
        }

    override fun save(room: PersistedRoom, actionSeq: Long, events: EventWrite, command: CommandRecord?) {
        val code = room.room.code
        tx.executeWithoutResult {
            jdbc.sql(
                """
                INSERT INTO rooms (code, status, snapshot, mode, schema_version, action_seq)
                VALUES (:code, :status, CAST(:snapshot AS jsonb), :mode, :schema, :actionSeq)
                ON CONFLICT (code) DO UPDATE SET
                    status = EXCLUDED.status, snapshot = EXCLUDED.snapshot, mode = EXCLUDED.mode,
                    schema_version = EXCLUDED.schema_version, action_seq = EXCLUDED.action_seq, updated_at = now()
                """,
            )
                .param("code", code)
                .param("status", room.room.status.name.lowercase())
                .param("snapshot", ProtocolJson.encodeToString(PersistedRoom.serializer(), room))
                .param("mode", room.room.mode)
                .param("schema", room.room.game?.schemaVersion)
                .param("actionSeq", actionSeq)
                .update()
            if (events.reset) jdbc.sql("DELETE FROM room_events WHERE code = :code").param("code", code).update()
            events.append.forEach { event ->
                jdbc.sql("INSERT INTO room_events (code, seq, audience, event) VALUES (:code, :seq, CAST(:audience AS jsonb), CAST(:event AS jsonb))")
                    .param("code", code)
                    .param("seq", event.seq)
                    .param("audience", ProtocolJson.encodeToString(Audience.serializer(), event.audience))
                    .param("event", ProtocolJson.encodeToString(JsonElement.serializer(), event.event))
                    .update()
            }
            if (command != null) {
                jdbc.sql("INSERT INTO room_commands (code, round, action_seq, command) VALUES (:code, :round, :actionSeq, CAST(:command AS jsonb))")
                    .param("code", code)
                    .param("round", command.round)
                    .param("actionSeq", command.actionSeq)
                    .param("command", ProtocolJson.encodeToString(JsonElement.serializer(), command.command))
                    .update()
            }
        }
    }

    override fun delete(code: String) {
        jdbc.sql("DELETE FROM rooms WHERE code = :code").param("code", code).update()
    }

    private fun events(code: String): List<StoredEvent> =
        jdbc.sql("SELECT seq, audience::text AS audience, event::text AS event FROM room_events WHERE code = :code ORDER BY seq")
            .param("code", code)
            .query { rs, _ ->
                StoredEvent(
                    rs.getLong("seq"),
                    ProtocolJson.decodeFromString(Audience.serializer(), rs.getString("audience")),
                    ProtocolJson.parseToJsonElement(rs.getString("event")),
                )
            }
            .list()
}
