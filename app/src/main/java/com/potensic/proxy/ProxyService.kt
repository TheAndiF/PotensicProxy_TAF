package com.potensic.proxy

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import kotlinx.coroutines.*
import org.json.JSONObject

/**
 * Foreground service that bridges:
 *   USB Accessory (drone controller) ↔ WebSocket (remote client)
 *
 * Control loop runs at ~50Hz (20ms):
 * 1. Read joystick state from WebServer
 * 2. Build protocol packet
 * 3. Send to USB accessory
 * 4. Forward any received telemetry to WebSocket clients
 */
class ProxyService : Service(), UsbAccessoryManager.Listener {

    companion object {
        const val CHANNEL_ID = "potensic_proxy"
        const val NOTIFICATION_ID = 4242
        const val CONTROL_LOOP_MS = 20L // 50Hz

        var instance: ProxyService? = null; private set
    }

    lateinit var usbManager: UsbAccessoryManager; private set
    lateinit var webServer: WebServer; private set
    val videoExtractor = VideoExtractor()
    val videoDecoder = VideoDecoder()

    private var wakeLock: PowerManager.WakeLock? = null
    private var controlJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.i("[Service] onCreate")

        createNotificationChannel()

        usbManager = UsbAccessoryManager(applicationContext)
        usbManager.listener = this

        webServer = WebServer(usbManager, videoExtractor, videoDecoder) { path ->
            try {
                assets.open(path).bufferedReader().readText()
            } catch (e: Exception) {
                Log.e("[Service] Asset load failed: $path", e)
                null
            }
        }

        acquireWakeLock()
    }

    private var serverStarted = false

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i("[Service] onStartCommand (serverStarted=$serverStarted)")

        val notification = buildNotification()
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION_ID, notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            Log.e("[Service] startForeground failed", e)
        }

        if (!serverStarted) {
            webServer.start(9090)
            serverStarted = true
            Log.i("[Service] Web server started on :9090")
        } else {
            Log.i("[Service] Web server already running, skipping")
        }

        // Auto-connect if accessory is already attached and not connected
        if (!usbManager.isConnected) {
            val connected = usbManager.connect()
            Log.i("[Service] Auto-connect result: $connected")
            if (connected) {
                startControlLoop()
            }
        } else {
            Log.i("[Service] USB already connected, skipping")
        }

        return START_STICKY
    }

    override fun onDestroy() {
        Log.i("[Service] onDestroy")
        controlJob?.cancel()
        webServer.stop()
        usbManager.destroy()
        releaseWakeLock()
        instance = null
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // === UsbAccessoryManager.Listener ===

    override fun onConnected() {
        Log.i("[Service] USB Connected — resetting and starting loops")
        videoExtractor.reset()

        // Send LiveViewParams to init video stream
        val liveView = DroneProtocol.buildLiveViewParams()
        usbManager.send(liveView)
        Log.i("[Service] Queued LiveViewParams")

        startControlLoop()
        startExtractorLoop()
        startDecoderLoop()
    }

    override fun onDisconnected() {
        Log.w("[Service] USB Disconnected — stopping loops")
        controlJob?.cancel(); controlJob = null
        decoderJob?.cancel(); decoderJob = null
        extractorJob?.cancel(); extractorJob = null
        rawDataQueue.clear()
    }

    private var decoderJob: Job? = null

    // Raw USB data queue for async processing
    private val rawDataQueue = java.util.concurrent.ConcurrentLinkedQueue<ByteArray>()
    private var extractorJob: Job? = null

    override fun onDataReceived(data: ByteArray, length: Int) {
        // Don't process on USB thread — just queue the data
        rawDataQueue.offer(data.copyOf(length))
    }

    private fun startExtractorLoop() {
        if (extractorJob?.isActive == true) return
        extractorJob = scope.launch(Dispatchers.Default) {
            Log.i("[Service] Extractor loop started")
            while (isActive && usbManager.isConnected) {
                val data = rawDataQueue.poll()
                if (data != null) {
                    videoExtractor.feed(data, data.size)
                } else {
                    delay(1)
                }
            }
            Log.i("[Service] Extractor loop ended")
        }
    }

    /**
     * Separate decoder thread that consumes NALs from the extractor queue.
     * Runs independently from USB read thread to avoid blocking.
     */
    private fun startDecoderLoop() {
        if (decoderJob?.isActive == true) return
        decoderJob = scope.launch(Dispatchers.Default) {
            Log.i("[Service] Decoder loop started")
            var statsCounter = 0
            var gotFirstIdr = false
            while (isActive && usbManager.isConnected) {
                // Drain queue — grab only the LATEST IDR to minimize latency
                var latestIdr: VideoExtractor.NalUnit? = null
                while (true) {
                    val nal = videoExtractor.nalQueue.poll() ?: break
                    if (nal.isIFrame) latestIdr = nal
                }

                if (latestIdr != null) {
                    // Start decoder on first frame
                    if (videoDecoder.framesDecoded.get() == 0 && videoExtractor.lastWidth > 0) {
                        val v = videoExtractor.vps ?: VideoExtractor.FALLBACK_VPS
                        val s = videoExtractor.sps ?: VideoExtractor.FALLBACK_SPS
                        val p = videoExtractor.pps ?: VideoExtractor.FALLBACK_PPS
                        videoDecoder.start(videoExtractor.lastWidth, videoExtractor.lastHeight, v, s, p)
                    }

                    gotFirstIdr = true
                    videoDecoder.publishFrame = true
                    videoDecoder.decode(latestIdr.data, true)

                    // Broadcast stats periodically
                    if (++statsCounter % 25 == 0) {
                        val json = JSONObject().apply {
                            put("type", "telemetry")
                            put("videoFrames", videoExtractor.framesExtracted.get())
                            put("iFrames", videoExtractor.iFrames.get())
                            put("decodedFrames", videoDecoder.framesDecoded.get())
                            put("resolution", "${videoExtractor.lastWidth}x${videoExtractor.lastHeight}")
                        }
                        webServer.broadcast(json)
                    }
                } else {
                    delay(2) // wait for more NALs
                }
            }
            Log.i("[Service] Decoder loop ended")
        }
    }

    // === Control Loop ===

    private fun startControlLoop() {
        if (controlJob?.isActive == true) {
            Log.w("[Service] Control loop already running")
            return
        }

        controlJob = scope.launch {
            Log.i("[Service] Control loop started (${CONTROL_LOOP_MS}ms interval = ${1000 / CONTROL_LOOP_MS}Hz)")
            var loopCount = 0L
            var lastIdrRequest = 0L
            var lastHeartbeat = 0L
            val heartbeatPacket = DroneProtocol.buildHeartbeat()
            Log.hex("[Service] Heartbeat packet", heartbeatPacket)

            while (isActive && usbManager.isConnected) {
                try {
                    // Build control packet from current joystick state
                    val packet = DroneProtocol.buildControlPacket(
                        throttle = webServer.throttle,
                        yaw = webServer.yaw,
                        pitch = webServer.pitch,
                        roll = webServer.roll,
                        gimbalTilt = webServer.gimbalTilt,
                    )

                    // Send via USB
                    usbManager.send(packet)

                    val now = System.currentTimeMillis()

                    // Send heartbeat every 500ms to keep connection alive
                    if (now - lastHeartbeat > 500) {
                        usbManager.sendDirect(heartbeatPacket)
                        lastHeartbeat = now
                    }

                    // Request IDR frame every 5s until we get one
                    // Request IDR every 30ms — maximum clean keyframes
                    if (now - lastIdrRequest > 30) {
                        val idrCmd = DroneProtocol.buildIDRRequest()
                        usbManager.send(idrCmd)
                        lastIdrRequest = now
                    }

                    loopCount++
                    if (loopCount % 250 == 0L) {
                        Log.d("[Service] Control loop: $loopCount iterations, joystick=(${webServer.throttle},${webServer.yaw},${webServer.pitch},${webServer.roll}) iFrames=${videoExtractor.iFrames.get()}")
                    }

                    delay(CONTROL_LOOP_MS)
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    Log.e("[Service] Control loop error", e)
                    delay(100) // back off on error
                }
            }

            Log.i("[Service] Control loop ended after $loopCount iterations")
        }
    }

    // === Notification & WakeLock ===

    private fun buildNotification(): Notification {
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Potensic Proxy")
            .setContentText("Drone control relay active — :9090")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Drone Proxy", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "Potensic drone control relay"
                    setShowBadge(false)
                }
            )
        }
    }

    private fun acquireWakeLock() {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "potensic:proxy")
            .apply { acquire() }
        Log.i("[Service] WakeLock acquired")
    }

    private fun releaseWakeLock() {
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        Log.i("[Service] WakeLock released")
    }
}
