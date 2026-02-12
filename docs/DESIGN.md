# Yommy 詳細設計書

## 1. システム概要
**Yommy** は、Amazon Fire HD (Android) 上で動作する Web小説リーダーアプリケーションです。
外部サイト（カクヨム）から小説データをスクレイピングしてローカルデータベースに保存し、オフラインでの閲覧および快適な読書体験を提供します。

## 2. アーキテクチャ
Google推奨の **Web App Architecture (Modern Android Architecture)** に準拠しています。

*   **パターン**: MVVM (Model-View-ViewModel)
*   **DI (依存性注入)**: Hilt
*   **非同期処理**: Kotlin Coroutines & Flow
*   **データフロー**: 単方向データフロー (UDF)

```mermaid
graph TD
    UI[UI Layer (Compose)] --> ViewModel
    ViewModel --> Repository
    Repository --> Local[Local DataSource (Room)]
    Repository --> Remote[Remote DataSource (Scraper)]
    Local <--> DB[(SQLite)]
    Remote <--> Web((Kakuyomu))
```

## 3. ディレクトリ構成
`com.devuser.yommy`

*   `data/`
    *   `local/`: Roomデータベース関連
        *   `dao/`: データアクセスオブジェクト (`NovelDao`, `EpisodeDao`)
        *   `entity/`: データベースエンティティ (`NovelEntity`, `EpisodeEntity`)
        *   `AppDatabase.kt`: DB定義
    *   `remote/`: 通信・スクレイピング関連
        *   `model/`: 解析結果データクラス
        *   `KakuyomuScraper.kt`: Jsoupを用いたHTML解析ロジック
    *   `repository/`: データ調停層 (`NovelRepository`)
*   `di/`: Hiltモジュール (`DatabaseModule`, `NetworkModule`)
*   `ui/`: 画面・ViewModel
    *   `home/`: 本棚画面 (`BookshelfScreen`, `BookshelfViewModel`)
    *   `search/`: 検索画面 (`SearchScreen`, `SearchViewModel`)
    *   `reader/`: 読書画面 (`ReaderScreen`, `ReaderViewModel`)
    *   `navigation/`: ナビゲーション定義 (`Screen`)
    *   `theme/`: テーマ定義
*   `worker/`: バックグラウンドタスク (`UpdateCheckWorker`, `PreFetchWorker`)

## 4. データベース設計 (Schema)

### Novels テーブル (`novels`)
登録された小説のメタデータを管理します。

| カラム名 | 型 | 説明 |
| :--- | :--- | :--- |
| `id` | String (PK) | カクヨムの作品ID |
| `title` | String | タイトル |
| `author` | String | 作者名 |
| `totalChapters` | Int | 総話数（更新チェック用） |
| `lastReadEpisodeUrl` | String? | 最後に読んだ話のURL |
| `lastScrollY` | Int | 最後に読んだスクロール位置 (Y座標) |
| `siteSource` | String | サイト識別子 ("KAKUYOMU") |
| `addedAt` | Long | 登録日時 |

### Episodes テーブル (`episodes`)
各話のメタデータおよび本文キャッシュを管理します。

| カラム名 | 型 | 説明 |
| :--- | :--- | :--- |
| `url` | String (PK) | エピソードURL |
| `novelId` | String (FK) | 親作品ID (Novels.id) |
| `title` | String | サブタイトル |
| `indexOrder` | Int | 話数順序 (昇順) |
| `contentHtml` | String? | 本文HTML（未取得時はnull） |
| `lastFetchedAt` | Long | 最終取得日時 |

## 5. クラス詳細設計

### Data Layer
*   **NovelRepository**:
    *   `allNovels`: `Flow<List<NovelEntity>>` - 本棚用ストリーム。
    *   `checkAllUpdates()`: 全小説の最新話数を取得し、DBを更新。
    *   `prefetchNextEpisodes(novelId, count)`: 指定話数分、本文未取得のエピソードをスクレイピングしてDBに保存。
    *   `getEpisodeContent(url)`: DBにあれば返却、なければスクレイピングして保存してから返却。

*   **KakuyomuScraper**:
    *   `searchNovels(query)`: 検索結果ページを解析。
    *   `getEpisodeList(novelId)`: 目次ページを解析。
    *   `getEpisodeContent(url)`: エピソード本文ページを解析。`div.widget-episodeBody` 等を抽出。

### UI Layer
*   **ReaderScreen**:
    *   `AndroidView` で `WebView` をラップ。
    *   `onScrollChangeListener` で最下部到達を検知 -> `viewModel.onScrollBottom()` を呼び出し（オーバーレイ表示トリガー）。
    *   JavaScript有効化、DOM Storage有効化。

## 6. バックグラウンド処理
WorkManagerを使用し、アプリが起動していない間も定期実行します。

1.  **UpdateCheckWorker**: 6時間ごとに実行。全小説の目次を取得し、話数が増えていればDB更新。
2.  **PreFetchWorker**: 必要に応じてチェイン実行（今回は `ReaderViewModel` からの手動トリガーも想定）。

## 7. 使用ライブラリ
*   **Jetpack Compose**: UI構築
*   **Room**: ローカルデータベース
*   **Retrofit / OkHttp**: HTTP通信
*   **Jsoup**: HTML解析
*   **Hilt**: DIコンテナ
*   **WorkManager**: バックグラウンドタスク
*   **Coil** (未導入だが画像表示が必要になれば追加推奨)
