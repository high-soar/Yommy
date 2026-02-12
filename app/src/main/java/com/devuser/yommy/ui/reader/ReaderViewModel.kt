package com.devuser.yommy.ui.reader

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.devuser.yommy.data.local.entity.EpisodeEntity
import com.devuser.yommy.data.repository.NovelRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ReaderViewModel @Inject constructor(
    private val repository: NovelRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val novelId: String = checkNotNull(savedStateHandle["novelId"])
    private val initialEpisodeUrl: String = checkNotNull(savedStateHandle["episodeUrl"]) // Encoded? Navigation decodes it.

    private val _currentEpisode = MutableStateFlow<EpisodeEntity?>(null)
    val currentEpisode: StateFlow<EpisodeEntity?> = _currentEpisode.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _nextEpisodeUrl = MutableStateFlow<String?>(null)
    val nextEpisodeUrl: StateFlow<String?> = _nextEpisodeUrl.asStateFlow()

    init {
        loadEpisode(initialEpisodeUrl)
    }

    fun loadEpisode(url: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                // Determine if we need to fetch TOC first if URL is "TOC" or similar special flag
                if (url == "TOC") {
                    // Fetch list to ensure we have episodes
                    repository.refreshEpisodeList(novelId)
                    // Get the first episode from DB
                    val episodes = repository.getEpisodesFlow(novelId).firstOrNull()
                    val firstEpisode = episodes?.minByOrNull { it.indexOrder }
                    
                    if (firstEpisode != null) {
                        // Load first episode content
                        val content = repository.getEpisodeContent(firstEpisode.url)
                        _currentEpisode.value = content
                        
                        // Set up next episode URL if available
                         val nextEpisode = episodes.find { it.indexOrder == firstEpisode.indexOrder + 1 }
                         _nextEpisodeUrl.value = nextEpisode?.url
                    } else {
                        // Handle empty novel
                         // _error.value = "No episodes found"
                    }
                } else {
                    val episode = repository.getEpisodeContent(url)
                    _currentEpisode.value = episode
                    
                    // Find next episode
                    if (episode != null) {
                         val allEpisodes = repository.getEpisodesFlow(novelId).firstOrNull() ?: emptyList()
                         val current = allEpisodes.find { it.url == episode.url }
                         if (current != null) {
                             val nextEpisode = allEpisodes.find { it.indexOrder == current.indexOrder + 1 }
                             _nextEpisodeUrl.value = nextEpisode?.url
                         }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                _isLoading.value = false
            }
        }
    }
    
    fun onScrollBottom() {
         // Logic to prepare next episode
    }
    
    fun saveProgress(scrollY: Int) {
        val url = _currentEpisode.value?.url ?: return
        viewModelScope.launch {
            repository.updateReadingProgress(novelId, url, scrollY)
        }
    }
}
