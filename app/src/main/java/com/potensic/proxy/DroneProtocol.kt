package com.potensic.proxy

/**
 * Potensic Atom 2 USB protocol implementation.
 * Reversed from com.ipotensic.atom APK (deepsea/PixSync 4.0).
 *
 * Packet structure:
 * - HighFrequencyData2 (55 bytes, ID=2, GPS state)
 * - HighFrequencyData1 (47 bytes, ID=1, Location)
 * - HighFrequencyData3 (37 bytes, ID=3, Control input) ← our main target
 *
 * All multi-byte values are LITTLE-ENDIAN signed shorts/ints.
 */
object DroneProtocol {

    // Handshake sent on AOA connection (from AOAEngine.p)
    val HANDSHAKE = hexToBytes("fe00000000000012000000000000000100")

    // Heartbeat pattern (from FlightHeartbeat — 3 zero bytes wrapped in FE transport type 0x14)
    val HEARTBEAT_RAW = ByteArray(3)

    /**
     * Build the exact init sequence that the official Potensic app sends.
     * Captured via smali injection logging (POTENSIC_SPY).
     */
    fun buildInitSequence(): List<ByteArray> {
        return listOf(
            // #1 FPV: GET_FPV_INFO
            hexPkt("fe000000000000160000000000000007 fffd030000161500"),
            // #2 REMOTER: GET_INFO
            hexPkt("fe000000000000170000000000000008 fffe04007310006700"),
            // #3 FPV: GET_SETTINGS
            hexPkt("fe000000000000160000000000000007 fffd030035162000"),
            // #5 CAMERA: GET_MODE
            hexPkt("fe000000000000150000000000000008 fffd040000122036"),
            // #6 FPV: GET_FPV_INFO
            hexPkt("fe000000000000160000000000000007 fffd030000161500"),
            // #8 FLIGHT: INIT
            hexPkt("fe0000000000001400000000000000 0a fffd0600010300 7e 00 7a"),
            // #9 FLIGHT: SET_MODE
            hexPkt("fe0000000000001400000000000000 0b fffd070001030680000083"),
            // #11 CAMERA: GET_MODE (repeat)
            hexPkt("fe000000000000150000000000000008 fffd040000122036"),
            // #16 CAMERA: GET_STATUS
            hexPkt("fe000000000000150000000000000008 fffd040000120117"),
            // #20 CAMERA: LIVEVIEW_START (cmd=0x73, data=0x00 0x64)
            hexPkt("fe000000000000150000000000000009 fffd050000127300 64"),
        )
    }

    /**
     * Build the REAL heartbeat — exactly as the official app sends it.
     * Type 0x14 (FLIGHT), 26 bytes total.
     */
    fun buildHeartbeat(): ByteArray {
        return hexPkt("fe0000000000001400000000000000 0a fffd060000030000000500")
    }

    /**
     * Build the REAL IDR request (cmd=0xD7, NOT 0xD9).
     * The official app sends 0xD7 with a device hash.
     */
    fun buildIDRRequestReal(): ByteArray {
        // cmd=0xD9 (simple IDR request without hash — fallback)
        return wrapFE(buildInnerCommand(0xD9.toByte()), 0x15)
    }

    private fun hexPkt(hex: String): ByteArray {
        val clean = hex.replace(" ", "")
        return ByteArray(clean.length / 2) { i ->
            clean.substring(i * 2, i * 2 + 2).toInt(16).toByte()
        }
    }

    /**
     * Build a HighFrequencyData3 control packet (37 bytes).
     *
     * @param throttle     Left stick vertical (-1000..1000) = up/down
     * @param yaw          Left stick horizontal (-1000..1000) = rotate left/right
     * @param pitch        Right stick vertical (-1000..1000) = forward/backward
     * @param roll         Right stick horizontal (-1000..1000) = strafe left/right
     * @param gimbalTilt   Left wheel (-1000..1000) = camera tilt
     * @param rightWheel   Right wheel (-1000..1000)
     * @param controlPitch Gimbal pitch angle * 100
     * @param phoneLat     Phone latitude (degrees)
     * @param phoneLng     Phone longitude (degrees)
     * @param phoneAngle   Phone compass angle
     */
    fun buildControlPacket(
        throttle: Short = 0,
        yaw: Short = 0,
        pitch: Short = 0,
        roll: Short = 0,
        gimbalTilt: Short = 0,
        rightWheel: Short = 0,
        controlPitch: Short = 0,
        phoneLat: Double = 0.0,
        phoneLng: Double = 0.0,
        phoneAngle: Short = 0,
    ): ByteArray {
        val packet = ByteArray(37)
        var offset = 0

        // Header
        packet[offset++] = 3 // ID = 3 (HighFrequencyData3)
        writeShortLE(packet, offset, 34) // payload length
        offset += 2

        // Control pitch (gimbal angle * 100)
        writeShortLE(packet, offset, controlPitch.toInt())
        offset += 2
        // Minimal logging in hot path

        // Error status (0 = no error)
        writeShortLE(packet, offset, 0)
        offset += 2

        // Phone angle
        writeShortLE(packet, offset, phoneAngle.toInt())
        offset += 2

        // Phone longitude * 10,000,000
        writeIntLE(packet, offset, (phoneLng * 10_000_000).toInt())
        offset += 4

        // Phone latitude * 10,000,000
        writeIntLE(packet, offset, (phoneLat * 10_000_000).toInt())
        offset += 4

        // Joystick values (signed 16-bit shorts)
        writeShortLE(packet, offset, throttle.toInt())   // leftRockerUpDown
        offset += 2
        writeShortLE(packet, offset, yaw.toInt())         // leftRockerLeftRight
        offset += 2
        writeShortLE(packet, offset, pitch.toInt())       // rightRockerUpDown
        offset += 2
        writeShortLE(packet, offset, roll.toInt())        // rightRockerLeftRight
        offset += 2

        // joysticks logged at service level only

        // Wheels
        writeShortLE(packet, offset, gimbalTilt.toInt())  // leftWheel
        offset += 2
        writeShortLE(packet, offset, rightWheel.toInt())  // rightWheel
        offset += 2

        // PWM1-4 (motor thrust — 0 = let flight controller handle it)
        writeShortLE(packet, offset, 0) // pwm1
        offset += 2
        writeShortLE(packet, offset, 0) // pwm2
        offset += 2
        writeShortLE(packet, offset, 0) // pwm3
        offset += 2
        writeShortLE(packet, offset, 0) // pwm4

        // packet hex logged only on first call
        return packet
    }

    /**
     * Parse incoming flight data from the drone/controller.
     * Returns a map of parsed fields for logging and forwarding.
     */
    fun parseIncomingPacket(data: ByteArray, length: Int): Map<String, Any> {
        val result = mutableMapOf<String, Any>()
        if (length < 3) {
            Log.w("[Protocol] Incoming packet too short: $length bytes")
            return result
        }

        val id = data[0].toInt() and 0xFF
        val payloadLen = readShortLE(data, 1)
        result["id"] = id
        result["payloadLen"] = payloadLen
        result["rawLength"] = length

        // No per-packet logging in hot path

        when (id) {
            1 -> {
                result["type"] = "location"
                Log.d("[Protocol] Received location data (ID=1)")
            }
            2 -> {
                result["type"] = "gps_state"
                Log.d("[Protocol] Received GPS state (ID=2)")
            }
            3 -> {
                result["type"] = "control_echo"
                if (length >= 37) {
                    result["throttle"] = readShortLE(data, 17)
                    result["yaw"] = readShortLE(data, 19)
                    result["pitch"] = readShortLE(data, 21)
                    result["roll"] = readShortLE(data, 23)
                    Log.d("[Protocol] Control echo: throttle=${result["throttle"]} yaw=${result["yaw"]} pitch=${result["pitch"]} roll=${result["roll"]}")
                }
            }
            4 -> {
                result["type"] = "telemetry"
                Log.d("[Protocol] Received telemetry (ID=4)")
            }
            5 -> {
                result["type"] = "flight_stats"
                Log.d("[Protocol] Received flight stats (ID=5)")
            }
            else -> {
                result["type"] = "unknown_$id"
            }
        }

        return result
    }

    // === Binary helpers (little-endian) ===

    private fun writeShortLE(arr: ByteArray, offset: Int, value: Int) {
        arr[offset] = (value and 0xFF).toByte()
        arr[offset + 1] = ((value shr 8) and 0xFF).toByte()
    }

    private fun writeIntLE(arr: ByteArray, offset: Int, value: Int) {
        arr[offset] = (value and 0xFF).toByte()
        arr[offset + 1] = ((value shr 8) and 0xFF).toByte()
        arr[offset + 2] = ((value shr 16) and 0xFF).toByte()
        arr[offset + 3] = ((value shr 24) and 0xFF).toByte()
    }

    fun readShortLE(arr: ByteArray, offset: Int): Int {
        return (arr[offset].toInt() and 0xFF) or ((arr[offset + 1].toInt() and 0xFF) shl 8)
    }

    fun readIntLE(arr: ByteArray, offset: Int): Int {
        return (arr[offset].toInt() and 0xFF) or
                ((arr[offset + 1].toInt() and 0xFF) shl 8) or
                ((arr[offset + 2].toInt() and 0xFF) shl 16) or
                ((arr[offset + 3].toInt() and 0xFF) shl 24)
    }

    fun hexToBytes(hex: String): ByteArray {
        val clean = hex.replace(" ", "")
        return ByteArray(clean.length / 2) { i ->
            clean.substring(i * 2, i * 2 + 2).toInt(16).toByte()
        }
    }

    fun bytesToHex(bytes: ByteArray): String =
        bytes.joinToString("") { "%02x".format(it) }

    /**
     * Build a camera command packet.
     * Reversed from zy2.x() + zy2.k()
     *
     * @param cmdByte The command byte (e.g. 0xD9 for IDR request)
     * @param cmdShort The command short (e.g. 0x1200 = 4608 for camera commands)
     * @param typeByte Transport type (21 = 0x15 for camera, 20 for flight)
     */
    fun buildCameraCommand(cmdByte: Byte, cmdShort: Short = 0x1200, typeByte: Byte = 21): ByteArray {
        // Inner payload (zy2.x)
        val payloadSize = 8 // FF FD [len 2] [short 2] [cmd 1] [checksum 1]
        val payload = ByteArray(payloadSize)
        payload[0] = 0xFF.toByte()
        payload[1] = 0xFD.toByte()
        // Length = 3 (1 cmd byte + 1 short high/low... actually len of inner data + 1)
        val innerLen: Short = 4 // cmdShort(2) + cmdByte(1) + checksum already included differently
        writeShortLE(payload, 2, innerLen.toInt())
        writeShortLE(payload, 4, cmdShort.toInt())
        payload[6] = cmdByte
        // XOR checksum over bytes 2..6
        var xor: Byte = 0
        for (i in 2 until payloadSize - 1) {
            xor = (xor.toInt() xor payload[i].toInt()).toByte()
        }
        payload[payloadSize - 1] = xor

        Log.hex("[Protocol] Camera cmd payload", payload)

        // Transport wrapper (zy2.k) — 16 byte header + payload
        val header = ByteArray(16)
        header[0] = 0xFE.toByte()
        header[7] = typeByte
        writeIntLE(header, 12, payload.size)

        val packet = header + payload
        Log.hex("[Protocol] Camera cmd full packet", packet)
        return packet
    }

    /**
     * Build LiveViewParams command — MUST be sent before IDR requests.
     * Reversed from VideoFragment.initData() → h0().O3(Score.INSTANCE.get1080P5MLiveViewParams())
     * g10.H0 = yy2(k53 encoder, type=21, short=4608, byte=0xD8)
     * LiveViewParams(h264Level=0, h264Rate=5000, h265Level=0, h265Rate=5000)
     * k53 encodes: [h264Level, h264Rate_BE_2bytes, h265Level, h265Rate_BE_2bytes]
     */
    /**
     * Build inner camera command with correct endianness.
     * Format: FF FD [len_LE_2] [short_LE_2(0x1200)] [cmd_byte] [data...] [xor_checksum]
     * Reversed from zy2.x() bytecode — ALL shorts are little-endian via kc4.J()
     */
    private fun buildInnerCommand(cmdByte: Byte, data: ByteArray? = null): ByteArray {
        val dataLen = data?.size ?: 0
        // With cmd byte: total = 2(short) + 1(cmd) + dataLen + 1(checksum) = innerLen
        // Without cmd byte: total = 2(short) + dataLen + 1(checksum)
        val hasCmd = true // all our commands have a cmd byte
        // Total inner = FF(1) + FD(1) + len(2) + short(2) + cmd(1) + data + checksum(1) = 8 + dataLen
        val totalSize = 8 + dataLen
        val payload = ByteArray(totalSize)
        val contentLen = 2 + 1 + dataLen + 1 // short + cmd + data + checksum (value written in len field)
        var offset = 0
        payload[offset++] = 0xFF.toByte()
        payload[offset++] = 0xFD.toByte()
        // Length in LITTLE-ENDIAN (kc4.J)
        val lenVal = contentLen
        payload[offset++] = (lenVal and 0xFF).toByte()
        payload[offset++] = ((lenVal shr 8) and 0xFF).toByte()
        // Short 4608 (0x1200) in LITTLE-ENDIAN
        payload[offset++] = 0x00
        payload[offset++] = 0x12
        // Cmd byte
        payload[offset++] = cmdByte
        // Data
        if (data != null) {
            System.arraycopy(data, 0, payload, offset, dataLen)
            offset += dataLen
        }
        // XOR checksum over [2..last-1]
        var xor = 0
        for (i in 2 until payload.size - 1) xor = xor xor (payload[i].toInt() and 0xFF)
        payload[payload.size - 1] = xor.toByte()
        return payload
    }

    private fun wrapFE(inner: ByteArray, feType: Byte = 0x15): ByteArray {
        val header = ByteArray(16)
        header[0] = 0xFE.toByte()
        header[7] = feType
        // Payload length in BIG-ENDIAN at [12-15]
        val plen = inner.size
        header[12] = ((plen shr 24) and 0xFF).toByte()
        header[13] = ((plen shr 16) and 0xFF).toByte()
        header[14] = ((plen shr 8) and 0xFF).toByte()
        header[15] = (plen and 0xFF).toByte()
        return header + inner
    }

    fun buildLiveViewParams(): ByteArray {
        // h264Level/h265Level: 0=1080P, 1=720P, 2=480P
        // h264Rate/h265Rate: bitrate in Kbps (big-endian)
        val liveViewData = byteArrayOf(
            0x00,                   // h264Level = 0 (1080P)
            0x13, 0x88.toByte(),   // h264Rate = 5000 Kbps
            0x00,                   // h265Level = 0 (1080P)
            0x13, 0x88.toByte(),   // h265Rate = 5000 Kbps
        )
        val inner = buildInnerCommand(0xD8.toByte(), liveViewData)
        val packet = wrapFE(inner)
        Log.i("[Protocol] LiveViewParams: ${packet.joinToString(" ") { "%02x".format(it) }}")
        return packet
    }

    fun buildIDRRequest(): ByteArray {
        val inner = buildInnerCommand(0xD9.toByte())
        return wrapFE(inner)
    }
}
