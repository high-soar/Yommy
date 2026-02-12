package com.devuser.yommy.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "novels")
data class NovelEntity(
    @PrimaryKey val id: String, // e.g., "1177354054880238351" (Kakuyomu ID)
    val title: String,
    val author: String,
    val totalChapters: Int = 0,
    val lastReadEpisodeUrl: String? = null,
    val lastScrollY: Int = 0,
    val siteSource: String, // "KAKUYOMU", "NAROU"
    val addedAt: Long = System.currentTimeMillis()
)
