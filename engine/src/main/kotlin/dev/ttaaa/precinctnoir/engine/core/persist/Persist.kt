package dev.ttaaa.precinctnoir.engine.core.persist

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

/**
 * The one JSON configuration for snapshots, commands and projections.
 *
 * Strict (unknown keys are errors), defaults are written so snapshots are self-describing, and
 * nulls are omitted. Polymorphic types use a `"t"` discriminator.
 */
val EngineJson: Json = Json {
    classDiscriminator = "t"
    encodeDefaults = true
    explicitNulls = false
    ignoreUnknownKeys = false
}

/** Upgrades a snapshot's JSON from schema [from] to `from + 1`. */
class Migration(val from: Int, val transform: (JsonObject) -> JsonObject)

object Migrations {
    /** Applies the chain [from] → [to]. Fails if a step is missing or [from] is newer than this engine. */
    fun upgrade(json: JsonObject, from: Int, to: Int, migrations: List<Migration>): JsonObject {
        require(from in 1..to) { "cannot restore schema $from with engine schema $to" }
        return (from..<to).fold(json) { current, version ->
            val step = requireNotNull(migrations.singleOrNull { it.from == version }) { "no migration from schema $version" }
            step.transform(current)
        }
    }
}
