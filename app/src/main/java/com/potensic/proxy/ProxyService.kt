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
 *   USB Accessory (drone controller) Ôåö WebSocket (remote client)
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

    // WiFi Direct transport
    var wifiTransport: WifiTransport? = null; private set
    private var blePairing: BlePairing? = null
    @Volatile var bleStatus: String = "idle"; private set

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
                assets.open(path).use { it.readBytes() }
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
            Log.e("[Service] startForeground failed: ${e.message}")
            try {
                startForeground(NOTIFICATION_ID, notification)
            } catch (e2: Exception) {
                Log.e("[Service] fallback startForeground failed: ${e2.message}")
            }
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
        wifiTransport?.destroy()
        blePairing?.stop()
        releaseWakeLock()
        instance = null
        scope.cancel()
        super.onDestroy()
    }

    // === WiFi Direct ===

    fun startBlePairing() {
        bleStatus = "scanning"
        blePairing = BlePairing(applicationContext)
        blePairing?.start(object : BlePairing.Callback {
            override fun onStatus(status: String) {
                bleStatus = status
                Log.i("[Service] BLE: $status")
                scope.launch {
                    webServer.broadcast(org.json.JSONObject().apply {
                        put("type", "ble")
                        put("status", status)
                    })
                }
            }
            override fun onCredentials(creds: BlePairing.WifiCredentials) {
                bleStatus = "credentials: SSID=${creds.ssid}"
                Log.i("[Service] BLE credentials: SSID=${creds.ssid} pw=${creds.password} bat=${creds.battery}%")
                scope.launch {
                    webServer.broadcast(org.json.JSONObject().apply {
                        put("type", "ble")
                        put("status", "credentials")
                        put("ssid", creds.ssid)
                        put("password", creds.password)
                        put("battery", creds.battery)
                        put("wifiMode", creds.wifiMode)
                        put("isOpen", creds.isOpen)
                    })
                }
            }
            override fun onError(error: String) {
                bleStatus = "error: $error"
                Log.e("[Service] BLE error: $error")
                scope.launch {
                    webServer.broadcast(org.json.JSONObject().apply {
                        put("type", "ble")
                        put("status", "error")
                        put("error", error)
                    })
                }
            }
        })
    }

    fun connectWifi(ip: String = "192.168.29.1", port: Int = 8889): Boolean {
        Log.i("[Service] WiFi connecting to $ip:$port")
        val wt = WifiTransport()
        wt.listener = object : WifiTransport.Listener {
            override fun onConnected() {
                Log.i("[Service] WiFi Connected!")
                videoExtractor.reset()

                // Send init sequence (same as USB)
                scope.launch {
                    val initSeq = DroneProtocol.buildInitSequence()
                    for ((i, cmd) in initSeq.withIndex()) {
                        wt.send(cmd)
                        Log.i("[Service] WiFi init cmd #${i+1}/${initSeq.size}")
                        delay(50)
                    }
                    wt.send(DroneProtocol.buildLiveViewParams())
                    Log.i("[Service] WiFi LiveViewParams sent")
                }

                startControlLoop()
                startExtractorLoop()
                startDecoderLoop()

                // Broadcast telemetry
                scope.launch {
                    while (wt.isConnected) {
                        val tel = TelemetryParser.latest
                        val json = org.json.JSONObject().apply {
                            put("type", "telemetry")
                            put("data", tel.toJson())
                        }
                        webServer.broadcast(json)
                        delay(200)
                    }
                }
            }

            override fun onDisconnected() {
                Log.w("[Service] WiFi Disconnected")
                controlJob?.cancel(); controlJob = null
            }

            override fun onDataReceived(data: ByteArray, length: Int) {
                rawDataQueue.offer(data.copyOf(length))
            }
        }

        wifiTransport = wt
        return scope.async { wt.connect(ip, port) }.let {
            runBlocking { it.await() }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // === UsbAccessoryManager.Listener ===

    override fun onConnected() {
        Log.i("[Service] USB Connected ÔÇö resetting and starting loops")
        videoExtractor.reset()

        // Send the EXACT init sequence captured from the official app
        scope.launch {
            val initSeq = DroneProtocol.buildInitSequence()
            for ((i, cmd) in initSeq.withIndex()) {
                usbManager.send(cmd)
                Log.i("[Service] Init cmd #${i+1}/${initSeq.size} (${cmd.size}B)")
                delay(50)
            }
            activateLiveView()
        }

        startControlLoop()
        startExtractorLoop()
        startDecoderLoop()

        // Broadcast telemetry to WebSocket every 200ms
        scope.launch {
            while (usbManager.isConnected) {
                val tel = TelemetryParser.latest
                val json = org.json.JSONObject().apply {
                    put("type", "telemetry")
                    put("data", tel.toJson())
                }
                webServer.broadcast(json)
                delay(200)
            }
        }
    }

    override fun onDisconnected() {
        Log.w("[Service] USB Disconnected ÔÇö stopping loops")
        controlJob?.cancel(); controlJob = null
        decoderJob?.cancel(); decoderJob = null
        extractorJob?.cancel(); extractorJob = null
        rawDataQueue.clear()
    }

    private var decoderJob: Job? = null
    private var extractorJob: Job? = null
    private val rawDataQueue = java.util.concurrent.ConcurrentLinkedQueue<ByteArray>()

    /** True if any transport (USB or WiFi) is connected */
    private val isAnyConnected: Boolean
        get() = usbManager.isConnected || (wifiTransport?.isConnected == true)

    /** Send via whichever transport is active */
    fun sendAny(data: ByteArray) {
        wifiTransport?.let { if (it.isConnected) { it.send(data); return } }
        if (usbManager.isConnected) usbManager.send(data)
    }

    fun sendDirectAny(data: ByteArray) {
        wifiTransport?.let { if (it.isConnected) { it.sendDirect(data); return } }
        if (usbManager.isConnected) usbManager.sendDirect(data)
    }

    override fun onDataReceived(data: ByteArray, length: Int) {
        // Never drop USB data ÔÇö dropping causes corrupted frames
        val copy = data.copyOf(length)
        rawDataQueue.offer(copy)
        scope.launch {
            webServer.broadcastUsbData(copy)
        }
    }

    private fun startExtractorLoop() {
        if (extractorJob?.isActive == true) return
        extractorJob = scope.launch(Dispatchers.Default) {
            Log.i("[Service] Extractor loop started")
            while (isActive && isAnyConnected) {
                val data = rawDataQueue.poll()
                if (data != null) {
                    videoExtractor.feed(data, data.size)
                } else {
                    delay(1)
                }
            }
        }
    }

    /**
     * Video stream activation helper.
     * Tells drone camera to start encoding and transmitting H.265 video packets.
     */
    fun activateLiveView() {
        scope.launch {
            try {
                Log.i("[Service] Activating LiveView stream...")
                // CAMERA: LIVEVIEW_START (cmd=0x73, data=0x00 0x64)
                val liveViewStart = DroneProtocol.hexToBytes("fe000000000000150000000000000009fffd05000012730064")
                sendDirectAny(liveViewStart)
                delay(50)
                // CAMERA: LIVEVIEW_PARAMS (cmd=0xD8, 1080P 5000Kbps)
                sendDirectAny(DroneProtocol.buildLiveViewParams())
                delay(50)
                // CAMERA: REQUEST_IDR (cmd=0xD9)
                sendDirectAny(DroneProtocol.buildIDRRequest())
                Log.i("[Service] Sent LiveView activation commands")
            } catch (e: Exception) {
                Log.e("[Service] Error activating LiveView: ${e.message}")
            }
        }
    }

    /**
     * Separate decoder thread that consumes NALs from the extractor queue.
     * Runs independently from USB read thread to avoid blocking.
     * Decodes all sequential NAL units (I and P frames) in stream order.
     */
    private fun startDecoderLoop() {
        if (decoderJob?.isActive == true) return
        decoderJob = scope.launch(Dispatchers.Default) {
            Log.i("[Service] Decoder loop started")
            var statsCounter = 0
            var gotFirstIdr = false
            while (isActive && isAnyConnected) {
                // If extractor reset, reset IDR sync
                if (videoExtractor.framesExtracted.get() == 0) {
                    gotFirstIdr = false
                }

                val nal = videoExtractor.nalQueue.poll()
                if (nal != null) {
                    // Before the first IDR frame, discard P-frames (cannot be decoded without IDR)
                    if (!gotFirstIdr && !nal.isIFrame) {
                        delay(2)
                        continue
                    }
                    if (nal.isIFrame) {
                        gotFirstIdr = true
                    }

                    // Start decoder on first frame once resolution is known
                    val w = if (nal.width > 0) nal.width else videoExtractor.lastWidth
                    val h = if (nal.height > 0) nal.height else videoExtractor.lastHeight
                    if (videoDecoder.framesDecoded.get() == 0 && w > 0 && h > 0) {
                        val v = videoExtractor.vps ?: VideoExtractor.FALLBACK_VPS
                        val s = videoExtractor.sps ?: VideoExtractor.FALLBACK_SPS
                        val p = videoExtractor.pps ?: VideoExtractor.FALLBACK_PPS
                        videoDecoder.start(w, h, v, s, p)
                    }

                    videoDecoder.publishFrame = true
                    videoDecoder.decode(nal.data, nal.isIFrame)

                    // Low latency backlog prevention: if queue has more than 15 frames (~0.5s),
                    // skip non-IDR frames to catch up to real-time
                    if (videoExtractor.nalQueue.size > 15) {
                        while (videoExtractor.nalQueue.size > 2) {
                            val skipped = videoExtractor.nalQueue.poll() ?: break
                            if (skipped.isIFrame) {
                                videoDecoder.decode(skipped.data, true)
                                break
                            }
                        }
                    }

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
            var lastVideoWatchdog = 0L
            val heartbeatPacket = DroneProtocol.buildHeartbeat()
            Log.hex("[Service] Heartbeat packet", heartbeatPacket)

            while (isActive && isAnyConnected) {
                try {
                    // Send combined HFD2+HFD1+HFD3 (127B) FE-wrapped when web joysticks active
                    // Must match official app format: all 3 concatenated, FE type 0x14
                    if (webServer.hasActiveInput) {
                        val packet = DroneProtocol.buildCombinedControl(
                            throttle = webServer.throttle,
                            yaw = webServer.yaw,
                            pitch = webServer.pitch,
                            roll = webServer.roll,
                            gimbalTilt = webServer.gimbalTilt,
                        )
                        sendDirectAny(packet)
                    }

                    val now = System.currentTimeMillis()

                    // Send heartbeat every 100ms to keep connection alive
                    if (now - lastHeartbeat > 100) {
                        sendDirectAny(heartbeatPacket)
                        lastHeartbeat = now
                    }

                    // Video watchdog: If no video frames received yet, or stream stalled > 5s,
                    // automatically kickstart LiveView transmission
                    if (now - lastVideoWatchdog > 3000) {
                        lastVideoWatchdog = now
                        if (videoExtractor.framesExtracted.get() == 0 ||
                            (videoExtractor.lastFrameTime > 0 && now - videoExtractor.lastFrameTime > 5000)) {
                            Log.i("[Service] Video watchdog: Drone online but no video, sending LiveView activation")
                            activateLiveView()
                        }
                    }

                    // Periodic IDR request every 2000ms to repair any packet loss artifacts
                    if (now - lastIdrRequest > 2000) {
                        val idrCmd = DroneProtocol.buildIDRRequest()
                        sendDirectAny(idrCmd)
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



