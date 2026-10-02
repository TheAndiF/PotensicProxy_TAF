package com.potensic.proxy.protocol

import com.potensic.proxy.DroneProtocol

/**
 * Stable application-facing boundary around the reverse-engineered Potensic protocol.
 *
 * Keeping this forwarding layer intentionally thin prevents UI/service refactors from
 * changing confirmed packet builders or parsers. Protocol evidence stays in DroneProtocol.
 */
object PotensicProtocol {
    fun buildInitSequence(enableH265: Boolean = true, includeLiveViewStart: Boolean = true) =
        DroneProtocol.buildInitSequence(enableH265, includeLiveViewStart)
    fun buildHeartbeat() = DroneProtocol.buildHeartbeat()
    fun buildIDRRequestD9() = DroneProtocol.buildIDRRequestD9()
    fun buildIDRRequestD7(deviceHash: ByteArray) = DroneProtocol.buildIDRRequestD7(deviceHash)
    fun buildTakeoff() = DroneProtocol.buildTakeoff()
    fun buildLand() = DroneProtocol.buildLand()
    fun buildCancelLand() = DroneProtocol.buildCancelLand()
    fun buildRTH() = DroneProtocol.buildRTH()
    fun buildCancelAutoFly() = DroneProtocol.buildCancelAutoFly()
    fun buildEmergencyStop() = DroneProtocol.buildEmergencyStop()
    fun buildTakePhoto() = DroneProtocol.buildTakePhoto()
    fun buildToggleRecord() = DroneProtocol.buildToggleRecord()
    fun buildFourAxisControl(throttle: Short, yaw: Short, pitch: Short, roll: Short, gimbal: Short) =
        DroneProtocol.buildFourAxisControl(throttle, yaw, pitch, roll, gimbal)
    // Legacy HFD builder remains available only for diagnostics/backward comparison.
    fun buildCombinedControl(throttle: Short, yaw: Short, pitch: Short, roll: Short, gimbalTilt: Short) =
        DroneProtocol.buildCombinedControl(throttle, yaw, pitch, roll, gimbalTilt)
    fun buildWifiDirectSwitch(enter: Boolean) = DroneProtocol.buildWifiDirectSwitch(enter)
    fun buildFpvSyncVersion() = DroneProtocol.buildFpvSyncVersion()
    fun buildCameraFunction(enablePreview: Boolean = true, enableH265: Boolean = true) =
        DroneProtocol.buildCameraFunction(enablePreview, enableH265)
    fun buildLiveViewStart() = DroneProtocol.buildLiveViewStart()
    fun buildLiveViewParams(enableH265: Boolean = true, bitrateKbps: Int = 5000) =
        DroneProtocol.buildLiveViewParams(enableH265, bitrateKbps)
    fun buildRequestFreqParams(enable: Boolean = true) = DroneProtocol.buildRequestFreqParams(enable)
    fun hexToBytes(hex: String) = DroneProtocol.hexToBytes(hex)
    fun bytesToHex(bytes: ByteArray) = DroneProtocol.bytesToHex(bytes)
}
