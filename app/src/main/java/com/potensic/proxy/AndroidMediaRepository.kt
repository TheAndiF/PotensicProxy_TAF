package com.potensic.proxy

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.zip.GZIPOutputStream
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.roundToLong

/**
 * Android-owned image storage for the two intentionally separate media paths:
 *
 *  - camera      -> Pictures/PotensicProxy/Camera
 *  - recognition -> Pictures/PotensicProxy/Recognition
 *
 * Every image receives an app-owned index record. Recognition captures may attach
 * a rich JSON metadata snapshot (telemetry, gimbal, controls, camera state, etc.).
 * The repository verifies the MediaStore copy by reading it back and comparing its
 * byte count and SHA-256 digest before reporting verified=true.
 */
class AndroidMediaRepository(
    private val context: Context,
    filesDir: File,
) {
    companion object {
        private const val CAMERA_DIR = "Pictures/PotensicProxy/Camera"
        private const val RECOGNITION_DIR = "Pictures/PotensicProxy/Recognition"
        private const val CAMERA_VIDEO_DIR = "Movies/PotensicProxy/Camera"
        private const val MAX_INDEX_ITEMS = 1000
        private val PSTART_PROTOCOL_SIGNATURE = "POTENSIC_PSTART_PROTOCOL\u0000".toByteArray(Charsets.UTF_8)
    }

    private val indexDir = File(filesDir, "media").apply { mkdirs() }
    private val indexFile = File(indexDir, "android_images.jsonl")

    @Synchronized
    fun saveImage(
        bytes: ByteArray,
        requestedName: String?,
        source: String,
        library: String = "camera",
        metadata: JSONObject? = null,
        sessionId: String? = null,
    ): JSONObject {
        require(bytes.isNotEmpty()) { "Image payload is empty" }
        ensureLegacyWritePermission()

        val normalizedLibrary = normalizeLibrary(library)
        val relativeDir = if (
            normalizedLibrary == "recognition" &&
            source.startsWith("pstart", ignoreCase = true) &&
            !sessionId.isNullOrBlank()
        ) pstartRelativeDir(sessionId) else relativeDir(normalizedLibrary)
        val (displayName, mimeType) = normalizedNameAndMime(requestedName, normalizedLibrary)
        val captureTime = metadata
            ?.optJSONObject("capture")
            ?.optLong("timestampUnixMs", 0L)
            ?.takeIf { it > 0L }
            ?: System.currentTimeMillis()

        val finalizedBytes = finalizeImageBytes(bytes, mimeType, metadata, captureTime)

        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, displayName)
            put(MediaStore.Images.Media.MIME_TYPE, mimeType)
            put(MediaStore.Images.Media.DATE_ADDED, System.currentTimeMillis() / 1000L)
            put(MediaStore.Images.Media.DATE_TAKEN, captureTime)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Images.Media.RELATIVE_PATH, relativeDir)
                put(MediaStore.Images.Media.IS_PENDING, 1)
            } else {
                @Suppress("DEPRECATION")
                val publicDir = File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
                    relativeDir.removePrefix("Pictures/"),
                ).apply { mkdirs() }
                @Suppress("DEPRECATION")
                put(MediaStore.Images.Media.DATA, File(publicDir, displayName).absolutePath)
            }
        }

        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
            ?: throw IllegalStateException("Android MediaStore rejected image insert")

        try {
            resolver.openOutputStream(uri, "w")?.use { it.write(finalizedBytes) }
                ?: throw IllegalStateException("Could not open Android MediaStore output stream")

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val ready = ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }
                resolver.update(uri, ready, null, null)
            }
        } catch (e: Exception) {
            try { resolver.delete(uri, null, null) } catch (_: Exception) {}
            throw e
        }

        // Verification is deliberately performed before callers are allowed to delete
        // a Drone Reco source file from the drone SD card.
        val sourceHash = sha256(finalizedBytes)
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        try { BitmapFactory.decodeByteArray(finalizedBytes, 0, finalizedBytes.size, bounds) } catch (_: Exception) {}
        val storedBytes = try {
            resolver.openInputStream(uri)?.use { it.readBytes() }
        } catch (_: Exception) {
            null
        }
        val storedHash = storedBytes?.let(::sha256)
        val verified = storedBytes != null && storedBytes.size == finalizedBytes.size && storedHash == sourceHash

        val item = JSONObject().apply {
            put("id", UUID.randomUUID().toString())
            put("name", displayName)
            put("mimeType", mimeType)
            put("size", finalizedBytes.size)
            put("source", source)
            put("library", normalizedLibrary)
            put("createdAt", System.currentTimeMillis())
            put("captureTime", captureTime)
            put("uri", uri.toString())
            put("relativePath", relativeDir)
            put("sha256", sourceHash)
            put("verified", verified)
            put("image", JSONObject().apply {
                put("width", if (bounds.outWidth > 0) bounds.outWidth else JSONObject.NULL)
                put("height", if (bounds.outHeight > 0) bounds.outHeight else JSONObject.NULL)
                put("format", mimeType)
                put("byteSize", finalizedBytes.size)
                put("sha256", sourceHash)
            })
            if (metadata != null) put("metadata", metadata)
        }
        appendToIndex(item)
        Log.i("[MediaStore] Saved ${finalizedBytes.size} bytes as $displayName [$normalizedLibrary/$source] verified=$verified metadataEmbedded=${metadata != null && mimeType == "image/jpeg"} -> $uri")
        return item
    }

    @Synchronized
    fun saveVideo(
        bytes: ByteArray,
        requestedName: String?,
        source: String = "camera-download",
    ): JSONObject {
        require(bytes.isNotEmpty()) { "Video payload is empty" }
        ensureLegacyWritePermission()

        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss_SSS", Locale.US).format(Date())
        val raw = requestedName
            ?.substringAfterLast('/')
            ?.substringAfterLast('\\')
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: "Camera_$timestamp.mp4"
        val safeBase = raw.replace(Regex("[^A-Za-z0-9._-]"), "_")
        val displayName = if (safeBase.endsWith(".mp4", ignoreCase = true)) safeBase else "$safeBase.mp4"
        val mimeType = "video/mp4"
        val values = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, displayName)
            put(MediaStore.Video.Media.MIME_TYPE, mimeType)
            put(MediaStore.Video.Media.DATE_ADDED, System.currentTimeMillis() / 1000L)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Video.Media.RELATIVE_PATH, CAMERA_VIDEO_DIR)
                put(MediaStore.Video.Media.IS_PENDING, 1)
            } else {
                @Suppress("DEPRECATION")
                val publicDir = File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES),
                    CAMERA_VIDEO_DIR.removePrefix("Movies/"),
                ).apply { mkdirs() }
                @Suppress("DEPRECATION")
                put(MediaStore.Video.Media.DATA, File(publicDir, displayName).absolutePath)
            }
        }

        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
            ?: throw IllegalStateException("Android MediaStore rejected video insert")
        try {
            resolver.openOutputStream(uri, "w")?.use { it.write(bytes) }
                ?: throw IllegalStateException("Could not open Android MediaStore video output stream")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val ready = ContentValues().apply { put(MediaStore.Video.Media.IS_PENDING, 0) }
                resolver.update(uri, ready, null, null)
            }
        } catch (e: Exception) {
            try { resolver.delete(uri, null, null) } catch (_: Exception) {}
            throw e
        }

        val sourceHash = sha256(bytes)
        val storedBytes = try { resolver.openInputStream(uri)?.use { it.readBytes() } } catch (_: Exception) { null }
        val verified = storedBytes != null && storedBytes.size == bytes.size && sha256(storedBytes) == sourceHash
        val item = JSONObject().apply {
            put("id", UUID.randomUUID().toString())
            put("name", displayName)
            put("mimeType", mimeType)
            put("size", bytes.size)
            put("source", source)
            put("library", "camera")
            put("createdAt", System.currentTimeMillis())
            put("uri", uri.toString())
            put("relativePath", CAMERA_VIDEO_DIR)
            put("sha256", sourceHash)
            put("verified", verified)
        }
        appendToIndex(item)
        Log.i("[MediaStore] Saved video ${bytes.size} bytes as $displayName verified=$verified -> $uri")
        return item
    }



    /**
     * Publishes the finalized PStart JSONL protocol into the same public session
     * directory as the PStart images. The protocol is verified after MediaStore
     * write using byte count and SHA-256, just like image storage.
     */
    @Synchronized
    fun savePStartSessionProtocol(
        sessionId: String,
        protocol: String,
        requestedName: String? = null,
    ): JSONObject {
        require(sessionId.isNotBlank()) { "PStart session id is required" }
        require(protocol.isNotEmpty()) { "PStart protocol is empty" }
        ensureLegacyWritePermission()

        val relativeDir = pstartRelativeDir(sessionId)
        val rawName = requestedName
            ?.substringAfterLast('/')
            ?.substringAfterLast('\\')
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: "PStart_${sanitizeSessionId(sessionId)}_session.jsonl"
        val safeBase = rawName.replace(Regex("[^A-Za-z0-9._-]"), "_")
        val displayName = if (safeBase.endsWith(".jsonl", ignoreCase = true)) safeBase else "$safeBase.jsonl"
        val bytes = protocol.toByteArray(Charsets.UTF_8)
        val mimeType = "application/x-ndjson"

        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
            put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
            put(MediaStore.MediaColumns.DATE_ADDED, System.currentTimeMillis() / 1000L)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.MediaColumns.RELATIVE_PATH, relativeDir)
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            } else {
                @Suppress("DEPRECATION")
                val publicDir = File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
                    relativeDir.removePrefix("Pictures/"),
                ).apply { mkdirs() }
                @Suppress("DEPRECATION")
                put(MediaStore.MediaColumns.DATA, File(publicDir, displayName).absolutePath)
            }
        }

        val resolver = context.contentResolver
        val collection = MediaStore.Files.getContentUri("external")
        val uri = resolver.insert(collection, values)
            ?: throw IllegalStateException("Android MediaStore rejected PStart protocol insert")
        try {
            resolver.openOutputStream(uri, "w")?.use { it.write(bytes) }
                ?: throw IllegalStateException("Could not open Android MediaStore protocol output stream")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val ready = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
                resolver.update(uri, ready, null, null)
            }
        } catch (e: Exception) {
            try { resolver.delete(uri, null, null) } catch (_: Exception) {}
            throw e
        }

        val sourceHash = sha256(bytes)
        val storedBytes = try { resolver.openInputStream(uri)?.use { it.readBytes() } } catch (_: Exception) { null }
        val verified = storedBytes != null && storedBytes.size == bytes.size && sha256(storedBytes) == sourceHash
        return JSONObject().apply {
            put("name", displayName)
            put("mimeType", mimeType)
            put("size", bytes.size)
            put("createdAt", System.currentTimeMillis())
            put("uri", uri.toString())
            put("relativePath", relativeDir)
            put("sha256", sourceHash)
            put("verified", verified)
        }
    }

    /**
     * Adds the complete finalized PStart protocol to the first STEP0 JPEG. The
     * protocol is gzip-compressed and split over custom APP15 chunks so it is not
     * limited by the single 64 KiB XMP APP1 segment size. JPEG decoders ignore
     * these application segments and continue to display the image normally.
     */
    @Synchronized
    fun embedPStartProtocolInImage(
        imageId: String,
        protocol: String,
        protocolInfo: JSONObject,
    ): JSONObject? {
        if (imageId.isBlank() || protocol.isEmpty()) return null
        val all = readIndex().toMutableList()
        val index = all.indexOfLast { it.optString("id") == imageId }
        if (index < 0) return null
        val existing = all[index]
        if (!existing.optString("mimeType", "image/jpeg").equals("image/jpeg", ignoreCase = true)) return null
        val uriText = existing.optString("uri")
        if (uriText.isBlank()) return null

        val resolver = context.contentResolver
        val uri = Uri.parse(uriText)
        val original = resolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
        val clean = stripPStartProtocolApp15(original)
        val protocolBytes = protocol.toByteArray(Charsets.UTF_8)
        val descriptor = JSONObject(protocolInfo.toString()).apply {
            put("containerSchema", "PotensicProxy/PStartProtocol-APP15")
            put("containerVersion", 1)
            put("format", "JSONL")
            put("mimeType", "application/x-ndjson")
            put("compression", "gzip")
            put("rawBytes", protocolBytes.size)
            put("rawSha256", sha256(protocolBytes))
        }
        val embedded = injectPStartProtocolApp15(clean, protocolBytes, descriptor)
        val finalBytes = embedded.first
        val chunkCount = embedded.second

        resolver.openOutputStream(uri, "w")?.use { it.write(finalBytes) }
            ?: throw IllegalStateException("Could not rewrite PStart master image")
        val storedBytes = try { resolver.openInputStream(uri)?.use { it.readBytes() } } catch (_: Exception) { null }
        val finalHash = sha256(finalBytes)
        val verified = storedBytes != null && storedBytes.size == finalBytes.size && sha256(storedBytes) == finalHash

        val updated = JSONObject(existing.toString()).apply {
            put("size", finalBytes.size)
            put("sha256", finalHash)
            put("verified", verified)
            put("protocolEmbedded", true)
            put("protocolChunks", chunkCount)
            put("protocol", descriptor)
            optJSONObject("image")?.apply {
                put("byteSize", finalBytes.size)
                put("sha256", finalHash)
            }
        }
        all[index] = updated
        writeIndex(all)
        Log.i("[PStart] Embedded protocol ${protocolBytes.size} bytes into ${updated.optString("name")} as $chunkCount APP15 chunks; verified=$verified")
        return updated
    }

    @Synchronized
    fun listImages(library: String? = null): JSONArray {
        val normalized = library?.takeIf { it.isNotBlank() }?.let(::normalizeLibrary)
        val result = JSONArray()
        readIndex()
            .asReversed()
            .asSequence()
            .map(::withInferredLibrary)
            .filter { normalized == null || it.optString("library") == normalized }
            .take(MAX_INDEX_ITEMS)
            .forEach { result.put(it) }
        return result
    }

    @Synchronized
    fun readImage(id: String): Pair<ByteArray, String>? {
        val item = readIndex().lastOrNull { it.optString("id") == id } ?: return null
        val uriText = item.optString("uri")
        if (uriText.isBlank()) return null
        val bytes = context.contentResolver.openInputStream(Uri.parse(uriText))?.use { it.readBytes() } ?: return null
        return bytes to item.optString("mimeType", "image/jpeg")
    }

    private fun withInferredLibrary(item: JSONObject): JSONObject {
        if (!item.has("library")) {
            val source = item.optString("source")
            val inferred = if (source.contains("liveview", ignoreCase = true) || source.contains("reco", ignoreCase = true)) {
                "recognition"
            } else {
                "camera"
            }
            item.put("library", inferred)
            if (!item.has("relativePath")) item.put("relativePath", relativeDir(inferred))
        }
        return item
    }

    private fun normalizeLibrary(library: String): String = when (library.lowercase(Locale.US)) {
        "recognition", "reco" -> "recognition"
        else -> "camera"
    }

    private fun relativeDir(library: String): String = if (library == "recognition") RECOGNITION_DIR else CAMERA_DIR

    private fun sanitizeSessionId(sessionId: String): String = sessionId
        .trim()
        .replace(Regex("[^A-Za-z0-9._-]"), "_")
        .take(80)
        .ifBlank { "unknown" }

    private fun pstartRelativeDir(sessionId: String): String =
        "$RECOGNITION_DIR/PStart_${sanitizeSessionId(sessionId)}"

    private fun normalizedNameAndMime(requestedName: String?, library: String): Pair<String, String> {
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss_SSS", Locale.US).format(Date())
        val prefix = if (library == "recognition") "Reco" else "Camera"
        val raw = requestedName
            ?.substringAfterLast('/')
            ?.substringAfterLast('\\')
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: "${prefix}_$timestamp.jpg"

        val safe = raw.replace(Regex("[^A-Za-z0-9._-]"), "_")
        val extension = safe.substringAfterLast('.', "").lowercase(Locale.US)
        return when (extension) {
            "jpg", "jpeg" -> safe to "image/jpeg"
            "png" -> safe to "image/png"
            "dng" -> safe to "image/x-adobe-dng"
            else -> "$safe.jpg" to "image/jpeg"
        }
    }

    private fun finalizeImageBytes(bytes: ByteArray, mimeType: String, metadata: JSONObject?, captureTime: Long): ByteArray {
        if (mimeType != "image/jpeg" || metadata == null) return bytes
        val temp = File(indexDir, "metadata_${UUID.randomUUID()}.jpg")
        return try {
            temp.writeBytes(bytes)
            val exif = ExifInterface(temp.absolutePath)
            val localTime = SimpleDateFormat("yyyy:MM:dd HH:mm:ss", Locale.US).format(Date(captureTime))
            exif.setAttribute(ExifInterface.TAG_DATETIME, localTime)
            exif.setAttribute(ExifInterface.TAG_DATETIME_ORIGINAL, localTime)
            exif.setAttribute(ExifInterface.TAG_DATETIME_DIGITIZED, localTime)
            exif.setAttribute(ExifInterface.TAG_SOFTWARE, "PotensicProxy_TAF")
            exif.setAttribute(ExifInterface.TAG_USER_COMMENT, "PotensicProxy metadata: full PStart/recognition payload stored in XMP")

            val telemetry = metadata.optJSONObject("telemetry")
            val latitude = telemetry?.optDouble("latitude", Double.NaN) ?: Double.NaN
            val longitude = telemetry?.optDouble("longitude", Double.NaN) ?: Double.NaN
            if (latitude.isFinite() && longitude.isFinite() && latitude in -90.0..90.0 && longitude in -180.0..180.0 && !(latitude == 0.0 && longitude == 0.0)) {
                writeGpsExif(exif, latitude, longitude)
            }
            exif.saveAttributes()

            val xmp = buildXmpPacket(metadata)
            injectXmpApp1(temp.readBytes(), xmp)
        } finally {
            try { temp.delete() } catch (_: Exception) {}
        }
    }

    /**
     * android.media.ExifInterface does not expose setLatLong() on the platform
     * API used by this project. Write standard GPS EXIF tags explicitly.
     */
    private fun writeGpsExif(exif: ExifInterface, latitude: Double, longitude: Double) {
        exif.setAttribute(ExifInterface.TAG_GPS_LATITUDE_REF, if (latitude >= 0.0) "N" else "S")
        exif.setAttribute(ExifInterface.TAG_GPS_LATITUDE, decimalDegreesToExifDms(latitude))
        exif.setAttribute(ExifInterface.TAG_GPS_LONGITUDE_REF, if (longitude >= 0.0) "E" else "W")
        exif.setAttribute(ExifInterface.TAG_GPS_LONGITUDE, decimalDegreesToExifDms(longitude))
    }

    private fun decimalDegreesToExifDms(value: Double): String {
        val absolute = abs(value)
        var degrees = floor(absolute).toInt()
        val minutesRaw = (absolute - degrees) * 60.0
        var minutes = floor(minutesRaw).toInt()
        var secondsNumerator = ((minutesRaw - minutes) * 60.0 * 1_000_000.0).roundToLong()

        if (secondsNumerator >= 60_000_000L) {
            secondsNumerator = 0L
            minutes += 1
        }
        if (minutes >= 60) {
            minutes = 0
            degrees += 1
        }

        return "$degrees/1,$minutes/1,$secondsNumerator/1000000"
    }

    private fun buildXmpPacket(metadata: JSONObject): String {
        val pstart = metadata.optJSONObject("pstart")
        val capture = metadata.optJSONObject("capture")
        val telemetry = metadata.optJSONObject("telemetry")
        fun text(value: Any?): String = xmlEscape(
            when (value) {
                null, JSONObject.NULL -> ""
                else -> value.toString()
            }
        )
        val payloadJson = text(metadata.toString())
        return """<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="PotensicProxy_TAF">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:taf="https://potensicproxy.local/ns/pstart/1.0/">
      <xmp:CreateDate>${text(capture?.opt("timestampIso"))}</xmp:CreateDate>
      <taf:Schema>PotensicProxy/PStart</taf:Schema>
      <taf:SchemaVersion>${text(pstart?.opt("schemaVersion"))}</taf:SchemaVersion>
      <taf:SessionId>${text(pstart?.opt("sessionId"))}</taf:SessionId>
      <taf:StepId>${text(pstart?.opt("stepId"))}</taf:StepId>
      <taf:ReferenceIndex>${text(pstart?.opt("referenceIndex"))}</taf:ReferenceIndex>
      <taf:TargetHeight>${text(pstart?.opt("targetHeight"))}</taf:TargetHeight>
      <taf:RelativeHeight>${text(pstart?.opt("relativeHeight"))}</taf:RelativeHeight>
      <taf:HomeOffset>${text(pstart?.opt("homeOffset"))}</taf:HomeOffset>
      <taf:QualityStatus>${text(pstart?.opt("qualityStatus"))}</taf:QualityStatus>
      <taf:ImageRole>${text(pstart?.opt("imageRole"))}</taf:ImageRole>
      <taf:ReferenceEligible>${text(pstart?.opt("referenceEligible"))}</taf:ReferenceEligible>
      <taf:ZoomRole>${text(pstart?.opt("zoomRole"))}</taf:ZoomRole>
      <taf:SessionMaster>${text(pstart?.opt("sessionMaster"))}</taf:SessionMaster>
      <taf:SessionMasterImage>${text(pstart?.opt("sessionMasterImage"))}</taf:SessionMasterImage>
      <taf:SessionProtocolFile>${text(pstart?.opt("sessionProtocolFile"))}</taf:SessionProtocolFile>
      <taf:Latitude>${text(telemetry?.opt("latitude"))}</taf:Latitude>
      <taf:Longitude>${text(telemetry?.opt("longitude"))}</taf:Longitude>
      <taf:Heading>${text(telemetry?.opt("heading"))}</taf:Heading>
      <taf:GimbalPitch>${text(telemetry?.opt("gimbalPitch"))}</taf:GimbalPitch>
      <taf:HorizontalSpeed>${text(telemetry?.opt("horizontalSpeed"))}</taf:HorizontalSpeed>
      <taf:VerticalSpeed>${text(telemetry?.opt("verticalSpeed"))}</taf:VerticalSpeed>
      <taf:TofHeight>${text(telemetry?.opt("tofHeight"))}</taf:TofHeight>
      <taf:PayloadJson>$payloadJson</taf:PayloadJson>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>"""
    }

    private fun injectXmpApp1(jpeg: ByteArray, xmp: String): ByteArray {
        require(jpeg.size >= 4 && (jpeg[0].toInt() and 0xff) == 0xff && (jpeg[1].toInt() and 0xff) == 0xd8) {
            "XMP embedding requires a valid JPEG"
        }
        val header = "http://ns.adobe.com/xap/1.0/\u0000".toByteArray(Charsets.UTF_8)
        val xml = xmp.toByteArray(Charsets.UTF_8)
        val payloadLength = header.size + xml.size
        require(payloadLength + 2 <= 0xffff) { "XMP metadata exceeds the JPEG APP1 size limit" }

        val segment = ByteArrayOutputStream(payloadLength + 4).apply {
            write(0xff)
            write(0xe1)
            val length = payloadLength + 2
            write((length ushr 8) and 0xff)
            write(length and 0xff)
            write(header)
            write(xml)
        }.toByteArray()

        var insertAt = 2
        while (insertAt + 4 <= jpeg.size && (jpeg[insertAt].toInt() and 0xff) == 0xff) {
            val marker = jpeg[insertAt + 1].toInt() and 0xff
            if (marker != 0xe0 && marker != 0xe1) break
            val length = ((jpeg[insertAt + 2].toInt() and 0xff) shl 8) or (jpeg[insertAt + 3].toInt() and 0xff)
            if (length < 2 || insertAt + 2 + length > jpeg.size) break
            insertAt += 2 + length
        }

        return ByteArrayOutputStream(jpeg.size + segment.size).apply {
            write(jpeg, 0, insertAt)
            write(segment)
            write(jpeg, insertAt, jpeg.size - insertAt)
        }.toByteArray()
    }



    private fun injectPStartProtocolApp15(
        jpeg: ByteArray,
        protocolBytes: ByteArray,
        descriptor: JSONObject,
    ): Pair<ByteArray, Int> {
        require(jpeg.size >= 4 && (jpeg[0].toInt() and 0xff) == 0xff && (jpeg[1].toInt() and 0xff) == 0xd8) {
            "PStart protocol embedding requires a valid JPEG"
        }
        val compressed = gzip(protocolBytes)
        descriptor.put("compressedBytes", compressed.size)
        val descriptorBytes = descriptor.toString().toByteArray(Charsets.UTF_8)
        val container = ByteArrayOutputStream(4 + descriptorBytes.size + compressed.size).apply {
            writeInt32(this, descriptorBytes.size)
            write(descriptorBytes)
            write(compressed)
        }.toByteArray()

        val signature = PSTART_PROTOCOL_SIGNATURE
        val fixedHeaderSize = signature.size + 1 + 2 + 2 + 4
        val maxChunkData = 60_000
        val chunkCount = (container.size + maxChunkData - 1) / maxChunkData
        require(chunkCount <= 0xffff) { "PStart protocol requires too many JPEG chunks" }

        val segments = ByteArrayOutputStream()
        for (index in 0 until chunkCount) {
            val start = index * maxChunkData
            val end = minOf(container.size, start + maxChunkData)
            val chunk = container.copyOfRange(start, end)
            val payloadLength = fixedHeaderSize + chunk.size
            require(payloadLength + 2 <= 0xffff) { "PStart APP15 chunk exceeds JPEG segment limit" }
            segments.write(0xff)
            segments.write(0xef)
            val jpegLength = payloadLength + 2
            segments.write((jpegLength ushr 8) and 0xff)
            segments.write(jpegLength and 0xff)
            segments.write(signature)
            segments.write(1) // container version
            writeInt16(segments, index)
            writeInt16(segments, chunkCount)
            writeInt32(segments, container.size)
            segments.write(chunk)
        }

        var insertAt = 2
        while (insertAt + 4 <= jpeg.size && (jpeg[insertAt].toInt() and 0xff) == 0xff) {
            val marker = jpeg[insertAt + 1].toInt() and 0xff
            if (marker != 0xe0 && marker != 0xe1) break
            val length = ((jpeg[insertAt + 2].toInt() and 0xff) shl 8) or (jpeg[insertAt + 3].toInt() and 0xff)
            if (length < 2 || insertAt + 2 + length > jpeg.size) break
            insertAt += 2 + length
        }

        val segmentBytes = segments.toByteArray()
        val result = ByteArrayOutputStream(jpeg.size + segmentBytes.size).apply {
            write(jpeg, 0, insertAt)
            write(segmentBytes)
            write(jpeg, insertAt, jpeg.size - insertAt)
        }.toByteArray()
        return result to chunkCount
    }

    private fun stripPStartProtocolApp15(jpeg: ByteArray): ByteArray {
        if (jpeg.size < 4 || (jpeg[0].toInt() and 0xff) != 0xff || (jpeg[1].toInt() and 0xff) != 0xd8) return jpeg
        val out = ByteArrayOutputStream(jpeg.size)
        out.write(jpeg, 0, 2)
        var pos = 2
        while (pos + 1 < jpeg.size) {
            if ((jpeg[pos].toInt() and 0xff) != 0xff) {
                out.write(jpeg, pos, jpeg.size - pos)
                break
            }
            val marker = jpeg[pos + 1].toInt() and 0xff
            if (marker == 0xda || marker == 0xd9) {
                out.write(jpeg, pos, jpeg.size - pos)
                break
            }
            if (marker in 0xd0..0xd7 || marker == 0x01) {
                out.write(jpeg, pos, 2)
                pos += 2
                continue
            }
            if (pos + 4 > jpeg.size) {
                out.write(jpeg, pos, jpeg.size - pos)
                break
            }
            val length = ((jpeg[pos + 2].toInt() and 0xff) shl 8) or (jpeg[pos + 3].toInt() and 0xff)
            val end = pos + 2 + length
            if (length < 2 || end > jpeg.size) {
                out.write(jpeg, pos, jpeg.size - pos)
                break
            }
            val isPStartProtocol = marker == 0xef && startsWithAt(jpeg, pos + 4, PSTART_PROTOCOL_SIGNATURE)
            if (!isPStartProtocol) out.write(jpeg, pos, end - pos)
            pos = end
        }
        return out.toByteArray()
    }

    private fun startsWithAt(bytes: ByteArray, offset: Int, prefix: ByteArray): Boolean {
        if (offset < 0 || offset + prefix.size > bytes.size) return false
        for (i in prefix.indices) if (bytes[offset + i] != prefix[i]) return false
        return true
    }

    private fun gzip(bytes: ByteArray): ByteArray {
        val out = ByteArrayOutputStream()
        GZIPOutputStream(out).use { it.write(bytes) }
        return out.toByteArray()
    }

    private fun writeInt16(out: ByteArrayOutputStream, value: Int) {
        out.write((value ushr 8) and 0xff)
        out.write(value and 0xff)
    }

    private fun writeInt32(out: ByteArrayOutputStream, value: Int) {
        out.write((value ushr 24) and 0xff)
        out.write((value ushr 16) and 0xff)
        out.write((value ushr 8) and 0xff)
        out.write(value and 0xff)
    }

    private fun xmlEscape(value: String): String = value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&apos;")

    private fun sha256(bytes: ByteArray): String = MessageDigest
        .getInstance("SHA-256")
        .digest(bytes)
        .joinToString("") { "%02x".format(it) }

    private fun ensureLegacyWritePermission() {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
        ) {
            throw SecurityException("Storage permission is required on Android 8/9 to publish images to Pictures/PotensicProxy")
        }
    }

    private fun appendToIndex(item: JSONObject) {
        indexDir.mkdirs()
        indexFile.appendText(item.toString() + "\n")
        val all = readIndex()
        if (all.size > MAX_INDEX_ITEMS * 2) {
            writeIndex(all.takeLast(MAX_INDEX_ITEMS))
        }
    }

    private fun writeIndex(items: List<JSONObject>) {
        indexDir.mkdirs()
        val kept = items.takeLast(MAX_INDEX_ITEMS * 2)
        indexFile.writeText(if (kept.isEmpty()) "" else kept.joinToString("\n") { it.toString() } + "\n")
    }

    private fun readIndex(): List<JSONObject> {
        if (!indexFile.exists()) return emptyList()
        return indexFile.readLines()
            .asSequence()
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .mapNotNull {
                try { JSONObject(it) } catch (_: Exception) { null }
            }
            .toList()
    }
}
