package com.devuser.yommy.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.devuser.yommy.data.local.entity.NovelEntity
import com.devuser.yommy.data.repository.NovelRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class BookshelfViewModel @Inject constructor(
    private val repository: NovelRepository
) : ViewModel() {

    val novels: StateFlow<List<NovelEntity>> = repository.allNovels
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    fun deleteNovel(novel: NovelEntity) {
        viewModelScope.launch {
            repository.deleteNovel(novel.id)
        }
    }
}
