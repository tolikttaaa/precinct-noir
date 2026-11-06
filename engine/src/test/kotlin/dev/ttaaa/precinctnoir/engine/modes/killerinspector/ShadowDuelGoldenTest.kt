package dev.ttaaa.precinctnoir.engine.modes.killerinspector

import dev.ttaaa.precinctnoir.engine.core.persist.EngineJson
import dev.ttaaa.precinctnoir.engine.testing.playout
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.io.File

private val pretty = Json(EngineJson) { prettyPrint = true }

/**
 * Pins the persisted JSON shape of schema v1. If this fails, the snapshot format changed: bump
 * `ShadowDuel.schemaVersion`, add a Migration from the old shape, and keep this file as the v1 fixture.
 */
class ShadowDuelGoldenTest : FunSpec({

    val serializer = DuelState.serializer(ShadowDuelModel.serializer(), ShadowDuelStep.serializer())
    val fixture = "/golden/killer_inspector/v1.json"

    fun scripted(): DuelState =
        ShadowDuel.playout(2, buildJsonObject { put("killerSeat", JsonPrimitive(1)) }, seed = 20261106, maxSteps = 12).final

    test("a scripted game serializes exactly like the v1 fixture") {
        val actual = pretty.encodeToString(serializer, scripted())
        val expected = javaClass.getResource(fixture)?.readText()
        if (expected != actual) {
            File("build/golden-actual/killer_inspector").mkdirs()
            File("build/golden-actual/killer_inspector/v1.json").writeText(actual)
        }
        actual shouldBe expected
    }

    test("the v1 fixture still decodes to the same game") {
        val expected = javaClass.getResource(fixture)!!.readText()
        pretty.decodeFromString(serializer, expected) shouldBe scripted()
        EngineJson.parseToJsonElement(expected) as JsonObject
    }
})
