package com.potensic.proxy

import android.content.Context
import org.xmlpull.v1.XmlPullParser

/**
 * Central model/protocol profile selection.
 *
 * Model-specific constants live in res/xml/drone_protocol_profiles.xml so a single
 * ATOM / ATOM 2 selection can switch every known protocol difference together.
 */
class DroneProfileManager(private val context: Context) {

    data class Profile(
        val id: String,
        val displayName: String,
        val videoFeType: Int,
        val videoTransport: String,
        val stripBytesPerPacket: Int,
        val codec: String,
        val width: Int,
        val height: Int,
        val startMask: Int,
        val endMask: Int,
        val keyMask: Int,
        val magic: String?,
        val preferredCodec: String,
        val liveViewStartCommand: Int,
        val liveViewParamsCommand: Int,
        val idrCommand: Int,
    )

    private val prefs = context.getSharedPreferences("drone_protocol_profile", Context.MODE_PRIVATE)
    private val profiles: Map<String, Profile>
    private val defaultProfileId: String

    @Volatile private var currentProfileId: String

    init {
        val parsed = parseProfiles()
        profiles = parsed.second
        defaultProfileId = parsed.first
        val saved = prefs.getString("selected_profile", defaultProfileId) ?: defaultProfileId
        currentProfileId = if (profiles.containsKey(saved)) saved else defaultProfileId
        Log.i("[Profile] Loaded drone profile $currentProfileId (${current().videoTransport})")
    }

    fun current(): Profile = profiles[currentProfileId] ?: profiles[defaultProfileId]
        ?: error("No drone protocol profiles configured")

    fun all(): List<Profile> = profiles.values.toList()

    @Synchronized
    fun select(id: String): Profile? {
        val normalized = id.uppercase().replace('-', '_').replace(' ', '_')
        val profile = profiles[normalized] ?: return null
        currentProfileId = normalized
        prefs.edit().putString("selected_profile", normalized).apply()
        Log.i("[Profile] Selected ${profile.id}: transport=${profile.videoTransport} codec=${profile.codec}")
        return profile
    }

    private fun parseProfiles(): Pair<String, Map<String, Profile>> {
        val parser = context.resources.getXml(R.xml.drone_protocol_profiles)
        var defaultId = "ATOM"
        var currentId: String? = null
        var displayName = ""
        var videoFeType = 0x06
        var videoTransport = "w42"
        var stripBytes = 0
        var codec = "auto"
        var width = 1920
        var height = 1080
        var startMask = 0x08
        var endMask = 0x04
        var keyMask = 0x01
        var magic: String? = null
        var preferredCodec = "h265"
        var liveStart = 0x73
        var liveParams = 0xD8
        var idr = 0xD9
        val out = linkedMapOf<String, Profile>()

        var event = parser.eventType
        while (event != XmlPullParser.END_DOCUMENT) {
            if (event == XmlPullParser.START_TAG) {
                when (parser.name) {
                    "droneProfiles" -> defaultId = parser.getAttributeValue(null, "default") ?: defaultId
                    "profile" -> {
                        currentId = parser.getAttributeValue(null, "id")?.uppercase()
                        displayName = parser.getAttributeValue(null, "displayName") ?: currentId.orEmpty()
                        videoFeType = 0x06; videoTransport = "w42"; stripBytes = 0; codec = "auto"
                        width = 1920; height = 1080; startMask = 0x08; endMask = 0x04; keyMask = 0x01; magic = null
                        preferredCodec = "h265"; liveStart = 0x73; liveParams = 0xD8; idr = 0xD9
                    }
                    "video" -> {
                        videoFeType = parseInt(parser.getAttributeValue(null, "feType"), 0x06)
                        videoTransport = parser.getAttributeValue(null, "transport") ?: videoTransport
                        stripBytes = parseInt(parser.getAttributeValue(null, "stripBytesPerPacket"), 0)
                        codec = parser.getAttributeValue(null, "codec") ?: codec
                        width = parseInt(parser.getAttributeValue(null, "width"), width)
                        height = parseInt(parser.getAttributeValue(null, "height"), height)
                        startMask = parseInt(parser.getAttributeValue(null, "startMask"), startMask)
                        endMask = parseInt(parser.getAttributeValue(null, "endMask"), endMask)
                        keyMask = parseInt(parser.getAttributeValue(null, "keyMask"), keyMask)
                        magic = parser.getAttributeValue(null, "magic")
                    }
                    "camera" -> {
                        preferredCodec = parser.getAttributeValue(null, "preferredCodec") ?: preferredCodec
                        liveStart = parseInt(parser.getAttributeValue(null, "liveViewStartCommand"), liveStart)
                        liveParams = parseInt(parser.getAttributeValue(null, "liveViewParamsCommand"), liveParams)
                        idr = parseInt(parser.getAttributeValue(null, "idrCommand"), idr)
                    }
                }
            } else if (event == XmlPullParser.END_TAG && parser.name == "profile") {
                val id = currentId
                if (id != null) {
                    out[id] = Profile(id, displayName, videoFeType, videoTransport, stripBytes, codec, width, height,
                        startMask, endMask, keyMask, magic, preferredCodec, liveStart, liveParams, idr)
                }
                currentId = null
            }
            event = parser.next()
        }
        return defaultId.uppercase() to out
    }

    private fun parseInt(value: String?, fallback: Int): Int {
        if (value.isNullOrBlank()) return fallback
        return try {
            if (value.startsWith("0x", ignoreCase = true)) value.substring(2).toInt(16) else value.toInt()
        } catch (_: Exception) { fallback }
    }
}
