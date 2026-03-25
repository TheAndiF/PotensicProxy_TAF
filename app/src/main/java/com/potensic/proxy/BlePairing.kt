package com.potensic.proxy

import android.annotation.SuppressLint
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.os.ParcelUuid
import kotlinx.coroutines.*
import java.util.UUID

/**
 * BLE pairing with Potensic Atom 2 drone.
 * Reversed from com/atom/common/ble/a.java + b.java + jv6.java.
 *
 * Flow:
 * 1. Scan for BLE device with name "Atom*"
 * 2. Connect GATT, discover service 0000fff0-...
 * 3. Write phone ID to characteristic fff2
 * 4. Read WiFi credentials (SSID + password) from fff1 notifications
 * 5. Return credentials so the app can connect to drone WiFi
 */
@SuppressLint("MissingPermission")
class BlePairing(private val context: Context) {

    companion object {
        val SERVICE_UUID: UUID = UUID.fromString("0000fff0-0000-1000-8000-00805f9b34fb")
        val CHAR_READ_UUID: UUID = UUID.fromString("0000fff1-0000-1000-8000-00805f9b34fb")
        val CHAR_WRITE_UUID: UUID = UUID.fromString("0000fff2-0000-1000-8000-00805f9b34fb")
        val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        const val SCAN_TIMEOUT = 15000L
        const val GATT_TIMEOUT = 10000L
    }

    data class WifiCredentials(
        val ssid: String,
        val password: String,
        val battery: Int,
        val wifiMode: Int, // 0=2.4GHz, 1=5.8GHz, 2=5.1GHz
        val isOpen: Boolean, // no password
    )

    interface Callback {
        fun onStatus(status: String)
        fun onCredentials(creds: WifiCredentials)
        fun onError(error: String)
    }

    private var scanner: BluetoothLeScanner? = null
    private var gatt: BluetoothGatt? = null
    private var callback: Callback? = null
    private var charWrite: BluetoothGattCharacteristic? = null
    private var charRead: BluetoothGattCharacteristic? = null

    // 16-byte phone ID (random, persistent would use SharedPrefs)
    private val phoneId: ByteArray = ByteArray(16).also { java.security.SecureRandom().nextBytes(it) }

    /**
     * Start BLE scan + pairing. Results delivered via callback.
     */
    fun start(cb: Callback) {
        callback = cb
        val adapter = BluetoothAdapter.getDefaultAdapter()
        if (adapter == null || !adapter.isEnabled) {
            cb.onError("Bluetooth not available or disabled")
            return
        }
        scanner = adapter.bluetoothLeScanner
        if (scanner == null) {
            cb.onError("BLE scanner not available")
            return
        }

        cb.onStatus("Scanning for Atom drone...")
        Log.i("[BLE] Starting scan for Atom* devices")

        try {
            val settings = ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
                .build()

            // Must start scan on main thread for callbacks to work
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                try {
                    scanner?.startScan(null, settings, scanCallback)
                    Log.i("[BLE] Scan started on main thread")
                } catch (e: Exception) {
                    Log.e("[BLE] startScan failed", e)
                    cb.onError("BLE scan failed: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e("[BLE] Scan setup failed", e)
            cb.onError("BLE scan setup failed: ${e.message}")
        }

        // Stop scan after timeout
        CoroutineScope(Dispatchers.Main).launch {
            delay(SCAN_TIMEOUT)
            stopScan()
        }
    }

    fun stop() {
        stopScan()
        gatt?.close()
        gatt = null
    }

    private fun stopScan() {
        try { scanner?.stopScan(scanCallback) } catch (_: Exception) {}
    }

    private val seenDevices = mutableSetOf<String>()

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val name = result.device?.name
            val addr = result.device?.address ?: return

            // Log ALL devices (first time only)
            if (seenDevices.add(addr)) {
                Log.i("[BLE] Device: name=${name ?: "null"} addr=$addr rssi=${result.rssi}")
            }

            if (name == null) return
            if (!name.startsWith("Atom", ignoreCase = true) && !name.contains("Potensic", ignoreCase = true)) return

            Log.i("[BLE] Found drone: $name ($addr)")
            callback?.onStatus("Found: $name — connecting...")
            stopScan()
            connectGatt(result.device)
        }

        override fun onScanFailed(errorCode: Int) {
            Log.e("[BLE] Scan failed: $errorCode")
            callback?.onError("BLE scan failed (code $errorCode)")
        }
    }

    private fun connectGatt(device: BluetoothDevice) {
        Log.i("[BLE] Connecting GATT to ${device.address}")
        gatt = device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
    }

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                Log.i("[BLE] GATT connected, discovering services...")
                callback?.onStatus("Connected — discovering services...")
                g.discoverServices()
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                Log.w("[BLE] GATT disconnected (status=$status)")
                callback?.onError("BLE disconnected")
            }
        }

        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) {
                callback?.onError("Service discovery failed ($status)")
                return
            }
            val service = g.getService(SERVICE_UUID)
            if (service == null) {
                callback?.onError("Service fff0 not found on drone")
                return
            }

            charRead = service.getCharacteristic(CHAR_READ_UUID)
            charWrite = service.getCharacteristic(CHAR_WRITE_UUID)

            if (charRead == null || charWrite == null) {
                callback?.onError("Characteristics fff1/fff2 not found")
                return
            }

            Log.i("[BLE] Services discovered. Enabling notifications on fff1...")
            callback?.onStatus("Services found — requesting WiFi credentials...")

            // Enable notifications on fff1
            g.setCharacteristicNotification(charRead!!, true)
            val desc = charRead!!.getDescriptor(CCCD_UUID)
            if (desc != null) {
                desc.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                g.writeDescriptor(desc)
            } else {
                // No CCCD, send phone ID directly
                sendPhoneId(g)
            }
        }

        override fun onDescriptorWrite(g: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
            Log.i("[BLE] Descriptor write status=$status")
            // Notifications enabled, now send phone ID
            sendPhoneId(g)
        }

        override fun onCharacteristicChanged(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            if (characteristic.uuid == CHAR_READ_UUID) {
                val data = characteristic.value ?: return
                Log.hex("[BLE] Notification", data)
                parseHeartbeat(data)
            }
        }

        @Suppress("DEPRECATION")
        override fun onCharacteristicChanged(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
            if (characteristic.uuid == CHAR_READ_UUID) {
                Log.hex("[BLE] Notification", value)
                parseHeartbeat(value)
            }
        }
    }

    /**
     * Send 17-byte phone identification message via fff2.
     * Format: FF FD [len=19] [cmd=0] [1=enter WiFi] [16 bytes phoneId] [XOR checksum]
     */
    private fun sendPhoneId(g: BluetoothGatt) {
        val payload = ByteArray(17)
        payload[0] = 1 // 1 = enter WiFi Direct mode
        System.arraycopy(phoneId, 0, payload, 1, 16)

        // Build FF FD frame
        val frame = buildBleFrame(0, payload)
        Log.hex("[BLE] Sending phone ID", frame)

        charWrite?.let { c ->
            c.value = frame
            c.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            g.writeCharacteristic(c)
        }
        callback?.onStatus("Phone ID sent — waiting for WiFi credentials...")

        // After 3s, also send WifiDirectSwitch command (funcId=0xD2)
        // to explicitly activate the WiFi hotspot
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            sendWifiActivate(g)
        }, 3000)
    }

    /**
     * Build FF FD frame for BLE.
     * Same format as USB inner commands.
     */
    private fun buildBleFrame(cmdId: Int, data: ByteArray): ByteArray {
        val totalLen = 6 + data.size + 1 // FF FD len(2) cmd(2) data checksum
        val frame = ByteArray(totalLen)
        frame[0] = 0xFF.toByte()
        frame[1] = 0xFD.toByte()
        val innerLen = 2 + data.size + 1 // cmd(2) + data + checksum
        frame[2] = (innerLen and 0xFF).toByte()
        frame[3] = ((innerLen shr 8) and 0xFF).toByte()
        frame[4] = (cmdId and 0xFF).toByte()
        frame[5] = ((cmdId shr 8) and 0xFF).toByte()
        System.arraycopy(data, 0, frame, 6, data.size)
        // XOR checksum over [2..last-1]
        var xor = 0
        for (i in 2 until frame.size - 1) xor = xor xor (frame[i].toInt() and 0xFF)
        frame[frame.size - 1] = xor.toByte()
        return frame
    }

    /**
     * Send WifiDirectSwitch(isEnter=true) command via BLE.
     * funcId = 0xD2 (-46), payload = [0x01] + [16 bytes phoneId]
     * Reversed from ol3.u0() + iv6.java serializer.
     */
    private fun sendWifiActivate(g: BluetoothGatt) {
        val payload = ByteArray(17)
        payload[0] = 0x01 // isEnter = true
        System.arraycopy(phoneId, 0, payload, 1, 16)

        // funcId = 0xD2 = 210 unsigned (or -46 signed)
        val frame = buildBleFrame(0xD2, payload)
        Log.hex("[BLE] Sending WifiDirectSwitch ENTER", frame)

        charWrite?.let { c ->
            c.value = frame
            c.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            g.writeCharacteristic(c)
        }
        callback?.onStatus("WiFi activate command sent")
        Log.i("[BLE] WifiDirectSwitch(enter=true) sent via BLE")

        // Also try funcId=0x00 with mode=2 (5GHz) in case 2.4GHz doesn't work
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            val payload5g = ByteArray(17)
            payload5g[0] = 0x02 // mode 2 = 5GHz
            System.arraycopy(phoneId, 0, payload5g, 1, 16)
            val frame5g = buildBleFrame(0, payload5g)
            Log.hex("[BLE] Sending phone ID with 5GHz mode", frame5g)
            charWrite?.let { c ->
                c.value = frame5g
                c.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                g.writeCharacteristic(c)
            }
            Log.i("[BLE] 5GHz phone ID sent")
        }, 2000)
    }

    /**
     * BLE notifications are fragmented (20-byte MTU limit).
     * Reassemble fragments into complete FF FE/FD frames before parsing.
     */
    private var reassemblyBuffer = java.io.ByteArrayOutputStream()

    private fun parseHeartbeat(data: ByteArray) {
        if (data.isEmpty()) return

        val b0 = data[0].toInt() and 0xFF
        val b1 = if (data.size > 1) data[1].toInt() and 0xFF else 0

        // New frame starts with FF FE or FF FD
        if (b0 == 0xFF && (b1 == 0xFE || b1 == 0xFD)) {
            // Flush previous buffer if any
            if (reassemblyBuffer.size() > 0) {
                processCompleteFrame(reassemblyBuffer.toByteArray())
                reassemblyBuffer.reset()
            }
            reassemblyBuffer.write(data)
        } else {
            // Continuation fragment
            reassemblyBuffer.write(data)
        }

        // Check if we have a complete frame
        val buf = reassemblyBuffer.toByteArray()
        if (buf.size >= 4) {
            val expectedLen = (buf[2].toInt() and 0xFF) or ((buf[3].toInt() and 0xFF) shl 8)
            val totalExpected = 4 + expectedLen + 1 // header(4) + content(expectedLen) + checksum(1)... approximate
            // Try to parse when we have enough data
            if (buf.size >= 6 + expectedLen) {
                processCompleteFrame(buf)
                reassemblyBuffer.reset()
            }
        }
    }

    private fun processCompleteFrame(data: ByteArray) {
        if (data.size < 6) return

        val hex = data.joinToString(" ") { "%02x".format(it.toInt() and 0xFF) }
        Log.i("[BLE] Complete frame (${data.size}B): $hex")

        val funcId = ((data[4].toInt() and 0xFF) or ((data[5].toInt() and 0xFF) shl 8))
        Log.i("[BLE] funcId=$funcId dataSize=${data.size}")

        if (funcId == 0) {
            val responseCode = if (data.size > 6) data[6].toInt() and 0xFF else -1
            Log.i("[BLE] funcId=0 response: code=$responseCode (1=accepted, 2=rejected) size=${data.size}")
            if (responseCode == 1) {
                callback?.onStatus("Drone accepted! Waiting for WiFi hotspot...")
            } else if (responseCode == 2) {
                callback?.onError("Drone rejected phone ID (code=2)")
            }
        }

        if (funcId == 0 && data.size >= 24) {
            // WiFi credentials heartbeat
            val battery = if (data.size > 6) data[6].toInt() and 0xFF else 0
            val wifiFlags = if (data.size > 7) data[7].toInt() and 0xFF else 0
            val modeAndPw = if (data.size > 8) data[8].toInt() and 0xFF else 0
            val wifiMode = modeAndPw and 0x07
            val isOpen = (modeAndPw shr 4) and 1 == 1

            // SSID: bytes 9-23 (15 bytes)
            val ssidEnd = minOf(24, data.size)
            val ssidBytes = if (data.size > 9) data.copyOfRange(9, ssidEnd) else ByteArray(0)
            val ssid = String(ssidBytes, Charsets.US_ASCII).trim('\u0000', ' ')

            // Password: bytes 25-35 (11 bytes)
            val pwEnd = minOf(36, data.size)
            val pwBytes = if (data.size > 25) data.copyOfRange(25, pwEnd) else ByteArray(0)
            val password = String(pwBytes, Charsets.US_ASCII).trim('\u0000', ' ')

            Log.i("[BLE] WiFi: SSID='$ssid' pw='$password' bat=$battery% mode=$wifiMode open=$isOpen flags=0x${"%02x".format(wifiFlags)}")

            if (ssid.isNotEmpty()) {
                callback?.onCredentials(WifiCredentials(ssid, password, battery, wifiMode, isOpen))
            } else {
                Log.w("[BLE] Empty SSID in funcId=0 frame")
            }
        } else if (funcId == 1) {
            // Heartbeat with battery/status
            val battery = if (data.size > 6) data[6].toInt() and 0xFF else 0
            Log.i("[BLE] Heartbeat: bat=$battery%")
        } else if (funcId == 3) {
            Log.i("[BLE] WiFi Direct exit notification")
        } else {
            Log.d("[BLE] Unknown funcId=$funcId")
        }
    }
}
