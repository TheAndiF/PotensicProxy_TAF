package com.potensic.proxy

import android.content.Context
import org.json.JSONObject

/** Device-independent output configuration. The root camera bridge is intentionally separate. */
class StreamOutputSettings(context: Context) {
    private val preferences = context.getSharedPreferences("stream_output", Context.MODE_PRIVATE)
    private val fields = listOf("streamEnabled", "webcamEnabled", "mapPip", "showPosition", "showHeading", "showAltitude", "showBattery", "showPhoneBattery", "showControllerBattery", "showDroneBattery", "showHorizontalSpeed", "showVerticalSpeed", "showHorizontalDistance", "showSatellites", "showHomepoint", "showPitch", "showRoll")
    @Synchronized fun get(): JSONObject = JSONObject().apply {
        fields.forEach { put(it, preferences.getBoolean(it, false)) }
        put("port", 9091)
        put("mapProvider", preferences.getString("mapProvider", "main") ?: "main")
        put("webcamAvailable", false)
        put("webcamNote", "Requires separate Android camera provider; not installed")
    }
    @Synchronized fun update(input: JSONObject): JSONObject {
        val edit = preferences.edit()
        fields.forEach { key ->
            if (input.has(key)) {
                require(input.opt(key) is Boolean) { "$key must be a boolean" }
                edit.putBoolean(key, input.getBoolean(key))
            }
        }
        if (input.has("mapProvider")) {
            val provider = input.getString("mapProvider")
            require(provider in listOf("main", "osm")) { "Unsupported map provider" }
            edit.putString("mapProvider", provider)
        }
        edit.apply()
        return get()
    }
    fun streamEnabled(): Boolean = preferences.getBoolean("streamEnabled", false)
}
