package com.potensic.proxy.core

import com.potensic.proxy.TelemetryData
import org.json.JSONObject

/**
 * Authoritative application state shared by transport, protocol, API and UI layers.
 *
 * This deliberately stores already interpreted values only. Confirmed protocol parsing
 * remains in the existing protocol/telemetry classes and is not changed here.
 */
data class ControlAxes(
    val throttle: Short = 0,
    val yaw: Short = 0,
    val pitch: Short = 0,
    val roll: Short = 0,
    val gimbal: Short = 0,
) {
    val active: Boolean
        get() = throttle != 0.toShort() || yaw != 0.toShort() || pitch != 0.toShort() ||
            roll != 0.toShort() || gimbal != 0.toShort()

    fun toJson(): JSONObject = JSONObject().apply {
        put("throttle", throttle.toInt())
        put("yaw", yaw.toInt())
        put("pitch", pitch.toInt())
        put("roll", roll.toInt())
        put("gimbal", gimbal.toInt())
    }
}

data class ConnectionState(
    val transport: String = "none",
    val transportOpen: Boolean = false,
    val linkReady: Boolean = false,
    val lastRxMs: Long = 0L,
)

data class VideoState(
    val codec: String = "unknown",
    val width: Int = 0,
    val height: Int = 0,
    val frames: Long = 0L,
    val lastFrameMs: Long = 0L,
    val streaming: Boolean = false,
)

class DroneStateStore {
    @Volatile var telemetry: TelemetryData = TelemetryData()
        private set
    @Volatile var targetControl: ControlAxes = ControlAxes()
        private set
    @Volatile var measuredControl: ControlAxes = ControlAxes()
        private set
    @Volatile var connection: ConnectionState = ConnectionState()
        private set
    @Volatile var video: VideoState = VideoState()
        private set

    fun updateTelemetry(value: TelemetryData) {
        telemetry = value
        measuredControl = ControlAxes(
            throttle = value.rcThrottle.coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort(),
            yaw = value.rcYaw.coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort(),
            pitch = value.rcPitch.coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort(),
            roll = value.rcRoll.coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort(),
            gimbal = value.rcLeftWheel.coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort(),
        )
    }

    fun updateTarget(value: ControlAxes) { targetControl = value }
    fun resetTarget() { targetControl = ControlAxes() }
    fun updateConnection(value: ConnectionState) { connection = value }
    fun updateVideo(value: VideoState) { video = value }

    fun toJson(): JSONObject = JSONObject().apply {
        put("telemetry", telemetry.toJson())
        put("control", JSONObject().apply {
            put("target", targetControl.toJson())
            put("measured", measuredControl.toJson())
            put("active", targetControl.active)
        })
        put("connection", JSONObject().apply {
            put("transport", connection.transport)
            put("transportOpen", connection.transportOpen)
            put("linkReady", connection.linkReady)
            put("lastRxMs", connection.lastRxMs)
        })
        put("video", JSONObject().apply {
            put("codec", video.codec)
            put("width", video.width)
            put("height", video.height)
            put("frames", video.frames)
            put("lastFrameMs", video.lastFrameMs)
            put("streaming", video.streaming)
        })
    }
}
