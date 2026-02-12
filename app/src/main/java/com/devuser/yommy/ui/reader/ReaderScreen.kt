package com.devuser.yommy.ui.reader

import android.annotation.SuppressLint
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.devuser.yommy.ui.navigation.Screen

@SuppressLint("SetJavaScriptEnabled")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReaderScreen(
    navController: NavController,
    viewModel: ReaderViewModel = hiltViewModel()
) {
    val currentEpisode by viewModel.currentEpisode.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val nextEpisodeUrl by viewModel.nextEpisodeUrl.collectAsState()
    
    var showOverlay by remember { mutableStateOf(false) } // Initially false, show on tap or scroll bottom
    
    // Function to handle next episode navigation
    fun onNext() {
        nextEpisodeUrl?.let { url ->
            // Use navigation to reload ReaderScreen with new URL
            // Pop current? Or keep stack? 
            // Better to replace current to avoid huge stack.
            val novelId = currentEpisode?.novelId ?: return
            navController.navigate(Screen.Reader.createRoute(novelId, url)) {
                popUpTo(Screen.Reader.route) { inclusive = true }
            }
        }
    }

    Scaffold(
        topBar = {
            if (showOverlay) {
                TopAppBar(
                    title = { Text(currentEpisode?.title ?: "Loading...") },
                    navigationIcon = {
                        IconButton(onClick = { navController.popBackStack() }) { // Go back to Bookshelf/TOC
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                        }
                    }
                )
            }
        },
        bottomBar = {
            if (showOverlay || (nextEpisodeUrl != null && !isLoading)) { // Show bottom bar if overlay is active OR next episode available
                 BottomAppBar {
                     Spacer(modifier = Modifier.weight(1f))
                     if (nextEpisodeUrl != null) {
                         Button(onClick = { onNext() }) {
                             Text("Next Episode")
                             Icon(Icons.Default.ChevronRight, contentDescription = null)
                         }
                     }
                     Spacer(modifier = Modifier.weight(1f))
                 }
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize()) {
            if (isLoading) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            }
            
            currentEpisode?.contentHtml?.let { html ->
                AndroidView(
                    factory = { context ->
                        WebView(context).apply {
                            webViewClient = WebViewClient()
                            webChromeClient = WebChromeClient()
                            settings.javaScriptEnabled = true // Some sites might need it, but mostly static HTML
                            settings.domStorageEnabled = true
                            
                            // Detect scroll to bottom
                            setOnScrollChangeListener { v, scrollX, scrollY, oldScrollX, oldScrollY ->
                                // Simple check if bottom reached
                                val height = (v as WebView).contentHeight * v.scale
                                val diff = height - v.height - scrollY
                                if (diff < 100) { // Threshold
                                    showOverlay = true 
                                    viewModel.onScrollBottom()
                                }
                                viewModel.saveProgress(scrollY)
                            }
                        }
                    },
                    update = { webView ->
                        // Apply CSS for styling
                        val styledHtml = """
                            <html>
                            <head>
                            <style>
                                body { 
                                    font-size: 18px; 
                                    line-height: 1.8; 
                                    padding: 16px; 
                                    max-width: 800px;
                                    margin: 0 auto;
                                    color: #333;
                                    background-color: #fff;
                                }
                                .widget-episodeBody { } /* Keep original class */
                            </style>
                            </head>
                            <body>
                            ${html}
                            </body>
                            </html>
                        """.trimIndent()
                        
                        webView.loadDataWithBaseURL("https://kakuyomu.jp", styledHtml, "text/html", "UTF-8", null)
                        
                        // Restore scroll position? 
                        // webView.scrollY = ... (Reading from viewModel)
                    }
                )
            }
        }
    }
}
