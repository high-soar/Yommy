package com.devuser.yommy.ui.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.devuser.yommy.data.remote.model.ScrapedNovel
import com.devuser.yommy.data.repository.NovelRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SearchViewModel @Inject constructor(
    private val repository: NovelRepository
) : ViewModel() {

    private val _searchResults = MutableStateFlow<List<ScrapedNovel>>(emptyList())
    val searchResults: StateFlow<List<ScrapedNovel>> = _searchResults.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    init {
        fetchRanking()
    }

    fun fetchRanking() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                _searchResults.value = repository.getRanking()
                _error.value = null
            } catch (e: Exception) {
                _error.value = "Failed to load ranking: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun search(query: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                _searchResults.value = repository.searchNovels(query)
                _error.value = null
            } catch (e: Exception) {
                _error.value = "Search failed: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun addNovel(novel: ScrapedNovel) {
        viewModelScope.launch {
            try {
                repository.addNovel(novel)
                // Optionally show success message or update UI state to show "Added"
            } catch (e: Exception) {
                _error.value = "Failed to add novel: ${e.message}"
            }
        }
    }
}
