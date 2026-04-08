package com.longclaw.app

import android.app.Application
import android.util.Log

/**
 * Application entry point. Kept tiny on purpose — heavy bootstrap (DI, network,
 * telemetry) will land in later milestones.
 */
class LongclawApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "LongclawApplication.onCreate, versionName=${BuildConfig.VERSION_NAME}")
    }

    companion object {
        const val TAG = "龙爪"
    }
}
