package dev.ttaaa.precinctnoir.server.protocol

import dev.ttaaa.precinctnoir.engine.core.legal.SimpleChoice
import kotlinx.serialization.json.JsonObject
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

class ProtocolTest {

    private val commands: List<ClientMessage.RoomCommand> = listOf(
        ClientMessage.Act(1, 2, SimpleChoice("disguise")),
        ClientMessage.SetMode(2, "killer_inspector"),
        ClientMessage.SetConfig(3, JsonObject(emptyMap())),
        ClientMessage.SetTimer(4, 60),
        ClientMessage.Kick(5, 2),
        ClientMessage.Leave(6),
        ClientMessage.Start(7),
        ClientMessage.EndGame(8),
        ClientMessage.PlayAgain(9),
    )

    @Test
    fun `client messages round-trip with a t discriminator, as a whole or as commands`() {
        for (command in commands + ClientMessage.Hello("BCDF", "token")) {
            val json = ProtocolJson.encodeToString(ClientMessage.serializer(), command)
            assertThat(json).startsWith("{\"t\":")
            assertThat(ProtocolJson.decodeFromString(ClientMessage.serializer(), json)).isEqualTo(command)
        }
        for (command in commands) {
            val json = ProtocolJson.encodeToString(ClientMessage.RoomCommand.serializer(), command)
            assertThat(ProtocolJson.decodeFromString(ClientMessage.RoomCommand.serializer(), json)).isEqualTo(command)
        }
        assertThat(ProtocolJson.encodeToString(ClientMessage.serializer(), ClientMessage.SetTimer(1, null))).isEqualTo("""{"t":"set_timer","clientSeq":1}""")
    }

    @Test
    fun `client input is strict`() {
        assertThatThrownBy { ProtocolJson.decodeFromString(ClientMessage.serializer(), """{"t":"start","clientSeq":1,"x":1}""") }
            .isInstanceOf(IllegalArgumentException::class.java)
        assertThatThrownBy { ProtocolJson.decodeFromString(JoinRequest.serializer(), """{}""") }
            .isInstanceOf(IllegalArgumentException::class.java)
        assertThat(ProtocolJson.encodeToString(JoinRequest.serializer(), JoinRequest("Ann"))).isEqualTo("""{"name":"Ann"}""")
    }

    @Test
    fun `close codes are the documented ones`() {
        assertThat(CloseReason.entries.associate { it.name to it.code }).isEqualTo(
            mapOf(
                "BAD_TOKEN" to 4001, "AUTH_TIMEOUT" to 4002, "KICKED" to 4003, "ROOM_CLOSED" to 4004,
                "HELLO_REQUIRED" to 4005, "LEFT" to 1000, "RESTARTING" to 1012,
            ),
        )
    }
}
