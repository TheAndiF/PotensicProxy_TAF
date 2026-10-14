import java.io.FileInputStream
import groovy.json.JsonSlurper
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// WebUI package.json is the authoritative application version.
val webuiVersion = (JsonSlurper().parse(rootProject.file("webui/package.json")) as Map<*, *>)["version"].toString()

// Debug builds must not require a release keystore. A release build still needs
// the original signing identity, supplied outside the distributed source archive.
val releaseKeystorePropertiesFile = rootProject.file("keystore.properties")
val releaseKeystoreProperties = Properties().apply {
    if (releaseKeystorePropertiesFile.isFile) {
        FileInputStream(releaseKeystorePropertiesFile).use { load(it) }
    }
}
val hasReleaseSigning = releaseKeystoreProperties.getProperty("storeFile") != null &&
    (System.getenv("TAF_RELEASE_STORE_PASSWORD") ?: releaseKeystoreProperties.getProperty("storePassword")) != null &&
    (System.getenv("TAF_RELEASE_KEY_ALIAS") ?: releaseKeystoreProperties.getProperty("keyAlias")) != null &&
    (System.getenv("TAF_RELEASE_KEY_PASSWORD") ?: releaseKeystoreProperties.getProperty("keyPassword")) != null

android {
    namespace = "com.potensic.proxy"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.potensic.proxy"
        minSdk = 26
        targetSdk = 36
        versionCode = (System.getenv("TAF_BUILD_VERSION_CODE")?.toIntOrNull()?.plus(100000) ?: 68)
        versionName = webuiVersion
    }

    signingConfigs {
        // Stable debug signing is mandatory for compatible BA_ in-place updates.
        // Local builds continue to use Android's default debug key when secrets are absent.
        if (System.getenv("TAF_DEBUG_KEYSTORE") != null) {
            getByName("debug") {
                storeFile = rootProject.file(System.getenv("TAF_DEBUG_KEYSTORE"))
                storePassword = System.getenv("TAF_DEBUG_STORE_PASSWORD")
                keyAlias = System.getenv("TAF_DEBUG_KEY_ALIAS")
                keyPassword = System.getenv("TAF_DEBUG_KEY_PASSWORD")
            }
        }
        if (hasReleaseSigning) {
            create("release") {
                storeFile = rootProject.file(releaseKeystoreProperties.getProperty("storeFile"))
                storePassword = System.getenv("TAF_RELEASE_STORE_PASSWORD") ?: releaseKeystoreProperties.getProperty("storePassword")
                keyAlias = System.getenv("TAF_RELEASE_KEY_ALIAS") ?: releaseKeystoreProperties.getProperty("keyAlias")
                keyPassword = System.getenv("TAF_RELEASE_KEY_PASSWORD") ?: releaseKeystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
        }
    }

    // VersionInfo reads BuildConfig.VERSION_NAME at runtime.
    // AGP 8+ may not generate BuildConfig unless explicitly enabled.
    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("org.opencv:opencv:4.10.0")
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("io.ktor:ktor-server-cio:3.1.3")
    implementation("io.ktor:ktor-server-websockets:3.1.3")
}

// Single authoritative WebUI build: Gradle owns generation and verification.
// GitHub installs npm dependencies, then calls Gradle once; local Gradle builds
// use the same task. Vite clears old assets before replacing them.
val npmExecutable = if (System.getProperty("os.name").lowercase().contains("windows")) "npm.cmd" else "npm"
val buildWebUi by tasks.registering(Exec::class) {
    workingDir = rootProject.file("webui")
    commandLine(npmExecutable, "run", "build")
    doFirst {
        require(rootProject.file("webui/node_modules").isDirectory) {
            "[webui] Missing dependencies: run 'cd webui && npm ci --include=optional --no-audit --no-fund'"
        }
    }
}
val verifyEmbeddedWebUi by tasks.registering(Exec::class) {
    dependsOn(buildWebUi)
    workingDir = rootProject.file("webui")
    commandLine(npmExecutable, "run", "verify:embedded")
}
tasks.named("preBuild") {
    dependsOn(verifyEmbeddedWebUi)
}

// Never silently ship an unsigned release when original credentials are missing.
tasks.configureEach {
    if (name.matches(Regex("(?i).*(assemble|bundle|package).*release.*"))) {
        doFirst {
            require(hasReleaseSigning) {
                "[signing] Missing original release signing configuration. Provide keystore.properties and original key securely."
            }
        }
    }
}
