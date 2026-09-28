package com.potensic.proxy

import org.json.JSONObject
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.PrintWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** Captures the real USB/FE video transport for offline protocol analysis. */
class TransportCaptureManager(private val rootDir: File) {
    private val executor = Executors.newSingleThreadExecutor()
    private val active = AtomicBoolean(false)
    private val rawBytes = AtomicLong(0)
    private val feFrames = AtomicLong(0)
    private val fe06Bytes = AtomicLong(0)
    @Volatile private var startedAt = 0L
    @Volatile private var captureDir: File? = null
    @Volatile private var usbOut: BufferedOutputStream? = null
    @Volatile private var feOut: BufferedOutputStream? = null
    @Volatile private var fe06Out: BufferedOutputStream? = null
    @Volatile private var events: PrintWriter? = null

    data class Status(val active:Boolean,val startedAt:Long,val directory:String?,val rawBytes:Long,val feFrames:Long,val fe06Bytes:Long)

    @Synchronized fun start(): Status {
        if (active.get()) return status()
        val base = File(rootDir, "captures").apply { mkdirs() }
        val stamp = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.US).format(Date())
        val dir = File(base, "video_transport_$stamp").apply { mkdirs() }
        captureDir = dir
        usbOut = BufferedOutputStream(FileOutputStream(File(dir, "capture_usb_raw.bin")), 256 * 1024)
        feOut = BufferedOutputStream(FileOutputStream(File(dir, "capture_fe_frames.bin")), 256 * 1024)
        fe06Out = BufferedOutputStream(FileOutputStream(File(dir, "capture_fe06_payload.bin")), 256 * 1024)
        events = PrintWriter(File(dir, "capture_events.csv")).also { it.println("timestamp_ms,direction,kind,detail,length") }
        rawBytes.set(0); feFrames.set(0); fe06Bytes.set(0)
        startedAt = System.currentTimeMillis(); active.set(true)
        event("SYS","capture","start",0)
        Log.i("[Capture] Video transport capture started: ${dir.absolutePath}")
        return status()
    }

    @Synchronized fun stop(): Status {
        if (!active.get()) return status()
        active.set(false)
        event("SYS","capture","stop",0)
        executor.submit {
            try { usbOut?.flush(); feOut?.flush(); fe06Out?.flush(); events?.flush() } catch (_:Exception) {}
            try { usbOut?.close(); feOut?.close(); fe06Out?.close(); events?.close() } catch (_:Exception) {}
            writeMetadata()
        }.get()
        usbOut=null; feOut=null; fe06Out=null; events=null
        Log.i("[Capture] Video transport capture stopped")
        return status()
    }

    fun status() = Status(active.get(), startedAt, captureDir?.name, rawBytes.get(), feFrames.get(), fe06Bytes.get())

    fun recordUsbRx(data: ByteArray) {
        if (!active.get()) return
        val copy = data.copyOf()
        executor.execute {
            if (!active.get() && usbOut == null) return@execute
            try { usbOut?.write(copy); rawBytes.addAndGet(copy.size.toLong()) } catch (e:Exception) { Log.e("[Capture] USB raw write failed", e) }
        }
    }

    fun recordFePacket(feType:Int, packet:ByteArray, payload:ByteArray) {
        if (!active.get()) return
        val p = packet.copyOf(); val pay = payload.copyOf(); val ts = System.currentTimeMillis()
        executor.execute {
            try {
                val out = feOut ?: return@execute
                writeLongBE(out, ts); out.write(feType and 0xff); writeIntBE(out, p.size); out.write(p)
                feFrames.incrementAndGet()
                if (feType == 0x06) { fe06Out?.write(pay); fe06Bytes.addAndGet(pay.size.toLong()) }
            } catch (e:Exception) { Log.e("[Capture] FE write failed", e) }
        }
    }

    fun event(direction:String, kind:String, detail:String, length:Int) {
        if (!active.get() && kind != "capture") return
        val safe = detail.replace('"','\'').replace(',',';')
        executor.execute { events?.println("${System.currentTimeMillis()},$direction,$kind,$safe,$length") }
    }

    fun latestZip(): File? {
        val dir = captureDir ?: return null
        if (active.get()) stop()
        val zip = File(dir.parentFile, "${dir.name}.zip")
        ZipOutputStream(BufferedOutputStream(FileOutputStream(zip))).use { zos ->
            dir.listFiles()?.sortedBy { it.name }?.forEach { f ->
                zos.putNextEntry(ZipEntry(f.name)); f.inputStream().use { it.copyTo(zos) }; zos.closeEntry()
            }
        }
        return zip
    }

    private fun writeMetadata() {
        val dir = captureDir ?: return
        val s = status()
        File(dir,"capture_metadata.json").writeText(JSONObject().apply {
            put("startedAtMs", s.startedAt); put("stoppedAtMs", System.currentTimeMillis()); put("usbRawBytes", s.rawBytes)
            put("feFrames", s.feFrames); put("fe06PayloadBytes", s.fe06Bytes); put("format", "usb raw + length framed FE + concatenated FE06 payload")
        }.toString(2))
    }
    private fun writeIntBE(out:BufferedOutputStream,v:Int){ out.write((v ushr 24) and 255);out.write((v ushr 16) and 255);out.write((v ushr 8) and 255);out.write(v and 255) }
    private fun writeLongBE(out:BufferedOutputStream,v:Long){ for(i in 7 downTo 0) out.write(((v ushr (i*8)) and 255).toInt()) }
}
