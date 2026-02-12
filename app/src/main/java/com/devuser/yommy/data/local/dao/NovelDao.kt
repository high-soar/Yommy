package com.devuser.yommy.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.devuser.yommy.data.local.entity.NovelEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface NovelDao {
    @Query("SELECT * FROM novels ORDER BY addedAt DESC")
    fun getAllNovels(): Flow<List<NovelEntity>>

    @Query("SELECT * FROM novels WHERE id = :id")
    suspend fun getNovelById(id: String): NovelEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNovel(novel: NovelEntity)

    @Query("DELETE FROM novels WHERE id = :id")
    suspend fun deleteNovel(id: String)
    
    @Query("UPDATE novels SET totalChapters = :totalChapters WHERE id = :id")
    suspend fun updateTotalChapters(id: String, totalChapters: Int)
    
    @Query("UPDATE novels SET lastReadEpisodeUrl = :url, lastScrollY = :scrollY WHERE id = :id")
    suspend fun updateReadingProgress(id: String, url: String, scrollY: Int)
}
