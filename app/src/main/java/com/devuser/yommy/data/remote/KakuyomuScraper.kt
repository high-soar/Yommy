package com.devuser.yommy.data.remote

import com.devuser.yommy.data.remote.model.EpisodeContent
import com.devuser.yommy.data.remote.model.ScrapedEpisode
import com.devuser.yommy.data.remote.model.ScrapedNovel
import okhttp3.OkHttpClient
import okhttp3.Request
import org.jsoup.Jsoup
import javax.inject.Inject
import javax.inject.Singleton
import java.io.IOException

@Singleton
class KakuyomuScraper @Inject constructor(
    private val okHttpClient: OkHttpClient
) {

    private fun fetchHtml(url: String): String {
        val request = Request.Builder().url(url).build()
        val response = okHttpClient.newCall(request).execute()
        if (!response.isSuccessful) throw IOException("Unexpected code $response")
        return response.body?.string() ?: throw IOException("Empty body")
    }

    fun searchNovels(query: String): List<ScrapedNovel> {
        val url = "https://kakuyomu.jp/search?q=$query"
        val html = fetchHtml(url)
        val doc = Jsoup.parse(html)
        val novels = mutableListOf<ScrapedNovel>()

        // Selectors might change, robust handling needed
        // As of 2024 (Hypothetical selector based on typical structure)
        val elements = doc.select(".widget-work") 
        // Note: Actual selectors for Kakuyomu need to be verified or updated based on current site.
        // Assuming: .widget-work for container, .widget-work-title, .widget-work-author
        
        for (element in elements) {
            val titleEl = element.selectFirst(".widget-work-title a") ?: continue
            val link = titleEl.attr("href") // /works/123456...
            val id = link.split("/").lastOrNull { it.isNotEmpty() } ?: continue
            val title = titleEl.text()
            val author = element.selectFirst(".widget-work-author a")?.text() ?: "Unknown"
            
            // Total chapters might be in a different tag
            // For search results, sometimes chapter count isn't visible or is in .widget-work-status
            val statusText = element.select(".widget-work-status").text()
            // Try to extract number? For now set 0
            
            novels.add(ScrapedNovel(id, title, author, 0, "https://kakuyomu.jp$link"))
        }
        return novels
    }

    fun getRanking(): List<ScrapedNovel> {
        val url = "https://kakuyomu.jp/rankings/total/weekly"
        val html = fetchHtml(url)
        val doc = Jsoup.parse(html)
        val novels = mutableListOf<ScrapedNovel>()
        
        // Similar parsing logic, adapt selectors
        // Ranking usually has similar structure .widget-work
        val elements = doc.select(".widget-work")
        for (element in elements) {
            val titleEl = element.selectFirst(".widget-work-title a") ?: continue
            val link = titleEl.attr("href")
            val id = link.split("/").lastOrNull { it.isNotEmpty() } ?: link
            val title = titleEl.text()
            val author = element.selectFirst(".widget-work-author a")?.text() ?: "Unknown"
            
            novels.add(ScrapedNovel(id, title, author, 0, "https://kakuyomu.jp$link"))
        }
        return novels
    }

    fun getEpisodeList(novelId: String): List<ScrapedEpisode> {
        val url = "https://kakuyomu.jp/works/$novelId"
        val html = fetchHtml(url)
        val doc = Jsoup.parse(html)
        val episodes = mutableListOf<ScrapedEpisode>()

        // Kakuyomu TOC structure: .widget-toc-items .widget-toc-episode
        val episodeElements = doc.select(".widget-toc-episode a")
        
        episodeElements.forEach { element ->
            val link = element.attr("href") // /works/{novelId}/episodes/{episodeId}
            val id = link.split("/").lastOrNull { it.isNotEmpty() } ?: link
            val title = element.select("span").firstOrNull()?.text() ?: element.text()
            val publishedAt = element.select("time").attr("datetime")
            
            episodes.add(ScrapedEpisode(
                id = id,
                novelId = novelId,
                title = title,
                url = "https://kakuyomu.jp$link",
                publishedAt = publishedAt
            ))
        }
        return episodes
    }

    fun getEpisodeContent(url: String): EpisodeContent {
        val html = fetchHtml(url)
        val doc = Jsoup.parse(html)
        
        val title = doc.select(".widget-episodeTitle").text()
        val contentBody = doc.select(".widget-episodeBody")
        
        // Clean up or extract HTML
        // Remove ads or specific Kakuyomu widget clutter if any
        contentBody.select("script").remove()
        contentBody.select(".test-google-rectangle-ad").remove()

        val nextLink = doc.select("#contentMain-readNextEpisode").attr("href")
        val prevLink = doc.select("#contentMain-readPreviousEpisode").attr("href")

        val nextUrl = if (nextLink.isNotEmpty()) "https://kakuyomu.jp$nextLink" else null
        val prevUrl = if (prevLink.isNotEmpty()) "https://kakuyomu.jp$prevLink" else null

        return EpisodeContent(
            title = title,
            html = contentBody.html(), // Keep HTML for displaying with format
            nextEpisodeUrl = nextUrl,
            prevEpisodeUrl = prevUrl
        )
    }
}
