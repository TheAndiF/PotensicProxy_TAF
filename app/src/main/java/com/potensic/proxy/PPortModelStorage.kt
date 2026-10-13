package com.potensic.proxy

import android.content.Context
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

/** SAF-backed public PPort models. Display-only assets; never issues flight commands. */
object PPortModelStorage {
    private val names = setOf("marker_pattern.png", "marker_model.json", "marker_scale.json", "marker_quality.json", "marker_weighting.json")
    private const val PUBLIC_MODELS = "Auto/PPort"
    private fun validId(id: String) = id.matches(Regex("[A-Za-z0-9_-]{1,120}"))
    private fun sha256(bytes: ByteArray) = MessageDigest.getInstance("SHA-256")
        .digest(bytes).joinToString("") { "%02x".format(it) }
    @Synchronized fun store(ctx: Context, id: String, payload: JSONObject): JSONObject {
        require(validId(id)) { "Invalid model ID" }
        val src = payload.getJSONObject("files")
        require(names.all { src.has(it) }) { "Incomplete model files" }
        PStartSafStorage.ensureProjectStructure(ctx)
        val relativeDir = "$PUBLIC_MODELS/PStart_$id"
        val hashes = JSONObject()
        val oldBytes = mutableMapOf<String, ByteArray>()
        for (name in names) {
            try { oldBytes[name] = PStartSafStorage.readProjectFile(ctx, relativeDir, name) }
            catch (_: Exception) { /* First publish or incomplete previous model */ }
        }
        val staged = linkedMapOf<String, ByteArray>()
        for (name in names) {
            val bytes = Base64.decode(src.getString(name), Base64.DEFAULT)
            require(bytes.isNotEmpty() && bytes.size < 12_000_000) { "Invalid model file size: $name" }
            staged[name] = bytes
            hashes.put(name, sha256(bytes))
        }
        val model = JSONObject(String(staged.getValue("marker_model.json"), Charsets.UTF_8))
        model.put("patternFile", "marker_pattern.png")
        model.put("scaleFile", "marker_scale.json")
        model.put("qualityFile", "marker_quality.json")
        model.put("weightingFile", "marker_weighting.json")
        staged["marker_model.json"] = model.toString(2).toByteArray(Charsets.UTF_8)
        hashes.put("marker_model.json", sha256(staged.getValue("marker_model.json")))
        require(model.optString("status") == "CANDIDATE_UNVERIFIED") { "Unexpected model status" }
        try {
            for ((name, bytes) in staged) {
                val mime = if (name.endsWith(".png")) "image/png" else "application/json"
                val saved = PStartSafStorage.putFile(ctx, relativeDir, name, mime, bytes)
                check(saved.optBoolean("verified")) { "PPort write not verified: $name" }
                val read = PStartSafStorage.readProjectFile(ctx, relativeDir, name)
                check(sha256(read) == hashes.getString(name)) { "PPort readback mismatch: $name" }
                android.util.Log.i("PPortModels", "Saved $relativeDir/$name verified=true")
            }
        } catch (e: Exception) {
            // Roll back previously existing model assets when the provider permits it.
            for ((name, bytes) in oldBytes) try {
                val mime = if (name.endsWith(".png")) "image/png" else "application/json"
                PStartSafStorage.putFile(ctx, relativeDir, name, mime, bytes)
            } catch (rollback: Exception) {
                android.util.Log.e("PPortModels", "Rollback failed: $relativeDir/$name", rollback)
            }
            throw IllegalStateException("PPort publish incomplete: ${e.message}", e)
        }
        return JSONObject().put("stored", true).put("id", id).put("verified", false)
            .put("replaced", oldBytes.isNotEmpty()).put("relativePath", "Documents/Potensic Proxy/$relativeDir")
            .put("sha256", hashes)

    }
    @Synchronized fun latest(ctx: Context): JSONObject {
        val folders = PStartSafStorage.projectSubfolders(ctx, PUBLIC_MODELS)
            .filter { it.startsWith("PStart_") }.sortedDescending()
        for (folder in folders) {
            try {
                val path = "$PUBLIC_MODELS/$folder"
                val model = JSONObject(String(PStartSafStorage.readProjectFile(ctx,path,"marker_model.json"), Charsets.UTF_8))
                // Older exported models may still reference *_analysis files that do not exist in PPort.
                model.put("patternFile", "marker_pattern.png")
                model.put("scaleFile", "marker_scale.json")
                model.put("qualityFile", "marker_quality.json")
                model.put("weightingFile", "marker_weighting.json")
                val scale = JSONObject(String(PStartSafStorage.readProjectFile(ctx,path,"marker_scale.json"), Charsets.UTF_8))
                val weighting = JSONObject(String(PStartSafStorage.readProjectFile(ctx,path,"marker_weighting.json"), Charsets.UTF_8))
                // Treat incomplete candidate models as unavailable.
                PStartSafStorage.readProjectFile(ctx,path,"marker_quality.json")
                val png = PStartSafStorage.readProjectFile(ctx,path,"marker_pattern.png")
                return JSONObject().put("available",true).put("id",folder)
                    .put("model",model).put("scale",scale).put("weighting",weighting)
                    .put("patternBase64",Base64.encodeToString(png,Base64.NO_WRAP))
            } catch (e: Exception) { android.util.Log.w("PPortModels", "Skipping incomplete $folder", e) }
        }
        return JSONObject().put("available",false)
    }
}
