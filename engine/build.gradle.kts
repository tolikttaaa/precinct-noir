plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.kover)
    `java-test-fixtures`
}

kover {
    useJacoco(libs.versions.jacoco.get())
}

kotlin {
    jvmToolchain(25)
    compilerOptions {
        allWarningsAsErrors = true
    }
}

dependencies {
    // The engine is pure Kotlin: no Spring, no IO. kotlinx.serialization is its only dependency.
    api(libs.kotlinx.serialization.json)

    // Shared test helpers (scenario/board DSLs, random playouts, leak checks), reusable by :server tests.
    testFixturesImplementation(libs.kotest.assertions.core)
    testFixturesImplementation(libs.kotest.property)

    testImplementation(libs.kotest.runner.junit5)
    testImplementation(libs.kotest.assertions.core)
    testImplementation(libs.kotest.property)
}

tasks.test {
    useJUnitPlatform()
    // Lets tests find repo-level files such as shared/roster.json.
    systemProperty("precinctnoir.repoRoot", rootProject.layout.projectDirectory.asFile.absolutePath)
}
