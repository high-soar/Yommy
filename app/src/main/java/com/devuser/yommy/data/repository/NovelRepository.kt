package com.devuser.yommy.data.repository

import com.devuser.yommy.data.local.dao.EpisodeDao
import com.devuser.yommy.data.local.dao.NovelDao
import com.devuser.yommy.data.local.entity.EpisodeEntity
import com.devuser.yommy.data.local.entity.NovelEntity
import com.devuser.yommy.data.remote.KakuyomuScraper
import com.devuser.yommy.data.remote.model.ScrapedNovel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NovelRepository @Inject constructor(
    private val novelDao: NovelDao,
    private val episodeDao: EpisodeDao,
    private val scraper: KakuyomuScraper
) {

    // --- Library Operations ---
    val allNovels: Flow<List<NovelEntity>> = novelDao.getAllNovels()

    suspend fun addNovel(scrapedNovel: ScrapedNovel) {
        val novelEntity = NovelEntity(
            id = scrapedNovel.id,
            title = scrapedNovel.title,
            author = scrapedNovel.author,
            totalChapters = scrapedNovel.totalChapters,
            siteSource = "KAKUYOMU"
        )
        novelDao.insertNovel(novelEntity)
    }

    suspend fun deleteNovel(novelId: String) {
        novelDao.deleteNovel(novelId)
        // Cascade delete should handle episodes, but to be sure/explicit:
        // episodeDao.deleteEpisodesForNovel(novelId) // Defined as cascade in Entity
    }

    // --- Remote Fetches ---
    suspend fun searchNovels(query: String): List<ScrapedNovel> = withContext(Dispatchers.IO) {
        scraper.searchNovels(query)
    }

    suspend fun getRanking(): List<ScrapedNovel> = withContext(Dispatchers.IO) {
        scraper.getRanking()
    }

    // --- Episode Operations ---

    fun getEpisodesFlow(novelId: String): Flow<List<EpisodeEntity>> = episodeDao.getEpisodesForNovel(novelId)

    suspend fun refreshEpisodeList(novelId: String) = withContext(Dispatchers.IO) {
        val scrapedEpisodes = scraper.getEpisodeList(novelId)
        val entities = scrapedEpisodes.mapIndexed { index, ep ->
            // Check if existing to preserve contentHtml if we already have it?
            // Or just update/insert. OnConflictStrategy.REPLACE will wipe contentHtml if we insert a new object with null content.
            // We need to be careful not to overwrite `contentHtml` if it exists.
            
            val existing = episodeDao.getEpisodeByUrl(ep.url)
            EpisodeEntity(
                url = ep.url,
                novelId = ep.novelId,
                title = ep.title,
                indexOrder = index,
                contentHtml = existing?.contentHtml,
                lastFetchedAt = existing?.lastFetchedAt ?: 0
            )
        }
        episodeDao.insertEpisodes(entities)
        
        // Update novel total chapters
        novelDao.updateTotalChapters(novelId, entities.size)
    }

    suspend fun getEpisodeContent(url: String, forceRefresh: Boolean = false): EpisodeEntity? = withContext(Dispatchers.IO) {
        val existing = episodeDao.getEpisodeByUrl(url)
        
        if (!forceRefresh && existing != null && !existing.contentHtml.isNullOrEmpty()) {
            return@withContext existing
        }

        // Fetch
        try {
            val content = scraper.getEpisodeContent(url)
            val parentNovelId = existing?.novelId ?: return@withContext null // Should exist if we are reading
            
            val updatedEntity = existing.copy(
                contentHtml = content.html,
                lastFetchedAt = System.currentTimeMillis()
            )
            episodeDao.insertEpisode(updatedEntity)
            return@withContext updatedEntity
        } catch (e: Exception) {
            e.printStackTrace() // Log error
            return@withContext null // Indicate failure
        }
    }

    // --- Reading Progress ---
    suspend fun updateReadingProgress(novelId: String, url: String, scrollY: Int) {
        novelDao.updateReadingProgress(novelId, url, scrollY)
    }

    // --- Background Task Helpers ---

    suspend fun checkAllUpdates() = withContext(Dispatchers.IO) {
        val novels = novelDao.getAllNovels().firstOrNull() ?: return@withContext
        novels.forEach { novel ->
            try {
                // Fetch TOC to get episode count
                val episodes = scraper.getEpisodeList(novel.id)
                if (episodes.size > novel.totalChapters) {
                    // Update count
                    novelDao.updateTotalChapters(novel.id, episodes.size)
                    // Optionally set a flag "hasUnread" if I added it to Entity
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    suspend fun prefetchNextEpisodes(novelId: String, count: Int = 3) = withContext(Dispatchers.IO) {
        // Simple logic: Get all episodes, find first without content? Or based on lastRead?
        // Let's assume we want to fill gaps.
        // Get all episodes from DB
        val episodes = episodeDao.getEpisodesForNovel(novelId).firstOrNull() ?: return@withContext
        
        // Filter those needing content
        // This might re-fetch if we lost content, which is fine
        val toFetch = episodes.filter { it.contentHtml.isNullOrEmpty() }.take(count)
        
        toFetch.forEach { ep ->
            getEpisodeContent(ep.url) // This handles fetching and saving
        }
    }
}



