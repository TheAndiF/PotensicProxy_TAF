package com.potensic.proxy

import android.content.Context

import io.ktor.server.application.*
import com.potensic.proxy.protocol.PotensicProtocol
import io.ktor.server.cio.*
import io.ktor.server.engine.*
import io.ktor.server.request.*
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
import java.io.File
import com.potensic.proxy.core.ControlAxes
import com.potensic.proxy.control.ControlCoordinator
import com.potensic.proxy.control.ControlSource
import com.potensic.proxy.video.VideoFrameHub
import com.potensic.proxy.api.installApplicationStateRoutes
import com.potensic.proxy.api.installWebUiRoutes
import com.potensic.proxy.api.installDiagnosticsRoutes
import com.potensic.proxy.core.DroneStateStore

/**
 * Embedded HTTP + WebSocket server for remote drone control.
 *
 * HTTP endpoints:
 *   GET  /              ÔåÆ Web UI
 *   GET  /api/status    ÔåÆ Connection status + stats
 *   GET  /api/logs      ÔåÆ Log buffer (with ?since=N for polling)
 *   POST /api/connect   ÔåÆ Connect to USB accessory
 *   POST /api/disconnect ÔåÆ Disconnect
 *
 * WebSocket: /ws/control
 *   Send JSON: {"throttle":0, "yaw":0, "pitch":0, "roll":0, "gimbal":0}
 *   Receive JSON: telemetry + log events
 */
class WebServer(
    private val usbManager: UsbAccessoryManager,
    private val videoExtractor: VideoExtractor,
    private val videoDecoder: VideoDecoder,
    private val videoFrameHub: VideoFrameHub,
    private val transportCapture: TransportCaptureManager,
    private val droneState: DroneStateStore,
    private val controlCoordinator: ControlCoordinator,
    private val appContext: Context,
    filesDir: File,
    private val assetLoader: (String) -> ByteArray?,
) {
    private var server: EmbeddedServer<CIOApplicationEngine, CIOApplicationEngine.Configuration>? = null
    private val wsClients = CopyOnWriteArrayList<DefaultWebSocketSession>()
    private val usbWsClients = CopyOnWriteArrayList<DefaultWebSocketSession>()
    private val mapBackend = MapBackend(filesDir)
    private val missionBackend = MissionBackend(filesDir)
    private val androidMedia = AndroidMediaRepository(appContext, filesDir)

    // Requested control state is owned by ControlCoordinator.

    fun start(port: Int = 9090) {
        Log.i("[WebServer] Starting on port $port...")
        server = embeddedServer(CIO, host = "0.0.0.0", port = port) {
            install(WebSockets)
            routing {
                installWebUiRoutes(assetLoader)

                // Version index. Kept in the backend so the UI can show the version of the actually connected package.
                get("/api/version") {
                    call.respondText(mapBackend.versionInfo().toString(), ContentType.Application.Json)
                }

                // Map configuration is backend-owned. The browser never contacts tile providers directly.
                get("/api/map/config") {
                    call.respondText(mapBackend.publicConfig().toString(), ContentType.Application.Json)
                }
                post("/api/map/config") {
                    try {
                        val result = mapBackend.updateConfig(JSONObject(call.receiveText()))
                        call.respondText(result.toString(), ContentType.Application.Json)
                    } catch (e: Exception) {
                        call.respondText(JSONObject().put("error", e.message ?: "invalid config").toString(), ContentType.Application.Json, HttpStatusCode.BadRequest)
                    }
                }
                post("/api/map/test") {
                    try {
                        val input = JSONObject(call.receiveText())
                        val result = withContext(Dispatchers.IO) { mapBackend.testConnection(input) }
                        call.respondText(result.toString(), ContentType.Application.Json)
                    } catch (e: org.json.JSONException) {
                        call.respondText(JSONObject().put("error", e.message ?: "invalid map test request").toString(), ContentType.Application.Json, HttpStatusCode.BadRequest)
                    } catch (e: IllegalArgumentException) {
                        call.respondText(JSONObject().put("error", e.message ?: "invalid map configuration").toString(), ContentType.Application.Json, HttpStatusCode.BadRequest)
                    } catch (e: Exception) {
                        Log.e("[WebServer] POST /api/map/test failed", e)
                        call.respondText(
                            JSONObject()
                                .put("error", "Map backend test failed: ${e.javaClass.simpleName}: ${e.message ?: "unknown error"}")
                                .toString(),
                            ContentType.Application.Json,
                            HttpStatusCode.InternalServerError
                        )
                    } catch (e: LinkageError) {
                        Log.e("[WebServer] POST /api/map/test linkage failure", e)
                        call.respondText(
                            JSONObject()
                                .put("error", "Map backend runtime compatibility error: ${e.javaClass.simpleName}: ${e.message ?: "unknown error"}")
                                .toString(),
                            ContentType.Application.Json,
                            HttpStatusCode.InternalServerError
                        )
                    }
                }
                get("/api/map/tiles/{z}/{x}/{y}") {
                    val z = call.parameters["z"]?.toIntOrNull(); val x = call.parameters["x"]?.toIntOrNull(); val y = call.parameters["y"]?.toIntOrNull()
                    if (z == null || x == null || y == null) { call.respond(HttpStatusCode.BadRequest); return@get }
                    // The backend owns cache policy (Auto / Offline / Online). Prevent the
                    // browser image cache from bypassing a later mode/provider switch.
                    call.response.headers.append(HttpHeaders.CacheControl, "no-store, max-age=0")
                    val tile = withContext(Dispatchers.IO) { mapBackend.tile(z, x, y) }
                    if (tile == null) call.respond(HttpStatusCode.NotFound)
                    else call.respondBytes(tile.first, ContentType.parse(tile.second))
                }
                get("/api/map/cache/temporary") {
                    call.respondText(mapBackend.temporaryCacheInfo().toString(), ContentType.Application.Json)
                }
                delete("/api/map/cache/temporary") {
                    call.respondText(mapBackend.clearTemporaryCache().toString(), ContentType.Application.Json)
                }

                get("/api/map/regions") { call.respondText(mapBackend.regions().toString(), ContentType.Application.Json) }
                post("/api/map/regions") {
                    try {
                        val region = mapBackend.startRegionDownload(JSONObject(call.receiveText()))
                        call.respondText(region.toString(), ContentType.Application.Json, HttpStatusCode.Accepted)
                    } catch (e: Exception) {
                        call.respondText(JSONObject().put("error", e.message ?: "invalid region").toString(), ContentType.Application.Json, HttpStatusCode.BadRequest)
                    }
                }
                post("/api/map/regions/{id}/update") {
                    val id = call.parameters["id"] ?: ""
                    try {
                        val region = mapBackend.updateRegion(id)
                        call.respondText(region.toString(), ContentType.Application.Json, HttpStatusCode.Accepted)
                    } catch (e: IllegalStateException) {
                        call.respondText(JSONObject().put("error", e.message ?: "region is busy").toString(), ContentType.Application.Json, HttpStatusCode.Conflict)
                    } catch (e: Exception) {
                        call.respondText(JSONObject().put("error", e.message ?: "could not update region").toString(), ContentType.Application.Json, HttpStatusCode.BadRequest)
                    }
                }
                post("/api/map/regions/{id}/reload") {
                    val id = call.parameters["id"] ?: ""
                    try {
                        val region = mapBackend.reloadRegion(id)
                        call.respondText(region.toString(), ContentType.Application.Json, HttpStatusCode.Accepted)
                    } catch (e: IllegalStateException) {
                        call.respondText(JSONObject().put("error", e.message ?: "region is busy").toString(), ContentType.Application.Json, HttpStatusCode.Conflict)
                    } catch (e: Exception) {
                        call.respondText(JSONObject().put("error", e.message ?: "could not reload region").toString(), ContentType.Application.Json, HttpStatusCode.BadRequest)
                    }
                }
                delete("/api/map/regions/{id}/tiles") {
                    val id = call.parameters["id"] ?: ""
                    try {
                        val region = mapBackend.clearRegionTiles(id)
                        call.respondText(region.toString(), ContentType.Application.Json, HttpStatusCode.Accepted)
                    } catch (e: IllegalStateException) {
                        call.respondText(JSONObject().put("error", e.message ?: "region is busy").toString(), ContentType.Application.Json, HttpStatusCode.Conflict)
                    } catch (e: Exception) {
                        call.respondText(JSONObject().put("error", e.message ?: "could not clear region tiles").toString(), ContentType.Application.Json, HttpStatusCode.BadRequest)
                    }
                }
                get("/api/map/regions/{id}") {
                    val r = mapBackend.job(call.parameters["id"] ?: "")
                    if (r == null) call.respond(HttpStatusCode.NotFound) else call.respondText(r.toString(), ContentType.Application.Json)
                }
                delete("/api/map/regions/{id}") {
                    try {
                        if (mapBackend.deleteRegion(call.parameters["id"] ?: "")) call.respond(HttpStatusCode.NoContent) else call.respond(HttpStatusCode.NotFound)
                    } catch (e: IllegalStateException) {
                        call.respondText(JSONObject().put("error", e.message ?: "region is busy").toString(), ContentType.Application.Json, HttpStatusCode.Conflict)
                    }
                }

                // Mission planning storage and Potensic ATOM 1 export.
                get("/api/missions") {
                    call.respondText(missionBackend.list().toString(), ContentType.Application.Json)
                }
                get("/api/missions/{id}") {
                    try {
                        val mission = missionBackend.load(call.parameters["id"] ?: "")
                        if (mission == null) call.respond(HttpStatusCode.NotFound)
                        else call.respondText(mission.toString(), ContentType.Application.Json)
                    } catch (e: Exception) {
                        call.respondText(JSONObject().put("error", e.message ?: "invalid mission id").toString(), ContentType.Application.Json, HttpStatusCode.BadRequest)
                    }
                }
                put("/api/missions/{id}") {
                    try {
                        val mission = missionBackend.save(call.parameters["id"] ?: "", JSONObject(call.receiveText()))
                        call.respondText(mission.toString(), ContentType.Application.Json)
                    } catch (e: Exception) {
                        call.respondText(JSONObject().put("error", e.message ?: "mission save failed").toString(), ContentType.Application.Json, HttpStatusCode.BadRequest)
                    }
                }
                delete("/api/missions/{id}") {
                    try {
                        if (missionBackend.delete(call.parameters["id"] ?: "")) call.respond(HttpStatusCode.NoContent) else call.respond(HttpStatusCode.NotFound)
                    } catch (e: Exception) { call.respond(HttpStatusCode.BadRequest) }
                }
                get("/api/missions/{id}/export/potensic") {
                    try {
                        val file = withContext(Dispatchers.IO) { missionBackend.exportAtom1(call.parameters["id"] ?: "") }
                        call.response.header(HttpHeaders.ContentDisposition, "attachment; filename=map.db")
                        call.respondFile(file)
                    } catch (e: Exception) {
                        call.respondText(JSONObject().put("error", e.message ?: "Potensic export failed").toString(), ContentType.Application.Json, HttpStatusCode.BadRequest)
                    }
                }

                // USB WebSocket passthrough (bidirectional)
                webSocket("/ws/usb") {
                    usbWsClients.add(this)
                    Log.i("[WebServer] USB WebSocket client connected (total: ${usbWsClients.size})")
                    try {
                        for (frame in incoming) {
                            when (frame) {
                                is Frame.Binary -> {
                                    val bytes = frame.readBytes()
                                    ProxyService.instance?.sendDirectAny(bytes)
                                }
                                is Frame.Text -> {
                                    val text = frame.readText().trim()
                                    try {
                                        val bytes = if (text.startsWith("{")) {
                                            val json = JSONObject(text)
                                            PotensicProtocol.hexToBytes(json.getString("hex"))
                                        } else {
                                            PotensicProtocol.hexToBytes(text)
                                        }
                                        ProxyService.instance?.sendDirectAny(bytes)
                                    } catch (e: Exception) {
                                        Log.e("[WebServer] /ws/usb parse error: ${e.message}")
                                    }
                                }
                                else -> {}
                            }
                        }
                    } finally {
                        usbWsClients.remove(this)
                        Log.i("[WebServer] USB WebSocket client disconnected")
                    }
                }

                // OPTIONS preflight for all /api endpoints
                options("/api/{tail...}") {
                    call.response.header("Access-Control-Allow-Origin", "*")
                    call.response.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
                    call.response.header("Access-Control-Allow-Headers", "*")
                    call.respond(HttpStatusCode.OK)
                }

                // POST raw packet or hex to USB
                post("/api/usb/send") {
                    call.response.header("Access-Control-Allow-Origin", "*")
                    val text = call.receiveText().trim()
                    try {
                        val bytes = if (text.startsWith("{")) {
                            val json = JSONObject(text)
                            PotensicProtocol.hexToBytes(json.getString("hex"))
                        } else {
                            PotensicProtocol.hexToBytes(text)
                        }
                        ProxyService.instance?.sendDirectAny(bytes)
                        call.respondText("""{"success":true,"sentBytes":${bytes.size}}""", ContentType.Application.Json)
                    } catch (e: Exception) {
                        call.respondText("""{"success":false,"error":"${e.message}"}""", ContentType.Application.Json, HttpStatusCode.BadRequest)
                    }
                }

                // Android-owned image storage. These endpoints make captured images
                // available both to gallery apps and to the future on-device recognition pipeline.
                get("/api/media/local") {
                    call.response.header("Access-Control-Allow-Origin", "*")
                    val library = call.request.queryParameters["library"]
                    val images = withContext(Dispatchers.IO) { androidMedia.listImages(library) }
                    call.respondText(images.toString(), ContentType.Application.Json)
                }

                get("/api/media/local/{id}") {
                    call.response.header("Access-Control-Allow-Origin", "*")
                    val id = call.parameters["id"] ?: ""
                    val item = withContext(Dispatchers.IO) { androidMedia.readImage(id) }
                    if (item == null) {
                        call.respond(HttpStatusCode.NotFound)
                    } else {
                        call.respondBytes(item.first, ContentType.parse(item.second))
                    }
                }

                post("/api/media/snapshot") {
                    call.response.header("Access-Control-Allow-Origin", "*")
                    val requestedLibrary = call.request.queryParameters["library"]?.lowercase()
                    val snapshotLibrary = if (requestedLibrary == "camera") "camera" else "recognition"
                    val requestedSource = call.request.queryParameters["source"]
                    val snapshotSource = if (snapshotLibrary == "camera" && requestedSource == "cockpit-snapshot") "cockpit-snapshot" else "live-reco"
                    val metadata = try {
                        val text = call.receiveText().trim()
                        if (text.isNotEmpty()) JSONObject(text) else null
                    } catch (_: Exception) {
                        null
                    }
                    var jpeg = videoDecoder.lastJpeg
                    if (jpeg == null) {
                        ProxyService.instance?.activateLiveView()
                        var waitedMs = 0
                        while (jpeg == null && waitedMs < 2000) {
                            delay(100)
                            waitedMs += 100
                            jpeg = videoDecoder.lastJpeg
                        }
                    }
                    val frame = jpeg
                    if (frame == null) {
                        call.respondText(
                            JSONObject().put("error", "No decoded video frame is available").toString(),
                            ContentType.Application.Json,
                            HttpStatusCode.ServiceUnavailable,
                        )
                    } else {
                        try {
                            val saved = withContext(Dispatchers.IO) {
                                androidMedia.saveImage(
                                    bytes = frame,
                                    requestedName = null,
                                    source = snapshotSource,
                                    library = snapshotLibrary,
                                    metadata = metadata,
                                )
                            }
                            call.respondText(saved.toString(), ContentType.Application.Json, HttpStatusCode.Created)
                        } catch (e: SecurityException) {
                            call.respondText(JSONObject().put("error", e.message ?: "storage permission denied").toString(), ContentType.Application.Json, HttpStatusCode.Forbidden)
                        } catch (e: Exception) {
                            call.respondText(JSONObject().put("error", e.message ?: "snapshot save failed").toString(), ContentType.Application.Json, HttpStatusCode.InternalServerError)
                        }
                    }
                }

                post("/api/media/import") {
                    call.response.header("Access-Control-Allow-Origin", "*")
                    try {
                        val declaredLength = call.request.headers[HttpHeaders.ContentLength]?.toLongOrNull()
                        if (declaredLength != null && declaredLength > 512L * 1024L * 1024L) {
                            call.respondText(JSONObject().put("error", "Media file is larger than 512 MiB").toString(), ContentType.Application.Json, HttpStatusCode.BadRequest)
                            return@post
                        }
                        val name = call.request.queryParameters["name"]
                        val source = call.request.queryParameters["source"]?.take(64) ?: "camera-download"
                        val library = call.request.queryParameters["library"]?.take(32) ?: "camera"
                        val metadata = call.request.queryParameters["metadata"]
                            ?.takeIf { it.isNotBlank() }
                            ?.let { JSONObject(it) }
                        val ext = name?.substringAfterLast('.', "")?.lowercase()
                        if (ext !in setOf("jpg", "jpeg", "png", "dng", "mp4")) {
                            call.respondText(JSONObject().put("error", "Only JPG, JPEG, PNG, DNG and MP4 media can be imported").toString(), ContentType.Application.Json, HttpStatusCode.BadRequest)
                            return@post
                        }
                        val bytes = call.receive<ByteArray>()
                        if (bytes.size > 512 * 1024 * 1024) {
                            call.respondText(JSONObject().put("error", "Media file is larger than 512 MiB").toString(), ContentType.Application.Json, HttpStatusCode.BadRequest)
                            return@post
                        }
                        val saved = withContext(Dispatchers.IO) {
                            if (ext == "mp4") {
                                androidMedia.saveVideo(
                                    bytes = bytes,
                                    requestedName = name,
                                    source = source,
                                )
                            } else {
                                androidMedia.saveImage(
                                    bytes = bytes,
                                    requestedName = name,
                                    source = source,
                                    library = library,
                                    metadata = metadata,
                                )
                            }
                        }
                        call.respondText(saved.toString(), ContentType.Application.Json, HttpStatusCode.Created)
                    } catch (e: SecurityException) {
                        call.respondText(JSONObject().put("error", e.message ?: "storage permission denied").toString(), ContentType.Application.Json, HttpStatusCode.Forbidden)
                    } catch (e: Exception) {
                        call.respondText(JSONObject().put("error", e.message ?: "media import failed").toString(), ContentType.Application.Json, HttpStatusCode.InternalServerError)
                    }
                }

                // H265 Annex B stream (for ffplay or VLC)
                // Usage: ffplay -f hevc http://10.8.0.31:9090/api/video/h265
                get("/api/video/h265") {
                    Log.i("[WebServer] GET /api/video/h265 ÔÇö starting H265 stream")
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

                        // Stream from an independent subscription so native decoding remains authoritative.
                        val subscription = videoFrameHub.subscribe()
                        try {
                            var framesSent = 0
                            while (true) {
                                val nal = subscription.poll()
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
                        } finally {
                            subscription.close()
                        }
                    }
                }

                // Keep old endpoint as alias
                get("/api/video/h264") {
                    call.respondRedirect("/api/video/h265")
                }

                // Dump raw USB data for offline analysis
                get("/api/video/rawdump") {
                    Log.i("[WebServer] GET /api/video/rawdump ÔÇö capturing 5s of raw data")
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
                    Log.i("[WebServer] GET /api/video/mjpeg ÔÇö starting MJPEG stream")
                    call.response.header("Access-Control-Allow-Origin", "*")
                    call.response.header("Cache-Control", "no-cache, no-store, must-revalidate")
                    // If no frame yet, auto-kickstart video activation
                    if (videoDecoder.lastJpeg == null) {
                        ProxyService.instance?.activateLiveView()
                    }
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
                    call.response.header("Access-Control-Allow-Origin", "*")
                    call.response.header("Cache-Control", "no-cache, no-store, must-revalidate")
                    val jpeg = videoDecoder.lastJpeg
                    if (jpeg != null) {
                        call.respondBytes(jpeg, ContentType.Image.JPEG)
                    } else {
                        ProxyService.instance?.activateLiveView()
                        call.respondText("No frame available", status = HttpStatusCode.ServiceUnavailable)
                    }
                }

                installApplicationStateRoutes(droneState, controlCoordinator)

                installDiagnosticsRoutes(usbManager, videoExtractor, videoDecoder, videoFrameHub, transportCapture, droneState, controlCoordinator)


                // Flight commands
                post("/api/cmd/takeoff") {
                    val packet = PotensicProtocol.buildTakeoff()
                    Log.i("[Flight TX] Takeoff FE=0x14 function=0x0014 payloadLen=32 frame=${PotensicProtocol.bytesToHex(packet)}")
                    ProxyService.instance?.sendDirectAny(packet)
                    call.respondText("""{"cmd":"takeoff","repeats":1}""", ContentType.Application.Json)
                }
                post("/api/cmd/land") {
                    val packet = PotensicProtocol.buildLand()
                    Log.i("[Flight TX] Land FE=0x14 function=0x0014 payloadLen=32 frame=${PotensicProtocol.bytesToHex(packet)}")
                    ProxyService.instance?.sendDirectAny(packet)
                    call.respondText("""{"cmd":"land","repeats":1}""", ContentType.Application.Json)
                }
                post("/api/cmd/cancel-land") {
                    val packet = PotensicProtocol.buildCancelLand()
                    Log.i("[Flight TX] Cancel Land FE=0x14 function=0x0014 payloadLen=32 frame=${PotensicProtocol.bytesToHex(packet)}")
                    ProxyService.instance?.sendDirectAny(packet)
                    call.respondText("""{"cmd":"cancel-land","repeats":1}""", ContentType.Application.Json)
                }
                post("/api/cmd/rth") {
                    val packet = PotensicProtocol.buildRTH()
                    Log.i("[Flight TX] RTH FE=0x14 function=0x0014 payloadLen=32 frame=${PotensicProtocol.bytesToHex(packet)}")
                    ProxyService.instance?.sendDirectAny(packet)
                    call.respondText("""{"cmd":"rth","repeats":1}""", ContentType.Application.Json)
                }
                post("/api/cmd/cancel-auto-fly") {
                    val packet = PotensicProtocol.buildCancelAutoFly()
                    Log.i("[Flight TX] Cancel Auto Fly FE=0x14 function=0x0014 payloadLen=32 frame=${PotensicProtocol.bytesToHex(packet)}")
                    ProxyService.instance?.sendDirectAny(packet)
                    call.respondText("""{"cmd":"cancel-auto-fly","repeats":1}""", ContentType.Application.Json)
                }
                post("/api/cmd/emergency") {
                    // Emergency: send immediately and repeatedly
                    CoroutineScope(Dispatchers.IO).launch {
                        repeat(30) {
                            (ProxyService.instance ?: return@launch).sendDirectAny(PotensicProtocol.buildEmergencyStop())
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
                    val axes = ControlAxes(t, y, p, r, 0)
                    controlCoordinator.submit(ControlSource.TEST, axes)
                    Log.i("[WebServer] TEST JOY: t=$t y=$y p=$p r=$r active=${axes.active}")
                    call.respondText(JSONObject().apply { put("test", "joy"); put("active", axes.active); put("control", controlCoordinator.toJson()) }.toString(), ContentType.Application.Json)
                }
                post("/api/cmd/photo") {
                    ProxyService.instance?.sendAny(PotensicProtocol.buildTakePhoto())
                    call.respondText("""{"cmd":"photo"}""", ContentType.Application.Json)
                }
                post("/api/cmd/record") {
                    val action = call.request.queryParameters["action"]?.lowercase() ?: "start"
                    val stop = action == "stop" || action == "0" || action == "false"
                    val packet = if (stop) PotensicProtocol.buildStopRecord() else PotensicProtocol.buildStartRecord()
                    ProxyService.instance?.sendAny(packet)
                    call.respondText(JSONObject().apply { put("cmd", "record"); put("action", if (stop) "stop" else "start") }.toString(), ContentType.Application.Json)
                }
                // ATOM / ATOM 2 controller-aircraft re-pairing (PotensicPro SendMiniPairData / function 0x18).
                post("/api/cmd/pair") {
                    val service = ProxyService.instance
                    if (service == null) {
                        call.respondText(
                            JSONObject().put("error", "service not running").toString(),
                            ContentType.Application.Json,
                            HttpStatusCode.ServiceUnavailable
                        )
                    } else {
                        val packet = service.startMiniPairing()
                        call.respondText(
                            JSONObject().apply {
                                put("cmd", "pair")
                                put("sent", true)
                                put("size", packet.size)
                            }.toString(),
                            ContentType.Application.Json
                        )
                    }
                }
                post("/api/cmd/pair/reset") {
                    ProxyService.instance?.resetPairingStatus()
                    call.respondText("{\"cmd\":\"pair_reset\",\"ok\":true}", ContentType.Application.Json)
                }

                // RF probe control (CMD 5656 / 0x1618 FpvReqFreqParams)
                post("/api/cmd/rf_probe") {
                    val enable = call.request.queryParameters["enable"]?.toBooleanStrictOrNull() ?: true
                    Log.i("[WebServer] POST /api/cmd/rf_probe (enable=$enable)")
                    val packet = PotensicProtocol.buildRequestFreqParams(enable)
                    ProxyService.instance?.sendDirectAny(packet)
                    val json = JSONObject().apply {
                        put("cmd", "rf_probe")
                        put("enable", enable)
                        put("sent", true)
                        put("size", packet.size)
                    }
                    call.respondText(json.toString(), ContentType.Application.Json)
                }
                post("/api/rf/probe") {
                    val enable = call.request.queryParameters["enable"]?.toBooleanStrictOrNull() ?: true
                    Log.i("[WebServer] POST /api/rf/probe (enable=$enable)")
                    val packet = PotensicProtocol.buildRequestFreqParams(enable)
                    ProxyService.instance?.sendDirectAny(packet)
                    val json = JSONObject().apply {
                        put("cmd", "rf_probe")
                        put("enable", enable)
                        put("sent", true)
                        put("size", packet.size)
                    }
                    call.respondText(json.toString(), ContentType.Application.Json)
                }

                // Send raw hex packet to drone
                post("/api/cmd/raw/{hex}") {
                    val hex = call.parameters["hex"] ?: ""
                    val bytes = PotensicProtocol.hexToBytes(hex)
                    Log.i("[WebServer] POST /api/cmd/raw ÔÇö sending ${bytes.size} bytes: $hex")
                    ProxyService.instance?.sendDirectAny(bytes)
                    call.respondText("""{"sent":true,"size":${bytes.size}}""", ContentType.Application.Json)
                }

                // Activate LiveView transmission
                post("/api/video/activate") {
                    call.response.header("Access-Control-Allow-Origin", "*")
                    Log.i("[WebServer] POST /api/video/activate")
                    val codec = call.request.queryParameters["codec"]?.lowercase() ?: "auto"
                    val profile = ProxyService.instance?.getDroneProfile()
                    val requestedH265 = codec != "h264"
                    val enableH265 = when (profile?.codec) { "h264" -> false; "h265" -> true; else -> requestedH265 }
                    val activated = ProxyService.instance?.activateLiveView(enableH265, force = true) == true
                    val json = JSONObject().apply {
                        put("success", activated)
                        put("activated", activated)
                        put("profile", profile?.id ?: "unknown")
                        put("codec", if (enableH265) "h265" else "h264")
                        put("connected", usbManager.isLinkReady || (ProxyService.instance?.wifiTransport?.isConnected == true))
                    }
                    call.respondText(
                        json.toString(),
                        ContentType.Application.Json,
                        if (activated) HttpStatusCode.OK else HttpStatusCode.Conflict
                    )
                }

                // Request IDR frame from drone
                post("/api/video/request-idr") {
                    call.response.header("Access-Control-Allow-Origin", "*")
                    Log.i("[WebServer] POST /api/video/request-idr")
                    val connected = usbManager.isConnected || (ProxyService.instance?.wifiTransport?.isConnected == true)
                    if (!connected) {
                        call.respondText(
                            JSONObject().put("sent", false).put("error", "drone transport not connected").toString(),
                            ContentType.Application.Json,
                            HttpStatusCode.Conflict
                        )
                    } else {
                        val mode = call.request.queryParameters["mode"]?.lowercase() ?: "d9"
                        val idrCmd = when (mode) {
                            "d9" -> PotensicProtocol.buildIDRRequestD9()
                            "d7" -> {
                                val hashHex = call.request.queryParameters["hash"]?.replace(" ", "") ?: ""
                                if (hashHex.isEmpty() || hashHex.length % 2 != 0 || !hashHex.matches(Regex("[0-9a-fA-F]+"))) {
                                    call.respondText(
                                        JSONObject().put("sent", false).put("error", "mode=d7 requires an even-length captured device hash in ?hash=<hex>").toString(),
                                        ContentType.Application.Json,
                                        HttpStatusCode.BadRequest
                                    )
                                    return@post
                                }
                                val hash = ByteArray(hashHex.length / 2) { i -> hashHex.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
                                PotensicProtocol.buildIDRRequestD7(hash)
                            }
                            else -> {
                                call.respondText(
                                    JSONObject().put("sent", false).put("error", "unknown IDR mode; use d9 or d7").toString(),
                                    ContentType.Application.Json,
                                    HttpStatusCode.BadRequest
                                )
                                return@post
                            }
                        }
                        ProxyService.instance?.sendDirectAny(idrCmd)
                        Log.i("[WebServer] IDR request mode=$mode size=${idrCmd.size}")
                        call.respondText(JSONObject().put("sent", true).put("mode", mode).put("size", idrCmd.size).toString(), ContentType.Application.Json)
                    }
                }

                // Central drone model / protocol profile selection
                get("/api/drone/profile") {
                    call.response.header("Access-Control-Allow-Origin", "*")
                    val profile = ProxyService.instance?.getDroneProfile()
                    if (profile == null) {
                        call.respondText(JSONObject().put("error", "service unavailable").toString(), ContentType.Application.Json, HttpStatusCode.ServiceUnavailable)
                    } else {
                        call.respondText(JSONObject().apply {
                            put("id", profile.id)
                            put("displayName", profile.displayName)
                            put("videoTransport", profile.videoTransport)
                            put("codec", profile.codec)
                            put("width", profile.width)
                            put("height", profile.height)
                            put("stripBytesPerPacket", profile.stripBytesPerPacket)
                            put("preferredCodec", profile.preferredCodec)
                        }.toString(), ContentType.Application.Json)
                    }
                }
                post("/api/drone/profile") {
                    call.response.header("Access-Control-Allow-Origin", "*")
                    val requested = call.request.queryParameters["model"] ?: ""
                    val profile = ProxyService.instance?.selectDroneProfile(requested)
                    if (profile == null) {
                        call.respondText(JSONObject().put("changed", false).put("error", "unknown model; use ATOM or ATOM_2").toString(), ContentType.Application.Json, HttpStatusCode.BadRequest)
                    } else {
                        call.respondText(JSONObject().apply {
                            put("changed", true)
                            put("id", profile.id)
                            put("displayName", profile.displayName)
                            put("videoTransport", profile.videoTransport)
                            put("codec", profile.codec)
                            put("width", profile.width)
                            put("height", profile.height)
                            put("preferredCodec", profile.preferredCodec)
                        }.toString(), ContentType.Application.Json)
                    }
                }

                // Raw transport capture for ATOM/ATOM 2 protocol comparison
                post("/api/capture/start") {
                    call.response.header("Access-Control-Allow-Origin", "*")
                    val mgr = ProxyService.instance?.transportCapture
                    if (mgr == null) {
                        call.respondText(JSONObject().put("started", false).put("error", "service unavailable").toString(), ContentType.Application.Json, HttpStatusCode.ServiceUnavailable)
                    } else {
                        val st = mgr.start()
                        call.respondText(JSONObject().put("started", true).put("directory", st.directory).toString(), ContentType.Application.Json)
                    }
                }
                post("/api/capture/stop") {
                    call.response.header("Access-Control-Allow-Origin", "*")
                    val mgr = ProxyService.instance?.transportCapture
                    val st = mgr?.stop()
                    call.respondText(JSONObject().put("stopped", st != null).put("directory", st?.directory ?: JSONObject.NULL).put("rawBytes", st?.rawBytes ?: 0).put("feFrames", st?.feFrames ?: 0).put("fe06Bytes", st?.fe06Bytes ?: 0).toString(), ContentType.Application.Json)
                }
                get("/api/capture/status") {
                    call.response.header("Access-Control-Allow-Origin", "*")
                    val st = ProxyService.instance?.transportCapture?.status()
                    call.respondText(JSONObject().put("active", st?.active ?: false).put("startedAt", st?.startedAt ?: 0).put("directory", st?.directory ?: JSONObject.NULL).put("rawBytes", st?.rawBytes ?: 0).put("feFrames", st?.feFrames ?: 0).put("fe06Bytes", st?.fe06Bytes ?: 0).toString(), ContentType.Application.Json)
                }
                get("/api/capture/download") {
                    val zip = ProxyService.instance?.transportCapture?.latestZip()
                    if (zip == null || !zip.exists()) call.respond(HttpStatusCode.NotFound) else call.respondFile(zip)
                }

                // Video stats
                get("/api/video/stats") {
                    call.response.header("Access-Control-Allow-Origin", "*")
                    val json = JSONObject().apply {
                        put("framesExtracted", videoExtractor.framesExtracted.get())
                        put("iFrames", videoExtractor.iFrames.get())
                        put("pFrames", videoExtractor.pFrames.get())
                        put("decodedFrames", videoDecoder.framesDecoded.get())
                        put("hasJpeg", videoDecoder.lastJpeg != null)
                        put("lastJpegMs", videoDecoder.lastJpegTime)
                        put("width", videoExtractor.lastWidth)
                        put("height", videoExtractor.lastHeight)
                        put("queueSize", videoExtractor.nalQueue.size)
                        put("lastFrameMs", videoExtractor.lastFrameTime)
                        put("detectedCodec", videoExtractor.detectedCodec)
                        put("decoderCodec", videoDecoder.currentCodec)
                        put("droneProfile", videoExtractor.currentProfileId())
                        put("videoTransport", videoExtractor.currentTransport())
                        put("atomFramesParsed", videoExtractor.atomFramesParsed.get())
                        val parser = videoExtractor.getParserSnapshot()
                        put("parser", JSONObject().apply {
                            put("usbChunksFed", parser.usbChunksFed)
                            put("fePacketsParsed", parser.fePacketsParsed)
                            put("feStreamBufferBytes", parser.feStreamBufferBytes)
                            put("videoStreamBufferBytes", parser.videoStreamBufferBytes)
                            put("w42MagicHits", parser.w42MagicHits)
                            put("w42HeadersParsed", parser.w42HeadersParsed)
                            put("w42InvalidHeaders", parser.w42InvalidHeaders)
                            put("w42IncompleteChunks", parser.w42IncompleteChunks)
                            put("streamBytesDropped", parser.streamBytesDropped)
                            put("detectedCodec", parser.detectedCodec)
                        })
                        put("feTraffic", org.json.JSONArray().apply {
                            videoExtractor.getFeTrafficSnapshot().forEach { stat ->
                                put(JSONObject().apply {
                                    put("feType", stat.feType)
                                    put("feTypeHex", "0x${"%02X".format(stat.feType)}")
                                    put("packets", stat.packets)
                                    put("bytes", stat.bytes)
                                    put("payloadBytes", stat.payloadBytes)
                                    put("bytesPerSecond", stat.bytesPerSecond)
                                    put("packetsPerSecond", stat.packetsPerSecond)
                                    put("lastPacketMs", stat.lastPacketMs)
                                    put("samples", org.json.JSONArray(stat.samples))
                                })
                            }
                        })
                    }
                    call.respondText(json.toString(), ContentType.Application.Json)
                }

                // Status
                get("/api/status") {
                    call.response.header("Access-Control-Allow-Origin", "*")
                    val json = JSONObject().apply {
                        put("connected", usbManager.isLinkReady || (ProxyService.instance?.wifiTransport?.isConnected == true))
                        put("usbConnected", usbManager.isLinkReady)
                        put("usbOpen", usbManager.isConnected)
                        put("accessoryAttached", usbManager.hasAttachedAccessory)
                        put("permissionPending", usbManager.isPermissionPending)
                        put("mode", if (ProxyService.instance?.wifiTransport?.isConnected == true) "wifi" else if (usbManager.isConnected) "usb" else "none")
                        put("bytesSent", usbManager.bytesSent)
                        put("bytesReceived", usbManager.bytesReceived)
                        put("packetsSent", usbManager.packetsSent)
                        put("packetsReceived", usbManager.packetsReceived)
                        put("lastSendMs", usbManager.lastSendTime)
                        put("lastRecvMs", usbManager.lastRecvTime)
                        put("linkSilenceMs", if (usbManager.isConnected) usbManager.linkSilenceMs else -1L)
                        put("videoFrames", videoExtractor.framesExtracted.get())
                        put("videoLastFrameMs", videoExtractor.lastFrameTime)
                        put("videoStreaming", videoExtractor.lastFrameTime > 0L && (System.currentTimeMillis() - videoExtractor.lastFrameTime) < 3000L)
                        ProxyService.instance?.getPhoneBatteryPercent()?.let { put("phoneBatteryPercent", it) }
                        put("wsClients", wsClients.size)
                        put("usbWsClients", usbWsClients.size)
                        put("joystick", controlCoordinator.current().toJson())
                        put("state", droneState.toJson())
                        ProxyService.instance?.pairingStatus()?.let { pairing ->
                            put("pairing", JSONObject().apply {
                                put("state", pairing.state.wireName)
                                put("startedAtMs", pairing.startedAtMs ?: JSONObject.NULL)
                                put("lastUpdatedMs", pairing.lastUpdatedMs)
                                put("lastMessage", pairing.lastMessage)
                                put("resultRawHex", pairing.resultRawHex ?: JSONObject.NULL)
                            })
                        }
                    }
                    call.respondText(json.toString(), ContentType.Application.Json)
                    Log.d("[WebServer] GET /api/status -> open=${usbManager.isConnected} linkReady=${usbManager.isLinkReady}")
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
                    Log.i("[WebServer] POST /api/connect - attempting USB connection")
                    val service = ProxyService.instance
                    val ok = service?.ensureUsbConnection() ?: usbManager.connect()
                    val json = JSONObject().apply {
                        put("success", ok || usbManager.isConnected)
                        put("connected", usbManager.isLinkReady)
                        put("usbOpen", usbManager.isConnected)
                        put("accessoryAttached", usbManager.hasAttachedAccessory)
                        put("permissionPending", usbManager.isPermissionPending)
                    }
                    call.respondText(json.toString(), ContentType.Application.Json)
                }

                // WiFi Direct: send WifiDirectSwitch via USB to activate hotspot
                post("/api/wifi/activate") {
                    Log.i("[WebServer] POST /api/wifi/activate ÔÇö sending WifiDirectSwitch via USB")
                    val cmd = PotensicProtocol.buildWifiDirectSwitch(true)
                    ProxyService.instance?.sendDirectAny(cmd)
                    // Send 3 times for reliability
                    CoroutineScope(Dispatchers.IO).launch {
                        repeat(3) {
                            ProxyService.instance?.sendDirectAny(PotensicProtocol.buildWifiDirectSwitch(true))
                            kotlinx.coroutines.delay(200)
                        }
                    }
                    call.respondText("""{"cmd":"wifi_activate","sent":true}""", ContentType.Application.Json)
                }

                // WiFi Direct: BLE scan + pairing
                post("/api/wifi/scan") {
                    Log.i("[WebServer] POST /api/wifi/scan ÔÇö starting BLE pairing")
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
                    Log.i("[WebServer] POST /api/wifi/connect ÔåÆ $ip:$port")
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
                    val subscription = videoFrameHub.subscribe()
                    try {
                        while (true) {
                            val nal = subscription.poll()
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
                        subscription.close()
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
                                    val axes = ControlAxes(
                                        throttle = json.optInt("throttle", 0).toShort(),
                                        yaw = json.optInt("yaw", 0).toShort(),
                                        pitch = json.optInt("pitch", 0).toShort(),
                                        roll = json.optInt("roll", 0).toShort(),
                                        gimbal = json.optInt("gimbal", 0).toShort(),
                                    )
                                    controlCoordinator.submit(ControlSource.WEB, axes)
                                    Log.d("[WebServer] WS input: $axes active=${axes.active}")
                                } catch (e: Exception) {
                                    Log.e("[WebServer] WS parse error: ${e.message}")
                                }
                            }
                        }
                    } finally {
                        wsClients.remove(this)
                        Log.i("[WebServer] WebSocket client disconnected (remaining: ${wsClients.size})")
                        // Reset web override when client disconnects (safety!)
                        controlCoordinator.release(ControlSource.WEB)
                        Log.w("[WebServer] Joysticks reset to zero (client disconnected)")
                    }
                }
            }
        }
        server!!.start(wait = false)
        Log.i("[WebServer] Started on 0.0.0.0:$port (LAN-accessible while Android network permits)")
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
     * Broadcast raw USB data to all connected USB WebSocket clients.
     */
    suspend fun broadcastUsbData(data: ByteArray) {
        if (usbWsClients.isEmpty()) return
        val frame = Frame.Binary(true, data)
        usbWsClients.forEach { session ->
            try {
                session.send(frame)
            } catch (_: Exception) {}
        }
    }

    /**
     * Broadcast a packet that the backend is transmitting to the controller.
     * TX is sent as a small JSON envelope so browser clients can distinguish it
     * from raw RX binary data and include backend-generated commands in logs.
     */
    suspend fun broadcastUsbTx(data: ByteArray) {
        if (usbWsClients.isEmpty()) return
        val json = JSONObject().apply {
            put("direction", "TX")
            put("hex", PotensicProtocol.bytesToHex(data))
        }.toString()
        usbWsClients.forEach { session ->
            try {
                session.send(Frame.Text(json))
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
        usbWsClients.clear()
        Log.i("[WebServer] Stopped")
    }
}

