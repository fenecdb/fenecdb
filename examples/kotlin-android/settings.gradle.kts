// Notes in Kotlin: `notes` (the shared logic), `cli` (a JVM program, run
// headless by CI) and, where an Android SDK is installed, `app` (Compose).
pluginManagement {
    repositories {
        gradlePluginPortal()
        google()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "fennecdb-notes"
include("notes", "cli")

val sdk = System.getenv("ANDROID_HOME") ?: System.getenv("ANDROID_SDK_ROOT")
val android = sdk != null && file(sdk).isDirectory
if (android) include("app")

// FENNEC_LOCAL=1: the library from this repository (integrations/kotlin)
// instead of Maven Central, as CI builds it.
if (System.getenv("FENNEC_LOCAL") != null) {
    includeBuild("../../integrations/kotlin") {
        dependencySubstitution {
            substitute(module("com.fennecdb:fennecdb")).using(project(":fennecdb"))
            if (android) substitute(module("com.fennecdb:fennecdb-android")).using(project(":android"))
        }
    }
}
