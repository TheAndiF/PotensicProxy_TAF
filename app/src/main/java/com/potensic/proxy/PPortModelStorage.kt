package com.potensic.proxy

import android.content.Context
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

/** App-private PPort cache. Only data artifacts; never issues flight commands. */
object PPortModelStorage {
    private val names = setOf("marker_pattern.png", "marker_model.json", "marker_scale.json", "marker_quality.json", "marker_weighting.json")
    private fun root(ctx: Context): File = File(ctx.filesDir, "PPort").also {
        check((it.isDirectory || it.mkdirs()) && it.canWrite()) { "PPort directory unavailable: ${it.absolutePath}" }
    }
    private fun validId(id: String) = id.matches(Regex("[A-Za-z0-9_-]{1,120}"))
    private fun sha256(bytes: ByteArray) = MessageDigest.getInstance("SHA-256")
        .digest(bytes).joinToString("") { "%02x".format(it) }
    @Synchronized fun store(ctx: Context, id: String, payload: JSONObject): JSONObject {
        require(validId(id)) { "Invalid model ID" }
        val src = payload.getJSONObject("files")
        require(names.all { src.has(it) }) { "Incomplete model files" }
        val parent = root(ctx)
        val destination = File(parent, "PStart_$id")
        val token = java.util.UUID.randomUUID().toString().replace("-", "")
        val temp = File(parent, ".pending_${id}_$token")
        val old = File(parent, ".backup_${id}_$token")
        check(temp.mkdir()) { "Cannot create PPort staging folder" }
        var replaced = false
        try {
            val hashes = JSONObject()
            for (name in names) {
                val bytes = Base64.decode(src.getString(name), Base64.DEFAULT)
                require(bytes.isNotEmpty() && bytes.size < 12_000_000) { "Invalid model file size: $name" }
                val file = File(temp, name)
                file.writeBytes(bytes)
                check(file.readBytes().contentEquals(bytes)) { "PPort staging verification failed: $name" }
                hashes.put(name, sha256(bytes))
            }
            val model = JSONObject(File(temp, "marker_model.json").readText())
            require(model.optString("status") == "CANDIDATE_UNVERIFIED") { "Unexpected model status" }
            if (destination.exists()) {
                check(destination.isDirectory && destination.renameTo(old)) { "Cannot back up existing PPort model" }
                replaced = true
            }
            check(temp.renameTo(destination)) { "Cannot commit PPort model folder" }
            check(names.all { name -> File(destination, name).isFile &&
                sha256(File(destination, name).readBytes()) == hashes.getString(name) }) { "PPort final readback mismatch" }
            if (replaced && !old.deleteRecursively()) android.util.Log.w("PPortModels", "Previous model backup not removed: $id")
            return JSONObject().put("stored", true).put("id", id).put("verified", false)
                .put("replaced", replaced).put("relativePath", "PPort/PStart_$id")
                .put("absolutePath", destination.absolutePath).put("sha256", hashes)
        } catch (e: Exception) {
            // An older complete model must remain available if replacement fails.
            if (replaced && old.exists()) {
                if (destination.exists()) destination.deleteRecursively()
                if (!old.renameTo(destination)) android.util.Log.e("PPortModels", "Model rollback failed for $id", e)
            } else if (!replaced && destination.exists()) destination.deleteRecursively()
            throw e
        } finally {
            if (temp.exists()) temp.deleteRecursively()
        }
    }
    @Synchronized fun latest(ctx: Context): JSONObject {
        val folders = root(ctx).listFiles()?.filter { it.isDirectory && it.name.startsWith("PStart_") } ?: emptyList()
        for (dir in folders.sortedByDescending { it.lastModified() }) {
            try {
                val model = JSONObject(File(dir,"marker_model.json").readText())
                val scale = JSONObject(File(dir,"marker_scale.json").readText())
                val weighting = JSONObject(File(dir,"marker_weighting.json").readText())
                val png = File(dir,"marker_pattern.png").readBytes()
                return JSONObject().put("available",true).put("id",dir.name)
                    .put("model",model).put("scale",scale).put("weighting",weighting)
                    .put("patternBase64",Base64.encodeToString(png,Base64.NO_WRAP))
            } catch (_: Exception) { /* Ignore incomplete folders */ }
        }
        return JSONObject().put("available",false)
    }
}
