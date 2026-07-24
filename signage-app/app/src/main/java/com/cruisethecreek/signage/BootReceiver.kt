package com.cruisethecreek.signage

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * After the TV finishes booting: re-arm the daily on/off alarms (they don't
 * survive a reboot) and relaunch the signage in whichever mode fits the current
 * time — so a power blip mid-day comes back to signage, and one overnight comes
 * back to a black, sleeping screen.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Schedule.arm(context)

            val mode = if (Schedule.shouldBeAwakeNow())
                MainActivity.MODE_WAKE else MainActivity.MODE_SLEEP

            val launch = Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra(MainActivity.EXTRA_MODE, mode)
            context.startActivity(launch)
        }
    }
}
