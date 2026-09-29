package com.potensic.proxy

import android.app.Notification
import com.potensic.proxy.protocol.PotensicProtocol
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.Context
import android.os.Build
import android.os.BatteryManager
import android.os.IBinder
import android.os.PowerManager
import kotlinx.coroutines.*
import org.json.JSONObject
import com.potensic.proxy.core.ConnectionState
import com.potensic.proxy.core.DroneStateStore
import com.potensic.proxy.control.ControlCoordinator
import com.potensic.proxy.core.VideoState
import com.potensic.proxy.video.VideoFrameHub

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
    val droneState = DroneStateStore()
    val controlCoordinator = ControlCoordinator(droneState)
    val videoExtractor = VideoExtractor()
    val videoFrameHub = VideoFrameHub()
    val videoDecoder = VideoDecoder()
    lateinit var transportCapture: TransportCaptureManager; private set
    lateinit var droneProfileManager: DroneProfileManager; private set

    // WiFi Direct transport
    var wifiTransport: WifiTransport? = null; private set
    private var blePairing: BlePairing? = null
    @Volatile var bleStatus: String = "idle"; private set

    private var wakeLock: PowerManager.WakeLock? = null
    private var controlJob: Job? = null
    private var connectionSupervisorJob: Job? = null
    @Volatile private var liveViewActivationInProgress = false
    @Volatile private var officialInitSentForConnection = false
    @Volatile private var lastLiveViewActivationMs = 0L
    @Volatile private var preferredLiveViewH265 = true
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.i("[Service] onCreate")

        createNotificationChannel()

        transportCapture = TransportCaptureManager(filesDir)
        videoExtractor.captureManager = transportCapture
        droneProfileManager = DroneProfileManager(applicationContext)
        videoExtractor.setProtocolProfile(droneProfileManager.current())
        preferredLiveViewH265 = droneProfileManager.current().preferredCodec == "h265"
        usbManager = UsbAccessoryManager(applicationContext)
        usbManager.listener = this

        webServer = WebServer(usbManager, videoExtractor, videoDecoder, videoFrameHub, transportCapture, droneState, controlCoordinator, filesDir) { path ->
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

        ensureUsbConnection()
        startConnectionSupervisor()

        return START_STICKY
    }

    override fun onDestroy() {
        Log.i("[Service] onDestroy")
        connectionSupervisorJob?.cancel()
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


    fun getPhoneBatteryPercent(): Int? {
        val manager = getSystemService(Context.BATTERY_SERVICE) as? BatteryManager ?: return null
        val value = manager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        return value.takeIf { it in 0..100 }
    }

    fun getDroneProfile(): DroneProfileManager.Profile = droneProfileManager.current()

    @Synchronized
    fun selectDroneProfile(id: String): DroneProfileManager.Profile? {
        val profile = droneProfileManager.select(id) ?: return null
        preferredLiveViewH265 = profile.preferredCodec == "h265"
        videoExtractor.setProtocolProfile(profile)
        videoDecoder.stop()
        lastLiveViewActivationMs = 0L
        officialInitSentForConnection = false
        Log.i("[Service] Drone protocol switched to ${profile.id}; parser/decoder reset")
        return profile
    }

    /**
     * Ensure that the Android process is actually connected to the Potensic USB accessory.
     * A browser WebSocket connection is not considered a drone/controller connection.
     */
    fun ensureUsbConnection(): Boolean {
        if (usbManager.isConnected) return true
        val connectedNow = usbManager.connect()
        Log.i("[Service] ensureUsbConnection: connected=$connectedNow attached=${usbManager.hasAttachedAccessory} permissionPending=${usbManager.isPermissionPending}")
        return connectedNow
    }

    /**
     * Keep the AOA link alive across cable re-plugs and service/UI timing differences.
     */
    private fun startConnectionSupervisor() {
        if (connectionSupervisorJob?.isActive == true) return
        connectionSupervisorJob = scope.launch {
            var lastProbeMs = 0L
            var lastReopenMs = 0L
            while (isActive) {
                try {
                    if (!usbManager.isConnected) {
                        if (usbManager.hasAttachedAccessory && !usbManager.isPermissionPending) {
                            ensureUsbConnection()
                        }
                    } else if (!usbManager.isLinkReady) {
                        val silence = usbManager.linkSilenceMs
                        val now = System.currentTimeMillis()

                        // The FD is open, but the RC has not answered yet. Re-send the
                        // AOA handshake and camera/flight initialization after a short
                        // settling interval. This handles the common race where usb_link
                        // becomes ready slightly after Android openAccessory().
                        if (silence >= 2500L && now - lastProbeMs >= 2500L) {
                            Log.w("[Service] USB accessory open but no RX for ${silence}ms - probing link")
                            usbManager.sendHandshakeProbe()
                            activateLiveView()
                            lastProbeMs = now
                        }

                        // If the accessory remains completely silent, force a clean reopen.
                        // Keep this deliberately slow so a permission dialog or drone boot
                        // cannot cause a reconnect storm.
                        if (silence >= 10000L && now - lastReopenMs >= 10000L) {
                            Log.w("[Service] USB link still silent - reopening accessory")
                            usbManager.disconnect()
                            delay(350)
                            ensureUsbConnection()
                            lastReopenMs = System.currentTimeMillis()
                            lastProbeMs = lastReopenMs
                        }
                    }
                } catch (e: Exception) {
                    Log.e("[Service] USB connection supervisor error: ${e.message}")
                }
                delay(1000)
            }
        }
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

                // Use the same captured initialization/LiveView path as USB.
                officialInitSentForConnection = false
                lastLiveViewActivationMs = 0L
                scope.launch {
                    delay(250)
                    activateLiveView(true, force = true)
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
        Log.i("[Service] USB accessory opened - waiting for controller RX")
        officialInitSentForConnection = false
        lastLiveViewActivationMs = 0L
        videoExtractor.reset()
        droneState.updateConnection(ConnectionState(transport = "usb", transportOpen = true, linkReady = usbManager.isLinkReady, lastRxMs = usbManager.lastRecvTime))

        startControlLoop()
        startExtractorLoop()
        startDecoderLoop()

        // Give usb_link/data_link a short settling interval after the AOA handshake,
        // then perform one authoritative backend-side camera initialization.
        scope.launch {
            delay(250)
            activateLiveView(preferredLiveViewH265, force = true)
        }

        // Broadcast telemetry to WebSocket every 200ms
        scope.launch {
            while (usbManager.isConnected) {
                val tel = TelemetryParser.latest
                droneState.updateTelemetry(tel)
                droneState.updateConnection(ConnectionState(transport = "usb", transportOpen = usbManager.isConnected, linkReady = usbManager.isLinkReady, lastRxMs = usbManager.lastRecvTime))
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
        Log.w("[Service] USB Disconnected - stopping loops; supervisor will reconnect when accessory is present")
        liveViewActivationInProgress = false
        officialInitSentForConnection = false
        lastLiveViewActivationMs = 0L
        controlJob?.cancel(); controlJob = null
        decoderJob?.cancel(); decoderJob = null
        extractorJob?.cancel(); extractorJob = null
        rawDataQueue.clear()
        videoFrameHub.clear()
        droneState.updateConnection(ConnectionState())
        droneState.updateVideo(VideoState())
    }

    private var decoderJob: Job? = null
    private var extractorJob: Job? = null
    private val rawDataQueue = java.util.concurrent.ConcurrentLinkedQueue<ByteArray>()

    /** True if any transport (USB or WiFi) is connected */
    private val isAnyConnected: Boolean
        get() = usbManager.isConnected || (wifiTransport?.isConnected == true)

    /** Send via whichever transport is active */
    private fun broadcastTxToWebUi(data: ByteArray) {
        val copy = data.copyOf()
        scope.launch { webServer.broadcastUsbTx(copy) }
    }

    fun sendAny(data: ByteArray) {
        if (::transportCapture.isInitialized) transportCapture.recordTxPacket(data)
        wifiTransport?.let {
            if (it.isConnected) {
                it.send(data)
                broadcastTxToWebUi(data)
                return
            }
        }
        if (usbManager.isConnected) {
            usbManager.send(data)
            broadcastTxToWebUi(data)
        }
    }

    fun sendDirectAny(data: ByteArray) {
        if (::transportCapture.isInitialized) transportCapture.recordTxPacket(data)
        wifiTransport?.let {
            if (it.isConnected) {
                it.sendDirect(data)
                broadcastTxToWebUi(data)
                return
            }
        }
        if (usbManager.isConnected) {
            usbManager.sendDirect(data)
            broadcastTxToWebUi(data)
        }
    }

    override fun onDataReceived(data: ByteArray, length: Int) {
        // Never drop USB data ÔÇö dropping causes corrupted frames
        val copy = data.copyOf(length)
        transportCapture.recordUsbRx(copy)
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
     * Codec/transport details are constrained by the selected drone protocol profile.
     */
    fun activateLiveView(enableH265: Boolean = preferredLiveViewH265, force: Boolean = false): Boolean {
        val profile = droneProfileManager.current()
        val effectiveH265 = when (profile.codec) {
            "h264" -> false
            "h265" -> true
            else -> enableH265
        }
        if (!isAnyConnected) {
            Log.w("[Service] LiveView activation requested without an active drone transport")
            ensureUsbConnection()
            return false
        }

        val now = System.currentTimeMillis()
        if (!force && preferredLiveViewH265 == effectiveH265 && now - lastLiveViewActivationMs < 10_000L) {
            Log.d("[Service] LiveView activation suppressed by 10s debounce (profile=${profile.id} codec=${if (effectiveH265) "H265" else "H264"})")
            return true
        }
        if (liveViewActivationInProgress) {
            Log.d("[Service] LiveView activation already in progress")
            return true
        }

        preferredLiveViewH265 = effectiveH265
        liveViewActivationInProgress = true
        scope.launch {
            try {
                // On the first activation for each USB connection, reproduce the exact
                // archived official-app initialization sequence before touching LiveView.
                if (!officialInitSentForConnection) {
                    Log.i("[Service] Sending captured official initialization sequence (pre-LiveView)...")
                    // Keep the captured initialization, but hold its final 0x73 packet so the
                    // explicit FPV sync + camera-function setup happens before LIVEVIEW_START.
                    val initSeq = PotensicProtocol.buildInitSequence(effectiveH265, includeLiveViewStart = false)
                    for ((i, cmd) in initSeq.withIndex()) {
                        sendDirectAny(cmd)
                        Log.i("[Service] Official init #${i + 1}/${initSeq.size} (${cmd.size}B)")
                        delay(50)
                    }
                    officialInitSentForConnection = true
                }

                // Combined sequence from the TAF helpers + captured Android flow:
                // FPV sync -> camera function/codec -> 0x73 start -> 0xD8 params -> 0xD9 IDR.
                Log.i("[Service] LiveView step 1/5: FPV sync version (FE 0x16 / short 0x1600)")
                sendDirectAny(PotensicProtocol.buildFpvSyncVersion())
                delay(100)

                Log.i("[Service] LiveView step 2/5: camera function preview=${true} profile=${profile.id} codec=${if (effectiveH265) "H265" else "H264"}")
                sendDirectAny(PotensicProtocol.buildCameraFunction(enablePreview = true, enableH265 = effectiveH265))
                delay(100)

                Log.i("[Service] LiveView step 3/5: LIVEVIEW_START 0x73")
                sendDirectAny(PotensicProtocol.buildLiveViewStart())
                delay(100)

                Log.i("[Service] LiveView step 4/5: LIVEVIEW_PARAMS 0xD8 (1080p/5000 captured payload)")
                sendDirectAny(PotensicProtocol.buildLiveViewParams(enableH265 = effectiveH265, bitrateKbps = 5000))
                delay(100)

                Log.i("[Service] LiveView step 5/5: IDR request 0xD9")
                sendDirectAny(PotensicProtocol.buildIDRRequestD9())
                lastLiveViewActivationMs = System.currentTimeMillis()
                Log.i("[Service] Extended LiveView activation sent; waiting for FE traffic/video")
            } catch (e: Exception) {
                Log.e("[Service] Error activating LiveView: ${e.message}")
            } finally {
                liveViewActivationInProgress = false
            }
        }
        return true
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
            var decoderSyncCodec = "unknown"
            while (isActive && isAnyConnected) {
                // If extractor reset, reset IDR sync
                if (videoExtractor.framesExtracted.get() == 0) {
                    gotFirstIdr = false
                }

                val nal = videoExtractor.nalQueue.poll()
                if (nal != null) {
                    // Consume the extractor queue exactly once, then fan out to browser/diagnostic clients.
                    videoFrameHub.publish(nal)
                    val frameTime = videoExtractor.lastFrameTime
                    droneState.updateVideo(VideoState(
                        codec = nal.codec,
                        width = if (nal.width > 0) nal.width else videoExtractor.lastWidth,
                        height = if (nal.height > 0) nal.height else videoExtractor.lastHeight,
                        frames = videoExtractor.framesExtracted.get().toLong(),
                        lastFrameMs = frameTime,
                        streaming = frameTime > 0L && System.currentTimeMillis() - frameTime < 3000L,
                    ))
                    if (nal.codec != "unknown" && nal.codec != decoderSyncCodec) {
                        decoderSyncCodec = nal.codec
                        gotFirstIdr = false
                    }
                    // Before the first IDR frame, discard P-frames (cannot be decoded without IDR)
                    if (!gotFirstIdr && !nal.isIFrame) {
                        delay(2)
                        continue
                    }
                    if (nal.isIFrame) {
                        gotFirstIdr = true
                    }

                    // Start/restart Android hardware decoder for the codec actually detected in w42.
                    val w = if (nal.width > 0) nal.width else videoExtractor.lastWidth
                    val h = if (nal.height > 0) nal.height else videoExtractor.lastHeight
                    val codec = if (nal.codec == "h264") "h264" else "h265"
                    if ((!videoDecoder.isRunning || videoDecoder.currentCodec != codec) && w > 0 && h > 0) {
                        val v = if (codec == "h265") (videoExtractor.vps ?: VideoExtractor.FALLBACK_VPS) else null
                        val s = if (codec == "h264") videoExtractor.sps264 else (videoExtractor.sps ?: VideoExtractor.FALLBACK_SPS)
                        val p = if (codec == "h264") videoExtractor.pps264 else (videoExtractor.pps ?: VideoExtractor.FALLBACK_PPS)
                        videoDecoder.start(w, h, codec, v, s, p)
                    }

                    videoDecoder.publishFrame = true
                    videoDecoder.decode(nal.data, nal.isIFrame)

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
            val heartbeatPacket = PotensicProtocol.buildHeartbeat()
            Log.hex("[Service] Heartbeat packet", heartbeatPacket)

            while (isActive && isAnyConnected) {
                try {
                    // Send combined HFD2+HFD1+HFD3 (127B) FE-wrapped when web joysticks active
                    // Must match official app format: all 3 concatenated, FE type 0x14
                    val control = controlCoordinator.current()
                    if (control.active) {
                        val packet = PotensicProtocol.buildCombinedControl(
                            throttle = control.throttle,
                            yaw = control.yaw,
                            pitch = control.pitch,
                            roll = control.roll,
                            gimbalTilt = control.gimbal,
                        )
                        sendDirectAny(packet)
                    }

                    val now = System.currentTimeMillis()

                    // Send heartbeat every 100ms to keep connection alive
                    if (now - lastHeartbeat > 100) {
                        sendDirectAny(heartbeatPacket)
                        lastHeartbeat = now
                    }

                    // Video watchdog: do not restart the complete camera sequence while FE 0x06
                    // is already flowing. In that state the transport is alive and repeated 0x16/0x73/0xD8
                    // commands only risk resetting an encoder that has already started.
                    if (now - lastVideoWatchdog > 3000) {
                        lastVideoWatchdog = now
                        val fe06Active = videoExtractor.hasRecentFeTraffic(0x06, 3500L)
                        val noFrames = videoExtractor.framesExtracted.get() == 0
                        val stalled = videoExtractor.lastFrameTime > 0 && now - videoExtractor.lastFrameTime > 5000L

                        if (!fe06Active && now - lastLiveViewActivationMs > 10_000L) {
                            Log.i("[Service] Video watchdog: no FE 0x06 traffic; retrying LiveView activation")
                            activateLiveView(preferredLiveViewH265, force = false)
                        } else if (fe06Active && (noFrames || stalled)) {
                            val parser = videoExtractor.getParserSnapshot()
                            Log.d("[Service] FE 0x06 active but video parser has no fresh frame: w42=${parser.w42HeadersParsed} invalid=${parser.w42InvalidHeaders} buffer=${parser.videoStreamBufferBytes}B")
                        }
                    }

                    // Request a recovery IDR only when FE 0x06 is active but no usable frame has
                    // appeared recently. Avoid the previous unconditional 2-second IDR storm.
                    val fe06ActiveForIdr = videoExtractor.hasRecentFeTraffic(0x06, 3500L)
                    val needsIdr = videoExtractor.framesExtracted.get() == 0 ||
                        (videoExtractor.lastFrameTime > 0 && now - videoExtractor.lastFrameTime > 3000L)
                    if (fe06ActiveForIdr && needsIdr && now - lastIdrRequest > 5000L) {
                        sendDirectAny(PotensicProtocol.buildIDRRequestD9())
                        lastIdrRequest = now
                    }

                    loopCount++
                    if (loopCount % 250 == 0L) {
                        Log.d("[Service] Control loop: $loopCount iterations, source=${controlCoordinator.activeSource().wireName} joystick=${controlCoordinator.current()} iFrames=${videoExtractor.iFrames.get()}")
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
            .setContentTitle(getString(R.string.notification_proxy_title))
            .setContentText(getString(R.string.notification_proxy_text))
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, getString(R.string.notification_channel_name), NotificationManager.IMPORTANCE_LOW).apply {
                    description = getString(R.string.notification_channel_description)
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



