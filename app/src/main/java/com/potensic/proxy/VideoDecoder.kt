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
    val jpegQueue = ConcurrentLinkedQueue<ByteArray>()

    @Volatile var lastJpeg: ByteArray? = null; private set
    @Volatile var lastJpegTime: Long = 0; private set

    companion object {
        const val MAX_JPEG_QUEUE = 5
        const val JPEG_QUALITY = 92
    }

    fun start(width: Int, height: Int, vps: ByteArray?, sps: ByteArray?, pps: ByteArray?) {
        if (running.get()) return
        Log.i("[Decoder] Starting HEVC ${width}x${height}")
        try {
            val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_HEVC, width, height)
            format.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
            if (vps != null && sps != null && pps != null) {
                format.setByteBuffer("csd-0", java.nio.ByteBuffer.wrap(vps + sps + pps))
            }
            codec = MediaCodec.createDecoderByType(MediaFormat.MIMETYPE_VIDEO_HEVC)
            codec!!.configure(format, null, null, 0)
            codec!!.start()
            running.set(true)
            Log.i("[Decoder] Started: ${codec!!.name}")
        } catch (e: Exception) {
            Log.e("[Decoder] Failed", e)
            codec = null
        }
    }

    fun decode(nalData: ByteArray) {
        val c = codec ?: return
        if (!running.get()) return

        try {
            val inputIdx = c.dequeueInputBuffer(5000)
            if (inputIdx >= 0) {
                val buf = c.getInputBuffer(inputIdx)!!
                buf.clear()
                buf.put(nalData)
                c.queueInputBuffer(inputIdx, 0, nalData.size, System.nanoTime() / 1000, 0)
            }

            val info = MediaCodec.BufferInfo()
            while (true) {
                val outputIdx = c.dequeueOutputBuffer(info, 0)
                if (outputIdx >= 0) {
                    // Use Image API — handles stride/sliceHeight correctly
                    var jpeg: ByteArray? = null
                    try {
                        val image = c.getOutputImage(outputIdx)
                        if (image != null) {
                            jpeg = imageToJpegFast(image)
                            image.close()
                        }
                    } catch (_: Exception) {
                        // Fallback to buffer
                        val outBuf = c.getOutputBuffer(outputIdx)
                        if (outBuf != null && info.size > 0) {
                            jpeg = bufferToJpeg(outBuf, c.outputFormat)
                        }
                    }

                    if (jpeg != null) {
                        lastJpeg = jpeg
                        lastJpegTime = System.currentTimeMillis()
                        while (jpegQueue.size >= MAX_JPEG_QUEUE) jpegQueue.poll()
                        jpegQueue.offer(jpeg)
                        val count = framesDecoded.incrementAndGet()
                        if (count <= 3 || count % 100 == 0) {
                            Log.i("[Decoder] #$count → ${jpeg.size / 1024}KB")
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
            if (running.get()) Log.e("[Decoder] ${e.message}")
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

        if (uvPixelStride == 2 && uvRowStride == w) {
            // Semi-planar, contiguous — the U and V buffers overlap by 1 byte
            // V buffer contains: V0 U0 V1 U1 ... (interleaved, this IS NV21 already)
            vBuf.position(0)
            val uvSize = minOf(vBuf.remaining(), w * uvH)
            vBuf.get(nv21, uvOffset, uvSize)
        } else if (uvPixelStride == 2) {
            // Semi-planar but with row padding — copy row by row from V buffer
            for (row in 0 until uvH) {
                vBuf.position(row * uvRowStride)
                val rowLen = minOf(w, vBuf.remaining())
                if (rowLen > 0) {
                    vBuf.get(nv21, uvOffset + row * w, rowLen)
                }
            }
        } else {
            // Planar (pixelStride==1) — need to interleave V and U
            for (row in 0 until uvH) {
                for (col in 0 until uvW) {
                    val idx = uvOffset + row * w + col * 2
                    vBuf.position(row * uvRowStride + col * uvPixelStride)
                    nv21[idx] = vBuf.get()
                    uBuf.position(row * uvRowStride + col * uvPixelStride)
                    nv21[idx + 1] = uBuf.get()
                }
            }
        }

        val yuvImage = YuvImage(nv21, ImageFormat.NV21, w, h, null)
        val out = ByteArrayOutputStream(w * h / 4)
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
        codec = null; jpegQueue.clear()
    }
}
