package com.cruisethecreek.signage

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager

/**
 * Fires at the scheduled wake / sleep times. Brings the kiosk to the front in
 * the right mode, then re-arms both alarms for the next day.
 */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val mode = if (intent.action == Schedule.ACTION_SLEEP)
            MainActivity.MODE_SLEEP else MainActivity.MODE_WAKE

        // On wake, kick the display on first — an alarm can fire while the stick
        // is fully asleep, and this wakelock is what turns the screen back on.
        if (mode == MainActivity.MODE_WAKE) {
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            @Suppress("DEPRECATION")
            val wl = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK or
                    PowerManager.ACQUIRE_CAUSES_WAKEUP or
                    PowerManager.ON_AFTER_RELEASE,
                "signage:wake"
            )
            wl.acquire(15_000L)   // held briefly; the activity keeps the screen on after this
        }

        val launch = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(MainActivity.EXTRA_MODE, mode)
        context.startActivity(launch)

        // Alarms set with setExact* are one-shot — line up tomorrow's now.
        Schedule.arm(context)
    }
}
