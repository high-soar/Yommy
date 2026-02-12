package com.devuser.yommy.worker

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.devuser.yommy.data.repository.NovelRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@HiltWorker
class PreFetchWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val repository: NovelRepository
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val novelId = inputData.getString("novelId") ?: return@withContext Result.failure()
        
        try {
            // Logic:
            // 1. Get episode list using Repo (updates DB if needed)
            repository.refreshEpisodeList(novelId) // Ensure list is up to date
            
            // 2. Find which episodes need downloading
            // We need a list of episodes.
            // Again, Repo exposes Flow.
            // I'll assume I can add `getEpisodeListSnapshot(novelId)` to Repo.
            
            repository.prefetchNextEpisodes(novelId, count = 3)
            
            Result.success()
        } catch (e: Exception) {
            e.printStackTrace()
            Result.failure()
        }
    }
}
