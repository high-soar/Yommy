package com.devuser.yommy.data.remote.model

data class ScrapedNovel(
    val id: String,
    val title: String,
    val author: String,
    val totalChapters: Int,
    val url: String
)

data class ScrapedEpisode(
    val id: String,
    val novelId: String,
    val title: String,
    val url: String,
    val publishedAt: String
)

data class EpisodeContent(
    val title: String,
    val html: String,
    val nextEpisodeUrl: String?,
    val prevEpisodeUrl: String?
)
