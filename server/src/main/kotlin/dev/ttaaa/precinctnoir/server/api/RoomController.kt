package dev.ttaaa.precinctnoir.server.api

import dev.ttaaa.precinctnoir.server.config.AppProperties
import dev.ttaaa.precinctnoir.server.protocol.ApiError
import dev.ttaaa.precinctnoir.server.protocol.ClientConfig
import dev.ttaaa.precinctnoir.server.protocol.CreateRoomRequest
import dev.ttaaa.precinctnoir.server.protocol.CreateRoomResponse
import dev.ttaaa.precinctnoir.server.protocol.JoinRequest
import dev.ttaaa.precinctnoir.server.protocol.JoinResponse
import dev.ttaaa.precinctnoir.server.protocol.ModeInfo
import dev.ttaaa.precinctnoir.server.protocol.ProtocolJson
import dev.ttaaa.precinctnoir.server.protocol.RoomSummary
import dev.ttaaa.precinctnoir.server.room.ApiException
import dev.ttaaa.precinctnoir.server.room.RoomService
import dev.ttaaa.precinctnoir.server.security.Guard
import dev.ttaaa.precinctnoir.server.security.Guarded
import dev.ttaaa.precinctnoir.server.security.HumanCheck
import dev.ttaaa.precinctnoir.server.security.Verdict
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * The room HTTP API (docs/PROTOCOL.md). Bodies use the protocol's strict kotlinx JSON, the same as the
 * WebSocket, rather than Jackson. Errors are `{"error": "<i18n code>"}`.
 */
@RestController
@RequestMapping("/api")
class RoomController(private val rooms: RoomService, private val humans: HumanCheck, private val props: AppProperties) {

    /** Only people may create rooms: the TV sends a Turnstile token. */
    @Guarded(Guard.CREATE_ROOM)
    @PostMapping("/rooms")
    fun create(@RequestBody body: String): ResponseEntity<String> {
        val request = parse(CreateRoomRequest.serializer(), body)
        when (humans.verify(request.turnstileToken)) {
            Verdict.PASSED -> Unit
            Verdict.FAILED -> throw ApiException(FORBIDDEN, "captcha_failed")
            Verdict.UNAVAILABLE -> throw ApiException(SERVICE_UNAVAILABLE, "captcha_unavailable")
        }
        val created = rooms.create()
        return json(CREATED, CreateRoomResponse.serializer(), CreateRoomResponse(created.code, created.hostToken))
    }

    @Guarded(Guard.JOIN_ROOM)
    @PostMapping("/rooms/{code}/players")
    fun join(@PathVariable code: String, @RequestBody body: String): ResponseEntity<String> {
        val request = parse(JoinRequest.serializer(), body)
        val joined = rooms.join(code, request.name)
        return json(CREATED, JoinResponse.serializer(), JoinResponse(joined.playerId, joined.playerToken))
    }

    @Guarded(Guard.LOOKUP_ROOM)
    @GetMapping("/rooms/{code}")
    fun summary(@PathVariable code: String): ResponseEntity<String> = json(OK, RoomSummary.serializer(), rooms.summary(code))

    @GetMapping("/modes")
    fun modes(): ResponseEntity<String> = json(OK, ListSerializer(ModeInfo.serializer()), rooms.modeInfo())

    @GetMapping("/config")
    fun config(): ResponseEntity<String> = json(
        OK,
        ClientConfig.serializer(),
        ClientConfig(
            turnstileSiteKey = props.turnstile.siteKey.ifBlank { null },
            version = props.version.ifBlank { null },
            commit = props.commit.ifBlank { null },
        ),
    )

    @ExceptionHandler(ApiException::class)
    fun failed(e: ApiException): ResponseEntity<String> = json(e.status, ApiError.serializer(), ApiError(e.code))

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun unreadable(): ResponseEntity<String> = json(BAD_REQUEST, ApiError.serializer(), ApiError(MALFORMED))

    private fun <T> parse(serializer: KSerializer<T>, body: String): T = try {
        ProtocolJson.decodeFromString(serializer, body)
    } catch (e: IllegalArgumentException) {
        throw ApiException(BAD_REQUEST, MALFORMED)
    }

    private fun <T> json(status: Int, serializer: KSerializer<T>, body: T): ResponseEntity<String> =
        ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON).body(ProtocolJson.encodeToString(serializer, body))

    private companion object {
        const val OK = 200
        const val CREATED = 201
        const val BAD_REQUEST = 400
        const val FORBIDDEN = 403
        const val SERVICE_UNAVAILABLE = 503
        const val MALFORMED = "malformed"
    }
}
