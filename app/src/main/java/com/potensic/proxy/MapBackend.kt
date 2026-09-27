package com.potensic.proxy

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.*

/** Backend-owned map configuration, token handling, tile proxy/cache and offline region downloader. */
class MapBackend(private val rootDir: File) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val mapDir = File(rootDir, "map").apply { mkdirs() }
    private val cacheDir = File(mapDir, "tiles").apply { mkdirs() }
    private val configFile = File(mapDir, "config.json")
    private val regionsFile = File(mapDir, "regions.json")
    private val jobs = ConcurrentHashMap<String, JSONObject>()
    private val maxTileBytes = 10 * 1024 * 1024
    private val mapboxTokenRegex = Regex("^(pk|sk|tk)\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$")

    @Volatile private var config: JSONObject = loadConfig()

    private data class HttpResult(
        val status: Int,
        val contentType: String?,
        val bytes: ByteArray?,
        val message: String?
    )

    private fun defaultConfig() = JSONObject().apply {
        put("provider", "osm")
        put("style", "street")
        put("tileUrlTemplate", "https://tile.openstreetmap.org/{z}/{x}/{y}.png")
        put("accessToken", "")
        put("mapboxStyle", "mapbox://styles/mapbox/streets-v12")
        put("attribution", "© OpenStreetMap contributors")
        put("defaultZoom", 15)
        put("autoCenter", true)
        put("orientation", "north")
        put("dataMode", "auto")
    }

    private fun loadConfig(): JSONObject = try {
        val loaded = if (configFile.exists()) JSONObject(configFile.readText()) else defaultConfig()
        // Add fields introduced after the first map integration without invalidating an existing config.
        if (!loaded.has("mapboxStyle")) loaded.put("mapboxStyle", "mapbox://styles/mapbox/streets-v12")
        loaded
    } catch (_: Exception) { defaultConfig() }

    fun versionInfo(): JSONObject = JSONObject().apply {
        put("projectVersion", "v0.6")
        put("appVersion", "0.6.0")
        put("backendVersion", "0.6.0")
        put("webUiVersion", "0.6.0")
        put("mapModuleVersion", "0.6.0")
        put("mapApiVersion", 2)
        put("buildDate", "2026-09-27")
    }

    @Synchronized fun publicConfig(): JSONObject = publicConfigOf(config)

    private fun publicConfigOf(source: JSONObject): JSONObject = JSONObject(source.toString()).apply {
        val token = source.optString("accessToken")
        put("accessToken", if (token.isNotBlank()) "********" else "")
        put("hasAccessToken", token.isNotBlank())
        put("tokenType", tokenType(token))
    }

    private fun tokenType(token: String): String = when {
        token.startsWith("pk.") -> "public"
        token.startsWith("sk.") -> "secret"
        token.startsWith("tk.") -> "temporary"
        token.isBlank() -> "none"
        else -> "unknown"
    }

    private fun mergeConfig(base: JSONObject, input: JSONObject): JSONObject {
        val next = JSONObject(base.toString())
        listOf("provider", "style", "tileUrlTemplate", "mapboxStyle", "attribution", "orientation", "dataMode").forEach {
            if (input.has(it)) next.put(it, input.getString(it))
        }
        if (input.has("defaultZoom")) next.put("defaultZoom", input.getInt("defaultZoom").coerceIn(1, 19))
        if (input.has("autoCenter")) next.put("autoCenter", input.getBoolean("autoCenter"))
        if (input.has("accessToken")) {
            val token = input.optString("accessToken")
            if (token != "********") next.put("accessToken", token.trim())
        }
        validateConfig(next)
        return next
    }

    private fun validateConfig(candidate: JSONObject) {
        val provider = candidate.optString("provider", "osm")
        require(provider in setOf("osm", "mapbox-satellite", "mapbox-style", "custom")) { "Unsupported map provider" }
        require(candidate.optString("orientation", "north") in setOf("north", "heading")) { "Invalid map orientation" }
        require(candidate.optString("dataMode", "auto") in setOf("auto", "offline", "online")) { "Invalid map data mode" }

        if (provider == "osm" || provider == "custom") {
            val template = candidate.optString("tileUrlTemplate")
            require(template.startsWith("https://") && template.contains("{z}") && template.contains("{x}") && template.contains("{y}")) {
                "Tile URL must be HTTPS and contain {z}, {x}, {y}"
            }
        }

        if (provider.startsWith("mapbox-")) {
            val token = candidate.optString("accessToken")
            require(token.isNotBlank()) { "Mapbox requires an access token" }
            require(mapboxTokenRegex.matches(token)) {
                "Mapbox token format is invalid. Supported token types start with pk., sk. or tk."
            }
        }

        if (provider == "mapbox-style") parseMapboxStyle(candidate.optString("mapboxStyle"))
    }

    @Synchronized fun updateConfig(input: JSONObject): JSONObject {
        val next = mergeConfig(config, input)
        config = next
        configFile.writeText(next.toString(2))
        return publicConfig()
    }

    /**
     * Tests the selected provider/resource without exposing the stored token back to the browser.
     * The optional input may contain a newly typed token; it is used only for this request and is not persisted.
     */
    @Synchronized fun testConnection(input: JSONObject): JSONObject {
        val candidate = mergeConfig(config, input)
        val provider = candidate.optString("provider", "osm")
        val token = candidate.optString("accessToken")
        val result = requestTile(candidate, 0, 0, 0, maxBytes = 2 * 1024 * 1024)
        val imageType = result.bytes?.let { guessContentType(it) } ?: "application/octet-stream"
        val ok = result.status in 200..299 && result.bytes != null && imageType != "application/octet-stream"
        return JSONObject().apply {
            put("ok", ok)
            put("provider", provider)
            put("tokenType", tokenType(token))
            put("httpStatus", result.status)
            put("resource", resourceLabel(candidate))
            put("contentType", if (ok) imageType else (result.contentType ?: ""))
            put("message", if (ok) "Map provider connection successful" else providerErrorMessage(result))
        }
    }

    private fun providerErrorMessage(result: HttpResult): String = when (result.status) {
        0 -> result.message ?: "Provider connection failed"
        401 -> "Map provider rejected the credentials/token (HTTP 401). Check the configured access token."
        403 -> "Map provider denied access (HTTP 403). For Mapbox, check token scopes, account state and token restrictions."
        404 -> "Requested map resource was not found (HTTP 404). Check the style or tileset."
        429 -> "Map provider rate limit reached (HTTP 429)."
        else -> result.message?.takeIf { it.isNotBlank() } ?: "Map provider returned HTTP ${result.status}"
    }

    private fun resourceLabel(candidate: JSONObject): String = when (candidate.optString("provider", "osm")) {
        "mapbox-satellite" -> "Mapbox Raster Tiles: mapbox.satellite"
        "mapbox-style" -> "Mapbox Static Tiles: ${candidate.optString("mapboxStyle")}"
        "osm" -> "OpenStreetMap public tiles"
        else -> "Custom XYZ tiles"
    }

    fun tile(z: Int, x: Int, y: Int): Pair<ByteArray, String>? {
        if (z !in 0..19) return null
        val n = 1 shl z
        if (x !in 0 until n || y !in 0 until n) return null
        val current = config
        val file = tileFile(current, z, x, y)
        if (file.exists()) {
            val bytes = file.readBytes()
            val type = guessContentType(bytes)
            if (type != "application/octet-stream") return bytes to type
            file.delete()
        }
        if (current.optString("dataMode", "auto") == "offline") return null
        val bytes = downloadTile(current, z, x, y) ?: return null
        file.parentFile?.mkdirs(); file.writeBytes(bytes)
        return bytes to guessContentType(bytes)
    }

    private fun downloadTile(candidate: JSONObject, z: Int, x: Int, y: Int): ByteArray? {
        val result = requestTile(candidate, z, x, y, maxTileBytes)
        if (result.status !in 200..299 || result.bytes == null) {
            Log.w("[Map] tile download failed z=$z x=$x y=$y: ${providerErrorMessage(result)}")
            return null
        }
        val bytes = result.bytes
        if (bytes.size > maxTileBytes || guessContentType(bytes) == "application/octet-stream") {
            Log.w("[Map] tile response is not a supported PNG/JPEG/WebP image")
            return null
        }
        return bytes
    }

    private fun requestTile(candidate: JSONObject, z: Int, x: Int, y: Int, maxBytes: Int): HttpResult {
        val url = buildTileUrl(candidate, z, x, y)
        return try {
            val conn = URL(url).openConnection() as HttpURLConnection
            conn.connectTimeout = 10000
            conn.readTimeout = 15000
            conn.setRequestProperty("User-Agent", "PotensicProxy-TAF/0.5")
            val status = conn.responseCode
            val contentType = conn.contentType
            if (status !in 200..299) {
                val message = try {
                    conn.errorStream?.bufferedReader()?.use { it.readText().take(1024) }
                } catch (_: Exception) { null }
                return HttpResult(status, contentType, null, message)
            }
            val declaredSize = conn.contentLengthLong
            if (declaredSize > maxBytes) return HttpResult(status, contentType, null, "Provider response is larger than the configured limit")
            val bytes = conn.inputStream.use { it.readNBytes(maxBytes + 1) }
            if (bytes.size > maxBytes) HttpResult(status, contentType, null, "Provider response is larger than the configured limit")
            else HttpResult(status, contentType, bytes, null)
        } catch (e: Exception) {
            HttpResult(0, null, null, e.message ?: "Provider connection failed")
        }
    }

    private fun buildTileUrl(candidate: JSONObject, z: Int, x: Int, y: Int): String {
        val provider = candidate.optString("provider", "osm")
        val token = URLEncoder.encode(candidate.optString("accessToken"), "UTF-8")
        return when (provider) {
            "mapbox-satellite" -> "https://api.mapbox.com/v4/mapbox.satellite/$z/$x/$y.jpg90?access_token=$token"
            "mapbox-style" -> {
                val (owner, styleId) = parseMapboxStyle(candidate.optString("mapboxStyle"))
                "https://api.mapbox.com/styles/v1/$owner/$styleId/tiles/256/$z/$x/$y?access_token=$token"
            }
            else -> candidate.optString("tileUrlTemplate")
                .replace("{z}", z.toString()).replace("{x}", x.toString()).replace("{y}", y.toString())
                .replace("{key}", token).replace("{token}", token)
        }
    }

    private fun parseMapboxStyle(raw: String): Pair<String, String> {
        val normalized = raw.trim().removePrefix("mapbox://styles/").trim('/')
        val parts = normalized.split('/').filter { it.isNotBlank() }
        require(parts.size == 2) { "Mapbox style must be mapbox://styles/{owner}/{style_id} or {owner}/{style_id}" }
        val owner = parts[0]
        val styleId = parts[1]
        require(owner.matches(Regex("[A-Za-z0-9_-]+")) && styleId.matches(Regex("[A-Za-z0-9_-]+"))) { "Invalid Mapbox style owner or style ID" }
        require(styleId != "standard" && styleId != "standard-satellite") {
            "Mapbox Standard and Standard Satellite are not supported by the Static Tiles API. Use Mapbox Satellite raster or a compatible Studio style."
        }
        return owner to styleId
    }

    private fun cacheNamespace(candidate: JSONObject): String {
        val identity = when (candidate.optString("provider", "osm")) {
            "mapbox-satellite" -> "mapbox-satellite|mapbox.satellite"
            "mapbox-style" -> "mapbox-style|${candidate.optString("mapboxStyle")}"
            else -> "${candidate.optString("provider")}|${candidate.optString("tileUrlTemplate")}"
        }
        val digest = MessageDigest.getInstance("SHA-256").digest(identity.toByteArray(Charsets.UTF_8))
        return digest.take(10).joinToString("") { "%02x".format(it) }
    }

    private fun tileFile(candidate: JSONObject, z: Int, x: Int, y: Int): File =
        File(cacheDir, "${cacheNamespace(candidate)}/$z/$x/$y.tile")

    private fun guessContentType(bytes: ByteArray): String = when {
        bytes.size >= 8 && bytes[0] == 0x89.toByte() && bytes[1] == 0x50.toByte() -> "image/png"
        bytes.size >= 3 && bytes[0] == 0xff.toByte() && bytes[1] == 0xd8.toByte() -> "image/jpeg"
        bytes.size >= 12 && String(bytes, 8, 4) == "WEBP" -> "image/webp"
        else -> "application/octet-stream"
    }

    @Synchronized fun regions(): JSONArray = try {
        if (regionsFile.exists()) JSONArray(regionsFile.readText()) else JSONArray()
    } catch (_: Exception) { JSONArray() }

    @Synchronized private fun saveRegion(region: JSONObject) {
        val all = regions(); val next = JSONArray()
        for (i in 0 until all.length()) if (all.getJSONObject(i).optString("id") != region.optString("id")) next.put(all.getJSONObject(i))
        next.put(region); regionsFile.writeText(next.toString(2))
    }

    fun startRegionDownload(input: JSONObject): JSONObject {
        // The public OpenStreetMap tile service explicitly prohibits bulk/offline prefetching.
        // Other providers remain subject to their own caching/offline terms.
        val current = JSONObject(config.toString())
        require(current.optString("provider") != "osm") {
            "Offline downloads are disabled for the public OpenStreetMap tile service. Select a provider whose terms allow offline/bulk downloads."
        }
        val lat = input.getDouble("latitude").coerceIn(-85.0, 85.0)
        val lon = input.getDouble("longitude").coerceIn(-180.0, 180.0)
        val radiusM = input.optDouble("radiusM", 5000.0).coerceIn(100.0, 50000.0)
        val minZoom = input.optInt("minZoom", 11).coerceIn(1, 19)
        val maxZoom = input.optInt("maxZoom", 16).coerceIn(minZoom, 19)
        val id = input.optString("id").ifBlank { "region_${System.currentTimeMillis()}" }.replace(Regex("[^A-Za-z0-9_-]"), "_")
        val region = JSONObject().apply {
            put("id", id); put("latitude", lat); put("longitude", lon); put("radiusM", radiusM)
            put("minZoom", minZoom); put("maxZoom", maxZoom); put("status", "downloading")
            put("provider", current.optString("provider")); put("resource", resourceLabel(current)); put("cacheNamespace", cacheNamespace(current))
            put("downloaded", 0); put("total", countTiles(lat, lon, radiusM, minZoom, maxZoom)); put("downloadedAt", JSONObject.NULL)
        }
        saveRegion(region); jobs[id] = region
        scope.launch {
            var done = 0; var errors = 0
            for (z in minZoom..maxZoom) {
                forEachRegionTile(lat, lon, radiusM, z) { x, y ->
                    val f = tileFile(current, z, x, y)
                    if (!f.exists()) {
                        val b = downloadTile(current, z, x, y)
                        if (b != null) { f.parentFile?.mkdirs(); f.writeBytes(b) } else errors++
                    }
                    done++
                    region.put("downloaded", done); region.put("errors", errors); jobs[id] = JSONObject(region.toString())
                    if (done % 25 == 0) saveRegion(region)
                }
            }
            region.put("status", if (errors == 0) "ready" else "ready_with_errors")
            region.put("downloadedAt", System.currentTimeMillis()); saveRegion(region); jobs[id] = JSONObject(region.toString())
        }
        return region
    }

    fun job(id: String): JSONObject? = jobs[id] ?: run {
        val a = regions(); for (i in 0 until a.length()) if (a.getJSONObject(i).optString("id") == id) return@run a.getJSONObject(i); null
    }

    @Synchronized fun deleteRegion(id: String): Boolean {
        val all = regions(); val next = JSONArray(); var found = false
        for (i in 0 until all.length()) { val r = all.getJSONObject(i); if (r.optString("id") == id) found = true else next.put(r) }
        if (found) regionsFile.writeText(next.toString(2)); jobs.remove(id); return found
    }

    private fun countTiles(lat: Double, lon: Double, radiusM: Double, minZ: Int, maxZ: Int): Int {
        var count = 0L
        for (z in minZ..maxZ) {
            forEachRegionTile(lat, lon, radiusM, z) { _, _ -> count++ }
        }
        return count.coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
    }

    private inline fun forEachRegionTile(lat: Double, lon: Double, radiusM: Double, z: Int, action: (Int, Int) -> Unit) {
        val range = tileRange(lat, lon, radiusM, z)
        for (x in range[0]..range[1]) for (y in range[2]..range[3]) {
            if (tileIntersectsCircle(x, y, z, lat, lon, radiusM)) action(x, y)
        }
    }

    private fun tileIntersectsCircle(x: Int, y: Int, z: Int, lat: Double, lon: Double, radiusM: Double): Boolean {
        val west = tileXToLon(x, z)
        val east = tileXToLon(x + 1, z)
        val north = tileYToLat(y, z)
        val south = tileYToLat(y + 1, z)
        val nearestLon = lon.coerceIn(min(west, east), max(west, east))
        val nearestLat = lat.coerceIn(min(south, north), max(south, north))
        return haversineMeters(lat, lon, nearestLat, nearestLon) <= radiusM
    }

    private fun tileXToLon(x: Int, z: Int): Double = x / 2.0.pow(z) * 360.0 - 180.0

    private fun tileYToLat(y: Int, z: Int): Double {
        val n = Math.PI - 2.0 * Math.PI * y / 2.0.pow(z)
        return Math.toDegrees(atan(sinh(n)))
    }

    private fun haversineMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val earthRadiusM = 6371008.8
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2).pow(2) + cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2).pow(2)
        return 2 * earthRadiusM * asin(sqrt(a.coerceIn(0.0, 1.0)))
    }

    private fun tileRange(lat: Double, lon: Double, radiusM: Double, z: Int): IntArray {
        val dLat = radiusM / 111320.0
        val dLon = radiusM / (111320.0 * cos(Math.toRadians(lat)).coerceAtLeast(0.05))
        val a = lonLatToTile(lon - dLon, lat + dLat, z); val b = lonLatToTile(lon + dLon, lat - dLat, z)
        val n = (1 shl z) - 1
        return intArrayOf(min(a.first,b.first).coerceIn(0,n), max(a.first,b.first).coerceIn(0,n), min(a.second,b.second).coerceIn(0,n), max(a.second,b.second).coerceIn(0,n))
    }

    private fun lonLatToTile(lon: Double, lat: Double, z: Int): Pair<Int,Int> {
        val n = 2.0.pow(z); val x = floor((lon + 180.0) / 360.0 * n).toInt()
        val lr = Math.toRadians(lat.coerceIn(-85.0511,85.0511)); val y = floor((1.0 - ln(tan(lr) + 1/cos(lr)) / Math.PI) / 2.0 * n).toInt()
        return x to y
    }
}
