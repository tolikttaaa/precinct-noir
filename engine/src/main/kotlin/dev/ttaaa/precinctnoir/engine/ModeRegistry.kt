package dev.ttaaa.precinctnoir.engine

import dev.ttaaa.precinctnoir.engine.core.api.AnyMode
import dev.ttaaa.precinctnoir.engine.core.api.ErasedMode
import dev.ttaaa.precinctnoir.engine.modes.killerinspector.ShadowDuel

/** Every playable mode, in release order. */
object ModeRegistry {
    val modes: List<AnyMode> = listOf(ErasedMode(ShadowDuel))

    fun byId(id: String): AnyMode? = modes.firstOrNull { it.id == id }
}
