package com.potensic.proxy

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.DocumentsContract
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

/** Persistable Android SAF tree: confined to the folder explicitly selected on the phone. */
object PStartSafStorage {
    private const val KEY = "pstart_saf_tree"
    @Volatile private var state: String = "NOT_SELECTED"
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
    fun selected(context: Context, uri: Uri, intentFlags: Int) {
        val flags = intentFlags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        val folderName = DocumentsContract.getTreeDocumentId(uri).substringAfterLast('/')
        require(folderName == "PotensicProxy") { "Select or create a folder named exactly PotensicProxy" }
        require(flags and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0 && flags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION != 0) { "Read/write access required" }
        context.contentResolver.takePersistableUriPermission(uri, flags)
        context.getSharedPreferences("pstart_saf", Context.MODE_PRIVATE).edit().putString(KEY, uri.toString()).apply()
        state = "READY"
    }
    fun cancelled() { state = "CANCELLED" }
    fun request(context: Context) {
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
        // Never overwrite original media or an existing analysis run.
        require(findChild(context, grant, directory, filename, null) == null) { "File already exists: $filename" }
        val file = DocumentsContract.createDocument(resolver, directory, mime, filename)
            ?: throw IllegalStateException("Cannot create file: $filename")
        try {
            resolver.openOutputStream(file, "wt")?.use { it.write(bytes) } ?: error("Storage output failed")
            val actual = resolver.openInputStream(file)?.use { it.readBytes() } ?: error("Storage readback failed")
            if (!actual.contentEquals(bytes)) error("Stored file differs from source")
            return JSONObject().put("uri", file.toString()).put("name", filename)
                .put("relativePath", "Documents/PotensicProxy/$path")
                .put("size", bytes.size).put("sha256", MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) })
                .put("verified", true)
        } catch (e: Exception) {
            try { DocumentsContract.deleteDocument(resolver, file) } catch (_: Exception) {}
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
        require(safe(name) && (name.endsWith(".json") || name.endsWith(".jsonl") || name.endsWith(".jpg"))) { "Unsupported artifact filename" }
        require(bytes.size <= 30_000_000) { "Artifact too large" }
        require(children(context).none { it.first == name }) { "Artifact already exists; use a new run ID" }
        val type = if (name.endsWith(".jpg")) "image/jpeg" else "application/json"
        val uri = DocumentsContract.createDocument(context.contentResolver, latestPStartDirectory(context), type, name) ?: throw IllegalStateException("Could not create artifact")
        try {
            context.contentResolver.openOutputStream(uri, "wt")?.use { it.write(bytes) } ?: throw IllegalStateException("SAF output failed")
            val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
            val verified = context.contentResolver.openInputStream(uri)?.use { stream ->
                val digest = MessageDigest.getInstance("SHA-256")
                val buffer = ByteArray(8192)
                while (true) { val n = stream.read(buffer); if (n < 0) break; digest.update(buffer, 0, n) }
                sha == digest.digest().joinToString("") { "%02x".format(it) }
            } == true
            if (!verified) throw IllegalStateException("Stored artifact hash mismatch")
            return JSONObject().put("verified", true).put("name", name).put("sha256", sha)
        } catch (e: Exception) {
            DocumentsContract.deleteDocument(context.contentResolver, uri)
            throw e
        }
    }
    private fun safe(name: String): Boolean = name.matches(Regex("[A-Za-z0-9_.-]{1,190}")) && !name.startsWith(".") && !name.contains("..")
}

class PStartFolderPickerActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
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
            } catch (e: Exception) { android.util.Log.w("PStartSAF", "Permission failed: ${e.message}"); PStartSafStorage.cancelled() }
            finish()
        }
    }
}
