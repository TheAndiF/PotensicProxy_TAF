package com.potensic.proxy

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.DocumentsContract
import android.os.Build
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

/** Persistable Android SAF tree: confined to the folder explicitly selected on the phone. */
object PStartSafStorage {
    private const val KEY = "pstart_saf_tree"
    @Volatile private var state: String = "NOT_SELECTED"
    fun hasPermission(context: Context): Boolean = tree(context) != null
    fun status(context: Context): JSONObject {
        val uri = tree(context)
        return JSONObject().put("state", if (uri != null) "READY" else if (state == "READY") "NOT_SELECTED" else state)
            .put("folder", "PotensicProxy")
            .put("treeUri", uri?.toString() ?: JSONObject.NULL)
    }
    private fun tree(context: Context): Uri? {
        val saved = context.getSharedPreferences("pstart_saf", Context.MODE_PRIVATE).getString(KEY, null) ?: return null
        val uri = Uri.parse(saved)
        val permission = context.contentResolver.persistedUriPermissions.any { it.uri == uri && it.isReadPermission && it.isWritePermission }
        return if (permission) uri else null
    }
    /** Read the display name via the provider; document IDs are opaque, not filesystem paths. */
    private fun selectedDisplayName(context: Context, treeUri: Uri): String {
        val rootDocument = DocumentsContract.buildDocumentUriUsingTree(treeUri, DocumentsContract.getTreeDocumentId(treeUri))
        context.contentResolver.query(rootDocument, arrayOf(
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE
        ), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                require(cursor.getString(1) == DocumentsContract.Document.MIME_TYPE_DIR) { "Selected item is not a directory" }
                return cursor.getString(0) ?: ""
            }
        }
        error("Selected SAF directory metadata could not be read")
    }

    fun selected(context: Context, uri: Uri, intentFlags: Int) {
        val flags = intentFlags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        require(flags and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0 && flags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION != 0) { "Read/write access required" }
        val name = selectedDisplayName(context, uri)
        require(name == "PotensicProxy") { "Selected folder '$name'; expected PotensicProxy" }
        // Where the standard external-storage provider exposes a path-like ID, also
        // enforce the intended parent. Other providers use opaque IDs and cannot be
        // verified by interpreting their IDs as paths; never pretend otherwise.
        val id = DocumentsContract.getTreeDocumentId(uri)
        // Android's ExternalStorageProvider exposes the Documents root through
        // two valid identifiers: primary:Documents/... and home:...
        // The `home:` alias represents the Documents directory, not storage root.
        // Accept ONLY this provider and these two exact target IDs; a matching
        // display name alone must not grant access to an unrelated location.
        val correctLocation = uri.authority == "com.android.externalstorage.documents" &&
            (id == "primary:Documents/PotensicProxy" || id == "home:PotensicProxy")
        require(correctLocation) {
            "Please select internal storage/Documents/PotensicProxy (selected provider=${uri.authority}, ID=$id, displayName=$name)"
        }
        Log.i("PStartSAF", "Selected location verified: provider=${uri.authority}, id=$id, name=$name")
        context.contentResolver.takePersistableUriPermission(uri, flags)
        // Probe the exact selected directory before enabling flight-related writes.
        try {
            val root = DocumentsContract.buildDocumentUriUsingTree(uri, id)
            val test = DocumentsContract.createDocument(context.contentResolver, root, "application/octet-stream", "potensicproxy_saf_probe.tmp")
                ?: error("Cannot create test document")
            try {
                val bytes = "PotensicProxy SAF v1".toByteArray(Charsets.UTF_8)
                context.contentResolver.openOutputStream(test, "wt")?.use { it.write(bytes) }
                    ?: error("Cannot write test document")
                val read = context.contentResolver.openInputStream(test)?.use { it.readBytes() }
                    ?: error("Cannot read test document")
                check(bytes.contentEquals(read)) { "SAF test document readback mismatch" }
            } finally {
                check(DocumentsContract.deleteDocument(context.contentResolver, test)) { "Cannot remove SAF test document" }
            }
        } catch (e: Exception) {
            Log.e("PStartSAF", "Probe failed for $uri", e)
            throw IllegalStateException("Folder write/read verification failed: ${e.message}", e)
        }
        context.getSharedPreferences("pstart_saf", Context.MODE_PRIVATE).edit().putString(KEY, uri.toString()).apply()
        state = "READY"
        Log.i("PStartSAF", "SAF permission verified for folder=$name uri=$uri")
    }

    fun cancelled() { state = "CANCELLED" }
    fun failed(message: String) { state = "ERROR: " + message.take(180) }
    fun request(context: Context) {
        if (hasPermission(context)) { state = "READY"; return }
        state = "PICKER_REQUESTED"
        context.startActivity(Intent(context, PStartFolderPickerActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    /** A single user-granted PotensicProxy tree for every persistent Android export. */
    fun requireRoot(context: Context): Uri = root(context)

    fun putFile(context: Context, path: String, filename: String, mime: String, bytes: ByteArray): JSONObject {
        require(path.split('/').all { safe(it) } && path.isNotEmpty()) { "Invalid storage path" }
        require(safe(filename)) { "Invalid filename" }
        val resolver = context.contentResolver
        val grant = tree(context) ?: throw SecurityException("PotensicProxy folder permission missing. Grant access in PStart settings.")
        var directory = root(context)
        for (part in path.split('/')) {
            val existing = findChild(context, grant, directory, part, DocumentsContract.Document.MIME_TYPE_DIR)
            directory = existing ?: DocumentsContract.createDocument(resolver, directory, DocumentsContract.Document.MIME_TYPE_DIR, part)
                ?: throw IllegalStateException("Cannot create folder: $part")
        }
        val existing = findChild(context, grant, directory, filename, null)
        // Only designated analysis outputs may be replaced; captured photos and source XMP stay immutable.
        val replaceable = filename.contains("_analysis_", ignoreCase = true) &&
            (filename.endsWith(".png", true) || filename.endsWith(".json", true) ||
             filename.endsWith(".jsonl", true) || filename.endsWith(".xmp", true) ||
             filename.endsWith(".jpg", true))
        require(existing == null || replaceable) { "Original file already exists: $filename" }
        // Write and verify before touching the old result. SAF rename is not guaranteed atomic.
        val stagingName = "analysis_tmp_${java.util.UUID.randomUUID().toString().replace("-", "")}.tmp"
        var staging = DocumentsContract.createDocument(resolver, directory, mime, stagingName)
            ?: throw IllegalStateException("Cannot create analysis staging file")
        var backup: Uri? = null
        try {
            resolver.openOutputStream(staging, "wt")?.use { it.write(bytes) } ?: error("Storage output failed")
            check(resolver.openInputStream(staging)?.use { it.readBytes().contentEquals(bytes) } == true) {
                "Analysis staging readback mismatch"
            }
            if (existing != null) {
                val backupName = "analysis_backup_${java.util.UUID.randomUUID().toString().replace("-", "")}.tmp"
                backup = DocumentsContract.renameDocument(resolver, existing, backupName)
                    ?: error("SAF provider cannot rename existing analysis file; original retained")
            }
            val result = DocumentsContract.renameDocument(resolver, staging, filename)
                ?: error("SAF provider cannot rename staging file")
            staging = result
            check(resolver.openInputStream(result)?.use { it.readBytes().contentEquals(bytes) } == true) {
                "Final analysis readback mismatch"
            }
            backup?.let { if (!DocumentsContract.deleteDocument(resolver, it)) Log.w("PStartSAF", "Previous artifact backup not removed: $filename") }
            backup = null
            return JSONObject().put("uri", result.toString()).put("name", filename)
                .put("relativePath", "Documents/PotensicProxy/$path")
                .put("size", bytes.size).put("replaced", existing != null)
                .put("sha256", MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) })
                .put("verified", true)
        } catch (e: Exception) {
            try { DocumentsContract.deleteDocument(resolver, staging) } catch (_: Exception) {}
            if (backup != null) {
                try { DocumentsContract.renameDocument(resolver, backup, filename) }
                catch (restore: Exception) { Log.e("PStartSAF", "Restore of previous analysis output failed: $filename", restore) }
            }
            throw e
        }
    }

    private fun findChild(context: Context, grant: Uri, parent: Uri, name: String, mime: String?): Uri? {
        val childUri = DocumentsContract.buildChildDocumentsUriUsingTree(grant, DocumentsContract.getDocumentId(parent))
        context.contentResolver.query(childUri, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE), null, null, null)?.use { cursor ->
            while (cursor.moveToNext()) {
                if (cursor.getString(1) == name && (mime == null || mime == cursor.getString(2))) {
                    return DocumentsContract.buildDocumentUriUsingTree(grant, cursor.getString(0))
                }
            }
        }
        return null
    }

    private fun root(context: Context): Uri {
        val uri = tree(context) ?: throw SecurityException("PotensicProxy folder not permitted. Open PStart settings and grant Android folder access")
        return DocumentsContract.buildDocumentUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri))
    }
    private fun latestPStartDirectory(context: Context): Uri {
        val grant = tree(context) ?: error("PotensicProxy not permitted")
        val root = root(context)
        val auto = findChild(context, grant, root, "Auto", DocumentsContract.Document.MIME_TYPE_DIR) ?: return root
        val pstart = findChild(context, grant, auto, "PStart", DocumentsContract.Document.MIME_TYPE_DIR) ?: return root
        val childUri = DocumentsContract.buildChildDocumentsUriUsingTree(grant, DocumentsContract.getDocumentId(pstart))
        val sessions = mutableListOf<Pair<String, Uri>>()
        context.contentResolver.query(childUri, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE), null, null, null)?.use { cursor ->
            while (cursor.moveToNext()) if (cursor.getString(2) == DocumentsContract.Document.MIME_TYPE_DIR)
                sessions.add(cursor.getString(1) to DocumentsContract.buildDocumentUriUsingTree(grant, cursor.getString(0)))
        }
        return sessions.maxByOrNull { it.first }?.second ?: root
    }

    /** List existing PStart session folders; browser only chooses IDs, never local PC files. */
    fun sessions(context: Context): JSONObject {
        val grant = tree(context) ?: throw SecurityException("PotensicProxy SAF access missing")
        val auto = findChild(context, grant, root(context), "Auto", DocumentsContract.Document.MIME_TYPE_DIR)
        val pstart = auto?.let { findChild(context, grant, it, "PStart", DocumentsContract.Document.MIME_TYPE_DIR) }
        val result = JSONArray()
        if (pstart != null) {
            val childUri = DocumentsContract.buildChildDocumentsUriUsingTree(grant, DocumentsContract.getDocumentId(pstart))
            context.contentResolver.query(childUri, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE), null, null, null)?.use { cursor ->
                while (cursor.moveToNext()) {
                    val name = cursor.getString(1) ?: continue
                    if (cursor.getString(2) == DocumentsContract.Document.MIME_TYPE_DIR && safe(name)) result.put(name)
                }
            }
        }
        return JSONObject().put("sessions", result)
    }

    private fun sessionDirectory(context: Context, sessionId: String): Uri {
        require(safe(sessionId)) { "Invalid session" }
        val grant = tree(context) ?: throw SecurityException("PotensicProxy SAF access missing")
        val auto = findChild(context, grant, root(context), "Auto", DocumentsContract.Document.MIME_TYPE_DIR)
            ?: throw IllegalArgumentException("Auto not found")
        val pstart = findChild(context, grant, auto, "PStart", DocumentsContract.Document.MIME_TYPE_DIR)
            ?: throw IllegalArgumentException("PStart not found")
        return findChild(context, grant, pstart, sessionId, DocumentsContract.Document.MIME_TYPE_DIR)
            ?: throw IllegalArgumentException("PStart session not found: $sessionId")
    }

    private fun sessionChildren(context: Context, sessionId: String): List<Pair<String, Uri>> {
        val grant = tree(context) ?: throw SecurityException("PotensicProxy SAF access missing")
        val folder = sessionDirectory(context, sessionId)
        val childUri = DocumentsContract.buildChildDocumentsUriUsingTree(grant, DocumentsContract.getDocumentId(folder))
        val found = mutableListOf<Pair<String, Uri>>()
        context.contentResolver.query(childUri, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE), null, null, null)?.use { c ->
            while (c.moveToNext()) if (c.getString(2) != DocumentsContract.Document.MIME_TYPE_DIR) {
                val name = c.getString(1) ?: continue
                if (safe(name)) found.add(name to DocumentsContract.buildDocumentUriUsingTree(grant, c.getString(0)))
            }
        }
        return found
    }

    fun sessionImages(context: Context, sessionId: String): JSONObject {
        val files = JSONArray()
        sessionChildren(context, sessionId).filter { (name, _) -> name.endsWith(".jpg", true) || name.endsWith(".jpeg", true) }
            .filterNot { (name, _) -> name.contains("_analysis_", true) }.sortedBy { it.first }
            .forEach { files.put(it.first) }
        return JSONObject().put("session", sessionId).put("files", files)
    }

    fun readSessionImage(context: Context, sessionId: String, name: String): ByteArray {
        require(safe(name) && (name.endsWith(".jpg", true) || name.endsWith(".jpeg", true)) && !name.contains("_analysis_", true)) { "Invalid image" }
        val file = sessionChildren(context, sessionId).firstOrNull { it.first == name }?.second
            ?: throw IllegalArgumentException("Image not found in session")
        return context.contentResolver.openInputStream(file)?.use { it.readBytes() }
            ?: throw IllegalStateException("Cannot read image")
    }

    private fun children(context: Context): List<Pair<String, Uri>> {
        val base = latestPStartDirectory(context)
        val tree = tree(context)!!
        val result = mutableListOf<Pair<String, Uri>>()
        val uri = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(base))
        context.contentResolver.query(uri, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE), null, null, null)?.use { c ->
            while (c.moveToNext()) {
                if (c.getString(2) == DocumentsContract.Document.MIME_TYPE_DIR) continue
                result.add(c.getString(1) to DocumentsContract.buildDocumentUriUsingTree(tree, c.getString(0)))
            }
        }
        return result
    }
    fun list(context: Context): JSONObject {
        val files = JSONArray()
        children(context).filter { (name, _) -> name.matches(Regex("(?i)^.*\\.jpe?g$")) && !name.contains("_analysis_", true) }.sortedBy { it.first }.forEach { (name, _) -> files.put(name) }
        return JSONObject().put("files", files).put("count", files.length())
    }
    fun read(context: Context, name: String): ByteArray {
        require(safe(name) && name.endsWith(".jpg", true) || safe(name) && name.endsWith(".jpeg", true)) { "Invalid JPEG name" }
        val uri = children(context).firstOrNull { it.first == name }?.second ?: throw IllegalArgumentException("JPEG not found")
        return context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: throw IllegalStateException("SAF open failed")
    }
    fun write(context: Context, name: String, bytes: ByteArray): JSONObject {
        require(safe(name) && name.contains("_analysis_", true) &&
            (name.endsWith(".json",true) || name.endsWith(".jsonl",true) ||
             name.endsWith(".jpg",true) || name.endsWith(".png",true))) { "Unsupported analysis artifact filename" }
        require(bytes.isNotEmpty() && bytes.size <= 30_000_000) { "Invalid artifact size" }
        val resolver = context.contentResolver
        val grant = tree(context) ?: throw SecurityException("SAF permission missing")
        val folder = latestPStartDirectory(context)
        val existing = findChild(context, grant, folder, name, null)
        val token = java.util.UUID.randomUUID().toString().replace("-", "")
        var staging = DocumentsContract.createDocument(resolver, folder, when { name.endsWith(".png",true) -> "image/png"; name.endsWith(".jpg",true) -> "image/jpeg"; else -> "application/json" }, "analysis_tmp_$token.tmp")
            ?: error("Cannot create SAF staging artifact")
        var backup: Uri? = null
        try {
            resolver.openOutputStream(staging,"wt")?.use { it.write(bytes) } ?: error("SAF write failed")
            check(resolver.openInputStream(staging)?.use { it.readBytes().contentEquals(bytes) } == true) { "SAF staged readback mismatch" }
            if (existing != null) backup = DocumentsContract.renameDocument(resolver,existing,"analysis_backup_$token.tmp")
                ?: error("SAF cannot back up existing artifact")
            staging = DocumentsContract.renameDocument(resolver,staging,name) ?: error("SAF artifact commit failed")
            check(resolver.openInputStream(staging)?.use { it.readBytes().contentEquals(bytes) } == true) { "SAF final readback mismatch" }
            backup?.let { if (!DocumentsContract.deleteDocument(resolver,it)) Log.w("PStartSAF","Prior artifact backup not removed: $name") }
            backup = null
            val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
            return JSONObject().put("verified",true).put("replaced",existing != null).put("name",name).put("sha256",sha)
        } catch(e: Exception) {
            try { DocumentsContract.deleteDocument(resolver,staging) } catch (_: Exception) {}
            backup?.let { try { DocumentsContract.renameDocument(resolver,it,name) } catch (restore: Exception) {
                Log.e("PStartSAF","Unable to restore previous artifact $name",restore) } }
            throw e
        }
    }
    private fun safe(name: String): Boolean = name.matches(Regex("[A-Za-z0-9_.-]{1,190}")) && !name.startsWith(".") && !name.contains("..")
}

class PStartFolderPickerActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState != null) return
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
            // Hint only: OEM document pickers may ignore the initial URI.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val initial = DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", "primary:Documents/PotensicProxy")
                putExtra(DocumentsContract.EXTRA_INITIAL_URI, initial)
            }
        }
        startActivityForResult(intent, 4201)
    }
    @Deprecated("Platform Activity result API for Android 10 compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 4201) {
            try {
                if (resultCode == RESULT_OK && data?.data != null) PStartSafStorage.selected(this, data.data!!, data.flags)
                else PStartSafStorage.cancelled()
            } catch (e: Exception) {
                android.util.Log.e("PStartSAF", "Permission failed", e)
                PStartSafStorage.failed(e.message ?: e.javaClass.simpleName)
                android.widget.Toast.makeText(this, e.message ?: "Ordnerfreigabe fehlgeschlagen", android.widget.Toast.LENGTH_LONG).show()
            }
            finish()
        }
    }
}
