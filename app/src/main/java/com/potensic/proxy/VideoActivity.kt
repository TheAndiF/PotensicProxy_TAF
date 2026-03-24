package com.potensic.proxy

import android.app.Activity
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.os.Bundle
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.Window
import android.view.WindowManager
import kotlinx.coroutines.*

/**
 * Full-screen video display — decodes H265 directly to Surface (GPU).
 * Zero JPEG, zero conversion, zero network. Same as official Potensic app.
 */
class VideoActivity : Activity(), SurfaceHolder.Callback {

    private var codec: MediaCodec? = null
    private var surfaceReady = false
    private var decoderJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN or WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val sv = SurfaceView(this)
        setContentView(sv)
        sv.holder.addCallback(this)

        // Stop the MJPEG decoder — we take over NAL consumption
        ProxyService.instance?.let {
            it.videoDecoder.stop()
            Log.i("[VideoActivity] Stopped MJPEG decoder")
        }
        Log.i("[VideoActivity] Created")
    }

    override fun surfaceCreated(holder: SurfaceHolder) {
        Log.i("[VideoActivity] Surface created")
        surfaceReady = true
        startDecoder(holder)
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        Log.i("[VideoActivity] Surface changed: ${width}x${height}")
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        Log.i("[VideoActivity] Surface destroyed")
        surfaceReady = false
        stopDecoder()
    }

    private fun startDecoder(holder: SurfaceHolder) {
        val service = ProxyService.instance ?: run {
            Log.e("[VideoActivity] ProxyService not running")
            return
        }
        val extractor = service.videoExtractor

        // Wait for resolution
        if (extractor.lastWidth == 0) {
            scope.launch {
                while (extractor.lastWidth == 0) delay(100)
                runOnUiThread { startDecoder(holder) }
            }
            return
        }

        val w = extractor.lastWidth
        val h = extractor.lastHeight
        Log.i("[VideoActivity] Starting Surface decoder ${w}x${h}")

        try {
            val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_HEVC, w, h)
            val vps = extractor.vps ?: VideoExtractor.FALLBACK_VPS
            val sps = extractor.sps ?: VideoExtractor.FALLBACK_SPS
            val pps = extractor.pps ?: VideoExtractor.FALLBACK_PPS
            format.setByteBuffer("csd-0", java.nio.ByteBuffer.wrap(vps + sps + pps))
            try { format.setInteger(MediaFormat.KEY_LOW_LATENCY, 1) } catch (_: Exception) {}

            codec = MediaCodec.createDecoderByType(MediaFormat.MIMETYPE_VIDEO_HEVC)
            codec!!.configure(format, holder.surface, null, 0) // RENDER TO SURFACE
            codec!!.start()
            Log.i("[VideoActivity] Decoder started: ${codec!!.name}")
        } catch (e: Exception) {
            Log.e("[VideoActivity] Decoder failed", e)
            return
        }

        // Decode loop — feed NALs and render directly to Surface
        decoderJob = scope.launch {
            val c = codec ?: return@launch
            var frames = 0
            var gotIdr = false

            while (isActive && surfaceReady) {
                // Sequential decode — every frame in order, like the official app
                val nal = extractor.nalQueue.poll()
                // Also drain the MJPEG decoder's queue to prevent it stealing frames
                // (in case it restarts)
                if (nal != null) {
                    if (!gotIdr && !nal.isIFrame) { delay(5); continue }
                    if (nal.isIFrame) gotIdr = true

                    try {
                        // Feed input
                        val idx = c.dequeueInputBuffer(5000)
                        if (idx >= 0) {
                            val buf = c.getInputBuffer(idx)!!
                            buf.clear()
                            buf.put(nal.data)
                            val flags = if (nal.isIFrame) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0
                            c.queueInputBuffer(idx, 0, nal.data.size, System.nanoTime() / 1000, flags)
                        }

                        // Render output directly to Surface
                        val info = MediaCodec.BufferInfo()
                        while (true) {
                            val outIdx = c.dequeueOutputBuffer(info, 0)
                            if (outIdx >= 0) {
                                c.releaseOutputBuffer(outIdx, true) // TRUE = render to surface
                                frames++
                                if (frames <= 3 || frames % 100 == 0) {
                                    Log.i("[VideoActivity] Frame #$frames rendered")
                                }
                            } else {
                                break
                            }
                        }
                    } catch (e: Exception) {
                        Log.e("[VideoActivity] Decode error: ${e.message}")
                    }
                } else {
                    delay(2)
                }
            }
            Log.i("[VideoActivity] Decode loop ended ($frames frames)")
        }
    }

    private fun stopDecoder() {
        decoderJob?.cancel()
        decoderJob = null
        try { codec?.stop(); codec?.release() } catch (_: Exception) {}
        codec = null
        Log.i("[VideoActivity] Decoder stopped")
    }

    override fun onDestroy() {
        stopDecoder()
        scope.cancel()
        super.onDestroy()
    }
}
