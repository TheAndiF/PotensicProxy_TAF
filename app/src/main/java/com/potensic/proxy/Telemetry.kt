package com.potensic.proxy

import org.json.JSONObject

/**
 * Drone telemetry parser.
 * Reversed from the official Potensic Atom 2 APK (jadx decompilation).
 *
 * FE type 0x21 → inner FF FD → du1 dispatch by short:
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
    fun parse(feType: Int, payload: ByteArray): TelemetryData? {
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
}
