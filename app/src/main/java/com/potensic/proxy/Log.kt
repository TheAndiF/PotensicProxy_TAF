package com.potensic.proxy

import android.util.Log as ALog

object Log {
    private const val TAG = "PotensicProxy"
    private val buffer = mutableListOf<String>()
    private val lock = Any()

    fun d(msg: String) {
        val line = "[${timestamp()}] DEBUG $msg"
        ALog.d(TAG, msg)
        append(line)
    }

    fun i(msg: String) {
        val line = "[${timestamp()}] INFO  $msg"
        ALog.i(TAG, msg)
        append(line)
    }

    fun w(msg: String) {
        val line = "[${timestamp()}] WARN  $msg"
        ALog.w(TAG, msg)
        append(line)
    }

    fun e(msg: String, t: Throwable? = null) {
        val line = "[${timestamp()}] ERROR $msg${t?.let { " | ${it.message}" } ?: ""}"
        ALog.e(TAG, msg, t)
        append(line)
    }

    fun hex(label: String, data: ByteArray, maxLen: Int = 64) {
        val hex = data.take(maxLen).joinToString(" ") { "%02x".format(it) }
        val suffix = if (data.size > maxLen) " ... (${data.size} bytes total)" else ""
        d("$label: $hex$suffix")
    }

    fun getBuffer(): List<String> = synchronized(lock) { buffer.toList() }

    fun getBufferSince(index: Int): List<String> = synchronized(lock) {
        if (index >= buffer.size) emptyList() else buffer.subList(index, buffer.size).toList()
    }

    private fun append(line: String) = synchronized(lock) {
        buffer.add(line)
        if (buffer.size > 5000) buffer.removeAt(0)
    }

    private fun timestamp(): String {
        val sdf = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US)
        return sdf.format(java.util.Date())
    }
}
