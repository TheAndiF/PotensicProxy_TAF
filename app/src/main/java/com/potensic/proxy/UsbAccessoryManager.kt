package com.potensic.proxy

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbAccessory
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.ParcelFileDescriptor
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Manages USB Accessory (AOA) connection to the Potensic drone controller.
 * Handles connect/disconnect, read/write, and packet routing.
 */
class UsbAccessoryManager(private val context: Context) {

    interface Listener {
        fun onConnected()
        fun onDisconnected()
        fun onDataReceived(data: ByteArray, length: Int)
    }

    var listener: Listener? = null

    companion object {
        const val ACTION_USB_PERMISSION = "com.potensic.proxy.USB_PERMISSION"
    }

    private val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
    private var accessory: UsbAccessory? = null
    @Volatile private var pendingConnect = false
    @Volatile private var openedAtMs: Long = 0
    @Volatile private var firstRxLogged = false
    private val writeLock = Any()

    private val permissionReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            if (intent.action == ACTION_USB_PERMISSION) {
                val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                Log.i("[USB] Permission result: granted=$granted")
                if (granted && pendingConnect) {
                    pendingConnect = false
                    if (!openAccessory()) {
                        Log.e("[USB] Permission granted but accessory open failed")
                    }
                } else {
                    pendingConnect = false
                    Log.e("[USB] Permission denied by user")
                }
            }
        }
    }

    init {
        val filter = IntentFilter(ACTION_USB_PERMISSION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(permissionReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(permissionReceiver, filter)
        }
        Log.d("[USB] Permission receiver registered")
    }
    private var fileDescriptor: ParcelFileDescriptor? = null
    private var inputStream: FileInputStream? = null
    private var outputStream: FileOutputStream? = null

    private val connected = AtomicBoolean(false)
    private val running = AtomicBoolean(false)
    private val sendQueue = ConcurrentLinkedQueue<ByteArray>()

    private var readJob: Job? = null
    private var writeJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    /** True when the Android USB accessory file descriptor is open. */
    val isConnected: Boolean get() = connected.get()
    val isPermissionPending: Boolean get() = pendingConnect
    val hasAttachedAccessory: Boolean get() = !usbManager.accessoryList.isNullOrEmpty()
    val openedAt: Long get() = openedAtMs

    /**
     * AOA open alone is not enough to claim that the controller/drone link is alive.
     * Require actual RX traffic from usb_link/data_link and keep it fresh.
     */
    val isLinkReady: Boolean
        get() = connected.get() && lastRecvTime > 0L && (System.currentTimeMillis() - lastRecvTime) < 6000L

    val linkSilenceMs: Long
        get() {
            val base = if (lastRecvTime > 0L) lastRecvTime else openedAtMs
            return if (base > 0L) (System.currentTimeMillis() - base).coerceAtLeast(0L) else Long.MAX_VALUE
        }

    // Stats
    var bytesSent: Long = 0; private set
    var bytesReceived: Long = 0; private set
    var packetsSent: Long = 0; private set
    var packetsReceived: Long = 0; private set
    var lastSendTime: Long = 0; private set
    var lastRecvTime: Long = 0; private set

    /**
     * Try to connect to an attached USB accessory.
     * If permission is needed, requests it and returns false (will auto-connect on grant).
     */
    @Synchronized
    fun connect(): Boolean {
        if (connected.get()) {
            Log.d("[USB] connect(): already connected")
            return true
        }
        if (pendingConnect) {
            Log.d("[USB] connect(): waiting for USB permission result")
            return false
        }

        Log.i("[USB] Attempting connection...")

        val accessories = usbManager.accessoryList
        if (accessories.isNullOrEmpty()) {
            Log.w("[USB] No USB accessories found")
            return false
        }

        for (acc in accessories) {
            Log.i("[USB] Found accessory: manufacturer=${acc.manufacturer} model=${acc.model} version=${acc.version}")
        }

        val target = accessories.firstOrNull {
            it.manufacturer == "deepsea" && it.model == "android.potensic.atom"
        } ?: accessories.first().also {
            Log.w("[USB] No deepsea accessory, using first available: ${it.manufacturer}/${it.model}")
        }

        accessory = target

        if (!usbManager.hasPermission(target)) {
            Log.i("[USB] Requesting USB permission from user...")
            pendingConnect = true
            val intent = Intent(ACTION_USB_PERMISSION).apply { setPackage(context.packageName) }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_ALLOW_UNSAFE_IMPLICIT_INTENT
            else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            else PendingIntent.FLAG_UPDATE_CURRENT
            val pi = PendingIntent.getBroadcast(context, 0, intent, flags)
            usbManager.requestPermission(target, pi)
            return false // will connect via receiver callback
        }

        return openAccessory()
    }

    /**
     * Open the accessory after permission is granted.
     */
    private fun openAccessory(): Boolean {
        val target = accessory ?: run {
            Log.e("[USB] No accessory to open")
            return false
        }

        Log.i("[USB] Opening accessory...")
        val pfd = usbManager.openAccessory(target)
        if (pfd == null) {
            Log.e("[USB] Failed to open accessory — openAccessory returned null")
            return false
        }

        fileDescriptor = pfd
        val fd = pfd.fileDescriptor
        inputStream = FileInputStream(fd)
        outputStream = FileOutputStream(fd)

        Log.i("[USB] Accessory opened. Sending handshake...")

        // Send handshake
        try {
            val handshake = DroneProtocol.HANDSHAKE
            Log.hex("[USB] Handshake TX", handshake)
            synchronized(writeLock) {
                outputStream!!.write(handshake)
                outputStream!!.flush()
            }
            Log.i("[USB] Handshake sent (${handshake.size} bytes)")
        } catch (e: Exception) {
            Log.e("[USB] Handshake failed", e)
            disconnect()
            return false
        }

        connected.set(true)
        running.set(true)
        openedAtMs = System.currentTimeMillis()
        firstRxLogged = false
        bytesSent = 0
        bytesReceived = 0
        packetsSent = 0
        packetsReceived = 0

        // Start read thread
        readJob = scope.launch {
            Log.i("[USB] Read thread started")
            readLoop()
            Log.i("[USB] Read thread ended")
        }

        // Start write thread
        writeJob = scope.launch {
            Log.i("[USB] Write thread started")
            writeLoop()
            Log.i("[USB] Write thread ended")
        }

        Log.i("[USB] Connection established!")
        listener?.onConnected()
        return true
    }

    /**
     * Disconnect and clean up.
     */
    fun disconnect() {
        Log.i("[USB] Disconnecting...")
        running.set(false)
        connected.set(false)
        pendingConnect = false
        openedAtMs = 0L
        firstRxLogged = false

        readJob?.cancel()
        writeJob?.cancel()

        try { inputStream?.close() } catch (_: Exception) {}
        try { outputStream?.close() } catch (_: Exception) {}
        try { fileDescriptor?.close() } catch (_: Exception) {}

        inputStream = null
        outputStream = null
        fileDescriptor = null
        accessory = null
        sendQueue.clear()

        Log.i("[USB] Disconnected. Stats: sent=$bytesSent bytes ($packetsSent pkts), recv=$bytesReceived bytes ($packetsReceived pkts)")
        listener?.onDisconnected()
    }

    /**
     * Re-send the AOA application handshake on an already-open accessory.
     * This is used by the connection supervisor when the file descriptor opened
     * successfully but no controller RX traffic has appeared yet.
     */
    fun sendHandshakeProbe(): Boolean {
        if (!connected.get()) return false
        return try {
            synchronized(writeLock) {
                val os = outputStream ?: return false
                os.write(DroneProtocol.HANDSHAKE)
                os.flush()
                bytesSent += DroneProtocol.HANDSHAKE.size
                packetsSent++
                lastSendTime = System.currentTimeMillis()
            }
            Log.i("[USB] AOA handshake probe sent")
            true
        } catch (e: Exception) {
            Log.e("[USB] AOA handshake probe failed", e)
            false
        }
    }

    /**
     * Queue a packet for sending to the controller.
     */
    fun send(data: ByteArray) {
        if (!connected.get()) {
            Log.w("[USB] Cannot send — not connected")
            return
        }
        if (sendQueue.size > 100) {
            Log.w("[USB] Send queue overflow (${sendQueue.size}), clearing!")
            sendQueue.clear()
        }
        sendQueue.offer(data)
    }

    /**
     * Send a packet immediately (bypass queue, for high-priority).
     */
    fun sendDirect(data: ByteArray) {
        if (!connected.get()) return
        try {
            synchronized(writeLock) {
                outputStream?.let { os ->
                    os.write(data, 0, data.size)
                    os.flush()
                    bytesSent += data.size
                    packetsSent++
                    lastSendTime = System.currentTimeMillis()
                }
            }
        } catch (e: Exception) {
            Log.e("[USB] Direct send failed", e)
        }
    }

    // === Internal loops ===

    private suspend fun readLoop() {
        val buffer = ByteArray(16384) // Match official app read behavior — individual USB packets
        android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_URGENT_AUDIO) // max priority
        while (running.get() && connected.get()) {
            try {
                val bytesRead = inputStream?.read(buffer) ?: -1
                if (bytesRead > 0) {
                    bytesReceived += bytesRead
                    packetsReceived++
                    lastRecvTime = System.currentTimeMillis()
                    if (!firstRxLogged) {
                        firstRxLogged = true
                        Log.i("[USB] Controller link confirmed by first RX packet (${bytesRead} bytes)")
                    }

                    // Minimal logging to avoid blocking the read thread
                    if (packetsReceived <= 3) {
                        Log.hex("[USB] RX#${packetsReceived}", buffer.copyOf(bytesRead.coerceAtMost(64)))
                    } else if (packetsReceived % 1000 == 0L) {
                        Log.d("[USB] RX stats: $bytesReceived bytes, $packetsReceived pkts")
                    }

                    val copy = buffer.copyOf(bytesRead)
                    listener?.onDataReceived(copy, bytesRead)
                } else if (bytesRead < 0) {
                    Log.w("[USB] Read returned $bytesRead — connection lost")
                    break
                }
            } catch (e: Exception) {
                if (running.get()) {
                    Log.e("[USB] Read error", e)
                }
                break
            }
        }
        if (connected.get()) {
            Log.w("[USB] Read loop exited while connected — triggering disconnect")
            disconnect()
        }
    }

    private suspend fun writeLoop() {
        while (running.get() && connected.get()) {
            try {
                val data = sendQueue.poll()
                if (data != null) {
                    synchronized(writeLock) {
                        outputStream?.let { os ->
                            os.write(data, 0, data.size)
                            os.flush()
                            bytesSent += data.size
                            packetsSent++
                            lastSendTime = System.currentTimeMillis()

                            if (packetsSent % 500 == 0L) {
                                Log.d("[USB] TX: ${data.size} bytes (total: $bytesSent bytes, $packetsSent pkts)")
                            }
                        }
                    }
                }
                delay(2) // ~500 packets/sec max, matching original app
            } catch (e: Exception) {
                if (running.get()) {
                    Log.e("[USB] Write error", e)
                }
                break
            }
        }
    }

    fun destroy() {
        disconnect()
        try { context.unregisterReceiver(permissionReceiver) } catch (_: Exception) {}
        scope.cancel()
        Log.i("[USB] Manager destroyed")
    }
}
