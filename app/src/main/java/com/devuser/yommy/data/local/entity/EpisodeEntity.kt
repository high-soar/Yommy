package com.devuser.yommy.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "episodes",
    foreignKeys = [
        ForeignKey(
            entity = NovelEntity::class,
            parentColumns = ["id"],
            childColumns = ["novelId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["novelId"])]
)
data class EpisodeEntity(
    @PrimaryKey val url: String, // Full URL as ID
    val novelId: String,
    val title: String,
    val indexOrder: Int, // For sorting
    val contentHtml: String? = null, // Null if not yet fetched
    val lastFetchedAt: Long = 0
)
