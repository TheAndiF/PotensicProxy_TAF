package com.potensic.proxy

import android.content.Context
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

/** SAF-backed public PPort models. Display-only assets; never issues flight commands. */
object PPortModelStorage {
    private val names = setOf("marker_pattern.png", "marker_model.json", "marker_scale.json", "marker_quality.json", "marker_weighting.json", "marker_ideal.svg", "marker_ideal.json")
    private const val PUBLIC_MODELS = "Auto/PPort"
    private val idealSvgTemplate = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 560"><rect x="80" y="80" width="400" height="400" fill="white"/><rect x="94" y="94" width="372" height="372" fill="none" stroke="#111" stroke-width="24"/><path d="M396 396H466V466H396Z" fill="#111"/><rect x="185" y="185" width="190" height="190" fill="none" stroke="#222" stroke-width="10"/><path d="M280 222V338M222 280H338" stroke="#222" stroke-width="12"/></svg>"""
    private val idealMetadataTemplate = JSONObject().put("schemaVersion",1).put("kind","SCHEMATIC_IDEAL_REFERENCE")
        .put("unit","normalized").put("viewBox",org.json.JSONArray(listOf(0,0,560,560)))
        .put("markerBounds",org.json.JSONArray(listOf(80,80,400,400)))
        .put("dominantBlackCorner","bottom-right").put("physicalSizeVerified",false)
        .put("geometryVerified",false).put("source","PLand reference sketch")
        .put("use","DISPLAY_ONLY").put("svgFile","marker_ideal.svg")
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
        val ideal = JSONObject(String(staged.getValue("marker_ideal.json"), Charsets.UTF_8))
        require(ideal.optString("kind") == "SCHEMATIC_IDEAL_REFERENCE" && !ideal.optBoolean("physicalSizeVerified")) { "Ideal geometry must be labeled schematic" }
        require(String(staged.getValue("marker_ideal.svg"), Charsets.UTF_8).startsWith("<svg ")) { "Invalid ideal SVG" }
        require(model.optString("status") == "CANDIDATE_UNVERIFIED") { "Unexpected model status" }
        try {
            for ((name, bytes) in staged) {
                val mime = if (name.endsWith(".png")) "image/png" else if (name.endsWith(".svg")) "image/svg+xml" else "application/json"
                val saved = PStartSafStorage.putFile(ctx, relativeDir, name, mime, bytes)
                check(saved.optBoolean("verified")) { "PPort write not verified: $name" }
                val read = PStartSafStorage.readProjectFile(ctx, relativeDir, name)
                check(sha256(read) == hashes.getString(name)) { "PPort readback mismatch: $name" }
                android.util.Log.i("PPortModels", "Saved $relativeDir/$name verified=true")
            }
        } catch (e: Exception) {
            // Roll back previously existing model assets when the provider permits it.
            for ((name, bytes) in oldBytes) try {
                val mime = if (name.endsWith(".png")) "image/png" else if (name.endsWith(".svg")) "image/svg+xml" else "application/json"
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
                // Upgrade older PPort sessions lazily; measured model assets are untouched.
                val idealSvg = try {
                    val current = String(PStartSafStorage.readProjectFile(ctx,path,"marker_ideal.svg"), Charsets.UTF_8)
                    PStartSafStorage.readProjectFile(ctx,path,"marker_ideal.json")
                    current
                } catch (_: Exception) {
                    try {
                        for ((name, bytes, mime) in listOf(
                            Triple("marker_ideal.svg", idealSvgTemplate.toByteArray(Charsets.UTF_8), "image/svg+xml"),
                            Triple("marker_ideal.json", idealMetadataTemplate.toString(2).toByteArray(Charsets.UTF_8), "application/json")
                        )) {
                            val result = PStartSafStorage.putFile(ctx,path,name,mime,bytes)
                            check(result.optBoolean("verified")) { "Ideal-model save not verified: $name" }
                            check(sha256(PStartSafStorage.readProjectFile(ctx,path,name)) == sha256(bytes)) { "Ideal-model readback mismatch: $name" }
                        }
                        android.util.Log.i("PPortModels", "Generated schematic ideal model for $path")
                        idealSvgTemplate
                    } catch (e: Exception) {
                        android.util.Log.w("PPortModels", "Unable to write ideal references for $path", e)
                        ""
                    }
                }
                return JSONObject().put("available",true).put("id",folder)
                    .put("model",model).put("scale",scale).put("weighting",weighting)
                    .put("patternBase64",Base64.encodeToString(png,Base64.NO_WRAP))
                    .put("idealSvg",idealSvg)
            } catch (e: Exception) { android.util.Log.w("PPortModels", "Skipping incomplete $folder", e) }
        }
        return JSONObject().put("available",false)
    }
}
