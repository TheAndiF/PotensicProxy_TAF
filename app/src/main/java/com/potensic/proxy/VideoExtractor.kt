package com.potensic.proxy

import java.io.ByteArrayOutputStream
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicInteger

/**
 * Extracts H265 NAL units from the Potensic video stream.
 *
 * Pipeline: USB raw → FE transport (16B header, BE length) → reassemble video frames
 *           → CC BB AA FF (24B header) → H265 NAL units
 *
 * Key insight: each FE payload that starts with CC BB AA FF is a NEW video frame.
 * FE payloads that DON'T start with CC BB AA FF are CONTINUATIONS of the previous frame.
 */
class VideoExtractor {

    companion object {
        val VIDEO_MAGIC = byteArrayOf(0xCC.toByte(), 0xBB.toByte(), 0xAA.toByte(), 0xFF.toByte())
        const val FE_HEADER_SIZE = 16
        const val VIDEO_HEADER_SIZE = 24
        const val MAX_FRAME_SIZE = 300_000 // IDR can be 130KB+
        const val MAX_QUEUE_SIZE = 300

        val FALLBACK_VPS = hexToBytes("0000000140010c01ffff016000000300a0000003000003007bac0c00011940001a5e02a8")
        val FALLBACK_SPS = hexToBytes("00000001420101016000000300a0000003000003007ba003c08010e58d2ee452fcd404040410000465000069780a10")
        val FALLBACK_PPS = hexToBytes("000000014401c0f28e783b34")

        private fun hexToBytes(hex: String): ByteArray =
            ByteArray(hex.length / 2) { i -> hex.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
    }

    // Raw USB accumulator
    private val rawBuffer = ByteArrayOutputStream(256 * 1024)
    private val lock = Any()

    // Current video frame being assembled
    private var currentFrame: ByteArrayOutputStream? = null
    private var currentHeader: ByteArray? = null // 24-byte CC BB AA FF header
    private var expectedPayloadLen = 0

    // Output
    val nalQueue = ConcurrentLinkedQueue<NalUnit>()

    @Volatile var vps: ByteArray? = null; private set
    @Volatile var sps: ByteArray? = null; private set
    @Volatile var pps: ByteArray? = null; private set
    val hasStreamInit: Boolean get() = vps != null && sps != null && pps != null
    @Volatile var lastIdrSequence: ByteArray? = null; private set

    val framesExtracted = AtomicInteger(0)
    val iFrames = AtomicInteger(0)
    val pFrames = AtomicInteger(0)
    var lastWidth = 0; private set
    var lastHeight = 0; private set
    var lastFrameTime = 0L; private set
    val feFramesParsed = AtomicInteger(0)

    data class NalUnit(
        val data: ByteArray,
        val width: Int,
        val height: Int,
        val isIFrame: Boolean,
        val nalType: String = "",
        val timestamp: Long = System.currentTimeMillis(),
    )

    fun getStreamInitBytes(): ByteArray =
        (vps ?: FALLBACK_VPS) + (sps ?: FALLBACK_SPS) + (pps ?: FALLBACK_PPS)

    fun feed(rawData: ByteArray, length: Int) {
        synchronized(lock) {
            rawBuffer.write(rawData, 0, length)
            val accumulated = rawBuffer.toByteArray()
            var pos = 0

            while (pos < accumulated.size - FE_HEADER_SIZE) {
                // Find FE header
                if (accumulated[pos] != 0xFE.toByte() ||
                    accumulated[pos + 1] != 0.toByte() ||
                    accumulated[pos + 2] != 0.toByte() ||
                    accumulated[pos + 3] != 0.toByte() ||
                    accumulated[pos + 4] != 0.toByte() ||
                    accumulated[pos + 5] != 0.toByte()) {
                    pos++
                    continue
                }

                // Big-endian payload length at [12-15]
                val plen = ((accumulated[pos + 12].toInt() and 0xFF) shl 24) or
                        ((accumulated[pos + 13].toInt() and 0xFF) shl 16) or
                        ((accumulated[pos + 14].toInt() and 0xFF) shl 8) or
                        (accumulated[pos + 15].toInt() and 0xFF)

                if (plen <= 0 || plen > 200000) { pos++; continue }

                val frameEnd = pos + FE_HEADER_SIZE + plen
                if (frameEnd > accumulated.size) break // incomplete

                val payload = accumulated.copyOfRange(pos + FE_HEADER_SIZE, frameEnd)
                feFramesParsed.incrementAndGet()

                // Check if this FE payload starts a new video frame
                if (payload.size >= VIDEO_HEADER_SIZE &&
                    payload[0] == VIDEO_MAGIC[0] && payload[1] == VIDEO_MAGIC[1] &&
                    payload[2] == VIDEO_MAGIC[2] && payload[3] == VIDEO_MAGIC[3]) {

                    // Validate header fields to avoid false positives
                    val w = readUShortLE(payload, 4)
                    val h = readUShortLE(payload, 6)
                    val dt = payload[10].toInt() and 0xFF
                    val pl = readIntLE(payload, 12)
                    val rl = readIntLE(payload, 16)

                    if (w == 1920 && h == 1080 && dt <= 2 && pl > 0 && pl < MAX_FRAME_SIZE && rl > 0 && rl <= pl) {
                        // Valid video frame header — flush previous and start new
                        flushCurrentFrame()

                        currentHeader = payload.copyOfRange(0, VIDEO_HEADER_SIZE)
                        expectedPayloadLen = rl
                        currentFrame = ByteArrayOutputStream(rl.coerceAtMost(MAX_FRAME_SIZE))
                        if (payload.size > VIDEO_HEADER_SIZE) {
                            currentFrame!!.write(payload, VIDEO_HEADER_SIZE, payload.size - VIDEO_HEADER_SIZE)
                        }
                    } else {
                        // False CC BB AA FF — treat as continuation
                        currentFrame?.write(payload)
                    }
                } else if (currentFrame != null) {
                    // Continuation of current video frame
                    currentFrame!!.write(payload)
                }

                // Check if frame is complete
                if (currentFrame != null && currentFrame!!.size() >= expectedPayloadLen) {
                    flushCurrentFrame()
                }

                pos = frameEnd
            }

            // Keep unprocessed data
            if (pos > 0) {
                val remaining = accumulated.copyOfRange(pos, accumulated.size)
                rawBuffer.reset()
                if (remaining.isNotEmpty()) rawBuffer.write(remaining)
            }
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

        // Trim to expected length
        val data = if (videoData.size > expectedPayloadLen && expectedPayloadLen > 0)
            videoData.copyOf(expectedPayloadLen) else videoData

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
                    Log.i("[Video] Built IDR sequence: ${lastIdrSequence!!.size} bytes")
                }
                0x4E -> { if (!isIDR) nalType = "SEI" }
                0x02 -> { if (!isIDR) nalType = "P-frame" }
            }
        }

        val nal = NalUnit(data = data, width = width, height = height, isIFrame = isIDR, nalType = nalType)
        while (nalQueue.size >= MAX_QUEUE_SIZE) nalQueue.poll()
        nalQueue.offer(nal)

        lastWidth = width; lastHeight = height; lastFrameTime = System.currentTimeMillis()
        framesExtracted.incrementAndGet()
        if (isIDR) iFrames.incrementAndGet() else pFrames.incrementAndGet()

        if (framesExtracted.get() <= 3 || framesExtracted.get() % 200 == 0 || isIDR) {
            Log.i("[Video] #${framesExtracted.get()}: ${width}x${height} $nalType ${nalPositions.size}NALs ${data.size}B (expected=$expectedPayloadLen) fe=${feFramesParsed.get()}")
        }
    }

    fun reset() {
        synchronized(lock) {
            rawBuffer.reset()
            currentFrame = null
            currentHeader = null
        }
        nalQueue.clear()
        framesExtracted.set(0); iFrames.set(0); pFrames.set(0); feFramesParsed.set(0)
        lastIdrSequence = null
        Log.i("[Video] Extractor reset")
    }

    private fun findAllNalStartCodes(data: ByteArray): List<Int> {
        val positions = mutableListOf<Int>()
        for (i in 0 until data.size - 3) {
            if (data[i] == 0.toByte() && data[i + 1] == 0.toByte() &&
                data[i + 2] == 0.toByte() && data[i + 3] == 1.toByte()) positions.add(i)
        }
        return positions
    }

    private fun readUShortLE(a: ByteArray, o: Int) = (a[o].toInt() and 0xFF) or ((a[o + 1].toInt() and 0xFF) shl 8)
    private fun readIntLE(a: ByteArray, o: Int) = (a[o].toInt() and 0xFF) or ((a[o+1].toInt() and 0xFF) shl 8) or ((a[o+2].toInt() and 0xFF) shl 16) or ((a[o+3].toInt() and 0xFF) shl 24)
}
