package com.potensic.proxy.control

import com.potensic.proxy.core.ControlAxes
import com.potensic.proxy.core.DroneStateStore
import org.json.JSONObject

enum class ControlSource(val wireName: String) {
    NONE("none"),
    WEB("web"),
    TEST("test"),
    EXTERNAL("external"),
}

/**
 * Owns the requested F1-F5 control state independently from protocol serialization.
 * F1-F5 packet encoding remains in the confirmed Potensic protocol implementation.
 */
class ControlCoordinator(private val droneState: DroneStateStore) {
    @Volatile private var source: ControlSource = ControlSource.NONE
    @Volatile private var updatedAtMs: Long = 0L

    fun submit(source: ControlSource, axes: ControlAxes) {
        this.source = source
        updatedAtMs = System.currentTimeMillis()
        droneState.updateTarget(axes)
    }

    fun release(source: ControlSource? = null) {
        if (source == null || this.source == source) {
            this.source = ControlSource.NONE
            updatedAtMs = System.currentTimeMillis()
            droneState.resetTarget()
        }
    }

    fun current(): ControlAxes = droneState.targetControl
    fun active(): Boolean = current().active
    fun activeSource(): ControlSource = source

    fun toJson(): JSONObject = JSONObject().apply {
        put("source", source.wireName)
        put("updatedAtMs", updatedAtMs)
        put("active", active())
        put("target", current().toJson())
        put("measured", droneState.measuredControl.toJson())
    }
}

/** Contract for future BX3/UART/network override adapters. */
interface ControlInputAdapter {
    val id: String
    fun start(onAxes: (ControlAxes) -> Unit)
    fun stop()
}
