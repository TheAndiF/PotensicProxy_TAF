package com.potensic.proxy.api

import com.potensic.proxy.*
import com.potensic.proxy.control.ControlCoordinator
import com.potensic.proxy.core.DroneStateStore
import com.potensic.proxy.video.VideoFrameHub
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.json.JSONArray
import org.json.JSONObject

/** Unified runtime diagnostics without changing protocol interpretation. */
fun Route.installDiagnosticsRoutes(
    usbManager: UsbAccessoryManager,
    videoExtractor: VideoExtractor,
    videoDecoder: VideoDecoder,
    videoFrameHub: VideoFrameHub,
    capture: TransportCaptureManager,
    droneState: DroneStateStore,
    control: ControlCoordinator,
) {
    get("/api/diagnostics") {
        val parser = videoExtractor.getParserSnapshot()
        val captureStatus = capture.status()
        val json = JSONObject().apply {
            put("version", VersionInfo.toJson())
            put("state", droneState.toJson())
            put("control", control.toJson())
            put("transport", JSONObject().apply {
                put("usbOpen", usbManager.isConnected)
                put("usbLinkReady", usbManager.isLinkReady)
                put("bytesSent", usbManager.bytesSent)
                put("bytesReceived", usbManager.bytesReceived)
                put("packetsSent", usbManager.packetsSent)
                put("packetsReceived", usbManager.packetsReceived)
                put("linkSilenceMs", if (usbManager.isConnected) usbManager.linkSilenceMs else -1L)
            })
            put("video", JSONObject().apply {
                put("profile", videoExtractor.currentProfileId())
                put("transport", videoExtractor.currentTransport())
                put("framesExtracted", videoExtractor.framesExtracted.get())
                put("iFrames", videoExtractor.iFrames.get())
                put("decodedFrames", videoDecoder.framesDecoded.get())
                put("decoderRunning", videoDecoder.isRunning)
                put("decoderCodec", videoDecoder.currentCodec)
                put("subscribers", videoFrameHub.subscriberCount())
                put("parser", JSONObject().apply {
                    put("w42HeadersParsed", parser.w42HeadersParsed)
                    put("w42InvalidHeaders", parser.w42InvalidHeaders)
                    put("videoStreamBufferBytes", parser.videoStreamBufferBytes)
                })
            })
            put("capture", JSONObject().apply {
                put("active", captureStatus.active)
                put("startedAt", captureStatus.startedAt)
                put("directory", captureStatus.directory)
                put("rawBytes", captureStatus.rawBytes)
                put("feFrames", captureStatus.feFrames)
                put("fe06Bytes", captureStatus.fe06Bytes)
            })
        }
        call.respondText(json.toString(), ContentType.Application.Json)
    }
}
