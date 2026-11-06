plugins {
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.spring) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.spring.boot) apply false
}

allprojects {
    group = "dev.ttaaa.precinctnoir"
    version = "0.1.0-SNAPSHOT"
}
