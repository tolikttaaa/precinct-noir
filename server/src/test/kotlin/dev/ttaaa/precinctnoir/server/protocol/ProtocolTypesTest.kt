package dev.ttaaa.precinctnoir.server.protocol

import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelEvent
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuelView
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import java.io.File

/**
 * Keeps `web/src/protocol/generated.ts` in sync with the Kotlin types, so CI fails on drift.
 * `./gradlew :server:generateProtocol` rewrites the file instead of comparing.
 */
class ProtocolTypesTest {

    @Test
    fun `web protocol types match the Kotlin protocol`() {
        val generated = TypeScriptGenerator().generate(ROOTS)
        val file = File(System.getProperty("precinctnoir.repoRoot") ?: "..", "web/src/protocol/generated.ts")
        if (System.getProperty("protocol.update") == "true") {
            file.parentFile.mkdirs()
            file.writeText(generated)
        }
        assertThat(file).describedAs("run ./gradlew :server:generateProtocol").exists()
        assertThat(file.readText()).describedAs("web/src/protocol/generated.ts is stale: run ./gradlew :server:generateProtocol").isEqualTo(generated)
    }

    @Test
    fun `two protocol types with the same name fail generation instead of merging`() {
        assertThatThrownBy { TypeScriptGenerator().generate(listOf(Role::class, dev.ttaaa.precinctnoir.server.protocol.clash.Role::class)) }
            .isInstanceOf(IllegalArgumentException::class.java)
            .hasMessageContaining("both called Role")
    }

    @Test
    fun `the generator handles every shape the protocol uses`() {
        val ts = TypeScriptGenerator().generate(listOf(Sample::class)).replace("ProtocolTypesTest", "") // samples are nested here
        assertThat(ts).contains(
            "export type Sample =\n  | SampleEmpty\n  | SampleLeaf",
            "export interface SampleLeaf {\n  t: 'leaf'\n  id: Code\n  tags: string[]\n  kinds: Kind[]\n  counts: Record<string, number>\n  raw: Record<string, unknown>\n  any: unknown\n  flag: boolean\n  note?: string\n}",
            "export interface SampleEmpty {\n  t: 'empty'\n}",
            "export type Code = number",
            "export type Kind = 'a' | 'b'",
        )
    }

    @Serializable
    sealed interface Sample {
        @Serializable
        @SerialName("leaf")
        data class Leaf(
            val id: Code,
            val tags: Set<String>,
            val kinds: List<Kind>,
            val counts: Map<String, Long>,
            val raw: JsonObject,
            val any: JsonElement,
            val flag: Boolean,
            val note: String? = null,
        ) : Sample

        @Serializable
        @SerialName("empty")
        data object Empty : Sample
    }

    @Serializable
    @JvmInline
    value class Code(val value: Int)

    @Serializable
    enum class Kind {
        @SerialName("a")
        A,

        @SerialName("b")
        B,
    }

    private companion object {
        /** Everything the web client reads or writes. Add each new mode's view and event types here. */
        val ROOTS = listOf(
            ClientMessage::class,
            ServerMessage::class,
            CreateRoomRequest::class,
            CreateRoomResponse::class,
            JoinRequest::class,
            JoinResponse::class,
            RoomSummary::class,
            ModeInfo::class,
            ApiError::class,
            ClientConfig::class,
            ShadowDuelView::class,
            ShadowDuelEvent::class,
        )
    }
}
