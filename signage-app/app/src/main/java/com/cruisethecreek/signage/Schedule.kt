package com.cruisethecreek.signage

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

/**
 * Daily on/off schedule for the signage.
 *
 * The TVs blank out at night and wake themselves back up in the morning — no
 * one has to be on-site. To change the hours, edit the four numbers below
 * (24-hour clock) and rebuild the APK.
 */
object Schedule {

    // ── Edit these to change the daily hours (24-hour time) ──────────
    const val WAKE_HOUR  = 8     // 08:00 → signage on
    const val WAKE_MIN   = 0
    const val SLEEP_HOUR = 18    // 18:00 → black screen, let the TV sleep
    const val SLEEP_MIN  = 0
    // ─────────────────────────────────────────────────────────────────

    const val ACTION_WAKE  = "com.cruisethecreek.signage.WAKE"
    const val ACTION_SLEEP = "com.cruisethecreek.signage.SLEEP"

    private const val REQ_WAKE  = 1001
    private const val REQ_SLEEP = 1002

    /** Arm (or re-arm) both daily alarms. Safe to call as often as you like. */
    fun arm(context: Context) {
        scheduleDaily(context, WAKE_HOUR, WAKE_MIN, ACTION_WAKE, REQ_WAKE)
        scheduleDaily(context, SLEEP_HOUR, SLEEP_MIN, ACTION_SLEEP, REQ_SLEEP)
    }

    /** True if the current time is inside the on-window (wake ≤ now < sleep). */
    fun shouldBeAwakeNow(): Boolean {
        val now = Calendar.getInstance()
        val mins  = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
        val wake  = WAKE_HOUR * 60 + WAKE_MIN
        val sleep = SLEEP_HOUR * 60 + SLEEP_MIN
        return if (wake <= sleep) mins in wake until sleep
               else mins >= wake || mins < sleep     // handles windows that cross midnight
    }

    private fun scheduleDaily(context: Context, hour: Int, minute: Int, action: String, requestCode: Int) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        val intent = Intent(context, AlarmReceiver::class.java).setAction(action)
        var flags = PendingIntent.FLAG_UPDATE_CURRENT
        if (Build.VERSION.SDK_INT >= 23) flags = flags or PendingIntent.FLAG_IMMUTABLE
        val pi = PendingIntent.getBroadcast(context, requestCode, intent, flags)

        val next = nextOccurrence(hour, minute)

        // RTC_WAKEUP + allow-while-idle fires even when the stick is asleep in Doze,
        // which is exactly the moment we need it to.
        when {
            Build.VERSION.SDK_INT >= 31 -> {
                if (am.canScheduleExactAlarms())
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi)
                else
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi) // exact not granted → close enough
            }
            Build.VERSION.SDK_INT >= 23 ->
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi)
            else ->
                am.setExact(AlarmManager.RTC_WAKEUP, next, pi)
        }
    }

    private fun nextOccurrence(hour: Int, minute: Int): Long {
        val now = Calendar.getInstance()
        val t = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        if (t.timeInMillis <= now.timeInMillis) t.add(Calendar.DAY_OF_YEAR, 1)
        return t.timeInMillis
    }
}
