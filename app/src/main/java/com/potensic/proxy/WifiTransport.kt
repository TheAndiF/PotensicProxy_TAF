package com.potensic.proxy

import kotlinx.coroutines.*
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean

/**
 * TCP transport for WiFi Direct mode.
 * Connects to drone at 192.168.29.1:8889 (reversed from uw5.java).
 * Same data format as USB (FE frames, FF FD commands, CC BB AA FF video).
 * Implements the same Listener interface as UsbAccessoryManager.
 */
class WifiTransport {

    companion object {
        const val DRONE_IP = "192.168.29.1"
        const val DRONE_PORT = 8889
        const val RX_BUFFER = 10240 // 10KB, matches official app (uw5.java)
        const val CONNECT_TIMEOUT = 5000
    }

    interface Listener {
        fun onConnected()
        fun onDisconnected()
        fun onDataReceived(data: ByteArray, length: Int)
    }

    var listener: Listener? = null

    private var socket: Socket? = null
    private var inputStream: InputStream? = null
    private var outputStream: OutputStream? = null

    private val connected = AtomicBoolean(false)
    private val running = AtomicBoolean(false)
    private val sendQueue = ConcurrentLinkedQueue<ByteArray>()

    private var readJob: Job? = null
    private var writeJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    val isConnected: Boolean get() = connected.get()

    // Stats
    var bytesSent: Long = 0; private set
    var bytesReceived: Long = 0; private set
    var packetsSent: Long = 0; private set
    var packetsReceived: Long = 0; private set
    var lastSendTime: Long = 0; private set
    var lastRecvTime: Long = 0; private set

    /**
     * Connect to drone via TCP.
     * Call this AFTER connecting to the drone's WiFi hotspot.
     */
    fun connect(ip: String = DRONE_IP, port: Int = DRONE_PORT): Boolean {
        Log.i("[WiFi] Connecting to $ip:$port...")
        try {
            val sock = Socket()
            sock.connect(InetSocketAddress(ip, port), CONNECT_TIMEOUT)
            sock.tcpNoDelay = true
            sock.soTimeout = 0 // blocking reads

            socket = sock
            inputStream = sock.getInputStream()
            outputStream = sock.getOutputStream()

            connected.set(true)
            running.set(true)
            bytesSent = 0; bytesReceived = 0; packetsSent = 0; packetsReceived = 0

            Log.i("[WiFi] TCP connected to $ip:$port")

            // Send handshake (same as USB)
            val handshake = DroneProtocol.HANDSHAKE
            sendDirect(handshake)
            Log.i("[WiFi] Handshake sent (${handshake.size} bytes)")

            // Start read/write threads
            readJob = scope.launch { readLoop() }
            writeJob = scope.launch { writeLoop() }

            listener?.onConnected()
            return true
        } catch (e: Exception) {
            Log.e("[WiFi] Connect failed: ${e.message}", e)
            disconnect()
            return false
        }
    }

    fun disconnect() {
        Log.i("[WiFi] Disconnecting...")
        running.set(false)
        connected.set(false)

        readJob?.cancel(); writeJob?.cancel()

        try { inputStream?.close() } catch (_: Exception) {}
        try { outputStream?.close() } catch (_: Exception) {}
        try { socket?.close() } catch (_: Exception) {}

        inputStream = null; outputStream = null; socket = null
        sendQueue.clear()

        Log.i("[WiFi] Disconnected. Stats: sent=$bytesSent ($packetsSent pkts), recv=$bytesReceived ($packetsReceived pkts)")
        listener?.onDisconnected()
    }

    fun send(data: ByteArray) {
        if (!connected.get()) return
        if (sendQueue.size > 100) {
            Log.w("[WiFi] Send queue overflow, clearing")
            sendQueue.clear()
        }
        sendQueue.offer(data)
    }

    fun sendDirect(data: ByteArray) {
        if (!connected.get()) return
        try {
            outputStream?.let { os ->
                os.write(data, 0, data.size)
                os.flush()
                bytesSent += data.size
                packetsSent++
                lastSendTime = System.currentTimeMillis()
            }
        } catch (e: Exception) {
            Log.e("[WiFi] Direct send failed", e)
        }
    }

    private suspend fun readLoop() {
        val buffer = ByteArray(RX_BUFFER)
        Log.i("[WiFi] Read thread started")
        while (running.get() && connected.get()) {
            try {
                val bytesRead = inputStream?.read(buffer) ?: -1
                if (bytesRead > 0) {
                    bytesReceived += bytesRead
                    packetsReceived++
                    lastRecvTime = System.currentTimeMillis()

                    if (packetsReceived <= 3) {
                        Log.hex("[WiFi] RX#$packetsReceived", buffer.copyOf(bytesRead.coerceAtMost(64)))
                    } else if (packetsReceived % 1000 == 0L) {
                        Log.d("[WiFi] RX stats: $bytesReceived bytes, $packetsReceived pkts")
                    }

                    val copy = buffer.copyOf(bytesRead)
                    listener?.onDataReceived(copy, bytesRead)
                } else if (bytesRead < 0) {
                    Log.w("[WiFi] Read returned $bytesRead — connection lost")
                    break
                }
            } catch (e: Exception) {
                if (running.get()) Log.e("[WiFi] Read error", e)
                break
            }
        }
        if (connected.get()) {
            Log.w("[WiFi] Read loop exited while connected — triggering disconnect")
            disconnect()
        }
        Log.i("[WiFi] Read thread ended")
    }

    private suspend fun writeLoop() {
        Log.i("[WiFi] Write thread started")
        while (running.get() && connected.get()) {
            try {
                val data = sendQueue.poll()
                if (data != null) {
                    outputStream?.let { os ->
                        os.write(data, 0, data.size)
                        os.flush()
                        bytesSent += data.size
                        packetsSent++
                        lastSendTime = System.currentTimeMillis()
                    }
                }
                delay(1) // 1ms poll, matches uw5.java
            } catch (e: Exception) {
                if (running.get()) Log.e("[WiFi] Write error", e)
                break
            }
        }
        Log.i("[WiFi] Write thread ended")
    }

    fun destroy() {
        disconnect()
        scope.cancel()
        Log.i("[WiFi] Transport destroyed")
    }
}
