package com.potensic.proxy

import com.potensic.proxy.protocol.PotensicProtocol

/**
 * Backend-owned monitor for ATOM / ATOM 2 controller-aircraft MiniPair sessions.
 *
 * The Android service receives the USB transport as arbitrary byte chunks. This
 * monitor performs only the minimal FE stream framing needed for pairing:
 *  - 0x1715 / 5909: FpvRevConnectState, bit 6 (0x40) = MiniPair active
 *  - 0x1718 / 5912: MiniPair result, payload bit 0 (0=success, 1=failure)
 *
 * Keeping this state in the backend makes pairing status and logging independent
 * of whichever WebUI bundle happens to be cached by the browser/WebView.
 */
class PairingMonitor {
    enum class State(val wireName: String) {
        IDLE("idle"),
        WAITING("waiting"),
        PAIRING("pairing"),
        SUCCESS("success"),
        FAILED("failed"),
        TIMEOUT("timeout")
    }

    data class Snapshot(
        val state: State,
        val startedAtMs: Long?,
        val lastUpdatedMs: Long,
        val lastMessage: String,
        val resultRawHex: String?
    )

    private val lock = Any()
    private var streamBuffer = ByteArray(0)
    private var state = State.IDLE
    private var startedAtMs: Long? = null
    private var lastUpdatedMs: Long = System.currentTimeMillis()
    private var lastMessage = "No pairing session started"
    private var resultRawHex: String? = null
    private var lastObservedPairing: Boolean? = null

    fun begin() = synchronized(lock) {
        streamBuffer = ByteArray(0)
        state = State.WAITING
        startedAtMs = System.currentTimeMillis()
        lastUpdatedMs = startedAtMs!!
        lastMessage = "Pairing command sent; waiting for controller pairing mode"
        resultRawHex = null
        lastObservedPairing = null
        Log.i("[Pairing] Session state=WAITING; waiting for 0x1715 bit 6 and 0x1718 result")
    }

    fun reset() = synchronized(lock) {
        state = State.IDLE
        startedAtMs = null
        lastUpdatedMs = System.currentTimeMillis()
        lastMessage = "No pairing session started"
        resultRawHex = null
        lastObservedPairing = null
        streamBuffer = ByteArray(0)
        Log.i("[Pairing] Session state reset to IDLE")
    }

    fun snapshot(): Snapshot = synchronized(lock) {
        checkTimeoutLocked()
        Snapshot(state, startedAtMs, lastUpdatedMs, lastMessage, resultRawHex)
    }

    fun feed(chunk: ByteArray) = synchronized(lock) {
        checkTimeoutLocked()
        if (chunk.isEmpty()) return@synchronized

        streamBuffer = if (streamBuffer.isEmpty()) {
            chunk.copyOf()
        } else {
            ByteArray(streamBuffer.size + chunk.size).also {
                System.arraycopy(streamBuffer, 0, it, 0, streamBuffer.size)
                System.arraycopy(chunk, 0, it, streamBuffer.size, chunk.size)
            }
        }

        var i = 0
        var lastConsumed = 0
        while (i + 16 <= streamBuffer.size) {
            if (!hasFeHeaderAt(streamBuffer, i)) {
                i++
                continue
            }

            val payloadLen = readBeInt(streamBuffer, i + 12)
            if (payloadLen < 0 || payloadLen > MAX_FE_PAYLOAD) {
                i++
                continue
            }

            val totalLen = 16 + payloadLen
            if (i + totalLen > streamBuffer.size) {
                // Keep the incomplete valid frame for the next USB read.
                lastConsumed = i
                break
            }

            val fullPacket = streamBuffer.copyOfRange(i, i + totalLen)
            handleFePacketLocked(fullPacket)
            i += totalLen
            lastConsumed = i
        }

        streamBuffer = when {
            lastConsumed > 0 -> streamBuffer.copyOfRange(lastConsumed, streamBuffer.size)
            streamBuffer.size > MAX_STREAM_BUFFER -> streamBuffer.copyOfRange(streamBuffer.size - 16, streamBuffer.size)
            else -> streamBuffer
        }
    }

    private fun handleFePacketLocked(bytes: ByteArray) {
        if (bytes.size < 22) return
        if ((bytes[16].toInt() and 0xff) != 0xff) return
        val marker = bytes[17].toInt() and 0xff
        if (marker != 0xfd && marker != 0xfe) return

        val cmdShort = (bytes[20].toInt() and 0xff) or ((bytes[21].toInt() and 0xff) shl 8)
        when (cmdShort) {
            FPV_CONNECT_STATE -> handleConnectStateLocked(bytes)
            FPV_PAIR_RESULT, FPV_MINI_PAIR -> handlePairResultLocked(bytes, cmdShort)
        }
    }

    private fun handleConnectStateLocked(bytes: ByteArray) {
        if (bytes.size < 25) return
        val flags = bytes[24].toInt() and 0xff
        val isPairing = (flags and 0x40) != 0
        val previous = lastObservedPairing
        lastObservedPairing = isPairing

        if (isPairing && state == State.WAITING) {
            state = State.PAIRING
            lastUpdatedMs = System.currentTimeMillis()
            lastMessage = "Controller is in pairing mode; put the aircraft into frequency-pairing mode"
            resultRawHex = PotensicProtocol.bytesToHex(bytes)
            Log.i("[Pairing] Controller confirmed pairing mode via 0x1715 bit 6 (0x40); frame=$resultRawHex")
        } else if (!isPairing && state == State.PAIRING && previous == true) {
            lastUpdatedMs = System.currentTimeMillis()
            lastMessage = "Controller left pairing mode; waiting for final pairing result"
            resultRawHex = PotensicProtocol.bytesToHex(bytes)
            Log.i("[Pairing] Controller left pairing mode; waiting for 0x1718 result")
        }
    }

    private fun handlePairResultLocked(bytes: ByteArray, cmdShort: Int) {
        if (bytes.size < 23) return
        val resultByte = bytes[22].toInt() and 0xff
        val success = (resultByte and 0x01) == 0
        state = if (success) State.SUCCESS else State.FAILED
        lastUpdatedMs = System.currentTimeMillis()
        lastMessage = if (success) "Pairing successful" else "Pairing failed"
        resultRawHex = PotensicProtocol.bytesToHex(bytes)
        val cmdName = if (cmdShort == FPV_PAIR_RESULT) "0x1718" else "0x0018"
        if (success) {
            Log.i("[Pairing] SUCCESS via $cmdName; resultByte=0x${resultByte.toString(16).padStart(2, '0')}; frame=$resultRawHex")
        } else {
            Log.e("[Pairing] FAILED via $cmdName; resultByte=0x${resultByte.toString(16).padStart(2, '0')}; frame=$resultRawHex")
        }
    }

    private fun checkTimeoutLocked() {
        val started = startedAtMs ?: return
        if ((state == State.WAITING || state == State.PAIRING) && System.currentTimeMillis() - started >= PAIRING_TIMEOUT_MS) {
            state = State.TIMEOUT
            lastUpdatedMs = System.currentTimeMillis()
            lastMessage = "Pairing timeout: no successful result received within 60 seconds"
            Log.e("[Pairing] TIMEOUT after 60 s; no successful 0x1718 result received")
        }
    }

    private fun hasFeHeaderAt(bytes: ByteArray, offset: Int): Boolean {
        if (offset + 6 > bytes.size) return false
        return (bytes[offset].toInt() and 0xff) == 0xfe &&
            bytes[offset + 1].toInt() == 0 &&
            bytes[offset + 2].toInt() == 0 &&
            bytes[offset + 3].toInt() == 0 &&
            bytes[offset + 4].toInt() == 0 &&
            bytes[offset + 5].toInt() == 0
    }

    private fun readBeInt(bytes: ByteArray, offset: Int): Int {
        return ((bytes[offset].toInt() and 0xff) shl 24) or
            ((bytes[offset + 1].toInt() and 0xff) shl 16) or
            ((bytes[offset + 2].toInt() and 0xff) shl 8) or
            (bytes[offset + 3].toInt() and 0xff)
    }

    companion object {
        private const val FPV_CONNECT_STATE = 0x1715
        private const val FPV_PAIR_RESULT = 0x1718
        private const val FPV_MINI_PAIR = 0x0018
        private const val PAIRING_TIMEOUT_MS = 60_000L
        private const val MAX_FE_PAYLOAD = 1_000_000
        private const val MAX_STREAM_BUFFER = 500_000
    }
}
