package com.devuser.yommy.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.devuser.yommy.ui.theme.YommyTheme
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.NavType
import com.devuser.yommy.ui.home.BookshelfScreen
import com.devuser.yommy.ui.navigation.Screen
import com.devuser.yommy.ui.reader.ReaderScreen
import com.devuser.yommy.ui.search.SearchScreen
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            YommyTheme {
                val navController = rememberNavController()
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    NavHost(navController = navController, startDestination = Screen.Bookshelf.route) {
                        composable(Screen.Bookshelf.route) {
                            BookshelfScreen(navController = navController)
                        }
                        composable(Screen.Search.route) {
                            SearchScreen(navController = navController)
                        }
                        composable(
                            route = Screen.Reader.route,
                            arguments = listOf(
                                navArgument("novelId") { type = NavType.StringType },
                                navArgument("episodeUrl") { type = NavType.StringType }
                            )
                        ) {
                            ReaderScreen(navController = navController)
                        }
                    }
                }
            }
        }
    }
}

