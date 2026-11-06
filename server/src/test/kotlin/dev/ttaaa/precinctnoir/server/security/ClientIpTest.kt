package dev.ttaaa.precinctnoir.server.security

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockHttpServletRequest

class ClientIpTest {

    private fun client(header: String? = null, peer: String = "127.0.0.1") =
        ClientIp.of(MockHttpServletRequest().apply { header?.let { addHeader(ClientIp.HEADER, it) }; remoteAddr = peer })

    @Test
    fun `Cloudflare's header wins over the peer address`() {
        assertThat(client("203.0.113.7", peer = "10.0.0.1")).isEqualTo("203.0.113.7")
        assertThat(client(" 203.0.113.8 ")).isEqualTo("203.0.113.8")
        assertThat(client(peer = "10.0.0.2")).isEqualTo("10.0.0.2")
    }

    @Test
    fun `junk in the header is ignored and never looked up in DNS`() {
        assertThat(client("example.com", peer = "10.0.0.3")).isEqualTo("10.0.0.3")
        assertThat(client("", peer = "10.0.0.4")).isEqualTo("10.0.0.4")
        assertThat(client("nope", peer = "also-nope")).isEqualTo(ClientIp.UNKNOWN)
    }

    @Test
    fun `IPv6 clients are grouped by their slash-64, mapped IPv4 is plain IPv4`() {
        assertThat(client("2001:db8:1:2:aaaa::1")).isEqualTo("2001:0db8:0001:0002::/64")
        assertThat(client("2001:db8:1:2:ffff:ffff:ffff:9")).isEqualTo("2001:0db8:0001:0002::/64")
        assertThat(client("2001:db8:1:3::1")).isEqualTo("2001:0db8:0001:0003::/64")
        assertThat(client("::ffff:198.51.100.1")).isEqualTo("198.51.100.1")
    }

    @Test
    fun `logs get a stable pseudonym that doesn't reveal the address`() {
        val pseudonym = ClientIp.pseudonym("203.0.113.7")
        assertThat(pseudonym).matches("[0-9a-f]{12}").isEqualTo(ClientIp.pseudonym("203.0.113.7"))
        assertThat(ClientIp.pseudonym("203.0.113.8")).isNotEqualTo(pseudonym)
    }
}
