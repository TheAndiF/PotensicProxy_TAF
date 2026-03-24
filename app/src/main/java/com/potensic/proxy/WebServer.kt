package com.potensic.proxy

import io.ktor.server.application.*
import io.ktor.server.cio.*
import io.ktor.server.engine.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.websocket.*
import io.ktor.http.*
import io.ktor.utils.io.*
import io.ktor.websocket.*
import kotlinx.coroutines.*
import org.json.JSONObject
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Embedded HTTP + WebSocket server for remote drone control.
 *
 * HTTP endpoints:
 *   GET  /              → Web UI
 *   GET  /api/status    → Connection status + stats
 *   GET  /api/logs      → Log buffer (with ?since=N for polling)
 *   POST /api/connect   → Connect to USB accessory
 *   POST /api/disconnect → Disconnect
 *
 * WebSocket: /ws/control
 *   Send JSON: {"throttle":0, "yaw":0, "pitch":0, "roll":0, "gimbal":0}
 *   Receive JSON: telemetry + log events
 */
class WebServer(
    private val usbManager: UsbAccessoryManager,
    private val videoExtractor: VideoExtractor,
    private val videoDecoder: VideoDecoder,
    private val assetLoader: (String) -> String?,
) {
    private var server: EmbeddedServer<CIOApplicationEngine, CIOApplicationEngine.Configuration>? = null
    private val wsClients = CopyOnWriteArrayList<DefaultWebSocketSession>()

    // Current joystick state (updated by WebSocket clients)
    @Volatile var throttle: Short = 0
    @Volatile var yaw: Short = 0
    @Volatile var pitch: Short = 0
    @Volatile var roll: Short = 0
    @Volatile var gimbalTilt: Short = 0

    fun start(port: Int = 9090) {
        Log.i("[WebServer] Starting on port $port...")
        server = embeddedServer(CIO, port = port) {
            install(WebSockets)
            routing {
                // Web UI
                get("/") {
                    val html = assetLoader("web/index.html")
                    if (html != null) {
                        call.respondText(html, ContentType.Text.Html)
                    } else {
                        call.respondText("Potensic Proxy v0.1 — web UI not found", ContentType.Text.Plain)
                    }
                    Log.d("[WebServer] GET / served")
                }

                // H265 Annex B stream (for ffplay or VLC)
                // Usage: ffplay -f hevc http://10.8.0.31:9090/api/video/h265
                get("/api/video/h265") {
                    Log.i("[WebServer] GET /api/video/h265 — starting H265 stream")
                    call.respondBytesWriter(contentType = ContentType.Application.OctetStream) {
                        // Wait for IDR sequence to be available (max 30s)
                        var waited = 0
                        while (videoExtractor.lastIdrSequence == null && waited < 30000) {
                            kotlinx.coroutines.delay(100)
                            waited += 100
                        }

                        val idrSeq = videoExtractor.lastIdrSequence
                        if (idrSeq != null) {
                            // Send the full VPS+SPS+PPS+IDR sequence first
                            writeFully(idrSeq)
                            flush()
                            Log.i("[WebServer] H265: sent IDR init sequence ${idrSeq.size} bytes (waited ${waited}ms)")
                        } else {
                            Log.w("[WebServer] H265: no IDR after ${waited}ms, sending fallback VPS+SPS+PPS")
                            writeFully(videoExtractor.getStreamInitBytes())
                            flush()
                        }

                        // Now stream all frames from the queue
                        var framesSent = 0
                        while (true) {
                            val nal = videoExtractor.nalQueue.poll()
                            if (nal != null) {
                                // Re-inject VPS+SPS+PPS before each IDR
                                if (containsNalType(nal.data, 0x26) && videoExtractor.hasStreamInit) {
                                    val reinit = videoExtractor.getStreamInitBytes()
                                    writeFully(reinit)
                                }
                                writeFully(nal.data)
                                flush()
                                framesSent++
                                if (framesSent % 100 == 0) {
                                    Log.d("[WebServer] H265: $framesSent frames streamed")
                                }
                            } else {
                                kotlinx.coroutines.delay(5)
                            }
                        }
                    }
                }

                // Keep old endpoint as alias
                get("/api/video/h264") {
                    call.respondRedirect("/api/video/h265")
                }

                // Dump raw USB data for offline analysis
                get("/api/video/rawdump") {
                    Log.i("[WebServer] GET /api/video/rawdump — capturing 5s of raw data")
                    call.respondBytesWriter(contentType = ContentType.Application.OctetStream) {
                        val start = System.currentTimeMillis()
                        val listener = object : UsbAccessoryManager.Listener {
                            override fun onConnected() {}
                            override fun onDisconnected() {}
                            override fun onDataReceived(data: ByteArray, length: Int) {
                                try {
                                    kotlinx.coroutines.runBlocking {
                                        writeFully(data, 0, length)
                                        flush()
                                    }
                                } catch (_: Exception) {}
                            }
                        }
                        // Temporarily add our listener
                        val origListener = usbManager.listener
                        usbManager.listener = object : UsbAccessoryManager.Listener {
                            override fun onConnected() { origListener?.onConnected() }
                            override fun onDisconnected() { origListener?.onDisconnected() }
                            override fun onDataReceived(data: ByteArray, length: Int) {
                                origListener?.onDataReceived(data, length)
                                listener.onDataReceived(data, length)
                            }
                        }
                        // Capture for 5 seconds
                        kotlinx.coroutines.delay(5000)
                        usbManager.listener = origListener
                        Log.i("[WebServer] Raw dump complete (${System.currentTimeMillis() - start}ms)")
                    }
                }

                // MJPEG stream (decoded by Android MediaCodec hardware)
                get("/api/video/mjpeg") {
                    Log.i("[WebServer] GET /api/video/mjpeg — starting MJPEG stream")
                    call.respondBytesWriter(contentType = ContentType.parse("multipart/x-mixed-replace; boundary=frame")) {
                        val boundary = "--frame\r\n"
                        var framesSent = 0

                        while (true) {
                            val jpeg = videoDecoder.jpegQueue.poll()
                            if (jpeg != null) {
                                val header = "${boundary}Content-Type: image/jpeg\r\nContent-Length: ${jpeg.size}\r\n\r\n"
                                writeFully(header.toByteArray())
                                writeFully(jpeg)
                                writeFully("\r\n".toByteArray())
                                flush()
                                framesSent++
                                if (framesSent % 50 == 0) {
                                    Log.d("[WebServer] MJPEG: $framesSent frames sent")
                                }
                            } else {
                                // Send last known frame if available (reduces latency)
                                kotlinx.coroutines.delay(20) // ~50fps max
                            }
                        }
                    }
                }

                // Single JPEG snapshot
                get("/api/video/snapshot") {
                    val jpeg = videoDecoder.lastJpeg
                    if (jpeg != null) {
                        call.respondBytes(jpeg, ContentType.Image.JPEG)
                    } else {
                        call.respondText("No frame available", status = HttpStatusCode.ServiceUnavailable)
                    }
                }

                // Request IDR frame from drone
                post("/api/video/request-idr") {
                    Log.i("[WebServer] POST /api/video/request-idr")
                    val idrCmd = DroneProtocol.buildIDRRequest()
                    usbManager.sendDirect(idrCmd)
                    call.respondText(JSONObject().put("sent", true).put("size", idrCmd.size).toString(), ContentType.Application.Json)
                }

                // Video stats
                get("/api/video/stats") {
                    val json = JSONObject().apply {
                        put("framesExtracted", videoExtractor.framesExtracted.get())
                        put("iFrames", videoExtractor.iFrames.get())
                        put("pFrames", videoExtractor.pFrames.get())
                        put("width", videoExtractor.lastWidth)
                        put("height", videoExtractor.lastHeight)
                        put("queueSize", videoExtractor.nalQueue.size)
                        put("lastFrameMs", videoExtractor.lastFrameTime)
                    }
                    call.respondText(json.toString(), ContentType.Application.Json)
                }

                // Status
                get("/api/status") {
                    val json = JSONObject().apply {
                        put("connected", usbManager.isConnected)
                        put("bytesSent", usbManager.bytesSent)
                        put("bytesReceived", usbManager.bytesReceived)
                        put("packetsSent", usbManager.packetsSent)
                        put("packetsReceived", usbManager.packetsReceived)
                        put("lastSendMs", usbManager.lastSendTime)
                        put("lastRecvMs", usbManager.lastRecvTime)
                        put("wsClients", wsClients.size)
                        put("joystick", JSONObject().apply {
                            put("throttle", throttle.toInt())
                            put("yaw", yaw.toInt())
                            put("pitch", pitch.toInt())
                            put("roll", roll.toInt())
                            put("gimbal", gimbalTilt.toInt())
                        })
                    }
                    call.respondText(json.toString(), ContentType.Application.Json)
                    Log.d("[WebServer] GET /api/status → connected=${usbManager.isConnected}")
                }

                // Logs
                get("/api/logs") {
                    val since = call.request.queryParameters["since"]?.toIntOrNull() ?: 0
                    val logs = Log.getBufferSince(since)
                    val json = JSONObject().apply {
                        put("since", since)
                        put("count", logs.size)
                        put("nextIndex", since + logs.size)
                        val arr = org.json.JSONArray()
                        logs.forEach { arr.put(it) }
                        put("lines", arr)
                    }
                    call.respondText(json.toString(), ContentType.Application.Json)
                }

                // Connect
                post("/api/connect") {
                    Log.i("[WebServer] POST /api/connect — attempting USB connection")
                    val ok = usbManager.connect()
                    val json = JSONObject().put("success", ok)
                    call.respondText(json.toString(), ContentType.Application.Json)
                }

                // Disconnect
                post("/api/disconnect") {
                    Log.i("[WebServer] POST /api/disconnect")
                    usbManager.disconnect()
                    call.respondText(JSONObject().put("disconnected", true).toString(), ContentType.Application.Json)
                }

                // WebSocket for real-time control
                webSocket("/ws/control") {
                    wsClients.add(this)
                    Log.i("[WebServer] WebSocket client connected (total: ${wsClients.size})")

                    try {
                        for (frame in incoming) {
                            if (frame is Frame.Text) {
                                val text = frame.readText()
                                try {
                                    val json = JSONObject(text)
                                    throttle = json.optInt("throttle", 0).toShort()
                                    yaw = json.optInt("yaw", 0).toShort()
                                    pitch = json.optInt("pitch", 0).toShort()
                                    roll = json.optInt("roll", 0).toShort()
                                    gimbalTilt = json.optInt("gimbal", 0).toShort()

                                    Log.d("[WebServer] WS input: t=$throttle y=$yaw p=$pitch r=$roll g=$gimbalTilt")
                                } catch (e: Exception) {
                                    Log.e("[WebServer] WS parse error: ${e.message}")
                                }
                            }
                        }
                    } finally {
                        wsClients.remove(this)
                        Log.i("[WebServer] WebSocket client disconnected (remaining: ${wsClients.size})")
                        // Reset joysticks when client disconnects (safety!)
                        throttle = 0; yaw = 0; pitch = 0; roll = 0; gimbalTilt = 0
                        Log.w("[WebServer] Joysticks reset to zero (client disconnected)")
                    }
                }
            }
        }
        server!!.start(wait = false)
        Log.i("[WebServer] Started on port $port")
    }

    /**
     * Broadcast telemetry/events to all WebSocket clients.
     */
    suspend fun broadcast(json: JSONObject) {
        val text = json.toString()
        wsClients.forEach { session ->
            try {
                session.send(Frame.Text(text))
            } catch (_: Exception) {}
        }
    }

    /**
     * Check if a byte array contains a H265 NAL unit of a specific type.
     */
    private fun containsNalType(data: ByteArray, nalType: Int): Boolean {
        for (i in 0 until data.size - 4) {
            if (data[i] == 0.toByte() && data[i+1] == 0.toByte() && data[i+2] == 0.toByte() && data[i+3] == 1.toByte()) {
                if (i + 4 < data.size && (data[i+4].toInt() and 0xFF) == nalType) return true
            }
        }
        return false
    }

    fun stop() {
        server?.stop(500, 1000)
        server = null
        wsClients.clear()
        Log.i("[WebServer] Stopped")
    }
}
