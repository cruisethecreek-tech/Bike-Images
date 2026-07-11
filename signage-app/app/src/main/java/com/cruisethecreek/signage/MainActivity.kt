package com.cruisethecreek.signage

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Fullscreen kiosk that loads the signage web page and keeps it running.
 * No browser chrome, no address bar — just your signage, edge to edge.
 */
class MainActivity : Activity() {

    private lateinit var web: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Never let the TV sleep while signage is on screen.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        web = WebView(this)
        setContentView(web)

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
            mediaPlaybackRequiresUserGesture = false   // let videos autoplay
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        web.webChromeClient = WebChromeClient()
        web.webViewClient = object : WebViewClient() {
            // Keep every navigation inside the app.
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean = false

            // If the network hiccups, retry after a short delay instead of showing an error.
            @Deprecated("Deprecated but valid down to minSdk 21")
            override fun onReceivedError(view: WebView, errorCode: Int, description: String?, failingUrl: String?) {
                view.postDelayed({ view.reload() }, 10_000)
            }
        }

        web.loadUrl(getString(R.string.signage_url))
    }

    // Swallow the remote's Back button so the kiosk can't be exited by accident.
    @Deprecated("Intentional no-op for kiosk lockdown")
    override fun onBackPressed() { /* no-op */ }

    override fun onResume() {
        super.onResume()
        enterImmersive()
        web.onResume()
    }

    override fun onPause() {
        super.onPause()
        web.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enterImmersive()
    }

    @Suppress("DEPRECATION")
    private fun enterImmersive() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
    }
}
