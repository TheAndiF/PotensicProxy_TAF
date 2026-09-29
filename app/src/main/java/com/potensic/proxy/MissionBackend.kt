package com.potensic.proxy

import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.math.*

/** Persistent TAF mission storage and isolated Potensic ATOM 1 map.db exporter. */
class MissionBackend(filesDir: File) {
    private val missionsDir = File(filesDir, "missions").apply { mkdirs() }
    private val exportsDir = File(missionsDir, "exports").apply { mkdirs() }

    @Synchronized
    fun list(): JSONArray {
        val out = JSONArray()
        missionsDir.listFiles { f -> f.isFile && f.extension == "json" }?.sortedByDescending { it.lastModified() }?.forEach { file ->
            runCatching {
                val obj = JSONObject(file.readText())
                out.put(JSONObject()
                    .put("id", obj.optString("id", file.nameWithoutExtension))
                    .put("name", obj.optString("name", "Mission"))
                    .put("aircraftProfile", obj.optString("aircraftProfile", "ATOM_1"))
                    .put("waypointCount", obj.optJSONArray("waypoints")?.length() ?: 0)
                    .put("updatedAt", obj.optString("updatedAt", "")))
            }
        }
        return out
    }

    @Synchronized
    fun load(id: String): JSONObject? {
        val file = missionFile(id)
        if (!file.exists()) return null
        return JSONObject(file.readText())
    }

    @Synchronized
    fun save(id: String, input: JSONObject): JSONObject {
        val safeId = safeId(id)
        val now = java.time.Instant.now().toString()
        val normalized = JSONObject(input.toString())
        normalized.put("id", safeId)
        if (!normalized.has("version")) normalized.put("version", 1)
        if (!normalized.has("aircraftProfile")) normalized.put("aircraftProfile", "ATOM_1")
        if (!normalized.has("createdAt")) normalized.put("createdAt", now)
        normalized.put("updatedAt", now)
        if (!normalized.has("waypoints")) normalized.put("waypoints", JSONArray())
        val target = missionFile(safeId)
        val tmp = File(target.parentFile, target.name + ".tmp")
        tmp.writeText(normalized.toString(2))
        if (target.exists()) target.delete()
        if (!tmp.renameTo(target)) {
            target.writeText(normalized.toString(2))
            tmp.delete()
        }
        return normalized
    }

    @Synchronized
    fun delete(id: String): Boolean = missionFile(id).delete()

    @Synchronized
    fun exportAtom1(id: String): File {
        val mission = load(id) ?: throw IllegalArgumentException("Mission not found")
        val waypoints = mission.optJSONArray("waypoints") ?: JSONArray()
        if (waypoints.length() == 0) throw IllegalArgumentException("Mission has no waypoints")
        val out = File(exportsDir, "${safeId(id)}-map.db")
        if (out.exists()) out.delete()
        val db = SQLiteDatabase.openOrCreateDatabase(out, null)
        try {
            db.execSQL("PRAGMA page_size = 4096")
            db.execSQL("PRAGMA encoding = 'UTF-8'")
            val creates = arrayOf(
                "CREATE TABLE android_metadata (locale TEXT)",
                "CREATE TABLE flightlog (id integer primary key autoincrement,null_lpcolumn integer, isupload integer, length integer, name text)",
                "CREATE TABLE flightnotes (id integer primary key autoincrement,null_lpcolumn integer, distance real, duration integer, height real, speed real, starttime integer)",
                "CREATE TABLE flightrecordbean (id integer primary key autoincrement,date text, duration integer, height text, mileage text, num integer, speed text)",
                "CREATE TABLE multipointbean (id integer primary key autoincrement,flightrecordbean_id integer, lat real, lng real)",
                "CREATE TABLE table_schema (id integer primary key autoincrement,name text, type integer)",
                "CREATE TABLE uomrecord (id integer primary key autoincrement,sorties integer, uomstatechangedtime integer, uomstateenumname text)",
                "CREATE TABLE uomuploadbody (id integer primary key autoincrement,altitude integer, course integer, flightenumname text, flightsorties integer, flightstatusenumname text, gs integer, height integer, latitude integer, longitude integer, sn text, timemillis integer, vs integer)"
            )
            creates.forEach(db::execSQL)
            db.execSQL("INSERT INTO android_metadata (locale) VALUES ('en_US_#u-mu-celsius')")
            arrayOf("flightrecordbean", "multipointbean", "flightnotes", "flightlog", "uomuploadbody", "uomrecord").forEach { name ->
                val cv = ContentValues().apply { put("name", name); put("type", 0) }
                db.insertOrThrow("table_schema", null, cv)
            }
            db.execSQL("PRAGMA user_version = 5")

            val name = mission.optString("name", "mission").trim().ifBlank { "mission" }
            val chunkSize = 45
            var offset = 0
            var chunkIndex = 0
            while (offset < waypoints.length()) {
                val end = min(offset + chunkSize, waypoints.length())
                val chunk = (offset until end).map { waypoints.getJSONObject(it) }
                val mileage = pathLength(chunk)
                val speed = chunk.map { it.optDouble("speed", 0.0) }.filter { it > 0 }.average().let { if (it.isNaN()) 0.0 else it }
                val height = chunk.map { it.optDouble("altitude", 0.0) }.average().let { if (it.isNaN()) 0.0 else it }
                val duration = if (speed > 0) mileage / speed else 0.0
                val label = if (waypoints.length() <= chunkSize) name else "$name ${String.format("%03d", offset + 1)}-${String.format("%03d", end)}"
                val record = ContentValues().apply {
                    put("date", label); put("duration", duration.roundToInt()); put("height", height.toString())
                    put("mileage", String.format(java.util.Locale.US, "%.1f", mileage)); put("num", chunk.size); put("speed", speed.toString())
                }
                val recordId = db.insertOrThrow("flightrecordbean", null, record)
                chunk.forEach { wp ->
                    val point = ContentValues().apply {
                        put("flightrecordbean_id", recordId)
                        put("lat", wp.getDouble("latitude")); put("lng", wp.getDouble("longitude"))
                    }
                    db.insertOrThrow("multipointbean", null, point)
                }
                offset = end; chunkIndex++
            }
            db.rawQuery("PRAGMA user_version", null).use { if (!it.moveToFirst() || it.getInt(0) != 5) throw IllegalStateException("map.db user_version verification failed") }
        } finally {
            db.close()
        }
        return out
    }

    private fun missionFile(id: String) = File(missionsDir, "${safeId(id)}.json")
    private fun safeId(id: String): String {
        val safe = id.replace(Regex("[^A-Za-z0-9._-]"), "_").take(120)
        require(safe.isNotBlank() && safe != "." && safe != "..") { "Invalid mission id" }
        return safe
    }

    private fun pathLength(points: List<JSONObject>): Double {
        var total = 0.0
        for (i in 1 until points.size) total += distance(points[i - 1], points[i])
        return total
    }
    private fun distance(a: JSONObject, b: JSONObject): Double {
        val r = 6_371_008.8
        val lat1 = Math.toRadians(a.getDouble("latitude")); val lat2 = Math.toRadians(b.getDouble("latitude"))
        val dLat = lat2 - lat1; val dLon = Math.toRadians(b.getDouble("longitude") - a.getDouble("longitude"))
        val h = sin(dLat / 2).pow(2) + cos(lat1) * cos(lat2) * sin(dLon / 2).pow(2)
        return 2 * r * asin(min(1.0, sqrt(h)))
    }
}
