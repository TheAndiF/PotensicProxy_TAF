package com.potensic.proxy

import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.content.IntentFilter
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.FileProvider
import com.potensic.proxy.core.DroneStateStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

/** Updates never send flight commands. Android remains the authority for installation. */
class UpdateManager(private val context: Context, private val drone: DroneStateStore) {
    companion object {
        private const val REPOSITORY = "TheAndiF/PotensicProxy_TAF"
        const val ACTION_INSTALL = "com.potensic.proxy.INSTALL_PREPARED_UPDATE"
        private const val CHANNEL = "potensic_updates"
    }
    private val prefs = context.getSharedPreferences("taf_app_updates", Context.MODE_PRIVATE)
    private val busy = AtomicBoolean(false)
    @Volatile private var cancel = false
    @Volatile private var percent = 0
    @Volatile private var phase = "idle"
    @Volatile private var error = ""
    private val storage get() = File(context.cacheDir, "taf-updates").apply { mkdirs() }
    private val destination get() = File(storage, "pending.apk")

    fun safetyReason(): String? {
        val battery = (context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager)
            .getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        val batteryStatus = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val chargeStatus = batteryStatus?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val isCharging = chargeStatus == BatteryManager.BATTERY_STATUS_CHARGING ||
            chargeStatus == BatteryManager.BATTERY_STATUS_FULL
        // Fail closed on unknown battery data. 20% always, or >=4% when charging.
        if (battery !in 0..100 || !(battery >= 20 || (battery >= 4 && isCharging)))
            return "Handy-Akku: mindestens 20 % oder mindestens 4 % bei aktivem Laden erforderlich (aktuell $battery %, lädt=$isCharging)."
        // A connected aircraft is not by itself unsafe. Never use default/old
        // telemetry values as proof of a safe grounded aircraft.
        val connected = drone.connection.linkReady || drone.connection.transportOpen ||
            ProxyService.instance?.wifiTransport?.isConnected == true
        val state = drone.telemetry
        if (state.flying || state.takingOff || state.landing || state.returning || state.unlocked)
            return "Flugbetrieb oder Motoren aktiv."
        if (connected) {
            val lastRx = drone.connection.lastRxMs
            val now = System.currentTimeMillis()
            if (!drone.connection.linkReady || lastRx <= 0 || lastRx > now || now - lastRx > 3000)
                return "Flugzustand nicht aktuell oder nicht eindeutig bestätigt."
        }
        return null
    }

    // A successful in-place replacement restarts the app. Confirm the installed
    // version on the next status request instead of assuming pm install success.
    private fun reconcileInstall() {
        val requested = prefs.getInt("install_requested_code", -1)
        if (requested <= 0) return
        if (BuildConfig.VERSION_CODE == requested) {
            prefs.edit().remove("install_requested_code").remove("candidate")
                .remove("candidate_code").remove("candidate_sha256").apply()
            unlockStartCommands()
            phase = "installed_verified"
            destination.delete()
        } else if (BuildConfig.VERSION_CODE > requested) {
            prefs.edit().remove("install_requested_code").apply()
            unlockStartCommands()
            phase = "installed_newer"
        }
    }

    fun startCommandsLocked(): Boolean = prefs.getBoolean("install_start_lock", false)

    private fun lockStartCommands() {
        prefs.edit().putBoolean("install_start_lock", true).commit()
    }
    private fun unlockStartCommands() {
        prefs.edit().putBoolean("install_start_lock", false).commit()
    }

    fun status(): JSONObject {
        reconcileInstall()
        return JSONObject().apply {
        put("version", BuildConfig.VERSION_NAME)
        put("versionCode", BuildConfig.VERSION_CODE)
        put("channel", if (BuildConfig.DEBUG) "BA_" else "stable")
        put("autoMode", prefs.getString("auto_mode", "notify"))
        put("installMethod", prefs.getString("install_method", "android"))
        put("headlessEnabled", prefs.getBoolean("headless_enabled", false))
        put("automaticInstall", prefs.getBoolean("automatic_install", false))
        put("phase", phase); put("progress", percent); put("error", error)
        put("startCommandsLocked", startCommandsLocked())
        put("pending", destination.isFile)
        put("blocker", safetyReason() ?: JSONObject.NULL)
        put("candidate", prefs.getString("candidate", ""))
        put("repository", REPOSITORY)
        put("installRequestedCode", prefs.getInt("install_requested_code", -1))
        }
    }
    fun setMode(mode: String) {
        require(mode in listOf("off", "notify", "download")) { "Invalid automatic update mode" }
        prefs.edit().putString("auto_mode", mode).apply()
    }
    fun setInstallOptions(method: String, headlessEnabled: Boolean, automaticInstall: Boolean) {
        require(method in listOf("android", "magisk", "auto")) { "Invalid installation method" }
        prefs.edit().putString("install_method", method).putBoolean("headless_enabled", headlessEnabled).putBoolean("automatic_install", automaticInstall).apply()
    }

    private fun rootAvailable(): Boolean = try {
        val proc = ProcessBuilder("su", "-c", "id -u").redirectErrorStream(true).start()
        val uid = proc.inputStream.bufferedReader().readText().trim()
        proc.waitFor() == 0 && uid == "0"
    } catch (_: Exception) { false }

    private fun startRootInstall() {
        require(prefs.getBoolean("headless_enabled", false)) { "Headless installation has not been explicitly authorized" }
        safetyReason()?.let { throw IllegalStateException(it) }
        verifyStagedUpdate()
        require(rootAvailable()) { "Magisk root not available or not authorized" }
        // Only the internally staged and cryptographically verified APK is accepted.
        // No user-supplied shell commands or paths are supported.
        val apk = destination.canonicalPath
        require(destination.canonicalFile.parentFile == storage.canonicalFile) { "Untrusted update location" }
        require(apk.matches(Regex("[a-zA-Z0-9_./-]+"))) { "Unsafe APK path" }
        prefs.edit().putInt("install_requested_code", prefs.getInt("candidate_code", -1)).apply()
        lockStartCommands()
        safetyReason()?.let { unlockStartCommands(); throw IllegalStateException(it) }
        phase = "installing_root"
        // The updating application process may be killed by PackageManager. Delegate
        // installation and service recovery to an independent root shell process.
        val packageName = context.packageName
        require(packageName.matches(Regex("[a-zA-Z0-9_.]+"))) { "Invalid package name" }
        val targetCode = prefs.getInt("install_requested_code", -1)
        require(targetCode > 0) { "Missing update version" }
        val script = File(storage, "install-and-restart.sh")
        script.writeText("""#!/system/bin/sh
pm install -r --user 0 '$apk'
result=${'$'}?
if [ "${'$'}result" -ne 0 ]; then
  log -t PotensicProxyUpdate "APK installation failed: ${'$'}result"
  exit "${'$'}result"
fi
sleep 3
# Verify the installed package version before restarting the foreground service.
installed=${'$'}(dumpsys package '$packageName' | grep -m 1 'versionCode=' | sed -n 's/.*versionCode=\([0-9]*\).*/\1/p')
if [ "${'$'}installed" != '$targetCode' ]; then
  log -t PotensicProxyUpdate "Version mismatch: installed=${'$'}installed expected=$targetCode"
  exit 1
fi
am start-foreground-service --user 0 -n '$packageName/.ProxyService'
result=${'$'}?
log -t PotensicProxyUpdate "ProxyService restart result=${'$'}result; AOA reconnect managed by service"
exit "${'$'}result"
""".trimIndent())
        val scriptPath = script.canonicalPath
        require(script.canonicalFile.parentFile == storage.canonicalFile) { "Invalid installer script location" }
        val installer = Thread {
            try {
                // nohup + background shell lets installation finish after our app process dies.
                val command = "nohup sh '$scriptPath' >/dev/null 2>&1 </dev/null &"
                val process = ProcessBuilder("su", "-c", command).redirectErrorStream(true).start()
                val output = process.inputStream.bufferedReader().readText().take(1000)
                if (process.waitFor() != 0) {
                    unlockStartCommands()
                    phase = "error"
                    error = "Root installer could not be started: $output"
                } else {
                    phase = "awaiting_restart"
                }
            } catch (e: Exception) {
                unlockStartCommands()
                phase = "error"
                error = e.message ?: "Root installer launch failed"
            }
        }
        installer.isDaemon = false
        installer.start()
    }

    private fun connection(url: String): HttpURLConnection {
        require(url.startsWith("https://")) { "Only HTTPS updates are permitted" }
        return (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15000; readTimeout = 30000
            setRequestProperty("User-Agent", "PotensicProxy_TAF-Android-Updater")
            instanceFollowRedirects = true
        }
    }
    private fun read(url: String): String {
        val c = connection(url)
        try {
            require(c.responseCode == 200) { "HTTP ${c.responseCode}" }
            return c.inputStream.bufferedReader().use { it.readText() }
        } finally { c.disconnect() }
    }
    suspend fun check(): JSONObject = withContext(Dispatchers.IO) {
        val releases = org.json.JSONArray(read("https://api.github.com/repos/$REPOSITORY/releases?per_page=25"))
        val requestedChannel = if (BuildConfig.DEBUG) "BA_" else "stable"
        var candidate: JSONObject? = null
        for (i in 0 until releases.length()) {
            val release = releases.getJSONObject(i)
            if (release.optBoolean("draft")) continue
            if (!BuildConfig.DEBUG || !release.optBoolean("prerelease")) continue
            if (!release.optString("tag_name").startsWith("ba-debug-")) continue
            val assets = release.optJSONArray("assets") ?: continue
            for (j in 0 until assets.length()) {
                val asset = assets.getJSONObject(j)
                if (asset.optString("name") != "taf-update-manifest.json") continue
                val data = JSONObject(read(asset.getString("browser_download_url")))
                if (data.optString("channel") != requestedChannel) continue
                if (data.optString("tag") != release.optString("tag_name")) continue
                if (!data.optString("apkUrl").startsWith("https://github.com/$REPOSITORY/releases/download/${release.optString("tag_name")}/")) continue
                if (!data.optString("sha256").matches(Regex("[0-9a-fA-F]{64}"))) continue
                if (data.optString("packageName") != context.packageName) continue
                if (data.optInt("versionCode") <= BuildConfig.VERSION_CODE) continue
                if (candidate == null || data.optInt("versionCode") > candidate.optInt("versionCode")) candidate = data
            }
        }
        JSONObject().apply { put("update", candidate ?: JSONObject.NULL); put("current", status()) }
    }
    suspend fun download(manifest: JSONObject): JSONObject = withContext(Dispatchers.IO) {
        if (!busy.compareAndSet(false, true)) throw IllegalStateException("Download already active")
        cancel = false; phase = "download"; percent = 0; error = ""
        val temp = File(storage, "download.part")
        try {
            // Never trust a manifest supplied by the browser: re-fetch from the fixed public repository.
            val authoritative = check().optJSONObject("update")
                ?: throw IllegalArgumentException("No approved BA update currently published")
            require(authoritative.toString() == manifest.toString() || (
                authoritative.optString("apkUrl") == manifest.optString("apkUrl") &&
                authoritative.optString("sha256").equals(manifest.optString("sha256"), ignoreCase = true) &&
                authoritative.optInt("versionCode") == manifest.optInt("versionCode") &&
                authoritative.optString("channel") == manifest.optString("channel")
            )) { "Update metadata does not match approved GitHub BA release" }
            require(manifest.getString("packageName") == context.packageName) { "Wrong app ID" }
            require(manifest.getInt("versionCode") > BuildConfig.VERSION_CODE) { "Version is not newer" }
            require(manifest.getString("channel") == (if (BuildConfig.DEBUG) "BA_" else "stable")) { "Wrong signing channel" }
            val url = manifest.getString("apkUrl")
            require(URL(url).host in setOf("github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com")) { "Invalid download host" }
            val expected = manifest.getString("sha256").lowercase()
            require(expected.matches(Regex("[0-9a-f]{64}"))) { "Invalid checksum" }
            val c = connection(url)
            try {
                require(c.responseCode == 200) { "Download HTTP ${c.responseCode}" }
                val total = c.contentLengthLong
                var received = 0L
                val hash = MessageDigest.getInstance("SHA-256")
                c.inputStream.use { input -> temp.outputStream().use { output ->
                    val buffer = ByteArray(65536)
                    while (true) {
                        if (cancel) throw InterruptedException("Download cancelled")
                        val n = input.read(buffer)
                        if (n < 0) break
                        output.write(buffer, 0, n); hash.update(buffer, 0, n)
                        received += n
                        if (total > 0) percent = (received * 100 / total).toInt().coerceIn(0,100)
                    }
                } }
                val digest = hash.digest().joinToString("") { "%02x".format(it) }
                require(digest == expected) { "APK checksum mismatch" }
            } finally { c.disconnect() }
            phase = "verify"
            verifyPackage(temp, manifest.getInt("versionCode"))
            destination.delete()
            require(temp.renameTo(destination)) { "Could not stage verified APK" }
            prefs.edit().putString("candidate", manifest.optString("versionName"))
                .putInt("candidate_code", manifest.getInt("versionCode"))
                .putString("candidate_sha256", expected).apply()
            phase = "ready"; percent = 100
            status()
        } catch (e: Exception) {
            temp.delete(); phase = if (cancel) "cancelled" else "error"; error = e.message ?: e.javaClass.simpleName
            throw e
        } finally { busy.set(false) }
    }
    /**
     * Android 9/10 package archive inspection may return null SigningInfo for a
     * correctly signed, not-yet-installed APK. Use archived legacy signatures
     * as a *read-only fallback*; never skip certificate comparison.
     */
    @Suppress("DEPRECATION")
    private fun signerDigests(info: android.content.pm.PackageInfo): Set<String> {
        val signatures = if (Build.VERSION.SDK_INT >= 28) {
            val signing = info.signingInfo
            val modern = if (signing != null) {
                signing.apkContentsSigners
            } else null
            if (!modern.isNullOrEmpty()) modern else info.signatures
        } else info.signatures
        return signatures?.map { signature ->
            MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())
                .joinToString("") { "%02x".format(it) }
        }?.toSet() ?: emptySet()
    }

    @Suppress("DEPRECATION")
    private fun verifyPackage(file: File, targetVersion: Int) {
        val pm = context.packageManager
        // Request both variants explicitly: Android 10 archive parsing sometimes
        // populates signatures but not signingInfo (or vice versa).
        val flags = PackageManager.GET_SIGNATURES or
            (if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else 0)
        val archive = pm.getPackageArchiveInfo(file.absolutePath, flags)
            ?: throw IllegalArgumentException("APK cannot be parsed by Android PackageManager")
        require(archive.packageName == context.packageName) { "APK package name mismatch" }
        val code = if (Build.VERSION.SDK_INT >= 28) archive.longVersionCode else archive.versionCode.toLong()
        require(code == targetVersion.toLong() && code > BuildConfig.VERSION_CODE) { "APK versionCode mismatch (installed=${BuildConfig.VERSION_CODE}, manifest=$targetVersion, apk=$code)" }
        val current = pm.getPackageInfo(context.packageName, flags)
        val from = signerDigests(current)
        val to = signerDigests(archive)
        require(from.isNotEmpty()) { "Installed APK certificate information unavailable" }
        require(to.isNotEmpty()) { "Downloaded APK certificate information unavailable; update blocked" }
        require(to == from) {
            "APK signing certificate differs from installed app (installed=${from.sorted().joinToString(",")}, update=${to.sorted().joinToString(",")})"
        }
    }
    fun abort() { cancel = true; if (!busy.get()) { destination.delete(); phase = "cancelled"; unlockStartCommands() } }
    fun requestInstall(): JSONObject {
        val method = prefs.getString("install_method", "android") ?: "android"
        // All installation methods share the same staged APK and verification.
        require(!busy.get()) { "Update currently downloading" }
        safetyReason()?.let { throw IllegalStateException(it) }
        verifyStagedUpdate()
        if (method == "magisk") {
            require(prefs.getBoolean("headless_enabled", false)) {
                "Magisk installation selected, but explicit root authorization is disabled"
            }
            require(rootAvailable()) { "Magisk root unavailable; choose Android installation explicitly" }
            startRootInstall()
            return status()
        }
        if (method == "auto" && prefs.getBoolean("headless_enabled", false) && rootAvailable()) {
            startRootInstall()
            return status()
        }
        // Android is the explicit fallback for auto, never for selected magisk.
        require(destination.isFile) { "No verified update prepared" }
        require(!busy.get()) { "Update currently downloading" }
        safetyReason()?.let { throw IllegalStateException(it) }
        verifyStagedUpdate()
        if (Build.VERSION.SDK_INT >= 26 && !context.packageManager.canRequestPackageInstalls())
            throw IllegalStateException("Android permission 'Install unknown apps' is required for PotensicProxy")
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            throw IllegalStateException("Benachrichtigungen sind nicht erlaubt. Bitte PotensicProxy am Handy öffnen und die Berechtigung erteilen.")
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "PotensicProxy updates", NotificationManager.IMPORTANCE_HIGH))
        val intent = Intent(context, MainActivity::class.java).apply { action = ACTION_INSTALL; flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP }
        val pending = PendingIntent.getActivity(context, 771, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle("PotensicProxy: Update bereit")
            .setContentText("Am Handy antippen, um die sichere Installation zu bestätigen")
            .setContentIntent(pending).setAutoCancel(true).build()
        manager.notify(771, notification)
        phase = "awaiting_user"; return status()
    }
    private fun verifyStagedUpdate() {
        require(destination.isFile) { "No update staged" }
        val expected = prefs.getString("candidate_sha256", "") ?: ""
        require(expected.matches(Regex("[0-9a-f]{64}"))) { "Missing signed update metadata" }
        val digest = MessageDigest.getInstance("SHA-256")
        destination.inputStream().use { input ->
            val buffer = ByteArray(65536)
            while (true) { val n = input.read(buffer); if (n < 0) break; digest.update(buffer, 0, n) }
        }
        require(digest.digest().joinToString("") { "%02x".format(it) } == expected) { "Staged APK was modified" }
        verifyPackage(destination, prefs.getInt("candidate_code", -1))
    }
    fun installFromActivity(activity: Activity) {
        require(destination.isFile) { "Update missing" }
        safetyReason()?.let { throw IllegalStateException(it) }
        verifyStagedUpdate()
        android.app.AlertDialog.Builder(activity)
            .setTitle("PotensicProxy aktualisieren")
            .setMessage("Bestätigen: Die Drohne steht sicher am Boden, die Motoren sind aus und kein Flugauftrag ist aktiv. Die App wird für das Update unterbrochen. Handy-Akku mindestens 20 % oder mindestens 4 % bei aktivem Laden erforderlich.")
            .setNegativeButton("Abbrechen", null)
            .setPositiveButton("Jetzt aktualisieren") { _, _ ->
                try {
                    safetyReason()?.let { throw IllegalStateException(it) }
                    verifyStagedUpdate()
                    val uri = FileProvider.getUriForFile(activity, "${context.packageName}.updatefiles", destination)
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(uri, "application/vnd.android.package-archive")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    prefs.edit().putInt("install_requested_code", prefs.getInt("candidate_code", -1)).apply()
                    lockStartCommands()
                    safetyReason()?.let { unlockStartCommands(); throw IllegalStateException(it) }
                    phase = "installing_android"
                    activity.startActivity(intent)
                } catch (e: Exception) {
                    unlockStartCommands()
                    android.app.AlertDialog.Builder(activity).setTitle("Installation gesperrt")
                        .setMessage(e.message ?: "Sicherheitsprüfung fehlgeschlagen")
                        .setPositiveButton("OK", null).show()
                }
            }.show()
    }
}
