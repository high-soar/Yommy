package com.devuser.yommy.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.devuser.yommy.data.local.dao.EpisodeDao
import com.devuser.yommy.data.local.dao.NovelDao
import com.devuser.yommy.data.local.entity.EpisodeEntity
import com.devuser.yommy.data.local.entity.NovelEntity

@Database(entities = [NovelEntity::class, EpisodeEntity::class], version = 1, exportSchema = true)
abstract class AppDatabase : RoomDatabase() {
    abstract fun novelDao(): NovelDao
    abstract fun episodeDao(): EpisodeDao
}
