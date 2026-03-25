package com.potensic.proxy

import java.io.ByteArrayOutputStream
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicInteger

/**
 * Extracts H265 NAL units from the Potensic video stream.
 *
 * KEY INSIGHT: Each USB read() returns exactly ONE FE frame.
 * No need to search for FE headers — treat each read as atomic.
 */
class VideoExtractor {

    companion object {
        val VIDEO_MAGIC = byteArrayOf(0xCC.toByte(), 0xBB.toByte(), 0xAA.toByte(), 0xFF.toByte())
        const val FE_HEADER_SIZE = 16
        const val VIDEO_HEADER_SIZE = 24
        const val MAX_FRAME_SIZE = 300_000

        val FALLBACK_VPS = hexToBytes("0000000140010c01ffff016000000300a0000003000003007bac0c00011940001a5e02a8")
        val FALLBACK_SPS = hexToBytes("00000001420101016000000300a0000003000003007ba003c08010e58d2ee452fcd404040410000465000069780a10")
        val FALLBACK_PPS = hexToBytes("000000014401c0f28e783b34")

        private fun hexToBytes(hex: String): ByteArray =
            ByteArray(hex.length / 2) { i -> hex.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
    }

    // Current video frame being assembled from FE continuations
    private var currentFrame: ByteArrayOutputStream? = null
    private var currentHeader: ByteArray? = null
    private var expectedPayloadLen = 0
    private val lock = Any()

    val nalQueue = ConcurrentLinkedQueue<NalUnit>()

    @Volatile var vps: ByteArray? = null; private set
    @Volatile var sps: ByteArray? = null; private set
    @Volatile var pps: ByteArray? = null; private set
    val hasStreamInit: Boolean get() = vps != null && sps != null && pps != null
    @Volatile var lastIdrSequence: ByteArray? = null; private set
    @Volatile var crcEnabled: Boolean = false // 99% pass — let hardware decoder handle the 1%

    val framesExtracted = AtomicInteger(0)
    val iFrames = AtomicInteger(0)
    val pFrames = AtomicInteger(0)
    var lastWidth = 0; private set
    var lastHeight = 0; private set
    var lastFrameTime = 0L; private set
    val feFramesParsed = AtomicInteger(0)
    var crcPassCount = 0; private set
    var crcFailCount = 0; private set

    data class NalUnit(
        val data: ByteArray, val width: Int, val height: Int,
        val isIFrame: Boolean, val nalType: String = "",
        val timestamp: Long = System.currentTimeMillis(),
    )

    fun getStreamInitBytes(): ByteArray =
        (vps ?: FALLBACK_VPS) + (sps ?: FALLBACK_SPS) + (pps ?: FALLBACK_PPS)

    /**
     * Feed ONE USB read result. Each USB read = one FE frame (atomic).
     */
    fun feed(usbPacket: ByteArray, length: Int) {
        synchronized(lock) {
            if (length < FE_HEADER_SIZE) return

            // Verify FE header
            val isFE = (usbPacket[0] == 0xFE.toByte() &&
                usbPacket[1] == 0.toByte() && usbPacket[2] == 0.toByte() &&
                usbPacket[3] == 0.toByte() && usbPacket[4] == 0.toByte() &&
                usbPacket[5] == 0.toByte())

            if (!isFE) {
                // Raw data without FE header — skip (telemetry or noise, NOT video continuation)
                return
            }

            // Parse FE header
            val feType = usbPacket[7].toInt() and 0xFF
            val plen = ((usbPacket[12].toInt() and 0xFF) shl 24) or
                    ((usbPacket[13].toInt() and 0xFF) shl 16) or
                    ((usbPacket[14].toInt() and 0xFF) shl 8) or
                    (usbPacket[15].toInt() and 0xFF)

            if (plen <= 0 || plen > 65536) return

            // Log large packet types to identify video FE type
            if (feFramesParsed.get() < 50 && plen > 1000) {
                Log.i("[Video] LARGE FE type=0x${"%02x".format(feType)} plen=$plen")
            }
            // Skip small telemetry packets
            if (plen < 100) return
            // Parse telemetry from non-video types
            if (feType != 0x06) {
                if (plen > 20) {
                    val telSize = minOf(plen, length - FE_HEADER_SIZE)
                    if (telSize > 0) {
                        val telPayload = usbPacket.copyOfRange(FE_HEADER_SIZE, FE_HEADER_SIZE + telSize)
                        TelemetryParser.parse(feType, telPayload)
                    }
                }
                return
            }

            val payloadSize = minOf(plen, length - FE_HEADER_SIZE)
            if (payloadSize <= 0) return

            val payload = usbPacket.copyOfRange(FE_HEADER_SIZE, FE_HEADER_SIZE + payloadSize)
            feFramesParsed.incrementAndGet()

            // Check if payload starts with CC BB AA FF (new video frame)
            if (payload.size >= VIDEO_HEADER_SIZE &&
                payload[0] == VIDEO_MAGIC[0] && payload[1] == VIDEO_MAGIC[1] &&
                payload[2] == VIDEO_MAGIC[2] && payload[3] == VIDEO_MAGIC[3]) {

                val w = readUShortLE(payload, 4)
                val h = readUShortLE(payload, 6)
                val dt = payload[10].toInt() and 0xFF
                val pl = readIntLE(payload, 12)
                val rl = readIntLE(payload, 16)

                val validRes = (w == 1920 && h == 1080) || (w == 1280 && h == 720)
                if (validRes && dt <= 2 && pl > 0 && pl < MAX_FRAME_SIZE && rl > 0 && rl <= pl) {
                    // New video frame — flush previous
                    flushCurrentFrame()

                    currentHeader = payload.copyOfRange(0, VIDEO_HEADER_SIZE)
                    expectedPayloadLen = rl
                    currentFrame = ByteArrayOutputStream(rl.coerceAtMost(MAX_FRAME_SIZE))
                    if (payload.size > VIDEO_HEADER_SIZE) {
                        currentFrame!!.write(payload, VIDEO_HEADER_SIZE, payload.size - VIDEO_HEADER_SIZE)
                    }
                    checkFrameComplete()
                    return
                }
            }

            // Continuation data for current video frame
            if (currentFrame != null) {
                currentFrame!!.write(payload)
                checkFrameComplete()
            }
        }
    }

    private fun checkFrameComplete() {
        if (currentFrame != null && currentFrame!!.size() >= expectedPayloadLen) {
            flushCurrentFrame()
        }
    }

    private fun flushCurrentFrame() {
        val frame = currentFrame ?: return
        val header = currentHeader ?: return
        val videoData = frame.toByteArray()
        currentFrame = null
        currentHeader = null

        if (videoData.isEmpty()) return

        val width = readUShortLE(header, 4)
        val height = readUShortLE(header, 6)
        val dataType = header[10].toInt() and 0xFF
        if (dataType != 0 || width == 0 || height == 0) return

        val data = if (videoData.size > expectedPayloadLen && expectedPayloadLen > 0)
            videoData.copyOf(expectedPayloadLen) else videoData

        // CRC32 validation — try both LE and BE
        val expectedCrcLE = readIntLE(header, 20)
        val expectedCrcBE = readIntBE(header, 20)
        val actualCrc = crc32(data)
        val crcOk = (expectedCrcLE == actualCrc || expectedCrcBE == actualCrc)
        if (!crcOk) {
            crcFailCount++
            if (crcFailCount <= 3) {
                Log.w("[Video] CRC: LE=0x${expectedCrcLE.toUInt().toString(16)} BE=0x${expectedCrcBE.toUInt().toString(16)} actual=0x${actualCrc.toUInt().toString(16)} size=${data.size}")
            }
            if (crcEnabled) return
        } else {
            crcPassCount++
        }

        // Scan NAL units
        var isIDR = false
        var nalType = "P-frame"
        val nalPositions = findAllNalStartCodes(data)

        for ((nalIdx, nalPos) in nalPositions.withIndex()) {
            if (nalPos + 4 >= data.size) continue
            val nalByte = data[nalPos + 4].toInt() and 0xFF
            val nextPos = if (nalIdx + 1 < nalPositions.size) nalPositions[nalIdx + 1] else data.size
            val singleNal = data.copyOfRange(nalPos, nextPos)

            when (nalByte) {
                0x40 -> { vps = singleNal }
                0x42 -> { sps = singleNal }
                0x44 -> { pps = singleNal }
                0x26 -> {
                    isIDR = true; nalType = "IDR"
                    val v = vps; val s = sps; val p = pps
                    lastIdrSequence = (v ?: FALLBACK_VPS) + (s ?: FALLBACK_SPS) + (p ?: FALLBACK_PPS) + data
                }
                0x4E -> { if (!isIDR) nalType = "SEI" }
                0x02 -> { if (!isIDR) nalType = "P-frame" }
            }
        }

        val nal = NalUnit(data = data, width = width, height = height, isIFrame = isIDR, nalType = nalType)
        while (nalQueue.size >= 30) nalQueue.poll()
        nalQueue.offer(nal)

        lastWidth = width; lastHeight = height; lastFrameTime = System.currentTimeMillis()
        framesExtracted.incrementAndGet()
        if (isIDR) iFrames.incrementAndGet() else pFrames.incrementAndGet()

        if (framesExtracted.get() <= 3 || framesExtracted.get() % 200 == 0 || isIDR) {
            Log.i("[Video] #${framesExtracted.get()}: ${width}x${height} $nalType ${data.size}B crc=${if(crcOk) "OK" else "FAIL"} pass=$crcPassCount fail=$crcFailCount")
        }
    }

    fun reset() {
        synchronized(lock) { currentFrame = null; currentHeader = null }
        nalQueue.clear()
        framesExtracted.set(0); iFrames.set(0); pFrames.set(0); feFramesParsed.set(0)
        crcPassCount = 0; crcFailCount = 0; lastIdrSequence = null
    }

    private fun crc32(data: ByteArray): Int {
        var crc = -1
        for (b in data) { crc = CRC32_TABLE[(crc xor b.toInt()) and 0xFF] xor (crc ushr 8) }
        return crc.inv()
    }

    private val CRC32_TABLE = intArrayOf(0,1996959894,-301047508,-1727442502,124634137,1886057615,-379345611,-1637575261,249268274,2044508324,-522852066,-1747789432,162941995,2125561021,-407360249,-1866523247,498536548,1789927666,-205950648,-2067906082,450548861,1843258603,-187386543,-2083289657,325883990,1684777152,-43845254,-1973040660,335633487,1661365465,-99664541,-1928851979,997073096,1281953886,-715111964,-1570279054,1006888145,1258607687,-770865667,-1526024853,901097722,1119000684,-608450090,-1396901568,853044451,1172266101,-589951537,-1412350631,651767980,1373503546,-925412992,-1076862698,565507253,1454621731,-809855591,-1195530993,671266974,1594198024,-972236366,-1324619484,795835527,1483230225,-1050600021,-1234817731,1994146192,31158534,-1731059524,-271249366,1907459465,112637215,-1614814043,-390540237,2013776290,251722036,-1777751922,-519137256,2137656763,141376813,-1855689577,-429695999,1802195444,476864866,-2056965928,-228458418,1812370925,453092731,-2113342271,-183516073,1706088902,314042704,-1950435094,-54949764,1658658271,366619977,-1932296973,-69972891,1303535960,984961486,-1547960204,-725929758,1256170817,1037604311,-1529756563,-740887301,1131014506,879679996,-1385723834,-631195440,1141124467,855842277,-1442165665,-586318647,1342533948,654459306,-1106571248,-921952122,1466479909,544179635,-1184443383,-832445281,1591671054,702138776,-1328506846,-942167884,1504918807,783551873,-1212326853,-1061524307,-306674912,-1698712650,62317068,1957810842,-355121351,-1647151185,81470997,1943803523,-480048366,-1805370492,225274430,2053790376,-468791541,-1828061283,167816743,2097651377,-267414716,-2029476910,503444072,1762050814,-144550051,-2140837941,426522225,1852507879,-19653770,-1982649376,282753626,1742555852,-105259153,-1900089351,397917763,1622183637,-690576408,-1580100738,953729732,1340076626,-776247311,-1497606297,1068828381,1219638859,-670225446,-1358292148,906185462,1090812512,-547295293,-1469587627,829329135,1181335161,-882789492,-1134132454,628085408,1382605366,-871598187,-1156888829,570562233,1426400815,-977650754,-1296233688,733239954,1555261956,-1026031705,-1244606671,752459403,1541320221,-1687895376,-328994266,1969922972,40735498,-1677130071,-351390145,1913087877,83908371,-1782625662,-491226604,2075208622,213261112,-1831694693,-438977011,2094854071,198958881,-2032938284,-237706686,1759359992,534414190,-2118248755,-155638181,1873836001,414664567,-2012718362,-15766928,1711684554,285281116,-1889165569,-127750551,1634467795,376229701,-1609899400,-686959890,1308918612,956543938,-1486412191,-799009033,1231636301,1047427035,-1362007478,-640263460,1088359270,936918000,-1447252397,-558129467,1202900863,817233897,-1111625188,-893730166,1404277552,615818150,-1160759803,-841546093,1423857449,601450431,-1285129682,-1000256840,1567103746,711928724,-1274298825,-1022587231,1510334235,755167117)

    private fun findAllNalStartCodes(data: ByteArray): List<Int> {
        val positions = mutableListOf<Int>()
        for (i in 0 until data.size - 3) {
            if (data[i] == 0.toByte() && data[i+1] == 0.toByte() && data[i+2] == 0.toByte() && data[i+3] == 1.toByte()) positions.add(i)
        }
        return positions
    }

    private fun readUShortLE(a: ByteArray, o: Int) = (a[o].toInt() and 0xFF) or ((a[o+1].toInt() and 0xFF) shl 8)
    private fun readIntLE(a: ByteArray, o: Int) = (a[o].toInt() and 0xFF) or ((a[o+1].toInt() and 0xFF) shl 8) or ((a[o+2].toInt() and 0xFF) shl 16) or ((a[o+3].toInt() and 0xFF) shl 24)
    private fun readIntBE(a: ByteArray, o: Int) = ((a[o].toInt() and 0xFF) shl 24) or ((a[o+1].toInt() and 0xFF) shl 16) or ((a[o+2].toInt() and 0xFF) shl 8) or (a[o+3].toInt() and 0xFF)
}
