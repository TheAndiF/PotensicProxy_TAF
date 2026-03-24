package com.potensic.proxy

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle

/**
 * Minimal launcher activity.
 * Starts the ProxyService and finishes — all interaction via web UI on :9090.
 */
class MainActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.i("[MainActivity] onCreate — intent: ${intent?.action}")

        // Start the proxy service
        val serviceIntent = Intent(this, ProxyService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }

        Log.i("[MainActivity] ProxyService started, finishing activity")
        Log.i("[MainActivity] Open http://<phone-ip>:9090 for web UI")

        // Show a toast with the URL
        val wifiManager = applicationContext.getSystemService(android.content.Context.WIFI_SERVICE) as android.net.wifi.WifiManager
        @Suppress("DEPRECATION")
        val ip = android.text.format.Formatter.formatIpAddress(wifiManager.connectionInfo.ipAddress)
        Log.i("[MainActivity] Phone IP: $ip")
        android.widget.Toast.makeText(this, "Potensic Proxy: http://$ip:9090", android.widget.Toast.LENGTH_LONG).show()

        finish()
    }
}
