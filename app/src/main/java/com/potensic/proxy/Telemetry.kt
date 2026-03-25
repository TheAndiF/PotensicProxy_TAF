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
    fun parse(feType: Int, payload: ByteArray): TelemetryData? {
        // vt1 (FlightRevGps) comes in packets of ~52+ bytes
        if (payload.size < 30) return null

        try {
            // Skip the inner FF FD header (find data start)
            var offset = 0
            if (payload.size > 4 && (payload[0].toInt() and 0xFF) == 0xFF) {
                // Inner command: FF FD [len LE 2] [short LE 2] [cmd 1] [data...]
                offset = 7 // skip FF FD + len(2) + short(2) + cmd(1)
                if (offset >= payload.size - 20) return null
            }

            val data = payload
            val i = offset

            if (i + 26 > data.size) return null

            val tel = TelemetryData(
                flightVoltage = readUShortLE(data, i) / 100f,
                remoterVoltage = readUShortLE(data, i + 2) / 100f,
                longitude = readIntLE(data, i + 4) / 10_000_000.0,
                latitude = readIntLE(data, i + 8) / 10_000_000.0,
                satellites = data[i + 12].toInt() and 0xFF,
                heading = readUShortLE(data, i + 13),
                horizontalDistance = if (i + 18 < data.size) readIntLE(data, i + 15) / 10f else 0f,
                verticalDistance = if (i + 20 < data.size) readShortLE(data, i + 19) / 10f else 0f,
                horizontalSpeed = if (i + 22 < data.size) readUShortLE(data, i + 21) / 10f else 0f,
                verticalSpeed = if (i + 24 < data.size) readShortLE(data, i + 23) / 10f else 0f,
                battery = if (i + 25 < data.size) data[i + 25].toInt() and 0xFF else 0,
                pitch = if (i + 28 < data.size) readShortLE(data, i + 27) else 0,
                roll = if (i + 30 < data.size) readShortLE(data, i + 29) else 0,
                windSpeed = if (i + 34 < data.size) readShortLE(data, i + 33) / 100f else 0f,
                altitude = if (i + 51 < data.size) readIntLE(data, i + 48) else 0,
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
