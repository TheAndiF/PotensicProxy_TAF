package com.potensic.proxy

import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.media.Image
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import java.io.ByteArrayOutputStream
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

class VideoDecoder {

    private var codec: MediaCodec? = null
    private val running = AtomicBoolean(false)
    val framesDecoded = AtomicInteger(0)
    @Volatile var currentCodec: String = "none"; private set
    val isRunning: Boolean get() = running.get()
    val jpegQueue = ConcurrentLinkedQueue<ByteArray>()

    @Volatile var lastJpeg: ByteArray? = null; private set
    @Volatile var lastJpegTime: Long = 0; private set
    @Volatile var publishFrame: Boolean = true

    companion object {
        const val MAX_JPEG_QUEUE = 2 // minimal queue for low latency
        const val JPEG_QUALITY = 95
    }

    private var csdBuffers: List<ByteArray> = emptyList()

    fun start(
        width: Int,
        height: Int,
        codecType: String,
        vps: ByteArray?,
        sps: ByteArray?,
        pps: ByteArray?,
    ) {
        val normalizedCodec = if (codecType == "h264") "h264" else "h265"
        if (running.get() && currentCodec == normalizedCodec) return
        if (running.get()) stop()

        val mime = if (normalizedCodec == "h264") MediaFormat.MIMETYPE_VIDEO_AVC else MediaFormat.MIMETYPE_VIDEO_HEVC
        Log.i("[Decoder] Starting ${normalizedCodec.uppercase()} ${width}x${height}")
        try {
            val format = MediaFormat.createVideoFormat(mime, width, height)
            format.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
            try { format.setInteger(MediaFormat.KEY_LOW_LATENCY, 1) } catch (_: Exception) {}
            try { format.setInteger("low-latency", 1) } catch (_: Exception) {}

            csdBuffers = if (normalizedCodec == "h264") {
                listOfNotNull(sps, pps)
            } else {
                val csd = listOfNotNull(vps, sps, pps).fold(ByteArray(0)) { acc, bytes -> acc + bytes }
                if (csd.isNotEmpty()) listOf(csd) else emptyList()
            }

            if (normalizedCodec == "h264") {
                sps?.let { format.setByteBuffer("csd-0", java.nio.ByteBuffer.wrap(it)) }
                pps?.let { format.setByteBuffer("csd-1", java.nio.ByteBuffer.wrap(it)) }
            } else {
                csdBuffers.firstOrNull()?.let { format.setByteBuffer("csd-0", java.nio.ByteBuffer.wrap(it)) }
            }

            codec = MediaCodec.createDecoderByType(mime)
            codec!!.configure(format, null, null, 0)
            codec!!.start()
            currentCodec = normalizedCodec
            running.set(true)
            Log.i("[Decoder] Started ${normalizedCodec.uppercase()}: ${codec!!.name}")
        } catch (e: Exception) {
            Log.e("[Decoder] Failed to start $normalizedCodec", e)
            try { codec?.release() } catch (_: Exception) {}
            codec = null
            currentCodec = "none"
            running.set(false)
        }
    }

    /**
     * Flush decoder and resubmit codec-specific CSD.
     */
    fun flush() {
        val c = codec ?: return
        try {
            c.flush()
            for (csd in csdBuffers) {
                val idx = c.dequeueInputBuffer(5000)
                if (idx >= 0) {
                    val buf = c.getInputBuffer(idx) ?: continue
                    buf.clear()
                    buf.put(csd)
                    c.queueInputBuffer(idx, 0, csd.size, 0, MediaCodec.BUFFER_FLAG_CODEC_CONFIG)
                }
            }
            Log.i("[Decoder] Flushed $currentCodec + ${csdBuffers.size} CSD buffer(s) resubmitted")
        } catch (e: Exception) {
            Log.e("[Decoder] Flush failed: ${e.message}")
        }
    }

    fun decode(nalData: ByteArray, isKeyFrame: Boolean = false) {
        val c = codec ?: return
        if (!running.get()) return

        try {
            val inputIdx = c.dequeueInputBuffer(5000)
            if (inputIdx >= 0) {
                val buf = c.getInputBuffer(inputIdx)!!
                buf.clear()
                buf.put(nalData)
                val flags = if (isKeyFrame) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0
                c.queueInputBuffer(inputIdx, 0, nalData.size, System.nanoTime() / 1000, flags)
            }

            val info = MediaCodec.BufferInfo()
            while (true) {
                val outputIdx = c.dequeueOutputBuffer(info, 0)
                if (outputIdx >= 0) {
                    var jpeg: ByteArray? = null
                    try {
                        val image = c.getOutputImage(outputIdx)
                        if (image != null) {
                            jpeg = imageToJpegFast(image)
                            image.close()
                        }
                    } catch (_: Exception) {
                        val outBuf = c.getOutputBuffer(outputIdx)
                        if (outBuf != null && info.size > 0) {
                            jpeg = bufferToJpeg(outBuf, c.outputFormat)
                        }
                    }

                    if (jpeg != null) {
                        val count = framesDecoded.incrementAndGet()
                        if (publishFrame) {
                            lastJpeg = jpeg
                            lastJpegTime = System.currentTimeMillis()
                            while (jpegQueue.size >= MAX_JPEG_QUEUE) jpegQueue.poll()
                            jpegQueue.offer(jpeg)
                        }
                        if (count <= 3 || count % 100 == 0) {
                            Log.i("[Decoder] #$count $currentCodec → ${jpeg.size / 1024}KB pub=$publishFrame")
                        }
                    }
                    c.releaseOutputBuffer(outputIdx, false)
                } else if (outputIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    Log.i("[Decoder] Format: ${c.outputFormat}")
                } else {
                    break
                }
            }
        } catch (e: Exception) {
            if (running.get()) Log.e("[Decoder] $currentCodec: ${e.message}")
        }
    }

    /**
     * Fast Image→JPEG using row-level copies instead of pixel-by-pixel.
     * Handles YUV_420_888 with any pixelStride.
     */
    private fun imageToJpegFast(image: Image): ByteArray? {
        val w = image.width
        val h = image.height
        val yPlane = image.planes[0]
        val uPlane = image.planes[1]
        val vPlane = image.planes[2]

        val yBuf = yPlane.buffer
        val uBuf = uPlane.buffer
        val vBuf = vPlane.buffer

        val yRowStride = yPlane.rowStride
        val uvRowStride = uPlane.rowStride
        val uvPixelStride = uPlane.pixelStride

        if (framesDecoded.get() <= 1) {
            Log.i("[Decoder] Image planes: Y=${yBuf.remaining()}B stride=$yRowStride, U=${uBuf.remaining()}B stride=$uvRowStride pxStride=$uvPixelStride, V=${vBuf.remaining()}B")
            Log.i("[Decoder] Expected: Y=${w*h} UV=${w*h/2} total=${w*h*3/2}")
        }

        val nv21 = ByteArray(w * h * 3 / 2)

        // Y plane — fast row copy if pixelStride==1 (always true for Y)
        if (yPlane.pixelStride == 1 && yRowStride == w) {
            // Contiguous — single bulk copy
            yBuf.position(0)
            yBuf.get(nv21, 0, w * h)
        } else {
            // Row by row
            for (row in 0 until h) {
                yBuf.position(row * yRowStride)
                yBuf.get(nv21, row * w, w)
            }
        }

        // UV planes → NV21 (VU interleaved)
        val uvH = h / 2
        val uvW = w / 2
        val uvOffset = w * h

        if (uvPixelStride == 2) {
            // Semi-planar — V and U buffers share memory, interleaved
            // V buffer: V0 U0 V1 U1 ... → this IS NV21 format
            // Buffer is exactly (w * uvH - 1) bytes (last V has no trailing U)
            val vSize = vBuf.remaining() // typically w*h/2 - 1
            for (row in 0 until uvH) {
                val srcPos = row * uvRowStride
                val dstPos = uvOffset + row * w
                // Last row may be 1 byte short
                val available = vSize - srcPos
                if (available <= 0) break
                val bytesToCopy = minOf(w, available)
                vBuf.position(srcPos)
                vBuf.get(nv21, dstPos, bytesToCopy)
                // If we copied 1 less byte (last row), fill the missing U with neighbor
                if (bytesToCopy == w - 1) {
                    nv21[dstPos + w - 1] = nv21[dstPos + w - 2] // duplicate last U
                }
            }
        } else {
            // Planar (pixelStride==1) — need to interleave V and U
            for (row in 0 until uvH) {
                for (col in 0 until uvW) {
                    val idx = uvOffset + row * w + col * 2
                    val srcIdx = row * uvRowStride + col
                    if (srcIdx < vBuf.remaining() && srcIdx < uBuf.remaining()) {
                        nv21[idx] = vBuf.get(srcIdx)
                        nv21[idx + 1] = uBuf.get(srcIdx)
                    }
                }
            }
        }

        val yuvImage = YuvImage(nv21, ImageFormat.NV21, w, h, null)
        val out = ByteArrayOutputStream(w * h / 6)
        yuvImage.compressToJpeg(Rect(0, 0, w, h), JPEG_QUALITY, out)
        return out.toByteArray()
    }

    /**
     * Fallback ByteBuffer→JPEG with correct stride/sliceHeight handling.
     */
    private fun bufferToJpeg(buffer: java.nio.ByteBuffer, format: MediaFormat): ByteArray? {
        try {
            val w = format.getInteger(MediaFormat.KEY_WIDTH)
            val h = format.getInteger(MediaFormat.KEY_HEIGHT)
            val stride = if (format.containsKey(MediaFormat.KEY_STRIDE)) format.getInteger(MediaFormat.KEY_STRIDE) else w
            val sliceH = if (format.containsKey(MediaFormat.KEY_SLICE_HEIGHT)) format.getInteger(MediaFormat.KEY_SLICE_HEIGHT) else h

            buffer.position(0)
            val yuv = ByteArray(buffer.remaining())
            buffer.get(yuv)

            val nv21 = ByteArray(w * h * 3 / 2)
            for (row in 0 until h) {
                System.arraycopy(yuv, row * stride, nv21, row * w, w)
            }
            val uvSrc = stride * sliceH
            val uvDst = w * h
            for (row in 0 until h / 2) {
                val s = uvSrc + row * stride
                val d = uvDst + row * w
                if (s + w <= yuv.size) System.arraycopy(yuv, s, nv21, d, w)
            }
            // NV12→NV21 swap
            var i = uvDst
            val uvEnd = uvDst + w * (h / 2)
            while (i < uvEnd - 1) {
                val tmp = nv21[i]; nv21[i] = nv21[i + 1]; nv21[i + 1] = tmp; i += 2
            }

            val yuvImage = YuvImage(nv21, ImageFormat.NV21, w, h, null)
            val out = ByteArrayOutputStream(w * h / 4)
            yuvImage.compressToJpeg(Rect(0, 0, w, h), JPEG_QUALITY, out)
            return out.toByteArray()
        } catch (e: Exception) {
            Log.e("[Decoder] bufferToJpeg: ${e.message}")
            return null
        }
    }

    fun stop() {
        running.set(false)
        try { codec?.stop(); codec?.release() } catch (_: Exception) {}
        codec = null
        currentCodec = "none"
        csdBuffers = emptyList()
        jpegQueue.clear()
    }
}
