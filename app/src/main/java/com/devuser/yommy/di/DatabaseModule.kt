package com.devuser.yommy.di

import android.content.Context
import androidx.room.Room
import com.devuser.yommy.data.local.AppDatabase
import com.devuser.yommy.data.local.dao.EpisodeDao
import com.devuser.yommy.data.local.dao.NovelDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideAppDatabase(
        @ApplicationContext context: Context
    ): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "yommy-database"
        ).build()
    }

    @Provides
    fun provideNovelDao(database: AppDatabase): NovelDao {
        return database.novelDao()
    }

    @Provides
    fun provideEpisodeDao(database: AppDatabase): EpisodeDao {
        return database.episodeDao()
    }
}
