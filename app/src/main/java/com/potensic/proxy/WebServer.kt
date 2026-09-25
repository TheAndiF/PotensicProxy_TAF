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
import kotlinx.coroutines.Dispatchers
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
    private val assetLoader: (String) -> ByteArray?,
) {
    private var server: EmbeddedServer<CIOApplicationEngine, CIOApplicationEngine.Configuration>? = null
    private val wsClients = CopyOnWriteArrayList<DefaultWebSocketSession>()

    // Current joystick state (updated by WebSocket clients)
    @Volatile var throttle: Short = 0
    @Volatile var yaw: Short = 0
    @Volatile var pitch: Short = 0
    @Volatile var roll: Short = 0
    @Volatile var gimbalTilt: Short = 0
    @Volatile var hasActiveInput: Boolean = false
    @Volatile private var lastInputTime: Long = 0

    fun start(port: Int = 9090) {
        Log.i("[WebServer] Starting on port $port...")
        server = embeddedServer(CIO, port = port) {
            install(WebSockets)
            routing {
                // Web UI
                get("/") {
                    val html = assetLoader("web/index.html")
                    if (html != null) {
                        call.respondBytes(html, ContentType.Text.Html)
                    } else {
                        call.respondText(
                            "Potensic Proxy - TAF — web UI not found",
                            ContentType.Text.Plain,
                            HttpStatusCode.NotFound,
                        )
                    }
                    Log.d("[WebServer] GET / served")
                }

                get("/index.html") {
                    val html = assetLoader("web/index.html")
                    if (html != null) {
                        call.respondBytes(html, ContentType.Text.Html)
                    } else {
                        call.respond(HttpStatusCode.NotFound)
                    }
                }

                // Serve Vite production assets embedded in app/src/main/assets/web/assets/.
                // The generated index.html references these as absolute /assets/... URLs.
                get("/assets/{fileName...}") {
                    val fileName = call.parameters.getAll("fileName")
                        ?.joinToString("/")
                        ?.takeIf { it.isNotBlank() && !it.contains("..") }

                    if (fileName == null) {
                        call.respond(HttpStatusCode.BadRequest)
                        return@get
                    }

                    val assetPath = "web/assets/$fileName"
                    val data = assetLoader(assetPath)
                    if (data == null) {
                        Log.w("[WebServer] Static asset not found: $assetPath")
                        call.respond(HttpStatusCode.NotFound)
                        return@get
                    }

                    call.respondBytes(data, contentTypeForAsset(fileName))
                }

                // Keep root-level Vite/static files addressable as well.
                get("/vite.svg") {
                    val data = assetLoader("web/vite.svg")
                    if (data != null) {
                        call.respondBytes(data, ContentType.parse("image/svg+xml"))
                    } else {
                        call.respond(HttpStatusCode.NotFound)
                    }
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
                        var lastSentTime = 0L

                        while (true) {
                            val jpeg = videoDecoder.lastJpeg
                            val jpegTime = videoDecoder.lastJpegTime

                            if (jpeg != null && jpegTime > lastSentTime) {
                                // Always send the LATEST frame, skip queue
                                lastSentTime = jpegTime
                                val header = "${boundary}Content-Type: image/jpeg\r\nContent-Length: ${jpeg.size}\r\n\r\n"
                                writeFully(header.toByteArray())
                                writeFully(jpeg)
                                writeFully("\r\n".toByteArray())
                                flush()
                                framesSent++
                                if (framesSent % 50 == 0) {
                                    Log.d("[WebServer] MJPEG: $framesSent frames")
                                }
                            }
                            kotlinx.coroutines.delay(16) // ~60fps max display rate
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

                // Telemetry
                get("/api/telemetry") {
                    call.respondText(TelemetryParser.latest.toJson().toString(), ContentType.Application.Json)
                }

                // Flight commands
                post("/api/cmd/takeoff") {
                    // Send multiple times like official app (hold button behavior)
                    CoroutineScope(Dispatchers.IO).launch {
                        repeat(20) {
                            (ProxyService.instance ?: return@launch).sendDirectAny(DroneProtocol.buildTakeoff())
                            kotlinx.coroutines.delay(50)
                        }
                    }
                    call.respondText("""{"cmd":"takeoff","repeats":20}""", ContentType.Application.Json)
                }
                post("/api/cmd/land") {
                    CoroutineScope(Dispatchers.IO).launch {
                        repeat(20) {
                            (ProxyService.instance ?: return@launch).sendDirectAny(DroneProtocol.buildLand())
                            kotlinx.coroutines.delay(50)
                        }
                    }
                    call.respondText("""{"cmd":"land","repeats":20}""", ContentType.Application.Json)
                }
                post("/api/cmd/rth") {
                    CoroutineScope(Dispatchers.IO).launch {
                        repeat(20) {
                            (ProxyService.instance ?: return@launch).sendDirectAny(DroneProtocol.buildRTH())
                            kotlinx.coroutines.delay(50)
                        }
                    }
                    call.respondText("""{"cmd":"rth","repeats":20}""", ContentType.Application.Json)
                }
                post("/api/cmd/emergency") {
                    // Emergency: send immediately and repeatedly
                    CoroutineScope(Dispatchers.IO).launch {
                        repeat(30) {
                            (ProxyService.instance ?: return@launch).sendDirectAny(DroneProtocol.buildEmergencyStop())
                            kotlinx.coroutines.delay(30)
                        }
                    }
                    call.respondText("""{"cmd":"emergency_stop","repeats":30}""", ContentType.Application.Json)
                }
                // Test endpoint: set joystick values via HTTP (bypass WebSocket)
                // Usage: GET /api/test/joy?t=0&y=0&p=0&r=500 (r=500 = roll right)
                get("/api/test/joy") {
                    val t = call.request.queryParameters["t"]?.toShortOrNull() ?: 0
                    val y = call.request.queryParameters["y"]?.toShortOrNull() ?: 0
                    val p = call.request.queryParameters["p"]?.toShortOrNull() ?: 0
                    val r = call.request.queryParameters["r"]?.toShortOrNull() ?: 0
                    throttle = t; yaw = y; pitch = p; roll = r
                    hasActiveInput = (t != 0.toShort() || y != 0.toShort() || p != 0.toShort() || r != 0.toShort())
                    Log.i("[WebServer] TEST JOY: t=$t y=$y p=$p r=$r active=$hasActiveInput")
                    call.respondText("""{"test":"joy","t":$t,"y":$y,"p":$p,"r":$r,"active":$hasActiveInput}""", ContentType.Application.Json)
                }
                post("/api/cmd/photo") {
                    ProxyService.instance?.sendAny(DroneProtocol.buildTakePhoto())
                    call.respondText("""{"cmd":"photo"}""", ContentType.Application.Json)
                }
                post("/api/cmd/record") {
                    ProxyService.instance?.sendAny(DroneProtocol.buildToggleRecord())
                    call.respondText("""{"cmd":"record"}""", ContentType.Application.Json)
                }

                // Send raw hex packet to drone
                post("/api/cmd/raw/{hex}") {
                    val hex = call.parameters["hex"] ?: ""
                    val bytes = DroneProtocol.hexToBytes(hex)
                    Log.i("[WebServer] POST /api/cmd/raw — sending ${bytes.size} bytes: $hex")
                    ProxyService.instance?.sendDirectAny(bytes)
                    call.respondText("""{"sent":true,"size":${bytes.size}}""", ContentType.Application.Json)
                }

                // Request IDR frame from drone
                post("/api/video/request-idr") {
                    Log.i("[WebServer] POST /api/video/request-idr")
                    val idrCmd = DroneProtocol.buildIDRRequest()
                    ProxyService.instance?.sendDirectAny(idrCmd)
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
                        put("connected", usbManager.isConnected || (ProxyService.instance?.wifiTransport?.isConnected == true))
                        put("mode", if (ProxyService.instance?.wifiTransport?.isConnected == true) "wifi" else if (usbManager.isConnected) "usb" else "none")
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

                // Connect USB
                post("/api/connect") {
                    Log.i("[WebServer] POST /api/connect — attempting USB connection")
                    val ok = usbManager.connect()
                    val json = JSONObject().put("success", ok)
                    call.respondText(json.toString(), ContentType.Application.Json)
                }

                // WiFi Direct: send WifiDirectSwitch via USB to activate hotspot
                post("/api/wifi/activate") {
                    Log.i("[WebServer] POST /api/wifi/activate — sending WifiDirectSwitch via USB")
                    val cmd = DroneProtocol.buildWifiDirectSwitch(true)
                    ProxyService.instance?.sendDirectAny(cmd)
                    // Send 3 times for reliability
                    CoroutineScope(Dispatchers.IO).launch {
                        repeat(3) {
                            ProxyService.instance?.sendDirectAny(DroneProtocol.buildWifiDirectSwitch(true))
                            kotlinx.coroutines.delay(200)
                        }
                    }
                    call.respondText("""{"cmd":"wifi_activate","sent":true}""", ContentType.Application.Json)
                }

                // WiFi Direct: BLE scan + pairing
                post("/api/wifi/scan") {
                    Log.i("[WebServer] POST /api/wifi/scan — starting BLE pairing")
                    val service = ProxyService.instance
                    if (service == null) {
                        call.respondText("""{"error":"service not running"}""", ContentType.Application.Json)
                    } else {
                        service.startBlePairing()
                        call.respondText("""{"status":"scanning"}""", ContentType.Application.Json)
                    }
                }

                // WiFi Direct: connect TCP to drone
                post("/api/wifi/connect") {
                    val ip = call.request.queryParameters["ip"] ?: "192.168.29.1"
                    val port = call.request.queryParameters["port"]?.toIntOrNull() ?: 8889
                    Log.i("[WebServer] POST /api/wifi/connect → $ip:$port")
                    val service = ProxyService.instance
                    if (service == null) {
                        call.respondText("""{"error":"service not running"}""", ContentType.Application.Json)
                    } else {
                        val ok = service.connectWifi(ip, port)
                        call.respondText("""{"success":$ok,"ip":"$ip","port":$port}""", ContentType.Application.Json)
                    }
                }

                // WiFi Direct: status
                get("/api/wifi/status") {
                    val service = ProxyService.instance
                    val wt = service?.wifiTransport
                    val json = JSONObject().apply {
                        put("wifiConnected", wt?.isConnected ?: false)
                        put("usbConnected", usbManager.isConnected)
                        put("mode", if (wt?.isConnected == true) "wifi" else if (usbManager.isConnected) "usb" else "none")
                        put("bleStatus", service?.bleStatus ?: "idle")
                    }
                    call.respondText(json.toString(), ContentType.Application.Json)
                }

                // Disconnect
                post("/api/disconnect") {
                    Log.i("[WebServer] POST /api/disconnect")
                    usbManager.disconnect()
                    call.respondText(JSONObject().put("disconnected", true).toString(), ContentType.Application.Json)
                }

                // WebSocket for raw H265 NAL streaming (decoded by browser WebCodecs)
                webSocket("/ws/video") {
                    Log.i("[WebServer] Video WebSocket client connected")
                    try {
                        while (true) {
                            val nal = videoExtractor.nalQueue.poll()
                            if (nal != null) {
                                // Send binary frame: [1 byte type] [NAL data]
                                // type: 0=P-frame, 1=IDR
                                val frame = ByteArray(1 + nal.data.size)
                                frame[0] = if (nal.isIFrame) 1 else 0
                                System.arraycopy(nal.data, 0, frame, 1, nal.data.size)
                                send(Frame.Binary(true, frame))
                            } else {
                                kotlinx.coroutines.delay(2)
                            }
                        }
                    } finally {
                        Log.i("[WebServer] Video WebSocket client disconnected")
                    }
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
                                    lastInputTime = System.currentTimeMillis()
                                    hasActiveInput = (throttle != 0.toShort() || yaw != 0.toShort() || pitch != 0.toShort() || roll != 0.toShort() || gimbalTilt != 0.toShort())

                                    Log.d("[WebServer] WS input: t=$throttle y=$yaw p=$pitch r=$roll g=$gimbalTilt active=$hasActiveInput")
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
                        hasActiveInput = false
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

    private fun contentTypeForAsset(path: String): ContentType = when {
        path.endsWith(".js", ignoreCase = true) -> ContentType.parse("application/javascript")
        path.endsWith(".css", ignoreCase = true) -> ContentType.Text.CSS
        path.endsWith(".json", ignoreCase = true) -> ContentType.Application.Json
        path.endsWith(".svg", ignoreCase = true) -> ContentType.parse("image/svg+xml")
        path.endsWith(".png", ignoreCase = true) -> ContentType.Image.PNG
        path.endsWith(".jpg", ignoreCase = true) || path.endsWith(".jpeg", ignoreCase = true) -> ContentType.Image.JPEG
        path.endsWith(".webp", ignoreCase = true) -> ContentType.parse("image/webp")
        path.endsWith(".woff", ignoreCase = true) -> ContentType.parse("font/woff")
        path.endsWith(".woff2", ignoreCase = true) -> ContentType.parse("font/woff2")
        path.endsWith(".ttf", ignoreCase = true) -> ContentType.parse("font/ttf")
        path.endsWith(".map", ignoreCase = true) -> ContentType.Application.Json
        else -> ContentType.Application.OctetStream
    }

    fun stop() {
        server?.stop(500, 1000)
        server = null
        wsClients.clear()
        Log.i("[WebServer] Stopped")
    }
}
