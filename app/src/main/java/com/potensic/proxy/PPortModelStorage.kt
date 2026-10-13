package com.potensic.proxy

import android.content.Context
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

/** App-private PPort cache. Only data artifacts; never issues flight commands. */
object PPortModelStorage {
    private val names = setOf("marker_pattern.png", "marker_model.json", "marker_scale.json", "marker_quality.json", "marker_weighting.json")
    private fun root(ctx: Context) = File(ctx.filesDir, "PPort").apply { mkdirs() }
    private fun validId(id: String) = id.matches(Regex("[A-Za-z0-9_-]{1,120}"))
    @Synchronized fun store(ctx: Context, id: String, payload: JSONObject): JSONObject {
        require(validId(id)) { "Invalid model ID" }
        val src = payload.getJSONObject("files")
        require(names.all { src.has(it) }) { "Incomplete model files" }
        val destination = File(root(ctx), "PStart_$id")
        require(!destination.exists()) { "Model ID already exists" }
        val temp = File(root(ctx), ".pending_$id")
        require(!temp.exists() && temp.mkdir()) { "Cannot create staging directory" }
        try {
            for (name in names) {
                val bytes = Base64.decode(src.getString(name), Base64.DEFAULT)
                require(bytes.isNotEmpty() && bytes.size < 12_000_000) { "Invalid model file size: $name" }
                File(temp, name).writeBytes(bytes)
            }
            val model = JSONObject(File(temp, "marker_model.json").readText())
            require(model.optString("status") == "CANDIDATE_UNVERIFIED") { "Unexpected model status" }
            require(temp.renameTo(destination)) { "Cannot commit model folder" }
            return JSONObject().put("stored",true).put("id",id).put("verified",false)
        } finally { if (temp.exists()) temp.deleteRecursively() }
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
