package dev.ttaaa.precinctnoir.server.config

import dev.ttaaa.precinctnoir.server.room.RoomRepository
import dev.ttaaa.precinctnoir.server.room.RoomService
import dev.ttaaa.precinctnoir.server.room.SecureRandomness
import dev.ttaaa.precinctnoir.server.ws.GameWebSocketHandler
import org.slf4j.LoggerFactory
import org.springframework.context.SmartLifecycle
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Clock
import java.time.Duration
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

@Configuration
class PlatformConfig {

    @Bean
    fun clock(): Clock = Clock.systemUTC()

    @Bean(destroyMethod = "shutdownNow")
    fun platformScheduler(): ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor(Thread.ofVirtual().name("platform-", 0).factory())

    /** Rooms are restored from Postgres before the web server accepts any connection. */
    @Bean
    fun roomService(repository: RoomRepository, clock: Clock, props: AppProperties): RoomService =
        RoomService(repository, clock, SecureRandomness(), props.rooms).also(RoomService::restore)

    @Bean
    fun gameWebSocketHandler(rooms: RoomService, platformScheduler: ScheduledExecutorService, props: AppProperties, clock: Clock) =
        GameWebSocketHandler(rooms, platformScheduler, props.ws, clock)

    @Bean
    fun platformLifecycle(rooms: RoomService, handler: GameWebSocketHandler, platformScheduler: ScheduledExecutorService, props: AppProperties) =
        PlatformLifecycle(
            platformScheduler,
            listOf(
                Periodic("room sweep", props.rooms.sweepInterval, rooms::tick),
                Periodic("keepalive", props.ws.pingInterval, handler::keepAlive),
            ),
            onStop = rooms::shutdown,
        )
}

class Periodic(val name: String, val period: Duration, val task: () -> Unit)

/**
 * Runs the periodic sweeps, and on shutdown closes every game socket with 1012 *before* the web server's
 * graceful shutdown (highest phase stops first), so long-lived sockets don't hold up a deploy.
 */
class PlatformLifecycle(
    private val scheduler: ScheduledExecutorService,
    private val periodic: List<Periodic>,
    private val onStop: () -> Unit,
) : SmartLifecycle {
    private val log = LoggerFactory.getLogger(PlatformLifecycle::class.java)
    private val futures = mutableListOf<ScheduledFuture<*>>()

    @Volatile
    private var running = false

    override fun start() {
        periodic.forEach { futures += schedule(it) }
        running = true
    }

    override fun stop() {
        running = false
        futures.forEach { it.cancel(false) }
        futures.clear()
        onStop()
    }

    override fun isRunning(): Boolean = running

    private fun schedule(job: Periodic): ScheduledFuture<*> {
        val millis = job.period.toMillis()
        return scheduler.scheduleWithFixedDelay(
            {
                try {
                    job.task()
                } catch (e: RuntimeException) { // keep the schedule alive
                    log.error("Periodic {} failed", job.name, e)
                }
            },
            millis,
            millis,
            TimeUnit.MILLISECONDS,
        )
    }
}
