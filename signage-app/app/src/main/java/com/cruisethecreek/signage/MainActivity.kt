package com.cruisethecreek.signage

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout

/**
 * Fullscreen kiosk that loads the signage web page and keeps it running.
 * No browser chrome, no address bar — just your signage, edge to edge.
 *
 * A daily schedule (see [Schedule]) wakes the screen in the morning and blanks
 * it to black at night so the stick can sleep — all on its own, unattended.
 */
class MainActivity : Activity() {

    companion object {
        const val EXTRA_MODE = "mode"
        const val MODE_WAKE  = "wake"
        const val MODE_SLEEP = "sleep"
    }

    private lateinit var web: WebView
    private lateinit var blackout: View

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // When an alarm brings us up from standby, wake the screen and show over
        // any lock/keyguard. (Window flags below cover the older Fire OS builds.)
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                or WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                or WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        )

        val root = FrameLayout(this)

        web = WebView(this)
        root.addView(web)

        // A full-screen black cover shown during off-hours.
        blackout = View(this).apply {
            setBackgroundColor(Color.BLACK)
            visibility = View.GONE
        }
        root.addView(blackout)

        setContentView(root)

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

        // Make sure the daily on/off alarms are set.
        Schedule.arm(this)

        // Honor the mode we were launched in (default: awake and showing signage).
        applyMode(intent?.getStringExtra(EXTRA_MODE) ?: MODE_WAKE, initial = true)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        applyMode(intent?.getStringExtra(EXTRA_MODE) ?: MODE_WAKE, initial = false)
    }

    /** Switch between showing the signage (wake) and a black, sleep-friendly screen. */
    private fun applyMode(mode: String, initial: Boolean) {
        if (mode == MODE_SLEEP) {
            blackout.visibility = View.VISIBLE
            web.onPause()
            // Stop holding the screen awake so the stick can idle-sleep, which in
            // turn tells the TV to go to standby over HDMI-CEC.
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
            blackout.visibility = View.GONE
            window.addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                    or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
            web.onResume()
            enterImmersive()
            // On the morning wake, pull a fresh copy so the day starts current.
            if (!initial) web.reload()
        }
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
