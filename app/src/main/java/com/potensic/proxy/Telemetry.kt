package com.potensic.proxy

import org.json.JSONObject

/**
 * Drone telemetry parser.
 * Reversed from the official Potensic Atom 2 APK (jadx decompilation).
 *
 * FE type 0x21 → inner FF FD → du1 dispatch by short:
 * Existing project mappings remain available unchanged.
 *
 * Confirmed ATOM parser mappings from PotensicPro app code (v0.7 project concept):
 *   0x0000 → FlightRevFlightInfoData — voltage, longitude, latitude, satellites, directToNorth
 *   0x0001 → FlightRevBatteryData — battery type/cells/temperature/cycles/current/time/capacity
 *   0x0005 → FlightRevHomePointData — home longitude/latitude + sync bit
 *
 * Legacy/current mappings retained unchanged:
 *   0x0200 (512) → vt1 (FlightRevGps) — GPS/flight telemetry
 *   0x0202 (514) → mu1 (FlightRevState) — flight state flags
 *   0x0211 (529) → fu1 (FlightRevRcValue) — physical joystick positions
 *
 * FE type 0x41 → inner FF FD → jw4 dispatch by short:
 *   0x1131 (4401) → hw4 (RemoterRevBattery) — controller battery
 *   0x1133 (4403) → kw4 (RemoterRevState) — buttons + joysticks
 *
 * Inner FF FD frame (for FE types 0x21/0x41, NOT type 0x05):
 *   [0]     0xFF
 *   [1]     0xFD or 0xFE
 *   [2-3]   length (uint16 LE) = iW
 *   [4-5]   command short (uint16 LE)
 *   [6+]    data — passed to parser.d(bArr, offset=6, len=iW-3)
 *   [3+iW]  XOR checksum
 */
data class TelemetryData(
    // Flight GPS (vt1)
    val flightVoltage: Float = 0f,
    val remoterVoltage: Float = 0f,
    val longitude: Double = 0.0,
    val latitude: Double = 0.0,
    val satellites: Int = 0,
    val heading: Int = 0,
    val horizontalDistance: Float = 0f,
    val verticalDistance: Float = 0f,
    val horizontalSpeed: Float = 0f,
    val verticalSpeed: Float = 0f,
    val battery: Int = 0,
    val pitch: Int = 0,
    val roll: Int = 0,
    val windSpeed: Float = 0f,
    val windDirection: Float = 0f,
    val gpsAccuracy: Int = 0,
    val altitude: Float = 0f,
    val remainedFlyTime: Int = 0,
    val gpsUtcTime: Long = 0L,
    val tofHeight: Int = 0,
    // ATOM state block (0x0002)
    val unlocked: Boolean = false,
    val flying: Boolean = false,
    val receiveGps: Boolean = false,
    val following: Boolean = false,
    val circleMode: Boolean = false,
    val pointFly: Boolean = false,
    val returning: Boolean = false,
    val landing: Boolean = false,
    val gyroCalibrating: Boolean = false,
    val magHorizontalCalibrating: Boolean = false,
    val magVerticalCalibrating: Boolean = false,
    val remoterConnected: Boolean = false,
    val takingOff: Boolean = false,
    val flightMode: Int = 2,
    val speedMode: Int = -1,
    val lowPowerMode: Boolean = false,
    val needCalibration: Boolean = false,
    val geomagneticFault: Boolean = false,
    val emergencyStop: Boolean = false,
    val opticalFlow: Boolean = false,
    val gpsInterference: Boolean = false,
    val gpsLocationValid: Boolean = false,
    val gpsSpeedValid: Boolean = false,
    val gimbalNotReady: Boolean = false,
    val flightInNoFlyZone: Boolean = false,
    val findingDrone: Boolean = false,
    val escBeep: Boolean = false,
    // ATOM no-fly status block (0x001E / 30)
    val locatedNoFlyZone: Boolean = false,
    val restrictedZone: Boolean = false,
    val nearNoFlyZone: Boolean = false,
    val nearRestrictedZone: Boolean = false,
    val noFlyHeightLimit: Int = 0,
    val noFlyDistance: Int = 0,
    // ATOM flight setting block (0x0003)
    val limitHeight: Int = 0,
    val limitDistance: Int = 0,
    val returnHeight: Int = 0,
    val beginnerMode: Boolean = false,
    val americaRockerMode: Boolean = true,
    val surroundRadius: Int = 0,
    val surroundClockwise: Boolean = true,
    val surroundSpeed: Int = 0,
    val settingSpeedMode: Int = -1,
    val settingsValid: Boolean = false,
    // ATOM gimbal settings block (0x001A / 26)
    val gimbalPitchControl: Int = 0,
    val gimbalPitchSpeed: Int = 0,
    val gimbalStableMode: Boolean = true,
    val gimbalFpvSmooth: Int = 0,
    val gimbalCalibration: Int = 0,
    val gimbalTuningRoll: Int = 0,
    val gimbalTuningYaw: Int = 0,
    val gimbalReset: Int = 0,
    val gimbalSettingsValid: Boolean = false,
    // Confirmed ATOM Home Point (0x0005)
    val homeLongitude: Double = 0.0,
    val homeLatitude: Double = 0.0,
    val homeSynced: Boolean = false,
    // Confirmed ATOM Battery block (0x0001). Units that are not confirmed stay raw.
    val batteryType: Int = 0,
    val cellVoltage1: Float = 0f,
    val cellVoltage2: Float = 0f,
    val cellVoltage3: Float = 0f,
    val cellVoltage4: Float = 0f,
    val batteryTemperatureRaw: Int = 0,
    val batteryCycleCount: Int = 0,
    val batteryCurrentAbsRaw: Int = 0,
    val batteryRemainingFlightTimeRaw: Int = 0,
    val batteryRemainingCapacityRaw: Int = 0,
    // Remoter battery (hw4)
    val remoterBatteryVoltage: Float = 0f,
    val remoterBatteryPercent: Float = 0f,
    // Physical joystick positions (fu1 / kw4)
    val rcThrottle: Int = 0,
    val rcYaw: Int = 0,
    val rcPitch: Int = 0,
    val rcRoll: Int = 0,
    val rcLeftWheel: Int = 0,
    val rcRightWheel: Int = 0,
    // Remoter buttons (kw4)
    val btnRecord: Boolean = false,
    val btnPhoto: Boolean = false,
    val btnRTH: Boolean = false,
    val btnC1: Boolean = false,
    val btnC2: Boolean = false,
    val timestamp: Long = System.currentTimeMillis(),
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("flightVoltage", flightVoltage)
        put("remoterVoltage", remoterVoltage)
        put("longitude", longitude)
        put("latitude", latitude)
        put("satellites", satellites)
        put("heading", heading)
        put("horizontalDistance", horizontalDistance)
        put("verticalDistance", verticalDistance)
        put("horizontalSpeed", horizontalSpeed)
        put("verticalSpeed", verticalSpeed)
        put("battery", battery)
        put("pitch", pitch)
        put("roll", roll)
        put("windSpeed", windSpeed)
        put("windDirection", windDirection)
        put("gpsAccuracy", gpsAccuracy)
        put("altitude", altitude)
        put("remainedFlyTime", remainedFlyTime)
        put("gpsUtcTime", gpsUtcTime)
        put("tofHeight", tofHeight)
        put("unlocked", unlocked)
        put("flying", flying)
        put("receiveGps", receiveGps)
        put("following", following)
        put("circleMode", circleMode)
        put("pointFly", pointFly)
        put("returning", returning)
        put("landing", landing)
        put("gyroCalibrating", gyroCalibrating)
        put("magHorizontalCalibrating", magHorizontalCalibrating)
        put("magVerticalCalibrating", magVerticalCalibrating)
        put("remoterConnected", remoterConnected)
        put("takingOff", takingOff)
        put("flightMode", flightMode)
        put("speedMode", speedMode)
        put("lowPowerMode", lowPowerMode)
        put("needCalibration", needCalibration)
        put("geomagneticFault", geomagneticFault)
        put("emergencyStop", emergencyStop)
        put("opticalFlow", opticalFlow)
        put("gpsInterference", gpsInterference)
        put("gpsLocationValid", gpsLocationValid)
        put("gpsSpeedValid", gpsSpeedValid)
        put("gimbalNotReady", gimbalNotReady)
        put("flightInNoFlyZone", flightInNoFlyZone)
        put("findingDrone", findingDrone)
        put("escBeep", escBeep)
        put("locatedNoFlyZone", locatedNoFlyZone)
        put("restrictedZone", restrictedZone)
        put("nearNoFlyZone", nearNoFlyZone)
        put("nearRestrictedZone", nearRestrictedZone)
        put("noFlyHeightLimit", noFlyHeightLimit)
        put("noFlyDistance", noFlyDistance)
        put("limitHeight", limitHeight)
        put("limitDistance", limitDistance)
        put("returnHeight", returnHeight)
        put("beginnerMode", beginnerMode)
        put("americaRockerMode", americaRockerMode)
        put("surroundRadius", surroundRadius)
        put("surroundClockwise", surroundClockwise)
        put("surroundSpeed", surroundSpeed)
        put("settingSpeedMode", settingSpeedMode)
        put("settingsValid", settingsValid)
        put("gimbalPitchControl", gimbalPitchControl)
        put("gimbalPitchSpeed", gimbalPitchSpeed)
        put("gimbalStableMode", gimbalStableMode)
        put("gimbalFpvSmooth", gimbalFpvSmooth)
        put("gimbalCalibration", gimbalCalibration)
        put("gimbalTuningRoll", gimbalTuningRoll)
        put("gimbalTuningYaw", gimbalTuningYaw)
        put("gimbalReset", gimbalReset)
        put("gimbalSettingsValid", gimbalSettingsValid)
        put("homeLongitude", homeLongitude)
        put("homeLatitude", homeLatitude)
        put("homeSynced", homeSynced)
        put("batteryType", batteryType)
        put("cellVoltage1", cellVoltage1)
        put("cellVoltage2", cellVoltage2)
        put("cellVoltage3", cellVoltage3)
        put("cellVoltage4", cellVoltage4)
        put("batteryTemperatureRaw", batteryTemperatureRaw)
        put("batteryCycleCount", batteryCycleCount)
        put("batteryCurrentAbsRaw", batteryCurrentAbsRaw)
        put("batteryRemainingFlightTimeRaw", batteryRemainingFlightTimeRaw)
        put("batteryRemainingCapacityRaw", batteryRemainingCapacityRaw)
        put("remoterBatteryVoltage", remoterBatteryVoltage)
        put("remoterBatteryPercent", remoterBatteryPercent)
        put("rcThrottle", rcThrottle)
        put("rcYaw", rcYaw)
        put("rcPitch", rcPitch)
        put("rcRoll", rcRoll)
        put("rcLeftWheel", rcLeftWheel)
        put("rcRightWheel", rcRightWheel)
        put("btnRecord", btnRecord)
        put("btnPhoto", btnPhoto)
        put("btnRTH", btnRTH)
        put("btnC1", btnC1)
        put("btnC2", btnC2)
        put("timestamp", timestamp)
    }
}

object TelemetryParser {

    @Volatile var latest: TelemetryData = TelemetryData(); private set

    // Sub-sources updated independently, merged into latest on each GPS update
    @Volatile private var remoterBatVoltage: Float = 0f
    @Volatile private var remoterBatPercent: Float = 0f
    @Volatile private var rcThrottle: Int = 0
    @Volatile private var rcYaw: Int = 0
    @Volatile private var rcPitch: Int = 0
    @Volatile private var rcRoll: Int = 0
    @Volatile private var rcLeftWheel: Int = 0
    @Volatile private var rcRightWheel: Int = 0
    @Volatile private var btnRecord: Boolean = false
    @Volatile private var btnPhoto: Boolean = false
    @Volatile private var btnRTH: Boolean = false
    @Volatile private var btnC1: Boolean = false
    @Volatile private var btnC2: Boolean = false

    private var logCount = 0
    private var rcLogCount = 0

    /**
     * Parse a raw FE payload (after 16B FE header).
     */
    fun parse(feType: Int, payload: ByteArray, profileId: String? = null): TelemetryData? {
        if (payload.size < 8) return null

        try {
            // Validate FF FD / FF FE inner header
            val b0 = payload[0].toInt() and 0xFF
            val b1 = payload[1].toInt() and 0xFF
            if (b0 != 0xFF || (b1 != 0xFD && b1 != 0xFE)) return null

            val innerLen = readUShortLE(payload, 2)
            val cmdShort = readUShortLE(payload, 4)
            val dataStart = 6
            val dataLen = innerLen - 3
            if (dataStart + dataLen > payload.size || dataLen < 0) return null

            // Log all unique shorts we receive
            if (logCount < 30) {
                val hex = payload.take(minOf(60, payload.size)).joinToString(" ") { "%02x".format(it.toInt() and 0xFF) }
                Log.i("[Telemetry] FE=0x${"%02x".format(feType)} short=0x${"%04x".format(cmdShort)} dataLen=$dataLen hex=$hex")
                logCount++
            }

            when (feType) {
                0x21 -> when (cmdShort) {
                    // v0.7: these mappings/offsets are confirmed for the ATOM app parser.
                    // They are profile-gated so ATOM 2 and existing legacy mappings stay untouched.
                    0x0000 -> if (profileId == "ATOM") return parseAtomFlightInfo(payload, dataStart, dataLen)
                    0x0001 -> if (profileId == "ATOM") parseAtomBattery(payload, dataStart, dataLen)
                    0x0002 -> if (profileId == "ATOM") parseAtomState(payload, dataStart, dataLen)
                    0x0003 -> if (profileId == "ATOM") parseAtomSettings(payload, dataStart, dataLen)
                    0x0005 -> if (profileId == "ATOM") parseAtomHomePoint(payload, dataStart, dataLen)
                    0x001A -> if (profileId == "ATOM") parseAtomGimbalSettings(payload, dataStart, dataLen)
                    0x001E -> if (profileId == "ATOM") parseAtomNoFly(payload, dataStart, dataLen)
                    0x0200 -> return parseFlightGps(payload, dataStart, dataLen)
                    0x0211 -> parseRcValues(payload, dataStart, dataLen)
                }
                0x41 -> when (cmdShort) {
                    0x1131 -> parseRemoterBattery(payload, dataStart, dataLen)
                    0x1133 -> parseRemoterState(payload, dataStart, dataLen)
                }
            }
        } catch (e: Exception) {
            if (logCount < 30) {
                Log.e("[Telemetry] Parse error: ${e.message}")
                logCount++
            }
        }
        return null
    }


    /**
     * Confirmed ATOM 0x0000 Flight Info fields from the PotensicPro parser.
     * Only fixed offsets documented as safe in concept v0.7 are decoded here.
     * No assumptions are made for the format-dependent fields after directToNorth.
     */
    private fun parseAtomFlightInfo(payload: ByteArray, i: Int, dataLen: Int): TelemetryData? {
        if (dataLen < 15) return null
        val fullLayout = dataLen >= 48
        val tel = latest.copy(
            flightVoltage = readUShortLE(payload, i) / 100f,
            remoterVoltage = readUShortLE(payload, i + 2) / 100f,
            longitude = readIntLE(payload, i + 4) / 1.0E7,
            latitude = readIntLE(payload, i + 8) / 1.0E7,
            satellites = payload[i + 12].toInt() and 0xFF,
            heading = readUShortLE(payload, i + 13),
            horizontalDistance = if (dataLen >= 19) { if (fullLayout) readIntLE(payload, i + 15) / 10f else readUShortLE(payload, i + 15) / 10f } else latest.horizontalDistance,
            verticalDistance = if (dataLen >= 19) readShortLE(payload, i + 17) / 10f else latest.verticalDistance,
            horizontalSpeed = if (dataLen >= 21) readUShortLE(payload, i + 19) / 10f else latest.horizontalSpeed,
            verticalSpeed = if (dataLen >= 23) readShortLE(payload, i + 21) / 10f else latest.verticalSpeed,
            battery = if (dataLen >= 24) payload[i + 23].toInt() and 0xFF else latest.battery,
            remainedFlyTime = if (dataLen >= 25) payload[i + 24].toInt() and 0xFF else latest.remainedFlyTime,
            pitch = if (dataLen >= 27) readShortLE(payload, i + 25) else latest.pitch,
            roll = if (dataLen >= 29) readShortLE(payload, i + 27) else latest.roll,
            windSpeed = if (dataLen >= 33) readShortLE(payload, i + 31) / 100f else latest.windSpeed,
            windDirection = if (dataLen >= 35) readShortLE(payload, i + 33) / 100f else latest.windDirection,
            gpsUtcTime = if (dataLen >= 43) readLongLE(payload, i + 35) else latest.gpsUtcTime,
            altitude = if (dataLen >= 47) readIntLE(payload, i + 43) / 1000f else latest.altitude,
            tofHeight = if (dataLen >= 48) payload[i + 47].toInt() else latest.tofHeight,
            remoterBatteryVoltage = remoterBatVoltage,
            remoterBatteryPercent = remoterBatPercent,
            rcThrottle = rcThrottle, rcYaw = rcYaw, rcPitch = rcPitch, rcRoll = rcRoll,
            rcLeftWheel = rcLeftWheel, rcRightWheel = rcRightWheel,
            btnRecord = btnRecord, btnPhoto = btnPhoto, btnRTH = btnRTH, btnC1 = btnC1, btnC2 = btnC2,
            timestamp = System.currentTimeMillis(),
        )
        latest = tel
        return tel
    }


    /** ATOM 0x0002 FlightRevStateData bit layout from PotensicPro. */
    private fun parseAtomState(payload: ByteArray, i: Int, dataLen: Int) {
        if (dataLen < 6) return
        fun bit(v: Int, b: Int) = ((v ushr b) and 1) == 1
        val b0 = payload[i].toInt() and 0xFF
        val b1 = payload[i + 1].toInt() and 0xFF
        val b2 = payload[i + 2].toInt() and 0xFF
        val b3 = payload[i + 3].toInt() and 0xFF
        val b5 = payload[i + 5].toInt() and 0xFF
        val mode = when { bit(b2,3) && !bit(b2,4) -> 2; !bit(b2,3) && bit(b2,4) -> 1; else -> 0 }
        val speed = when ((b2 ushr 6) and 0x03) { 0 -> 0; 1 -> 1; 2 -> 2; else -> -1 }
        val low = ((b2 and 0x03) != 0)
        val b7 = if (dataLen >= 8) payload[i + 7].toInt() and 0xFF else 0
        val b11 = if (dataLen >= 12) payload[i + 11].toInt() and 0xFF else 0
        val b13 = if (dataLen >= 14) payload[i + 13].toInt() and 0xFF else 0
        val b14 = if (dataLen >= 15) payload[i + 14].toInt() and 0xFF else 0
        latest = latest.copy(
            unlocked = bit(b0,0), flying = bit(b0,1), receiveGps = bit(b0,2), following = bit(b0,3),
            circleMode = bit(b0,4), pointFly = bit(b0,5), returning = bit(b0,6), landing = bit(b0,7),
            gyroCalibrating = bit(b1,0), magHorizontalCalibrating = bit(b1,1), magVerticalCalibrating = bit(b1,2),
            remoterConnected = bit(b1,3), takingOff = bit(b1,4), flightMode = mode, speedMode = speed, lowPowerMode = low,
            needCalibration = bit(b3,7), geomagneticFault = bit(b5,0), emergencyStop = bit(b5,5), opticalFlow = bit(b5,7),
            gpsInterference = bit(b7,6), gpsSpeedValid = bit(b11,2), gpsLocationValid = bit(b11,3),
            gimbalNotReady = bit(b13,4), flightInNoFlyZone = bit(b13,6), findingDrone = bit(b14,7),
            escBeep = (dataLen >= 16 && payload[i+15].toInt() != 0) || (dataLen >= 17 && payload[i+16].toInt() != 0),
            timestamp = System.currentTimeMillis(),
        )
    }

    /** ATOM 0x0003 FlightRevSettingData layout from PotensicPro/new FC. */
    private fun parseAtomSettings(payload: ByteArray, i: Int, dataLen: Int) {
        if (dataLen < 10) return
        val newFc = dataLen >= 13
        var o = i
        val limitHeight = if (newFc) readUShortLE(payload, o).also { o += 2 } else (payload[o++].toInt() and 0xFF)
        val limitDistance = readUShortLE(payload, o); o += 2
        val returnHeight = if (newFc) readUShortLE(payload, o).also { o += 2 } else (payload[o++].toInt() and 0xFF)
        val beginner = (payload[o++].toInt() and 0xFF) == 0xFF
        val america = (payload[o++].toInt() and 0xFF) == 0
        val radius = readUShortLE(payload, o); o += 2
        val clockwise = if (o < i + dataLen) payload[o++].toInt() == 1 else latest.surroundClockwise
        val surroundSpeed = if (o < i + dataLen) payload[o++].toInt() and 0xFF else latest.surroundSpeed
        val settingSpeed = if (o < i + dataLen) payload[o].toInt() and 0xFF else latest.settingSpeedMode
        latest = latest.copy(limitHeight=limitHeight, limitDistance=limitDistance, returnHeight=returnHeight, beginnerMode=beginner,
            americaRockerMode=america, surroundRadius=radius, surroundClockwise=clockwise, surroundSpeed=surroundSpeed,
            settingSpeedMode=settingSpeed, settingsValid=true, timestamp=System.currentTimeMillis())
    }



    /** ATOM 0x001E FlightRevNoFlyZone layout from PotensicPro. */
    private fun parseAtomNoFly(payload: ByteArray, i: Int, dataLen: Int) {
        if (dataLen < 12) return
        val flags = payload[i].toInt() and 0xFF
        latest = latest.copy(
            locatedNoFlyZone = (flags and 0x01) != 0,
            restrictedZone = (flags and 0x02) != 0,
            nearNoFlyZone = (flags and 0x04) != 0,
            nearRestrictedZone = (flags and 0x08) != 0,
            noFlyHeightLimit = readIntLE(payload, i + 4),
            noFlyDistance = readIntLE(payload, i + 8),
            timestamp = System.currentTimeMillis(),
        )
    }

    /** ATOM 0x001A FlightRevGimbalSettingData layout from PotensicPro. */
    private fun parseAtomGimbalSettings(payload: ByteArray, i: Int, dataLen: Int) {
        if (dataLen < 11) return
        latest = latest.copy(
            gimbalPitchControl = payload[i].toInt() and 0xFF,
            gimbalPitchSpeed = readUShortLE(payload, i + 1),
            gimbalStableMode = (payload[i + 3].toInt() and 0xFF) == 0,
            gimbalFpvSmooth = payload[i + 4].toInt() and 0xFF,
            gimbalCalibration = payload[i + 5].toInt() and 0xFF,
            gimbalTuningRoll = readShortLE(payload, i + 6),
            gimbalTuningYaw = readShortLE(payload, i + 8),
            gimbalReset = payload[i + 10].toInt() and 0xFF,
            gimbalSettingsValid = true,
            timestamp = System.currentTimeMillis(),
        )
    }

    /** Confirmed ATOM 0x0005 Home Point layout. */
    private fun parseAtomHomePoint(payload: ByteArray, i: Int, dataLen: Int) {
        if (dataLen < 9) return
        latest = latest.copy(
            homeLongitude = readIntLE(payload, i) / 1.0E7,
            homeLatitude = readIntLE(payload, i + 4) / 1.0E7,
            homeSynced = ((payload[i + 8].toInt() and 0xFF) and 0x01) != 0,
            timestamp = System.currentTimeMillis(),
        )
    }

    /**
     * Confirmed ATOM 0x0001 Battery layout. Values whose physical unit is not confirmed
     * by v0.7 are deliberately exported as raw values.
     */
    private fun parseAtomBattery(payload: ByteArray, i: Int, dataLen: Int) {
        if (dataLen < 19) return
        latest = latest.copy(
            batteryType = payload[i].toInt() and 0xFF,
            cellVoltage1 = readUShortLE(payload, i + 1) / 100f,
            cellVoltage2 = readUShortLE(payload, i + 3) / 100f,
            cellVoltage3 = readUShortLE(payload, i + 5) / 100f,
            cellVoltage4 = readUShortLE(payload, i + 7) / 100f,
            batteryTemperatureRaw = readShortLE(payload, i + 9),
            batteryCycleCount = readUShortLE(payload, i + 11),
            batteryCurrentAbsRaw = kotlin.math.abs(readShortLE(payload, i + 13)),
            batteryRemainingFlightTimeRaw = readUShortLE(payload, i + 15),
            batteryRemainingCapacityRaw = readUShortLE(payload, i + 17),
            timestamp = System.currentTimeMillis(),
        )
    }

    /**
     * vt1.java FlightRevGps — main GPS/flight telemetry.
     * Voltage: raw uint16 / 1000 → volts (Atom 2 reports ~7620 for 7.62V)
     */
    private fun parseFlightGps(payload: ByteArray, i: Int, dataLen: Int): TelemetryData? {
        if (dataLen < 26) return null

        val tel = TelemetryData(
            flightVoltage = readUShortLE(payload, i) / 1000f,
            remoterVoltage = readUShortLE(payload, i + 2) / 100f,
            longitude = readIntLE(payload, i + 4) / 1.0E7,
            latitude = readIntLE(payload, i + 8) / 1.0E7,
            satellites = payload[i + 12].toInt() and 0xFF,
            heading = readUShortLE(payload, i + 13),
            horizontalDistance = if (dataLen >= 19) readIntLE(payload, i + 15) / 10f else 0f,
            verticalDistance = if (dataLen >= 21) readShortLE(payload, i + 19) / 10f else 0f,
            horizontalSpeed = if (dataLen >= 23) readUShortLE(payload, i + 21) / 10f else 0f,
            verticalSpeed = if (dataLen >= 25) readShortLE(payload, i + 23) / 10f else 0f,
            battery = if (dataLen >= 26) payload[i + 25].toInt() and 0xFF else 0,
            pitch = if (dataLen >= 29) readShortLE(payload, i + 27) else 0,
            roll = if (dataLen >= 31) readShortLE(payload, i + 29) else 0,
            windSpeed = if (dataLen >= 35) readShortLE(payload, i + 33) / 100f else 0f,
            windDirection = if (dataLen >= 37) readShortLE(payload, i + 35) / 100f else 0f,
            gpsAccuracy = if (dataLen >= 48) (payload[i + 47].toInt() and 0xFF) else 0,
            altitude = if (dataLen >= 52) readIntLE(payload, i + 48) / 1000f else 0f,
            remoterBatteryVoltage = remoterBatVoltage,
            remoterBatteryPercent = remoterBatPercent,
            rcThrottle = rcThrottle,
            rcYaw = rcYaw,
            rcPitch = rcPitch,
            rcRoll = rcRoll,
            rcLeftWheel = rcLeftWheel,
            rcRightWheel = rcRightWheel,
            btnRecord = btnRecord,
            btnPhoto = btnPhoto,
            btnRTH = btnRTH,
            btnC1 = btnC1,
            btnC2 = btnC2,
        )

        latest = tel

        if (logCount < 30) {
            Log.i("[Telemetry] GPS: bat=${tel.battery}% volt=${tel.flightVoltage}V alt=${tel.altitude}m " +
                "sat=${tel.satellites} lat=${tel.latitude} lng=${tel.longitude} " +
                "spd=${tel.horizontalSpeed} heading=${tel.heading}")
        }

        return tel
    }

    /**
     * fu1.java FlightRevRcValue — physical joystick positions from controller.
     * FE type 0x21, short 0x0211 (529).
     * All values are int16 LE at sequential 2-byte offsets.
     */
    private fun parseRcValues(payload: ByteArray, i: Int, dataLen: Int) {
        if (dataLen < 12) return
        rcThrottle = readShortLE(payload, i)       // leftRockerUpDown
        rcYaw = readShortLE(payload, i + 2)         // leftRockerLeftRight
        rcPitch = readShortLE(payload, i + 4)       // rightRockerUpDown
        rcRoll = readShortLE(payload, i + 6)        // rightRockerLeftRight
        rcLeftWheel = readShortLE(payload, i + 8)   // leftWheel (gimbal tilt)
        rcRightWheel = readShortLE(payload, i + 10) // rightWheel

        if (rcLogCount < 5) {
            Log.i("[Telemetry] RC sticks: T=$rcThrottle Y=$rcYaw P=$rcPitch R=$rcRoll LW=$rcLeftWheel RW=$rcRightWheel")
            rcLogCount++
        }
    }

    /**
     * hw4.java RemoterRevBattery — controller battery.
     * FE type 0x41, short 0x1131 (4401).
     */
    private fun parseRemoterBattery(payload: ByteArray, i: Int, dataLen: Int) {
        if (dataLen < 4) return
        remoterBatVoltage = readUShortLE(payload, i) / 100f
        // kc4.o reads IEEE 754 float LE at offset +2
        if (dataLen >= 6) {
            remoterBatPercent = readFloatLE(payload, i + 2)
        }
        if (logCount < 30) {
            Log.i("[Telemetry] RC battery: ${remoterBatVoltage}V ${remoterBatPercent}%")
        }
    }

    /**
     * kw4.java RemoterRevState — buttons + joystick values from remoter.
     * FE type 0x41, short 0x1133 (4403).
     */
    private fun parseRemoterState(payload: ByteArray, i: Int, dataLen: Int) {
        if (dataLen < 15) return
        val flags = payload[i].toInt() and 0xFF
        btnRecord = (flags shr 1) and 1 == 1
        btnPhoto = (flags shr 2) and 1 == 1
        btnRTH = (flags shr 3) and 1 == 1
        btnC1 = (flags shr 4) and 1 == 1
        btnC2 = (flags shr 5) and 1 == 1
        // keyFunction at +1 (uint16 LE)
        // Joystick values at +3 onwards (uint16 LE via kc4.w)
        if (dataLen >= 15) {
            val lh = readUShortLE(payload, i + 3)  // leftRockerHorizontal
            val lv = readUShortLE(payload, i + 5)  // leftRockerVertical
            val rh = readUShortLE(payload, i + 7)  // rightRockerHorizontal
            val rv = readUShortLE(payload, i + 9)  // rightRockerVertical
            val lw = readUShortLE(payload, i + 11) // leftWheel
            val rw = readUShortLE(payload, i + 13) // rightWheel
            // Use kw4 values as fallback if fu1 not available
            if (rcThrottle == 0 && rcYaw == 0 && rcPitch == 0 && rcRoll == 0) {
                rcThrottle = lv
                rcYaw = lh
                rcPitch = rv
                rcRoll = rh
                rcLeftWheel = lw
                rcRightWheel = rw
            }
        }

        if (rcLogCount < 5) {
            Log.i("[Telemetry] RC state: rec=$btnRecord photo=$btnPhoto rth=$btnRTH c1=$btnC1 c2=$btnC2")
            rcLogCount++
        }
    }

    // === Binary helpers ===

    private fun readUShortLE(a: ByteArray, o: Int): Int =
        (a[o].toInt() and 0xFF) or ((a[o + 1].toInt() and 0xFF) shl 8)

    private fun readShortLE(a: ByteArray, o: Int): Int {
        val v = (a[o].toInt() and 0xFF) or ((a[o + 1].toInt() and 0xFF) shl 8)
        return if (v > 32767) v - 65536 else v
    }

    private fun readIntLE(a: ByteArray, o: Int): Int =
        (a[o].toInt() and 0xFF) or ((a[o + 1].toInt() and 0xFF) shl 8) or
        ((a[o + 2].toInt() and 0xFF) shl 16) or ((a[o + 3].toInt() and 0xFF) shl 24)

    private fun readFloatLE(a: ByteArray, o: Int): Float =
        Float.fromBits(readIntLE(a, o))

    private fun readLongLE(a: ByteArray, o: Int): Long {
        var v = 0L
        for (n in 0 until 8) v = v or ((a[o+n].toLong() and 0xFFL) shl (8*n))
        return v
    }
}
