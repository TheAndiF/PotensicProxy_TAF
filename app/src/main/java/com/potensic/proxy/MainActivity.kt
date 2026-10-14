package com.potensic.proxy

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.os.Build
import android.os.Bundle

/**
 * Minimal launcher activity.
 * Starts the ProxyService and finishes — all interaction via web UI on :9090.
 */
class MainActivity : Activity() {

    private fun requestNotificationPermissionOrFinish() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 771)
        } else finish()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 771) finish()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.action == UpdateManager.ACTION_INSTALL) {
            try {
                UpdateManager(this, ProxyService.instance?.droneState
                    ?: throw IllegalStateException("Flight safety status unavailable"))
                    .installFromActivity(this)
            } catch (e: Exception) {
                AlertDialog.Builder(this).setTitle("Update gesperrt")
                    .setMessage(e.message ?: "Sicherheitsprüfung fehlgeschlagen")
                    .setPositiveButton("OK", null).show()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i("[MainActivity] onCreate — intent: ${intent?.action}")

        if (intent?.action == UpdateManager.ACTION_INSTALL) {
            try {
                val service = ProxyService.instance
                val manager = UpdateManager(this, service?.droneState
                    ?: throw IllegalStateException("Flight safety status not available"))
                manager.installFromActivity(this)
            } catch (e: Exception) {
                AlertDialog.Builder(this).setTitle("Update gesperrt")
                    .setMessage(e.message ?: "Sicherheitsprüfung fehlgeschlagen")
                    .setPositiveButton("OK", null).show()
            }
            return
        }

        // Start the proxy service
        val serviceIntent = Intent(this, ProxyService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }

        Log.i("[MainActivity] ProxyService started; checking SAF setup")
        Log.i("[MainActivity] Open http://<phone-ip>:9090 for web UI")

        // Show a toast with the URL
        val wifiManager = applicationContext.getSystemService(android.content.Context.WIFI_SERVICE) as android.net.wifi.WifiManager
        @Suppress("DEPRECATION")
        val ip = android.text.format.Formatter.formatIpAddress(wifiManager.connectionInfo.ipAddress)
        Log.i("[MainActivity] Phone IP: $ip")
        android.widget.Toast.makeText(this, getString(R.string.toast_web_ui, ip), android.widget.Toast.LENGTH_LONG).show()

        if (PStartSafStorage.hasPermission(this)) {
            requestNotificationPermissionOrFinish()
        } else {
            AlertDialog.Builder(this)
                .setTitle("PotensicProxy – Speicherfreigabe")
                .setMessage("Für PStart-Aufnahmen und gespeicherte Kameramedien wird der Ordner Documents/PotensicProxy benötigt. Bitte diesen Ordner im Android-Dateidialog auswählen oder erstellen und den Zugriff erlauben. Die Freigabe bleibt gespeichert. Web-Downloads bleiben unverändert.")
                .setPositiveButton("Ordner freigeben") { _, _ ->
                    PStartSafStorage.request(this)
                    finish()
                }
                .setNegativeButton("Später") { _, _ -> finish() }
                .setCancelable(false)
                .show()
        }
    }
}
