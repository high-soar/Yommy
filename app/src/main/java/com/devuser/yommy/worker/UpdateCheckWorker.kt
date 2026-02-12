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
class UpdateCheckWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val repository: NovelRepository
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            // Get all novels from DB (blocking/snapshot)
            // Since getAllNovels returns Flow, we need a way to get snapshot or use DAO directly if exposed.
            // Repository exposes Flow. I should add a suspend function to get snapshot in Repository or Dao.
            // For now, I'll use the Flow and take one.
            
            // NOTE: Ideally Repository should expose "getAllNovelsSnapshot" or "checkUpdates".
            // I will implement the logic here using what I have, but accessing Flow in Worker is bit odd.
            // Let's assume I can add a method to Repo.
            
            // For now, let's just use the scraper directly? No, go through Repo.
            // I'll add `checkUpdates()` to Repository later.
            // Or I can collect from Flow.
            
            // Let's implement a simple loop assuming we can get the list.
            // I'll modify Repository to expose a suspend function for this, or just add logic here.
            
            // Workaround: I'll assume we can get the list via a new method in Repo or just adding it now.
            // To avoid changing Repo file again immediately, I'll try to collect the flow once.
            
            /*
            val novels = repository.allNovels.first() 
            novels.forEach { novel ->
               val remoteList = repository.scraper.getEpisodeList(novel.id) // Repo doesn't expose scraper publicly
               // ...
            }
            */
            
            // Better approach: Delegate to Repository.
            repository.checkAllUpdates()
            
            Result.success()
        } catch (e: Exception) {
            e.printStackTrace()
            Result.retry()
        }
    }
}
