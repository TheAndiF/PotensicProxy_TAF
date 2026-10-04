package com.potensic.proxy

import org.json.JSONObject

/**
 * Runtime backend version information.
 *
 * BACKEND_VERSION is read from Android's BuildConfig.VERSION_NAME, therefore
 * app/build.gradle.kts is the single backend version source for a release.
 */
object VersionInfo {
    val BACKEND_VERSION: String
        get() = BuildConfig.VERSION_NAME

    val PROJECT_VERSION: String
        get() = "v$BACKEND_VERSION"

    const val MAP_API_VERSION = 4
    const val BUILD_DATE = "2026-10-04"

    fun toJson(): JSONObject = JSONObject().apply {
        put("projectVersion", PROJECT_VERSION)
        put("appVersion", BACKEND_VERSION)
        put("backendVersion", BACKEND_VERSION)
        put("mapModuleVersion", BACKEND_VERSION)
        put("mapApiVersion", MAP_API_VERSION)
        put("buildDate", BUILD_DATE)
    }
}
