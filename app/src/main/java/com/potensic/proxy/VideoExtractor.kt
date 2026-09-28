package com.potensic.proxy

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import java.util.zip.CRC32

/**
 * Streaming extractor for Potensic ATOM 2 video transport.
 *
 * USB read boundaries are NOT protocol boundaries. Incoming bytes are therefore
 * processed in two independent streaming stages:
 *   1) USB byte stream -> complete FE packets (16-byte FE header + payload)
 *   2) FE 0x06 payload stream -> complete w42 chunks (CC BB AA FF + 24-byte header)
 *
 * This keeps FE and w42 headers detectable even when they are split across two
 * Android InputStream.read() calls or when several FE packets arrive in one read.
 */
class VideoExtractor {

    @Volatile var captureManager: TransportCaptureManager? = null
    @Volatile private var protocolProfile: DroneProfileManager.Profile? = null
    private var atomFrameBuffer = ByteArray(0)
    private var atomFrameIsKey = false
    val atomFramesParsed = AtomicLong(0)

    fun setProtocolProfile(profile: DroneProfileManager.Profile) {
        synchronized(lock) {
            protocolProfile = profile
            feStreamBuffer = ByteArray(0)
            videoStreamBuffer = ByteArray(0)
            atomFrameBuffer = ByteArray(0)
            atomFrameIsKey = false
            vps = null; sps = null; pps = null; sps264 = null; pps264 = null
            detectedCodec = if (profile.codec == "h264") "h264" else "unknown"
            lastWidth = profile.width
            lastHeight = profile.height
            while (nalQueue.poll() != null) {}
            Log.i("[Video] Protocol profile=${profile.id} transport=${profile.videoTransport} codec=${profile.codec}")
        }
    }

    fun currentProfileId(): String = protocolProfile?.id ?: "UNSET"
    fun currentTransport(): String = protocolProfile?.videoTransport ?: "w42"

    companion object {
        val VIDEO_MAGIC = byteArrayOf(0xCC.toByte(), 0xBB.toByte(), 0xAA.toByte(), 0xFF.toByte())
        const val FE_HEADER_SIZE = 16
        const val VIDEO_HEADER_SIZE = 24
        const val MAX_FE_PAYLOAD_SIZE = 1_000_000
        const val MAX_FE_STREAM_BUFFER = 2_000_000
        const val MAX_VIDEO_PAYLOAD_SIZE = 1_000_000
        const val MAX_VIDEO_STREAM_BUFFER = 2_000_000

        val FALLBACK_VPS = hexToBytes("0000000140010c01ffff016000000300a0000003000003007bac0c00011940001a5e02a8")
        val FALLBACK_SPS = hexToBytes("00000001420101016000000300a0000003000003007ba003c08010e58d2ee452fcd404040410000465000069780a10")
        val FALLBACK_PPS = hexToBytes("000000014401c0f28e783b34")

        private fun hexToBytes(hex: String): ByteArray =
            ByteArray(hex.length / 2) { i -> hex.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
    }

    private val lock = Any()
    private var feStreamBuffer = ByteArray(0)
    private var videoStreamBuffer = ByteArray(0)

    val nalQueue = ConcurrentLinkedQueue<NalUnit>()

    @Volatile var vps: ByteArray? = null; private set
    @Volatile var sps: ByteArray? = null; private set
    @Volatile var pps: ByteArray? = null; private set
    @Volatile var sps264: ByteArray? = null; private set
    @Volatile var pps264: ByteArray? = null; private set
    @Volatile var detectedCodec: String = "unknown"; private set
    @Volatile var lastIdrSequence: ByteArray? = null; private set
    @Volatile var crcEnabled: Boolean = false

    val hasStreamInit: Boolean
        get() = if (detectedCodec == "h264") sps264 != null && pps264 != null else vps != null && sps != null && pps != null

    val usbChunksFed = AtomicLong(0)
    val feFramesParsed = AtomicInteger(0)
    val framesExtracted = AtomicInteger(0)
    val iFrames = AtomicInteger(0)
    val pFrames = AtomicInteger(0)
    val w42MagicHits = AtomicLong(0)
    val w42HeadersParsed = AtomicLong(0)
    val w42InvalidHeaders = AtomicLong(0)
    val w42IncompleteChunks = AtomicLong(0)
    val streamBytesDropped = AtomicLong(0)

    @Volatile var lastWidth = 0; private set
    @Volatile var lastHeight = 0; private set
    @Volatile var lastFrameTime = 0L; private set
    @Volatile var crcPassCount = 0; private set
    @Volatile var crcFailCount = 0; private set
    @Volatile var feStreamBufferBytes = 0; private set
    @Volatile var videoStreamBufferBytes = 0; private set

    private data class FeTrafficCounter(
        val packets: AtomicLong = AtomicLong(0),
        val bytes: AtomicLong = AtomicLong(0),
        val payloadBytes: AtomicLong = AtomicLong(0),
        var windowStartedMs: Long = System.currentTimeMillis(),
        var windowBytes: Long = 0,
        var windowPackets: Long = 0,
        var bytesPerSecond: Long = 0,
        var packetsPerSecond: Long = 0,
        var lastPacketMs: Long = 0,
        val samples: MutableList<String> = mutableListOf(),
    )

    data class FeTrafficSnapshot(
        val feType: Int,
        val packets: Long,
        val bytes: Long,
        val payloadBytes: Long,
        val bytesPerSecond: Long,
        val packetsPerSecond: Long,
        val lastPacketMs: Long,
        val samples: List<String>,
    )

    data class ParserSnapshot(
        val usbChunksFed: Long,
        val fePacketsParsed: Int,
        val feStreamBufferBytes: Int,
        val videoStreamBufferBytes: Int,
        val w42MagicHits: Long,
        val w42HeadersParsed: Long,
        val w42InvalidHeaders: Long,
        val w42IncompleteChunks: Long,
        val streamBytesDropped: Long,
        val detectedCodec: String,
    )

    data class NalUnit(
        val data: ByteArray,
        val width: Int,
        val height: Int,
        val isIFrame: Boolean,
        val nalType: String = "",
        val codec: String = "unknown",
        val timestamp: Long = System.currentTimeMillis(),
    )

    private data class NalStart(val start: Int, val header: Int)

    private val feTraffic = ConcurrentHashMap<Int, FeTrafficCounter>()

    fun getStreamInitBytes(codec: String = detectedCodec): ByteArray {
        return if (codec == "h264") {
            val s = sps264 ?: ByteArray(0)
            val p = pps264 ?: ByteArray(0)
            s + p
        } else {
            (vps ?: FALLBACK_VPS) + (sps ?: FALLBACK_SPS) + (pps ?: FALLBACK_PPS)
        }
    }

    fun getParserSnapshot() = ParserSnapshot(
        usbChunksFed = usbChunksFed.get(),
        fePacketsParsed = feFramesParsed.get(),
        feStreamBufferBytes = feStreamBufferBytes,
        videoStreamBufferBytes = videoStreamBufferBytes,
        w42MagicHits = w42MagicHits.get(),
        w42HeadersParsed = w42HeadersParsed.get(),
        w42InvalidHeaders = w42InvalidHeaders.get(),
        w42IncompleteChunks = w42IncompleteChunks.get(),
        streamBytesDropped = streamBytesDropped.get(),
        detectedCodec = detectedCodec,
    )

    fun hasRecentFeTraffic(feType: Int, maxAgeMs: Long = 2500L): Boolean {
        val counter = feTraffic[feType] ?: return false
        return System.currentTimeMillis() - counter.lastPacketMs <= maxAgeMs
    }

    fun getFeTrafficSnapshot(): List<FeTrafficSnapshot> = feTraffic.entries.map { (feType, counter) ->
        synchronized(counter) {
            val active = System.currentTimeMillis() - counter.lastPacketMs < 2000
            FeTrafficSnapshot(
                feType = feType,
                packets = counter.packets.get(),
                bytes = counter.bytes.get(),
                payloadBytes = counter.payloadBytes.get(),
                bytesPerSecond = if (active) counter.bytesPerSecond else 0,
                packetsPerSecond = if (active) counter.packetsPerSecond else 0,
                lastPacketMs = counter.lastPacketMs,
                samples = counter.samples.toList(),
            )
        }
    }.sortedBy { it.feType }

    /** Feed an arbitrary USB read chunk. It may contain partial, one, or multiple FE packets. */
    fun feed(usbChunk: ByteArray, length: Int) {
        if (length <= 0) return
        synchronized(lock) {
            usbChunksFed.incrementAndGet()
            val safeLength = minOf(length, usbChunk.size)
            appendFeBytes(usbChunk, safeLength)
            parseFeStream()
        }
    }

    private fun appendFeBytes(data: ByteArray, length: Int) {
        val incoming = data.copyOfRange(0, length)
        feStreamBuffer = if (feStreamBuffer.isEmpty()) incoming else feStreamBuffer + incoming
        if (feStreamBuffer.size > MAX_FE_STREAM_BUFFER) {
            val keep = minOf(MAX_FE_STREAM_BUFFER / 2, feStreamBuffer.size)
            val drop = feStreamBuffer.size - keep
            streamBytesDropped.addAndGet(drop.toLong())
            feStreamBuffer = feStreamBuffer.copyOfRange(drop, feStreamBuffer.size)
            Log.w("[Video] FE stream buffer overflow; dropped $drop oldest bytes")
        }
        feStreamBufferBytes = feStreamBuffer.size
    }

    private fun parseFeStream() {
        var cursor = 0
        while (true) {
            if (feStreamBuffer.size - cursor < FE_HEADER_SIZE) break

            val header = findFeHeader(feStreamBuffer, cursor)
            if (header < 0) {
                // Keep only enough trailing bytes to complete a split FE header next time.
                val keep = minOf(FE_HEADER_SIZE - 1, feStreamBuffer.size)
                val drop = feStreamBuffer.size - keep
                if (drop > 0) streamBytesDropped.addAndGet(drop.toLong())
                feStreamBuffer = feStreamBuffer.copyOfRange(feStreamBuffer.size - keep, feStreamBuffer.size)
                feStreamBufferBytes = feStreamBuffer.size
                return
            }

            if (header > cursor) streamBytesDropped.addAndGet((header - cursor).toLong())
            if (feStreamBuffer.size - header < FE_HEADER_SIZE) {
                cursor = header
                break
            }

            val payloadLen = readIntBE(feStreamBuffer, header + 12)
            if (payloadLen <= 0 || payloadLen > MAX_FE_PAYLOAD_SIZE) {
                cursor = header + 1
                continue
            }

            val packetLen = FE_HEADER_SIZE + payloadLen
            if (header + packetLen > feStreamBuffer.size) {
                cursor = header
                break
            }

            val packet = feStreamBuffer.copyOfRange(header, header + packetLen)
            processFePacket(packet, payloadLen)
            cursor = header + packetLen
        }

        if (cursor > 0) {
            feStreamBuffer = feStreamBuffer.copyOfRange(cursor, feStreamBuffer.size)
        }
        feStreamBufferBytes = feStreamBuffer.size
    }

    private fun processFePacket(packet: ByteArray, payloadLen: Int) {
        val feType = packet[7].toInt() and 0xFF
        recordFeTraffic(feType, packet, packet.size, payloadLen)
        feFramesParsed.incrementAndGet()

        val payload = packet.copyOfRange(FE_HEADER_SIZE, FE_HEADER_SIZE + payloadLen)
        captureManager?.recordFePacket(feType, packet, payload)
        if (feType != 0x06) {
            if (payload.size > 6) TelemetryParser.parse(feType, payload)
            return
        }

        val profile = protocolProfile
        if (profile?.videoTransport == "atom_h264_fe06") {
            processAtomPayload(payload, profile)
        } else {
            appendVideoBytes(payload)
            parseVideoStream()
        }
    }

    /**
     * Potensic ATOM FE06 transport discovered from a real controller capture.
     * Each FE06 payload carries a 3-byte transport prefix:
     *   byte 0 sequence, byte 1 flags, byte 2 frame class.
     * Flag 0x08 starts an access unit, 0x04 ends it and 0x01 marks the keyframe class.
     * The bytes after the prefix form a normal H.264 Annex-B stream.
     */
    private fun processAtomPayload(payload: ByteArray, profile: DroneProfileManager.Profile) {
        val strip = profile.stripBytesPerPacket
        if (payload.size <= strip) return
        val flags = if (payload.size > 1) payload[1].toInt() and 0xFF else 0
        val frameClass = if (payload.size > 2) payload[2].toInt() and 0xFF else 0
        val start = (flags and profile.startMask) != 0
        val end = (flags and profile.endMask) != 0
        val keyHint = (flags and profile.keyMask) != 0 || frameClass == 0x05
        val video = payload.copyOfRange(strip, payload.size)

        if (start) {
            if (atomFrameBuffer.isNotEmpty()) {
                streamBytesDropped.addAndGet(atomFrameBuffer.size.toLong())
            }
            atomFrameBuffer = video
            atomFrameIsKey = keyHint
        } else if (atomFrameBuffer.isNotEmpty()) {
            atomFrameBuffer += video
            atomFrameIsKey = atomFrameIsKey || keyHint
        } else {
            // Ignore a continuation seen before the first start marker.
            return
        }

        videoStreamBufferBytes = atomFrameBuffer.size
        if (atomFrameBuffer.size > MAX_VIDEO_STREAM_BUFFER) {
            streamBytesDropped.addAndGet(atomFrameBuffer.size.toLong())
            atomFrameBuffer = ByteArray(0)
            atomFrameIsKey = false
            videoStreamBufferBytes = 0
            return
        }

        if (end) {
            val frame = atomFrameBuffer
            val key = atomFrameIsKey
            atomFrameBuffer = ByteArray(0)
            atomFrameIsKey = false
            videoStreamBufferBytes = 0
            processAtomAccessUnit(frame, profile, key)
        }
    }

    private fun processAtomAccessUnit(data: ByteArray, profile: DroneProfileManager.Profile, keyHint: Boolean) {
        if (data.size < 5) return
        val starts = findNalStartCodes(data)
        var containsPicture = false
        var isIdr = keyHint
        var containsSps = false
        var containsPps = false

        for ((index, start) in starts.withIndex()) {
            if (start.header >= data.size) continue
            val nextStart = if (index + 1 < starts.size) starts[index + 1].start else data.size
            if (nextStart <= start.start) continue
            val nal = data.copyOfRange(start.start, nextStart)
            when (data[start.header].toInt() and 0x1F) {
                7 -> { sps264 = nal; containsSps = true }
                8 -> { pps264 = nal; containsPps = true }
                5 -> { isIdr = true; containsPicture = true }
                1 -> containsPicture = true
            }
        }
        if (!containsPicture) return

        detectedCodec = "h264"
        var queued = data
        if (isIdr && !(containsSps && containsPps)) {
            val init = getStreamInitBytes("h264")
            if (init.isNotEmpty()) queued = init + data
        }

        val nalUnit = NalUnit(
            data = queued,
            width = profile.width,
            height = profile.height,
            isIFrame = isIdr,
            nalType = if (isIdr) "IDR" else "P-frame",
            codec = "h264",
        )
        while (nalQueue.size >= 30) nalQueue.poll()
        nalQueue.offer(nalUnit)
        lastWidth = profile.width
        lastHeight = profile.height
        lastFrameTime = System.currentTimeMillis()
        framesExtracted.incrementAndGet()
        atomFramesParsed.incrementAndGet()
        if (isIdr) { iFrames.incrementAndGet(); lastIdrSequence = queued } else pFrames.incrementAndGet()
    }

    private fun appendVideoBytes(payload: ByteArray) {
        if (payload.isEmpty()) return
        videoStreamBuffer = if (videoStreamBuffer.isEmpty()) payload else videoStreamBuffer + payload
        if (videoStreamBuffer.size > MAX_VIDEO_STREAM_BUFFER) {
            // Prefer resynchronizing at the newest known w42 magic. If none exists, keep a small tail.
            val newestMagic = findLastMagic(videoStreamBuffer)
            if (newestMagic > 0) {
                streamBytesDropped.addAndGet(newestMagic.toLong())
                videoStreamBuffer = videoStreamBuffer.copyOfRange(newestMagic, videoStreamBuffer.size)
            } else if (videoStreamBuffer.size > VIDEO_HEADER_SIZE) {
                val keep = VIDEO_HEADER_SIZE - 1
                val drop = videoStreamBuffer.size - keep
                streamBytesDropped.addAndGet(drop.toLong())
                videoStreamBuffer = videoStreamBuffer.copyOfRange(drop, videoStreamBuffer.size)
            }
            Log.w("[Video] w42 stream buffer overflow; resynchronized to ${videoStreamBuffer.size} bytes")
        }
        videoStreamBufferBytes = videoStreamBuffer.size
    }

    private fun parseVideoStream() {
        while (true) {
            if (videoStreamBuffer.size < VIDEO_MAGIC.size) return
            val magic = findMagic(videoStreamBuffer, 0)
            if (magic < 0) {
                // Keep 3 bytes so a CC BB AA FF marker can span the next FE packet.
                val keep = minOf(VIDEO_MAGIC.size - 1, videoStreamBuffer.size)
                val drop = videoStreamBuffer.size - keep
                if (drop > 0) streamBytesDropped.addAndGet(drop.toLong())
                videoStreamBuffer = videoStreamBuffer.copyOfRange(videoStreamBuffer.size - keep, videoStreamBuffer.size)
                videoStreamBufferBytes = videoStreamBuffer.size
                return
            }

            if (magic > 0) {
                streamBytesDropped.addAndGet(magic.toLong())
                videoStreamBuffer = videoStreamBuffer.copyOfRange(magic, videoStreamBuffer.size)
            }

            if (videoStreamBuffer.size < VIDEO_HEADER_SIZE) {
                videoStreamBufferBytes = videoStreamBuffer.size
                return
            }

            val width = readUShortLE(videoStreamBuffer, 4)
            val height = readUShortLE(videoStreamBuffer, 6)
            val frameOrder = readUShortLE(videoStreamBuffer, 8)
            val dataType = videoStreamBuffer[10].toInt() and 0xFF
            val refreshType = videoStreamBuffer[11].toInt() and 0xFF
            val payloadLen = readIntLE(videoStreamBuffer, 12)
            val realPayloadLen = readIntLE(videoStreamBuffer, 16)

            val saneDimensions = width in 16..8192 && height in 16..8192
            val saneHeader = saneDimensions && dataType <= 2 && payloadLen in 1..MAX_VIDEO_PAYLOAD_SIZE &&
                realPayloadLen in 1..payloadLen

            if (!saneHeader) {
                w42MagicHits.incrementAndGet()
                w42InvalidHeaders.incrementAndGet()
                if (w42InvalidHeaders.get() <= 5) {
                    Log.w("[Video] Invalid w42 header w=${width} h=${height} type=$dataType refresh=$refreshType payload=$payloadLen real=$realPayloadLen")
                }
                // Move one byte past the current false-positive magic and rescan.
                videoStreamBuffer = videoStreamBuffer.copyOfRange(1, videoStreamBuffer.size)
                videoStreamBufferBytes = videoStreamBuffer.size
                continue
            }

            val totalChunkLen = VIDEO_HEADER_SIZE + payloadLen
            if (videoStreamBuffer.size < totalChunkLen) {
                w42IncompleteChunks.incrementAndGet()
                videoStreamBufferBytes = videoStreamBuffer.size
                return
            }

            w42MagicHits.incrementAndGet()
            w42HeadersParsed.incrementAndGet()

            val header = videoStreamBuffer.copyOfRange(0, VIDEO_HEADER_SIZE)
            val videoData = videoStreamBuffer.copyOfRange(VIDEO_HEADER_SIZE, VIDEO_HEADER_SIZE + realPayloadLen)
            if (dataType == 0) {
                processVideoChunk(videoData, header, width, height, frameOrder, refreshType == 0)
            }

            videoStreamBuffer = videoStreamBuffer.copyOfRange(totalChunkLen, videoStreamBuffer.size)
            videoStreamBufferBytes = videoStreamBuffer.size
        }
    }

    private fun processVideoChunk(
        data: ByteArray,
        header: ByteArray,
        width: Int,
        height: Int,
        frameOrder: Int,
        headerIntra: Boolean,
    ) {
        if (data.isEmpty()) return

        val expectedCrcLE = readIntLE(header, 20)
        val expectedCrcBE = readIntBE(header, 20)
        val actualCrc = crc32(data)
        val crcOk = expectedCrcLE == actualCrc || expectedCrcBE == actualCrc
        if (crcOk) crcPassCount++ else {
            crcFailCount++
            if (crcFailCount <= 3) {
                Log.w("[Video] CRC mismatch frameOrder=$frameOrder LE=0x${expectedCrcLE.toUInt().toString(16)} BE=0x${expectedCrcBE.toUInt().toString(16)} actual=0x${actualCrc.toUInt().toString(16)} size=${data.size}")
            }
            if (crcEnabled) return
        }

        val nalStarts = findNalStartCodes(data)
        var isIDR = headerIntra
        var containsPicture = false
        var codec = detectedCodec
        var nalTypeLabel = if (headerIntra) "I-frame" else "P-frame"

        for ((index, start) in nalStarts.withIndex()) {
            if (start.header >= data.size) continue
            val nextStart = if (index + 1 < nalStarts.size) nalStarts[index + 1].start else data.size
            if (nextStart <= start.start) continue
            val nal = data.copyOfRange(start.start, nextStart)
            val first = data[start.header].toInt() and 0xFF
            val second = if (start.header + 1 < data.size) data[start.header + 1].toInt() and 0xFF else 0

            val h265Type = (first ushr 1) and 0x3F
            val h264Type = first and 0x1F
            val looksH265 = (second and 0x07) != 0 && h265Type in setOf(0, 1, 19, 20, 21, 32, 33, 34, 39, 40)
            val thisCodec = when {
                h265Type in 32..34 && looksH265 -> "h265"
                h264Type == 7 || h264Type == 8 || h264Type == 5 -> "h264"
                detectedCodec == "h265" -> "h265"
                detectedCodec == "h264" -> "h264"
                looksH265 -> "h265"
                h264Type == 1 || h264Type == 6 -> "h264"
                else -> "unknown"
            }

            if (thisCodec == "h265") {
                codec = "h265"
                when (h265Type) {
                    32 -> vps = nal
                    33 -> sps = nal
                    34 -> pps = nal
                    19, 20, 21 -> { isIDR = true; containsPicture = true; nalTypeLabel = "IDR" }
                    0, 1 -> { containsPicture = true; if (!isIDR) nalTypeLabel = "P-frame" }
                }
            } else if (thisCodec == "h264") {
                codec = "h264"
                when (h264Type) {
                    7 -> sps264 = nal
                    8 -> pps264 = nal
                    5 -> { isIDR = true; containsPicture = true; nalTypeLabel = "IDR" }
                    1 -> { containsPicture = true; if (!isIDR) nalTypeLabel = "P-frame" }
                }
            }
        }

        // If no Annex-B start code was found, keep the w42 refresh flag as a fallback.
        if (nalStarts.isEmpty()) containsPicture = data.size > 4
        if (!containsPicture) return

        if (codec != "unknown") detectedCodec = codec
        val resolvedCodec = if (codec == "unknown") detectedCodec else codec

        var queuedData = data
        if (isIDR) {
            val init = getStreamInitBytes(resolvedCodec)
            if (init.isNotEmpty()) queuedData = init + data
            lastIdrSequence = queuedData
        }

        val nalUnit = NalUnit(
            data = queuedData,
            width = width,
            height = height,
            isIFrame = isIDR,
            nalType = nalTypeLabel,
            codec = resolvedCodec,
        )
        while (nalQueue.size >= 30) nalQueue.poll()
        nalQueue.offer(nalUnit)

        lastWidth = width
        lastHeight = height
        lastFrameTime = System.currentTimeMillis()
        val count = framesExtracted.incrementAndGet()
        if (isIDR) iFrames.incrementAndGet() else pFrames.incrementAndGet()

        if (count <= 3 || count % 200 == 0 || isIDR) {
            Log.i("[Video] #$count: ${width}x$height $nalTypeLabel codec=$resolvedCodec ${data.size}B crc=${if (crcOk) "OK" else "FAIL"} w42=${w42HeadersParsed.get()}")
        }
    }

    private fun recordFeTraffic(feType: Int, packet: ByteArray, length: Int, payloadBytes: Int) {
        val now = System.currentTimeMillis()
        val counter = feTraffic.computeIfAbsent(feType) { FeTrafficCounter(windowStartedMs = now) }
        counter.packets.incrementAndGet()
        counter.bytes.addAndGet(length.toLong())
        counter.payloadBytes.addAndGet(payloadBytes.coerceAtLeast(0).toLong())
        synchronized(counter) {
            counter.lastPacketMs = now
            counter.windowBytes += length
            counter.windowPackets += 1
            val elapsed = now - counter.windowStartedMs
            if (elapsed >= 1000) {
                counter.bytesPerSecond = counter.windowBytes * 1000L / elapsed.coerceAtLeast(1)
                counter.packetsPerSecond = counter.windowPackets * 1000L / elapsed.coerceAtLeast(1)
                counter.windowStartedMs = now
                counter.windowBytes = 0
                counter.windowPackets = 0
            }
            if (counter.samples.size < 3) {
                val sampleLen = minOf(length, 64)
                val hex = packet.take(sampleLen).joinToString(" ") { "%02x".format(it.toInt() and 0xFF) }
                counter.samples += hex
                Log.i("[FE-Diag] FE=0x${"%02X".format(feType)} sample#${counter.samples.size} len=$length payload=$payloadBytes: $hex")
            }
        }
    }

    fun reset() {
        synchronized(lock) {
            feStreamBuffer = ByteArray(0)
            videoStreamBuffer = ByteArray(0)
            feStreamBufferBytes = 0
            videoStreamBufferBytes = 0
        }
        nalQueue.clear()
        vps = null; sps = null; pps = null; sps264 = null; pps264 = null
        detectedCodec = "unknown"
        lastIdrSequence = null
        framesExtracted.set(0); iFrames.set(0); pFrames.set(0); feFramesParsed.set(0)
        usbChunksFed.set(0); w42MagicHits.set(0); w42HeadersParsed.set(0); w42InvalidHeaders.set(0)
        w42IncompleteChunks.set(0); streamBytesDropped.set(0)
        feTraffic.clear()
        crcPassCount = 0; crcFailCount = 0
        lastWidth = 0; lastHeight = 0; lastFrameTime = 0
    }

    private fun findFeHeader(data: ByteArray, start: Int): Int {
        var i = start.coerceAtLeast(0)
        while (i <= data.size - FE_HEADER_SIZE) {
            if (data[i] == 0xFE.toByte() && data[i + 1] == 0.toByte() && data[i + 2] == 0.toByte() &&
                data[i + 3] == 0.toByte() && data[i + 4] == 0.toByte() && data[i + 5] == 0.toByte()) return i
            i++
        }
        return -1
    }

    private fun findMagic(data: ByteArray, start: Int): Int {
        var i = start.coerceAtLeast(0)
        while (i <= data.size - VIDEO_MAGIC.size) {
            if (data[i] == VIDEO_MAGIC[0] && data[i + 1] == VIDEO_MAGIC[1] &&
                data[i + 2] == VIDEO_MAGIC[2] && data[i + 3] == VIDEO_MAGIC[3]) return i
            i++
        }
        return -1
    }

    private fun findLastMagic(data: ByteArray): Int {
        var i = data.size - VIDEO_MAGIC.size
        while (i >= 0) {
            if (data[i] == VIDEO_MAGIC[0] && data[i + 1] == VIDEO_MAGIC[1] &&
                data[i + 2] == VIDEO_MAGIC[2] && data[i + 3] == VIDEO_MAGIC[3]) return i
            i--
        }
        return -1
    }

    private fun findNalStartCodes(data: ByteArray): List<NalStart> {
        val starts = mutableListOf<NalStart>()
        var i = 0
        while (i < data.size - 2) {
            if (i + 3 < data.size && data[i] == 0.toByte() && data[i + 1] == 0.toByte() &&
                data[i + 2] == 0.toByte() && data[i + 3] == 1.toByte()) {
                starts += NalStart(i, i + 4)
                i += 4
            } else if (data[i] == 0.toByte() && data[i + 1] == 0.toByte() && data[i + 2] == 1.toByte()) {
                starts += NalStart(i, i + 3)
                i += 3
            } else i++
        }
        return starts
    }

    private fun crc32(data: ByteArray): Int {
        val crc = CRC32()
        crc.update(data)
        return crc.value.toInt()
    }

    private fun readUShortLE(a: ByteArray, o: Int) = (a[o].toInt() and 0xFF) or ((a[o + 1].toInt() and 0xFF) shl 8)
    private fun readIntLE(a: ByteArray, o: Int) = (a[o].toInt() and 0xFF) or ((a[o + 1].toInt() and 0xFF) shl 8) or ((a[o + 2].toInt() and 0xFF) shl 16) or ((a[o + 3].toInt() and 0xFF) shl 24)
    private fun readIntBE(a: ByteArray, o: Int) = ((a[o].toInt() and 0xFF) shl 24) or ((a[o + 1].toInt() and 0xFF) shl 16) or ((a[o + 2].toInt() and 0xFF) shl 8) or (a[o + 3].toInt() and 0xFF)
}
