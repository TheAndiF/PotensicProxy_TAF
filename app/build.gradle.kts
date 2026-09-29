plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.potensic.proxy"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.potensic.proxy"
        minSdk = 26
        targetSdk = 36
        versionCode = 23
        versionName = "0.943"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
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
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("io.ktor:ktor-server-cio:3.1.3")
    implementation("io.ktor:ktor-server-websockets:3.1.3")
}

// Keep the embedded WebUI synchronized with the frontend sources.
// Install web dependencies once with `npm ci` in /webui; Android builds then regenerate assets automatically.
val npmExecutable = if (System.getProperty("os.name").lowercase().contains("windows")) "npm.cmd" else "npm"
val buildWebUi by tasks.registering(Exec::class) {
    workingDir = file("../webui")
    commandLine(npmExecutable, "run", "build")
}

tasks.named("preBuild") {
    dependsOn(buildWebUi)
}
