package com.potensic.proxy

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

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
    ): JSONObject {
        require(bytes.isNotEmpty()) { "Image payload is empty" }
        ensureLegacyWritePermission()

        val normalizedLibrary = normalizeLibrary(library)
        val relativeDir = relativeDir(normalizedLibrary)
        val (displayName, mimeType) = normalizedNameAndMime(requestedName, normalizedLibrary)
        val captureTime = metadata
            ?.optJSONObject("capture")
            ?.optLong("timestampUnixMs", 0L)
            ?.takeIf { it > 0L }
            ?: System.currentTimeMillis()

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
            resolver.openOutputStream(uri, "w")?.use { it.write(bytes) }
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
        val sourceHash = sha256(bytes)
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        try { BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds) } catch (_: Exception) {}
        val storedBytes = try {
            resolver.openInputStream(uri)?.use { it.readBytes() }
        } catch (_: Exception) {
            null
        }
        val storedHash = storedBytes?.let(::sha256)
        val verified = storedBytes != null && storedBytes.size == bytes.size && storedHash == sourceHash

        val item = JSONObject().apply {
            put("id", UUID.randomUUID().toString())
            put("name", displayName)
            put("mimeType", mimeType)
            put("size", bytes.size)
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
                put("byteSize", bytes.size)
                put("sha256", sourceHash)
            })
            if (metadata != null) put("metadata", metadata)
        }
        appendToIndex(item)
        Log.i("[MediaStore] Saved ${bytes.size} bytes as $displayName [$normalizedLibrary/$source] verified=$verified -> $uri")
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
            indexFile.writeText(all.takeLast(MAX_INDEX_ITEMS).joinToString("\n") { it.toString() } + "\n")
        }
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
