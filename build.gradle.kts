import kotlinx.kover.gradle.plugin.dsl.CoverageUnit

plugins {
    base
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.spring) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.spring.boot) apply false
    alias(libs.plugins.kover)
}

allprojects {
    group = "dev.ttaaa.precinctnoir"
    version = "0.1.0-SNAPSHOT"
}

// Aggregated coverage over all JVM modules: `./gradlew koverHtmlReport` / `koverXmlReport`.
dependencies {
    kover(project(":engine"))
    kover(project(":server"))
}

kover {
    reports {
        verify {
            rule("Minimum coverage") {
                // The goal is ~100%; these floors stop regressions (see docs/ARCHITECTURE.md → Verification).
                minBound(90, CoverageUnit.LINE)
                minBound(85, CoverageUnit.BRANCH)
            }
        }
    }
}

tasks.check {
    dependsOn(tasks.koverVerify)
}
