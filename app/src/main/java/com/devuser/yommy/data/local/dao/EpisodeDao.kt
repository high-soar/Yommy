package com.devuser.yommy.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.devuser.yommy.data.local.entity.EpisodeEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface EpisodeDao {
    @Query("SELECT * FROM episodes WHERE novelId = :novelId ORDER BY indexOrder ASC")
    fun getEpisodesForNovel(novelId: String): Flow<List<EpisodeEntity>>

    @Query("SELECT * FROM episodes WHERE url = :url")
    suspend fun getEpisodeByUrl(url: String): EpisodeEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEpisodes(episodes: List<EpisodeEntity>)
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEpisode(episode: EpisodeEntity)

    @Query("DELETE FROM episodes WHERE novelId = :novelId")
    suspend fun deleteEpisodesForNovel(novelId: String)
}
