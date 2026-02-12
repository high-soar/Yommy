package com.devuser.yommy

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class YommyApplication : Application(), Configuration.Provider {

    @Inject lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        scheduleUpdateCheck()
    }

    private fun scheduleUpdateCheck() {
        val request = androidx.work.PeriodicWorkRequestBuilder<com.devuser.yommy.worker.UpdateCheckWorker>(
            6, java.util.concurrent.TimeUnit.HOURS
        ).build()

        androidx.work.WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "UpdateCheck",
            androidx.work.ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }
}

