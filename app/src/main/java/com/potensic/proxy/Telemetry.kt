package com.potensic.proxy

import org.json.JSONObject

/**
 * Drone telemetry parser.
 * Reversed from vt1.java (FlightRevGps) in the official Potensic app.
 *
 * FE type 0x32 carries flight GPS telemetry.
 * Inner payload after FE header (16B) + FF FD header:
 *   [0-1]   flightVoltage (uint16 LE / 100)
 *   [2-3]   remoterVoltage (uint16 LE / 100)
 *   [4-7]   longitude (int32 LE / 10,000,000)
 *   [8-11]  latitude (int32 LE / 10,000,000)
 *   [12]    satellitesNum
 *   [13-14] directToNorth (uint16 LE, degrees)
 *   [15-18] horizontalDistance (int32 LE / 10, meters)
 *   [19-20] verticalDistance (int16 LE / 10, meters)
 *   [21-22] horizontalSpeed (uint16 LE / 10, m/s)
 *   [23-24] verticalSpeed (int16 LE / 10, m/s)
 *   [25]    remainedBattery (0-100%)
 *   [27-28] angleOfPitch (int16 LE, degrees)
 *   [29-30] angleOfRoll (int16 LE, degrees)
 *   [33-34] windSpeed (int16 LE / 100, m/s)
 *   [35-36] windDirection (int16 LE / 100, degrees)
 *   [48-51] altitude (int32 LE, cm)
 */
data class TelemetryData(
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
    val altitude: Int = 0,
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
        put("altitude", altitude)
        put("timestamp", timestamp)
    }
}

object TelemetryParser {

    @Volatile var latest: TelemetryData? = null; private set

    /**
     * Parse a raw FE packet that might contain telemetry.
     * Called for every non-video FE packet.
     */
    private var parseCount = 0

    fun parse(feType: Int, payload: ByteArray): TelemetryData? {
        if (payload.size < 10) return null

        try {
            // The inner command starts with FF FD [len] [short] [cmd] [data...]
            // or FF FE [len] [short] [cmd] [data...]
            // Find the data start after the inner header
            var i = 0
            if (payload.size > 4 && (payload[0].toInt() and 0xFF) >= 0xFD) {
                val innerLen = readUShortLE(payload, 2)
                i = 4 + 2 + 1 // FF/FE + len(2) + short(2) + cmd(1) = 7
                // But cmd might have sub-fields, find the actual data
                // The short at [4-5] tells us the command category
                val cmdShort = readUShortLE(payload, 4)
                val cmdByte = if (i - 1 < payload.size) payload[i - 1].toInt() and 0xFF else 0

                // Log first few packets for debugging
                if (parseCount < 5) {
                    val hex = payload.take(30).joinToString(" ") { "%02x".format(it.toInt() and 0xFF) }
                    Log.i("[Telemetry] type=0x${"%02x".format(feType)} short=0x${"%04x".format(cmdShort)} cmd=0x${"%02x".format(cmdByte)} size=${payload.size} hex=$hex")
                    parseCount++
                }

                // Parse type 0x21 short=0x0206 (high-freq flight data, 514 bytes)
                // Also try 0x32/0x0300 (vt1 GPS)
                if (!((feType == 0x21 && cmdShort == 0x0206) || (feType == 0x32 && cmdShort == 0x0300))) return null
            } else {
                return null
            }

            if (i + 12 > payload.size) return null

            // For type 0x21 (high-freq flight data), battery is at relative offset 11
            // maxHeight at offset 7, battery at offset 11
            val bat = if (i + 11 < payload.size) payload[i + 11].toInt() and 0xFF else 0

            // Try to extract what we can — the full vt1 format needs more analysis
            val tel = TelemetryData(
                battery = bat,
                flightVoltage = if (i + 1 < payload.size) (payload[i].toInt() and 0xFF) / 10f else 0f,
                altitude = if (i + 5 < payload.size) readShortLE(payload, i + 4) else 0,
            )

            latest = tel
            return tel
        } catch (e: Exception) {
            return null
        }
    }

    private fun readUShortLE(a: ByteArray, o: Int): Int =
        (a[o].toInt() and 0xFF) or ((a[o + 1].toInt() and 0xFF) shl 8)

    private fun readShortLE(a: ByteArray, o: Int): Int {
        val v = (a[o].toInt() and 0xFF) or ((a[o + 1].toInt() and 0xFF) shl 8)
        return if (v > 32767) v - 65536 else v
    }

    private fun readIntLE(a: ByteArray, o: Int): Int =
        (a[o].toInt() and 0xFF) or ((a[o + 1].toInt() and 0xFF) shl 8) or
        ((a[o + 2].toInt() and 0xFF) shl 16) or ((a[o + 3].toInt() and 0xFF) shl 24)
}
