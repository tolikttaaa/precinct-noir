package dev.ttaaa.precinctnoir.server.protocol.clash

import kotlinx.serialization.Serializable

/** A second top-level `Role`, so the generator test can prove that clashing names fail generation. */
@Serializable
enum class Role { SOMEONE }
