package com.devuser.yommy.ui.navigation

sealed class Screen(val route: String) {
    object Bookshelf : Screen("bookshelf")
    object Search : Screen("search")
    object Reader : Screen("reader/{novelId}/{episodeUrl}") {
        fun createRoute(novelId: String, episodeUrl: String) = "reader/$novelId/${android.net.Uri.encode(episodeUrl)}"
    }
}
