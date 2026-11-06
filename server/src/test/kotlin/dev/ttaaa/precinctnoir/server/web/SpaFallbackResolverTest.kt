package dev.ttaaa.precinctnoir.server.web

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import org.springframework.core.io.FileSystemResource
import java.nio.file.Path
import kotlin.io.path.createDirectory
import kotlin.io.path.writeText

class SpaFallbackResolverTest {

    @TempDir
    lateinit var root: Path

    private val resolver = SpaWebConfig.SpaFallbackResolver()

    private fun location() = FileSystemResource("$root/")

    private fun withShell() = root.resolve("index.html").writeText("<html>shell</html>")

    @Test
    fun `serves an existing file as-is`() {
        withShell()
        root.resolve("favicon.svg").writeText("<svg/>")
        assertThat(resolver.getResource("favicon.svg", location())?.filename).isEqualTo("favicon.svg")
    }

    @Test
    fun `client-side routes fall back to the shell`() {
        withShell()
        assertThat(resolver.getResource("play/ABCD", location())?.filename).isEqualTo("index.html")
    }

    @Test
    fun `directories are never served and fall back to the shell`() {
        withShell()
        root.resolve("lobby").createDirectory()
        assertThat(resolver.getResource("lobby", location())?.filename).isEqualTo("index.html")
    }

    @Test
    fun `backend paths are never rewritten`() {
        withShell()
        listOf("api", "api/rooms", "ws", "ws/echo", "actuator", "actuator/info").forEach { path ->
            assertThat(resolver.getResource(path, location())).describedAs(path).isNull()
        }
    }

    @Test
    fun `look-alike prefixes are client routes, not backend paths`() {
        withShell()
        listOf("apiary", "wsx", "actuators").forEach { path ->
            assertThat(resolver.getResource(path, location())?.filename).describedAs(path).isEqualTo("index.html")
        }
    }

    @Test
    fun `missing files are not rewritten`() {
        withShell()
        listOf("missing.js", "img/logo.png").forEach { path ->
            assertThat(resolver.getResource(path, location())).describedAs(path).isNull()
        }
    }

    @Test
    fun `without a built shell there is no fallback`() {
        assertThat(resolver.getResource("play/ABCD", location())).isNull()
    }
}
