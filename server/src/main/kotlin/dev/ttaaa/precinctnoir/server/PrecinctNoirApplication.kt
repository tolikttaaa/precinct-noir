package dev.ttaaa.precinctnoir.server

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication

@SpringBootApplication
@ConfigurationPropertiesScan
class PrecinctNoirApplication

fun main(args: Array<String>) {
    runApplication<PrecinctNoirApplication>(*args)
}
