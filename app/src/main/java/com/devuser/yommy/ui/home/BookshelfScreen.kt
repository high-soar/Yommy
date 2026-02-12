package com.devuser.yommy.ui.home

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.devuser.yommy.data.local.entity.NovelEntity
import com.devuser.yommy.ui.navigation.Screen
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookshelfScreen(
    navController: NavController,
    viewModel: BookshelfViewModel = hiltViewModel()
) {
    val novels by viewModel.novels.collectAsState()
    var showDeleteDialog by remember { mutableStateOf<NovelEntity?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Yommy") },
                actions = {
                    IconButton(onClick = { navController.navigate(Screen.Search.route) }) {
                        Icon(Icons.Default.Add, contentDescription = "Search & Add")
                    }
                }
            )
        }
    ) { padding ->
        if (novels.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Text("No novels added yet. Tap + to add.")
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            ) {
                items(novels) { novel ->
                    NovelItem(
                        novel = novel,
                        onClick = {
                            // Navigate to Reader. If lastReadEpisodeUrl is null, go to TOC (not impl yet) or fetch first?
                            // For simplicity, ReaderScreen will handle "load list" and "find first" if URL is special.
                            // But usually we need an episode URL.
                            // Let's assume we pass a special "resume" flag or handle it in ReaderViewModel.
                            val targetUrl = novel.lastReadEpisodeUrl ?: "TOC" 
                            navController.navigate(Screen.Reader.createRoute(novel.id, targetUrl))
                        },
                        onLongClick = { showDeleteDialog = novel }
                    )
                }
            }
        }

        if (showDeleteDialog != null) {
            AlertDialog(
                onDismissRequest = { showDeleteDialog = null },
                title = { Text("Delete Novel") },
                text = { Text("Are you sure you want to delete '${showDeleteDialog?.title}'?") },
                confirmButton = {
                    TextButton(
                        onClick = {
                            viewModel.deleteNovel(showDeleteDialog!!)
                            showDeleteDialog = null
                        }
                    ) {
                        Text("Delete")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDeleteDialog = null }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun NovelItem(
    novel: NovelEntity,
    onClick: () -> Unit,
    onLongClick: () -> Unit
) {
    ListItem(
        modifier = Modifier.combinedClickable(
            onClick = onClick,
            onLongClick = onLongClick
        ),
        headlineContent = { Text(novel.title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        supportingContent = { Text(novel.author, maxLines = 1) },
        leadingContent = {
            // Placeholder for cover image or initial
            Text(novel.title.take(1)) 
        },
        trailingContent = {
            if (novel.totalChapters > 0) { // Simple badge logic
                Badge { Text(novel.totalChapters.toString()) }
            }
        }
    )
    Divider()
}
