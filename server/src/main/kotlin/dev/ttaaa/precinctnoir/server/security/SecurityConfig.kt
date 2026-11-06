package dev.ttaaa.precinctnoir.server.security

import dev.ttaaa.precinctnoir.server.config.AppProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.InterceptorRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
import java.time.Clock

/** Abuse protection wiring; see docs/SECURITY.md. */
@Configuration
class SecurityConfig(private val props: AppProperties, private val clock: Clock) : WebMvcConfigurer {

    @Bean
    fun humanCheck(): HumanCheck = Turnstile(props.turnstile)

    @Bean
    fun apiGuard() = ApiGuard(props.limits, ClockTimeMeter(clock), props.allowedOrigins.toSet())

    @Bean
    fun socketGuard() = SocketGuard(props.limits.socketsPerClient, props.limits.socketsTotal)

    override fun addInterceptors(registry: InterceptorRegistry) {
        registry.addInterceptor(apiGuard()).addPathPatterns("/api/**")
    }
}
