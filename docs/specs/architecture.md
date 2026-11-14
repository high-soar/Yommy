---
type: spec-architecture
title: 3層アーキテクチャと共通インターフェース契約（App 全体正本）
description: Http/Bridge、Parser、Storage、Viewer/UIの3層分離構造、ディレクトリ規約、およびTypeScript基底インターフェース契約の正本。
status: "Review (#344)"
updated: "2026-11-14"
tags:
  - architecture
  - parser
  - storage
  - bridge
  - sanitizer
  - assets
  - settings
  - shell
  - search
  - ranking
  - site-selector
  - work-variation
  - four-tabs
  - prefetch
  - batch-cache
  - download-queue
  - queue-repository
  - cache-rules
  - cache-management
  - capacity-visualization
  - cloud-sync
  - google-drive
  - paging
  - gestures
  - pagination
  - font-family
  - page-margin
  - volume-key
  - hardware-key
  - narou
  - multi-page-toc
  - favorite
  - bookshelf-filter
  - webview-import
  - webview-bridge
  - scr-04
  - fallback
  - dom-import
  - ho-23
  - ho-24
  - ho-25
  - ho-28
  - ho-29
  - ho-30
  - ho-31
  - ho-32
  - ho-34
  - ho-35
  - conflict-dialog
  - ho-38
  - cache-scheduler
  - priority-queue
  - ho-39
related_specs:
  - docs/specs/changes/issue-344-priority-cache-scheduler.md
  - docs/specs/changes/archive/issue-343-novel-detail-header-menu.md
  - docs/specs/changes/archive/issue-342-cloud-sync-bookmark-protection.md
  - docs/specs/changes/archive/issue-304-v1-release-readiness.md
  - docs/specs/changes/archive/issue-269-webview-fallback-and-dom-import.md
  - docs/specs/features/webview-import.md
  - docs/specs/changes/archive/issue-268-persistent-download-queue.md
  - docs/specs/changes/archive/issue-266-bookshelf-favorite-and-sync.md
  - docs/specs/changes/archive/issue-265-work-variation-filter.md
  - docs/specs/changes/archive/issue-264-advanced-search-filter.md
  - docs/specs/changes/archive/issue-240-narou-search-ranking-and-site-selector.md
  - docs/specs/changes/archive/issue-239-narou-parser-and-multi-page-toc.md
  - docs/specs/parsers/narou.md
  - docs/specs/changes/archive/issue-238-loading-ux-clarification.md
  - docs/specs/changes/archive/issue-203-volume-key-paging.md
  - docs/specs/changes/archive/issue-202-reader-top-overlay-and-seekbar.md
  - docs/specs/changes/archive/issue-201-reader-page-slide-animation.md
  - docs/specs/changes/archive/issue-169-font-and-margin-customization.md
  - docs/specs/changes/archive/issue-170-cache-management-and-capacity-visualization.md
  - docs/specs/changes/archive/issue-168-reader-pagination-and-touch-refinement.md
  - docs/specs/changes/archive/issue-122-reader-page-turning.md
  - docs/specs/changes/archive/issue-120-cloud-sync-google-drive.md
  - docs/specs/changes/archive/issue-124-settings-back-button-navigation.md
  - docs/specs/changes/archive/issue-123-reader-bottom-overlay-ui-improvement.md
  - docs/specs/requirements.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/parsers/kakuyomu.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/search.md
  - docs/specs/features/ranking.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/reader-view.md
  - docs/specs/features/settings.md
  - docs/specs/changes/archive/issue-78-apk-signing-and-back-button.md
  - docs/specs/changes/archive/issue-79-four-tabs-search-ranking.md
  - docs/specs/changes/archive/issue-80-bookshelf-update-check-and-sort.md
  - docs/specs/changes/archive/issue-81-prefetch-and-cache-rules.md
  - docs/specs/changes/archive/issue-50-fullscreen-shell-and-settings.md
  - docs/specs/changes/archive/issue-51-novel-detail-layout-and-scroll.md
  - docs/specs/changes/archive/issue-52-reader-fullscreen-and-bottom-overlay.md
  - docs/specs/changes/archive/issue-12-bookshelf-and-routing.md
  - docs/specs/changes/archive/issue-13-novel-detail-and-toc.md
  - docs/specs/changes/archive/issue-14-reader-navigation-bookmark-settings.md
  - docs/specs/changes/archive/issue-15-app-icon-setup.md
  - docs/guidelines/testing.md
related_tests:
  - src/features/cache/services/cacheScheduler.test.ts
  - src/app/ServiceProvider.test.tsx
  - src/app/router.test.tsx
  - src/App.test.tsx
  - src/parsers/narou/NarouParser.test.ts
  - src/parsers/narou/genres.test.ts
  - src/parsers/kakuyomu/KakuyomuParser.test.ts
  - src/parsers/parserRegistry.test.ts
  - src/parsers/sanitizer.test.ts
  - src/parsers/fetchFullNovelIndex.test.ts
  - src/shared/ui/BottomTabBar.test.tsx
  - src/storage/schema.test.ts
  - src/storage/index.test.ts
  - src/storage/adapter/capacitorSqlite.test.ts
  - src/storage/adapter/inMemoryDb.test.ts
  - src/bridges/http/capacitorHttpClient.test.ts
  - src/bridges/http/mockHttpClient.test.ts
  - src/bridges/app/capacitorAppBridge.test.ts
  - src/bridges/app/mockAppBridge.test.ts
  - src/bridges/app/index.test.ts
  - src/bridges/volume-key/mockVolumeKeyBridge.test.ts
  - src/bridges/volume-key/capacitorVolumeKeyBridge.test.ts
  - src/bridges/volume-key/index.test.ts
  - src/bridges/cloud-sync/capacitorCloudSyncBridge.test.ts
  - src/bridges/cloud-sync/mockCloudSyncBridge.test.ts
  - src/bridges/cloud-sync/index.test.ts
  - src/features/cloud-sync/services/syncEngine.test.ts
  - src/features/cloud-sync/hooks/useBackgroundAutoPull.test.ts
  - src/storage/repositories/appSettingsRepository.test.ts
  - src/storage/repositories/chapterRepository.test.ts
  - src/storage/repositories/queueRepository.test.ts
  - src/storage/repositories/novelRepository.test.ts
  - src/storage/repositories/settingsRepository.test.ts
  - src/bridges/webview/capacitorWebViewDomBridge.test.ts
  - src/bridges/webview/mockWebViewDomBridge.test.ts
  - src/bridges/webview/urlUtils.test.ts
  - src/bridges/webview/index.test.ts
  - src/features/webview-import/index.test.ts
  - src/features/webview-import/hooks/useWebViewImport.test.ts
  - src/features/webview-import/components/WebViewImportContainer.test.tsx
  - src/features/webview-import/components/WebViewImportPage.test.tsx
  - test/it/scenarios/scn07-webview-import-fallback.spec.ts
  - src/shared/utils/cache.test.ts
  - src/shared/utils/formatByteSize.test.ts
  - src/shared/constants/app.test.ts
  - src/shared/constants/cache.test.ts
  - src/shared/constants/typography.test.ts
  - scripts/generate-icons.test.ts
  - scripts/android-build-config.test.ts
  - scripts/serve-storybook.test.ts
  - scripts/sync-env.test.ts
---

# 3層アーキテクチャと共通インターフェース契約（App 全体正本）

## 1. アーキテクチャ全体像と3層分離原則

AI による TDD 実装の確実性と保守性を最大化するため、Capacitor ネイティブ依存（HTTP 通信・SQLite・WebView ブリッジ）を薄いアダプター層に隔離し、アプリケーション全体を以下の3層（＋ Bridge 抽象層）に明確に分離します。

```mermaid
flowchart TB
    subgraph UILayer ["3. Viewer & UI Layer (src/features/*, src/shared/ui/*)"]
        Pages["Pages / Containers (SCR-01〜SCR-07)"]
        Components["Presentational UI Components<br>(縦書き vertical-rl / ルビ / テーマ / 本棚カード / 検索・ランキングカード / BottomTabBar 4タブ)"]
        Hooks["Application Hooks<br>(useBookshelf, useNovelDetail, useReader, useSettings, useNovelSearch, useNovelRanking)"]
        Pages --> Components
        Pages --> Hooks
    end

    subgraph ParserLayer ["1. Parser Layer (src/parsers/*)"]
        Registry["ParserRegistry<br>(URL から適切な NovelParser を解決)"]
        Kakuyomu["KakuyomuParser<br>(kakuyomu.jp: 目次・本文・検索・ランキング解析)"]
        Narou["NarouParser<br>(syosetu.com: 目次・本文・検索・ランキング解析)"]
        Sanitizer["HtmlSanitizer / Formatter<br>(許可タグ <p>,<br>,<ruby>,<rb>,<rt>,<rp>,<em> のみ保持)"]
        Registry --> Kakuyomu
        Registry --> Narou
        Kakuyomu --> Sanitizer
        Narou --> Sanitizer
    end

    subgraph StorageLayer ["2. Storage Layer (src/storage/*)"]
        Repos["Repositories<br>(NovelRepository, ChapterRepository, SettingsRepository, AppSettingsRepository, QueueRepository)"]
        DbAdapter["DatabaseAdapter Interface"]
        SqliteImpl["CapacitorSqliteAdapter<br>(Android 実機用)"]
        MemImpl["InMemoryDatabaseAdapter<br>(UT / Storybook / Playwright IT 用・resetTestDb())"]
        Repos --> DbAdapter
        DbAdapter -.-> SqliteImpl
        DbAdapter -.-> MemImpl
    end

    subgraph BridgeLayer ["Capacitor Bridge Layer (src/bridges/*)"]
        HttpBridge["HttpClientBridge Interface<br>(CapacitorHttp 実通信 / テスト時 Fixture モック)"]
        AppBridge["AppBridge Interface<br>(@capacitor/app システム戻るボタン・exitApp / テスト時モック)"]
        WebViewBridge["WebViewDomBridge Interface<br>(内蔵WebView DOM抽出 / テスト時モック)"]
        CloudSyncBridge["CloudSyncBridge Interface<br>(Google Identity Services & Drive appDataFolder / テスト時モック)"]
        VolumeKeyBridge["VolumeKeyBridge Interface<br>(VolumeKeyPlugin 音量キーインターセプト / テスト時モック)"]
    end

    Hooks --> Registry
    Hooks --> Repos
    Hooks --> HttpBridge
    Hooks --> AppBridge
    Hooks --> WebViewBridge
    Hooks --> CloudSyncBridge
    Hooks --> VolumeKeyBridge
```

---

## 2. 標準ディレクトリ構成とアセット管理規約

### 2.1 リポジトリ全体ツリー

```text
Yommy/
├── assets/                            # 【マスターアセット】高解像度マスター画像（assets/icon.png 1024×1024）
├── public/                            # 【Web 静的アセット】favicon.ico, icon-192.png, icon-512.png, apple-touch-icon.png
├── android/                           # 【Android プロジェクト】Capacitor ネイティブコード＆リソース
│   ├── debug.keystore                 # 【固定署名鍵】開発・検証用一貫デバッグキーストア（Issue #78）
│   └── app/src/main/res/              # mipmap-* (ic_launcher*), values/ic_launcher_background.xml
├── scripts/                            # 【ビルド・検証・環境同期スクリプト】generate-icons.mjs, serve-storybook.mjs, sync-env.mjs 等
└── src/                               # 【アプリケーションソースコード】
    ├── App.tsx                        # ルートコンポーネント（テーマ適用・ルーター配置・OS戻るボタン連携）
    ├── App.stories.tsx
    ├── App.test.tsx
    ├── app/                           # アプリケーション共通設定・DI Provider
    │   ├── router.tsx                 # 画面ルーティング定義（SCR-01〜SCR-07）
    │   ├── router.stories.tsx
    │   ├── router.test.tsx
    │   ├── ServiceProvider.tsx        # Storage / HttpBridge / AppBridge / ParserRegistry の Context DI（実機・テスト差し替え点）
    │   ├── ServiceProvider.stories.tsx
    │   └── ServiceProvider.test.tsx
    ├── bridges/                       # 【Capacitor Bridge 抽象層】
    │   ├── app/                       # 【AppBridge】システム戻るボタン・アプリ終了制御（Issue #78）
    │   │   ├── types.ts               # AppBridge, BackButtonEvent, BackButtonListener 定義
    │   │   ├── capacitorAppBridge.ts  # @capacitor/app 実装
    │   │   ├── mockAppBridge.ts       # UT / Storybook / IT 用モック実装（triggerBackButton）
    │   │   └── index.ts               # ブリッジ生成・エクスポート
    │   ├── cloud-sync/                # 【CloudSyncBridge】Google Drive appDataFolder クラウド同期（Issue #120）
    │   │   ├── types.ts               # CloudSyncBridge, CloudSyncAuthState 定義
    │   │   ├── capacitorCloudSyncBridge.ts # Android ネイティブ Capacitor プラグイン実装
    │   │   ├── mockCloudSyncBridge.ts # UT / Storybook / IT 用インメモリ同期モック
    │   │   └── index.ts               # ブリッジ生成・エクスポート
    │   ├── volume-key/                # 【VolumeKeyBridge】ハードウェア音量キーインターセプト・ページ送り（Issue #203）
    │   │   ├── types.ts               # VolumeKeyBridge, VolumeKeyEvent, VolumeKeyListener 定義
    │   │   ├── capacitorVolumeKeyBridge.ts # Capacitor プラグイン（VolumeKeyPlugin）ラッパー実装
    │   │   ├── mockVolumeKeyBridge.ts # UT / Storybook / IT 用モック実装（triggerVolumeKey）
    │   │   └── index.ts               # ブリッジ生成・エクスポート
    │   ├── http/
    │   │   ├── types.ts               # HttpClientBridge インターフェース定義
    │   │   ├── capacitorHttpClient.ts # CapacitorHttp 実装（CORS回避・User-Agent・タイムアウト制御）
    │   │   └── mockHttpClient.ts      # UT / Storybook / IT 用フィクスチャ応答クライアント
    │   └── webview/                   # 【WebViewDomBridge】内蔵WebView DOMキャプチャ・フォールバック（Issue #269）
    │       ├── types.ts               # WebViewDomBridge, CapturedDomResult, OpenWebViewOptions 定義
    │       ├── capacitorWebViewDomBridge.ts # Android ネイティブプラグイン（WebViewDomPlugin）連携
    │       ├── mockWebViewDomBridge.ts # UT / Storybook / IT 用モック実装（setMockPage）
    │       ├── urlUtils.ts            # URL スキーム・安全性検証ユーティリティ
    │       └── index.ts               # ブリッジ生成・エクスポート
    ├── features/                      # 【3. Viewer & UI Layer（画面・機能別モジュール）】
    │   ├── bookshelf/                 # SCR-01: 本棚一覧（空状態での検索/ランキング誘導・更新チェック・ソート・お気に入りトグル＆フィルタ）
    │   ├── novel-detail/              # SCR-02: 作品詳細・目次一覧・1行アイコンバー（お気に入り/目次更新/3点メニュー）・一括キャッシュ・キャッシュ整理・内蔵ブラウザ導線（TR-09）・削除（Issue #343）
    │   ├── reader/                    # SCR-03: 小説リーダー（全画面100dvh・上下連動オーバーレイ＆RTLシークバー・縦書きCSSマルチカラム組版・2段階水平スライドアニメーション・音量キー送り・ルビ・しおり保存・取得エラー時内蔵ブラウザフォールバック導線 TR-10）
    │   ├── webview-import/            # SCR-04: 内蔵ブラウザ・DOMインポート画面（URLバー・ネイティブWebView起動・DOMキャプチャ保存・作品詳細/リーダー遷移・Issue #269）
    │   │   ├── index.ts               # 内蔵ブラウザ機能バレルエクスポート
    │   │   ├── types.ts
    │   │   ├── hooks/useWebViewImport.ts
    │   │   └── components/
    │   │       ├── WebViewImportPage.tsx
    │   │       └── WebViewImportContainer.tsx
    │   ├── search/                    # SCR-06: 検索画面（カクヨム・小説家になろうサイト切替・作品検索・カードから本棚追加・SCR-02遷移）
    │   ├── ranking/                   # SCR-07: ランキング画面（カクヨム・小説家になろうサイト切替・期間/ジャンル別ランキング・カードから本棚追加・SCR-02遷移）
    │   ├── settings/                  # SCR-05: 設定画面（組版・テーマ・フォント・余白・音量キー送り設定・サンプル文章プレビュー・クラウド同期・キャッシュ管理）
    │   ├── cache/                     # 優先度付きバックグラウンドキャッシュスケジューラ（high > medium > low）（Issue #344）
    │   │   ├── types.ts               # CachePriority, CacheFetchTask, CacheNovelProgress, CacheScheduler 契約定義
    │   │   └── services/
    │   │       └── cacheScheduler.ts  # 0ms割り込み・1.5sレート制限・download_queue同期・自動再開スケジューラ実装
    │   └── cloud-sync/                # クラウド同期（Google Drive appDataFolder・SyncEngine）（Issue #120, #342）
    │       ├── types.ts               # YommySyncState, SyncNovelData 等の同期データ型定義
    │       ├── hooks/                 # useBackgroundAutoPull.ts（全画面 5分復帰自動 Pull フック）
    │       └── services/              # スキーマ検証・競合マージ・デバウンス同期エンジン・完了購読
    ├── parsers/                       # 【1. Parser Layer（スクレイピング・DOM解析層）】
    │   ├── types.ts                   # NovelParser, ParsedNovelMetadata, ParsedChapterContent, ParsedSearchResult, ParsedRankingResult 等の型契約
    │   ├── parserRegistry.ts          # URL から対応サイト（kakuyomu / narou 等）を判定・ディスパッチ
    │   ├── fetchFullNovelIndex.ts     # 複数ページ目次（nextTocPageUrl）連続取得・結合パイプライン（Issue #239）
    │   ├── sanitizer.ts               # 小説本文 HTML サニタイズ＆正規化（XSS防止・ルビ/傍点保持）
    │   ├── kakuyomu/                  # カクヨム用パーサーとローカル HTML フィクスチャ
    │   │   ├── KakuyomuParser.ts
    │   │   ├── KakuyomuParser.test.ts
    │   │   └── __fixtures__/
    │   └── narou/                     # 小説家になろう用パーサーとローカル HTML/JSON フィクスチャ（Issue #239, #240）
    │       ├── NarouParser.ts
    │       ├── NarouParser.test.ts
    │       ├── genres.ts
    │       └── __fixtures__/
    ├── storage/                       # 【2. Storage Layer（ローカルDB・キャッシュ管理層）】
    │   ├── types.ts                   # エンティティ型および各 Repository インターフェース契約
    │   ├── schema.ts                  # SQLite テーブル DDL および初期行定義（実機・インメモリ共有）
    │   ├── schema.test.ts
    │   ├── index.ts                   # Storage バレルエクスポート
    │   ├── index.test.ts
    │   ├── adapter/
    │   │   ├── types.ts               # DatabaseAdapter インターフェース
    │   │   ├── capacitorSqlite.ts     # @capacitor-community/sqlite アダプター実装
    │   │   └── inMemoryDb.ts          # テスト・Web開発用インメモリDB実装（resetTestDb() 提供）
    │   └── repositories/
    │       ├── novelRepository.ts     # novels テーブル操作
    │       ├── chapterRepository.ts   # chapters テーブル操作（本文キャッシュ保存・削除・容量集計・download_queue連動整理）
    │       ├── settingsRepository.ts  # reader_settings 操作
    │       ├── appSettingsRepository.ts # app_settings 操作（ソート順等永続化）
    │       └── queueRepository.ts     # download_queue テーブル操作（永続ダウンロードキュー・中断再開・再試行管理、v0.9 Issue #268）
    └── shared/                        # 複数機能で共有する汎用 UI コンポーネント・ユーティリティ
        ├── constants/                 # アプリ基本情報・キャッシュ・レートリミット・タイポグラフィ等の共有定数（app.ts, cache.ts, typography.ts）
        ├── utils/                     # キャッシュ判定・容量フォーマット等の共有ユーティリティ（cache.ts, formatByteSize.ts）
        └── ui/                        # BottomTabBar 等共通コンポーネント（モバイル幅での改行防止縦並び flex-col sm:flex-row ＋ whitespace-nowrap 最適化）
├── docs/                              # 【ドキュメント正本（OKF）】
└── test/                              # 【統合・結合テスト】Playwright 実ブラウザ IT シナリオ
```

---

## 3. 各層の基底インターフェース契約（TypeScript 型定義正本）

### 3.1 Http / Bridge Layer 契約（`src/bridges/http/types.ts`）

```ts
export interface HttpRequestOptions {
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface HttpResponse {
  status: number;
  url: string; // リダイレクト後の最終URL
  html: string;
  headers: Record<string, string>;
}

export interface HttpClientBridge {
  /**
   * 指定URLからHTMLテキストを取得する。
   * Android実機では CapacitorHttp を用いてCORSを回避し、テスト環境ではローカルFixtureを返す。
   * 実機実装（CapacitorHttpClient）では既定タイムアウト 15秒（15000ms）および既定 User-Agent
   * （"Yommy/1.0 (Android; WebNovelReader)"）を適用し、fetchFullNovelIndex 等からの伝播を保証する。
   */
  getHtml(options: HttpRequestOptions): Promise<HttpResponse>;
}
```

### 3.2 App / Native Bridge 契約（`src/bridges/app/types.ts`）

```ts
export interface BackButtonEvent {
  canGoBack: boolean;
}

export type BackButtonListener = (
  event: BackButtonEvent,
) => void | Promise<void>;

export interface AppBridge {
  /**
   * システム戻るボタン（またはテスト環境でのバックキー押下）のリスナーを登録する。
   * @returns リスナー解除関数
   */
  addBackButtonListener(listener: BackButtonListener): () => void;

  /**
   * アプリケーションを終了する。
   * Android 実機では @capacitor/app の App.exitApp() を実行し、モック環境では呼出フラグを記録する。
   */
  exitApp(): Promise<void>;
}
```

### 3.3 Parser Layer 契約（`src/parsers/types.ts`）

```ts
/** 対応サイト識別子 */
export type NovelSiteType = "kakuyomu" | "narou" | "generic";

/** 目次内の1エピソード情報 */
export interface ParsedTocItem {
  chapterIndex: number; // 1始まりの連番
  remoteChapterId: string; // サイト固有のエピソード識別子（カクヨムepisodeId、なろう話数等）
  partTitle: string | null; // 章・部見出し（存在しない場合は null）
  title: string; // サブタイトル（各話タイトル）
  url: string; // エピソード本文ページの正規化URL
  publishedAt: string | null; // 公開・更新日時文字列（取得可能な場合）
}

/** 作品トップ（目次）ページから抽出される作品メタデータと目次リスト */
export interface ParsedNovelIndex {
  siteType: NovelSiteType;
  remoteWorkId: string; // サイト固有の作品識別子（例: カクヨム workId, なろう ncode）
  canonicalUrl: string; // 正規化された作品トップURL
  title: string; // 作品タイトル
  author: string; // 著者名
  synopsis: string; // あらすじテキスト
  chapters: ParsedTocItem[]; // エピソード目次一覧
  nextTocPageUrl: string | null; // 目次が複数ページに分かれる場合の次ページURL（なろう等）
  truncated?: boolean; // maxPages 等により目次取得が途中で打ち切られたかどうかのフラグ (R1-24, R2-12)
}

/** 各話ページから抽出される本文データ */
export interface ParsedChapterContent {
  remoteChapterId: string;
  title: string; // サブタイトル
  bodyHtml: string; // サニタイズ済み本文HTML（<p>, <br>, <ruby>, <rb>, <rt>, <rp>, <em> のみ許容）
  byteSize: number; // UTF-8 バイトサイズ
  prevChapterUrl: string | null;
  nextChapterUrl: string | null;
}

/** 検索・ランキング共通オプションおよび型 */
export type NovelSearchOrder =
  "weekly_ranking" | "popular" | "last_episode_published_at" | "published_at";
export type NovelSerialStatus = "all" | "running" | "completed" | "short";

export interface NovelSearchOptions {
  order?: NovelSearchOrder;
  serialStatus?: NovelSerialStatus;
  genre?: string;
  genres?: string[];
  excludeKeyword?: string;
  page?: number;
}

export type NovelRankingPeriod = "daily" | "weekly" | "monthly" | "entire";
export type NovelRankingWorkVariation = "all" | "long" | "short";

export interface NovelRankingOptions {
  period?: NovelRankingPeriod;
  genre?: string;
  workVariation?: NovelRankingWorkVariation;
  page?: number;
}

export interface NovelSearchResultItem {
  remoteWorkId: string;
  title: string;
  author: string;
  synopsis: string;
  genre: string;
  genreLabel: string;
  serialStatus: "running" | "completed";
  serialStatusLabel: string;
  episodeCount: number;
  characterCount: number;
  tags: string[];
  reviewPoints: number;
  lastEpisodePublishedAt: string | null;
  workUrl: string;
}

export interface NovelRankingResultItem extends NovelSearchResultItem {
  rank: number; // 順位（1始まり）
}

export interface ParsedSearchResult {
  items: NovelSearchResultItem[];
  pageInfo: {
    currentPage: number;
    hasNextPage: boolean;
    totalCount?: number;
  };
}

export interface ParsedRankingResult {
  items: NovelRankingResultItem[];
  pageInfo: {
    currentPage: number;
    hasNextPage: boolean;
  };
}

/** サイト別パーサーの共通インターフェース（Strategyパターン） */
export interface NovelParser {
  readonly siteType: NovelSiteType;

  /** 指定されたURLがこのパーサーの対象サイトかどうかを判定する */
  canParse(url: string): boolean;

  /** エピソードURL等から作品トップURLへ正規化する */
  normalizeWorkUrl(url: string): string;

  /** 作品トップHTMLから作品情報と目次一覧を抽出する（純粋関数・通信なし） */
  parseNovelIndex(html: string, pageUrl: string): ParsedNovelIndex;

  /** 各話HTMLから整形・サニタイズ済み本文HTMLを抽出する（純粋関数・通信なし） */
  parseChapterContent(html: string, pageUrl: string): ParsedChapterContent;

  /** 検索クエリ・オプションに応じた検索 URL を生成する（任意実装） */
  buildSearchUrl?(query: string, options?: NovelSearchOptions): string;

  /** 検索結果 HTML から作品一覧をパースする（任意実装・純粋関数） */
  searchNovels?(html: string, pageUrl: string): ParsedSearchResult;

  /** ランキング条件に応じたランキング URL を生成する（任意実装） */
  buildRankingUrl?(options?: NovelRankingOptions): string;

  /** ランキング結果 HTML から順位付き作品一覧をパースする（任意実装・純粋関数） */
  getRanking?(html: string, pageUrl: string): ParsedRankingResult;
}
```

---

### 3.4 Storage Layer 契約（`src/storage/types.ts`）

DB テーブル構造の詳細は [docs/specs/db-schema.md](db-schema.md) を正本とし、アプリケーション層は以下の Repository インターフェースを介してのみデータにアクセスします。

```ts
export type BookshelfSortOrder =
  "unread_first" | "last_read" | "latest_published" | "created_at" | "title";

export interface DeletedNovelRecord {
  id: string;
  deletedAt: number;
}

export type WritingMode = "vertical-rl" | "horizontal-tb";
export type ReaderTheme = "light" | "sepia" | "dark" | "black";

export interface NovelRecord {
  id: string;
  siteType: NovelSiteType;
  remoteWorkId: string;
  canonicalUrl: string;
  title: string;
  author: string;
  synopsis: string;
  totalChapters: number;
  cachedChapters: number;
  totalByteSize: number;
  bookmarkChapterIndex: number | null;
  bookmarkScrollProgress: number;
  isFavorite: boolean;
  hasNewUpdate?: boolean;
  latestEpisodePublishedAt?: string | null;
  lastCheckedAt: string | null;
  lastReadAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NovelSummary = Omit<NovelRecord, "synopsis">;

export interface ChapterRecord {
  id: string;
  novelId: string;
  chapterIndex: number;
  remoteChapterId: string;
  partTitle: string | null;
  title: string;
  url: string;
  bodyHtml: string | null;
  byteSize: number;
  isRead: boolean;
  publishedAt: string | null;
  downloadedAt: string | null;
}

export type ChapterSummary = Omit<ChapterRecord, "bodyHtml">;

export interface NovelRepository {
  listNovels(sortOrder?: BookshelfSortOrder): Promise<NovelSummary[]>;
  getNovelById(novelId: string): Promise<NovelRecord | null>;
  upsertNovelWithToc(
    index: ParsedNovelIndex,
    fetchedAt: string,
    options?: { updateOnly?: boolean },
  ): Promise<NovelRecord | null>;
  updateBookmark(
    novelId: string,
    chapterIndex: number,
    scrollProgress: number,
  ): Promise<void>;
  setFavorite(novelId: string, isFavorite: boolean): Promise<void>;
  deleteNovel(novelId: string, deletedAt?: number): Promise<void>;
  clearNewUpdate(novelId: string): Promise<void>;
  updateLastCheckedAt(novelId: string, checkedAt: string): Promise<void>;
  getDeletedNovels?(): Promise<DeletedNovelRecord[]>;
  purgeDeletedNovels?(idList: string[]): Promise<void>;
  updateSyncMetadata?(
    novelId: string,
    metadata: {
      isFavorite?: boolean;
      lastReadAt?: string | null;
      createdAt?: string;
      updatedAt?: string;
    },
  ): Promise<void>;
  purgeExpiredDeletedNovels?(cutoffTimeMs: number): Promise<void>;
}

export interface AppSettingsRepository {
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  getCloudSyncLastSyncedAt?(): Promise<number | null>;
  setCloudSyncLastSyncedAt?(timestamp: number | null): Promise<void>;
  getCloudSyncAccountEmail?(): Promise<string | null>;
  setCloudSyncAccountEmail?(email: string | null): Promise<void>;
}

export interface ChapterRepository {
  listChaptersByNovelId(novelId: string): Promise<ChapterSummary[]>;
  getChapter(
    novelId: string,
    chapterIndex: number,
  ): Promise<ChapterRecord | null>;
  saveChapterBody(
    novelId: string,
    chapterIndex: number,
    content: ParsedChapterContent,
    downloadedAt: string,
  ): Promise<void>;
  markChapterRead(
    novelId: string,
    chapterIndex: number,
    isRead: boolean,
  ): Promise<void>;
  deleteCachedBodies(
    novelId: string,
    options?: { onlyRead?: boolean },
  ): Promise<number>;
  deleteAllCachedBodies(options?: { onlyRead?: boolean }): Promise<number>;
  getStorageCacheSummary(): Promise<{
    totalCachedChapters: number;
    totalByteSize: number;
  }>;
}

export type DownloadQueueStatus =
  "pending" | "downloading" | "completed" | "failed";

export interface DownloadQueueItem {
  id: number;
  novelId: string;
  chapterIndex: number;
  targetUrl: string;
  status: DownloadQueueStatus;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueChapterInput {
  chapterIndex: number;
  targetUrl: string;
}

export interface QueueRepository {
  enqueueChapters(
    novelId: string,
    items: EnqueueChapterInput[],
    nowIso?: string,
  ): Promise<void>;
  listByNovelId(novelId: string): Promise<DownloadQueueItem[]>;
  updateStatus(
    novelId: string,
    chapterIndex: number,
    status: DownloadQueueStatus,
    options?: {
      lastError?: string | null;
      incrementRetry?: boolean;
      nowIso?: string;
    },
  ): Promise<void>;
  resetInterruptedToPending(novelId: string, nowIso?: string): Promise<void>;
  deleteByNovelAndChapters(
    novelId: string,
    chapterIndexes: number[],
  ): Promise<void>;
  clearNovelQueue(novelId: string): Promise<void>;
  clearAllQueue(): Promise<void>;
}

/**
 * フォント種別（v0.5 Issue #169）
 * - biz-ud-mincho: UD明朝（既定値、'BIZ UDMincho', 'Noto Serif CJK JP', 'Noto Serif JP', 'IPAexMincho', serif）
 * - mincho: 明朝体（'Noto Serif CJK JP', 'Noto Serif JP', 'IPAexMincho', 'Hiragino Mincho ProN', 'Yu Mincho', serif）
 * - biz-ud-gothic: UDゴシック（'BIZ UDGothic', 'Noto Sans CJK JP', 'Noto Sans JP', 'IPAexGothic', sans-serif）
 * - gothic: ゴシック体（'Noto Sans CJK JP', 'Noto Sans JP', 'IPAexGothic', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif）
 * - klee: 教科書体（'Klee One', 'Klee', 'Noto Serif CJK JP', serif）
 */
export type ReaderFontFamily =
  "biz-ud-mincho" | "mincho" | "biz-ud-gothic" | "gothic" | "klee";

/**
 * ページ送り動作モード
 * - auto: 自動（縦書き時はページめくり、横書き時はスクロール）
 * - paged: ページめくり（縦書き時のみ有効、横書き時はスクロール固定）
 * - scroll: 常に連続スクロール
 * ※ v0.5 Issue #168: 横書き時は常に連続スクロールに固定され、設定画面では「ページめくり（縦書き時）」「連続スクロール」の2択に整理される。
 */
export type ReaderPagingMode = "auto" | "paged" | "scroll";

export interface ReaderSettings {
  writingMode: WritingMode;
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  fontSizePx: number;
  lineHeight: number;
  pageMarginPx: number;
  enableTapPaging: boolean;
  enableVolumeKeyPaging: boolean;
  pagingMode: ReaderPagingMode;
  updatedAt: string;
}

export interface SettingsRepository {
  getReaderSettings(): Promise<ReaderSettings>;
  updateReaderSettings(patch: Partial<ReaderSettings>): Promise<ReaderSettings>;
  getCloudSyncLastSyncedAt?(): Promise<number | null>;
  setCloudSyncLastSyncedAt?(timestamp: number | null): Promise<void>;
  getCloudSyncAccountEmail?(): Promise<string | null>;
  setCloudSyncAccountEmail?(email: string | null): Promise<void>;
}
```

### 3.5 Application Router 契約（`src/app/router.tsx`）

外部ルーティングライブラリへの依存を持たず、History API（`window.history.pushState` / `popstate` / `replaceState`）と React Context による軽量ルーターで画面遷移（[docs/specs/screen-transitions.md](screen-transitions.md)）を管理します。

```ts
export type AppRoute =
  | { name: "bookshelf"; path: "/" }
  | { name: "search"; path: "/search" }
  | { name: "ranking"; path: "/ranking" }
  | { name: "settings"; path: "/settings" }
  | { name: "novel-detail"; path: string; novelId: string }
  | { name: "reader"; path: string; novelId: string; chapterIndex: number }
  | {
      name: "browser";
      path: string;
      url: string;
      novelId?: string;
      chapterIndex?: number;
      originPath?: string;
    };

export interface NavigateToReaderOptions {
  replace?: boolean;
  fromBookshelfResume?: boolean;
}

export interface NavigateToBrowserOptions {
  novelId?: string;
  chapterIndex?: number;
  originPath?: string;
  replace?: boolean;
}

export interface RouterContextValue {
  currentPath: string;
  previousPath?: string;
  novelOrigin: string | null;
  settingsOrigin: string | null;
  browserOrigin: string | null;
  route: AppRoute;
  navigate: (path: string) => void;
  navigateToBookshelf: () => void;
  navigateToSearch: () => void;
  navigateToRanking: () => void;
  navigateToNovelDetail: (novelId: string, origin?: string) => void;
  navigateToReader: (
    novelId: string,
    chapterIndex: number,
    options?: NavigateToReaderOptions,
  ) => void;
  navigateToSettings: () => void;
  navigateToBrowser: (url: string, options?: NavigateToBrowserOptions) => void;
  back: () => void;
  blockBackNavigation?: () => () => void;
  isBackNavigationBlocked?: () => boolean;
}
```

- `novelId`（例: `"kakuyomu:16817330658027210412"`）を URL パスに含める際は `encodeURIComponent` でエンコードし、ルート解決（`matchRoute`）時に `decodeURIComponent` でデコードする。
- `RouterProvider` は `initialPath?: string` プロパティを受け取り、Vitest 単体テストや Storybook において任意のルート状態を決定論的に再現できる。
- `navigate` は同一パスへの遷移呼び出し時（例: `/settings` での「設定」タブ再タップ、`/search` での「検索」タブ再タップ）は履歴追加（`pushState`）および `previousPath` の上書きを行わず no-op とする。
- **モーダル表示中の戻る遷移抑止ガード（`blockBackNavigation`、`v1.1` Issue #342）**:
  - リーダー画面のしおり競合確認モーダル（`BookmarkConflictDialog`）等の誤操作防止が必要な状態では `blockBackNavigation()` を登録（戻り値のクリーンアップ関数で解除）し、登録中は `isBackNavigationBlocked()` が `true` を返却する。
  - `isBackNavigationBlocked() === true` の間は、`App.tsx` の `appBridge.addBackButtonListener` が Android OS バックキー処理をスキップするとともに、`popstate` イベント発火時もルート遷移を行わず現在パスを復元維持する。
- **設定画面復帰オリジン制御（`settingsOrigin`、Issue #124 / R1-22）**:
  - 設定画面（`SCR-05: /settings`）への遷移時、直前画面がリーダー（`SCR-03`）または作品詳細（`SCR-02`）の場合はそのパスを `settingsOrigin` として保持する。
  - OS バックキー実行時、`settingsOrigin` が保持されていれば直前画面へ復帰し、`settingsOrigin` を `null` にリセットする。
  - 下部タブバー等で別の主画面（本棚・検索・ランキング）へ移動した際も `settingsOrigin` は `null` にリセットされる。
- **内蔵ブラウザ画面復帰オリジン制御（`browserOrigin`、Issue #269 / R1-19）**:
  - 内蔵ブラウザ画面（`SCR-04: /browser`）への遷移時、直前画面（作品詳細 `SCR-02` またはリーダー `SCR-03`）または明示された `originPath` を `browserOrigin` として保持する。
  - 「← 戻る」ボタン押下時または OS バックキー実行時、`browserOrigin` が保持されていれば直前画面へ復帰し、未指定時は本棚（`/`）へ復帰する（`TR-12`）。
- **OS バックキー（@capacitor/app の AppBridge 経由およびブラウザ戻る操作）の論理階層遷移制御**:
  - ブラウザ履歴順に依存せず、常に論理階層順（**各話View `SCR-03` → 目次 `SCR-02` → 直前の遷移元（本棚 `SCR-01`、検索 `SCR-06`、ランキング `SCR-07`）**、**設定 `SCR-05` → 直前画面（リーダー `SCR-03`、作品詳細 `SCR-02`、または本棚 `SCR-01`）**、**検索 `SCR-06` / ランキング `SCR-07` → 本棚 `SCR-01`**）で戻るよう制御する。
  - 本棚の「続きから読む」から各話Viewへ直行した場合も、ルーターが履歴スタックに目次（`/novels/:novelId`）を介在させることで、バックキー 1 回で確実に目次画面へ戻る。
  - リーダー画面内の前後話連続遷移（第1話 → 第2話）では `history.replaceState` を適用し、履歴の肥大化を防ぎつつバックキー 1 回で目次へ復帰できるようにする。
  - リーダー離脱時には未保存のしおり進捗変更がある場合のみ最新の閲覧話数・スクロール進捗率を SQLite へ自動保存（`flushBookmark`）し、未操作離脱時は `last_read_at` を上書きしない（`AC-RD-34`）。
  - 作品詳細・目次画面（`SCR-02`）からのバックキー操作時は、直前の呼び出し元画面（本棚 `SCR-01`、検索 `SCR-06`、またはランキング `SCR-07`）へ戻る（`TR-07`、直前履歴が存在しない場合は本棚 `/` へ復帰）。
  - 設定画面（`SCR-05`）で OS バックキーを実行したとき、直前の画面（リーダー `SCR-03`、作品詳細 `SCR-02`）またはホームの本棚画面（`SCR-01`）へ復帰する。検索画面（`SCR-06`）、ランキング画面（`SCR-07`）ではホームの本棚画面（`/`）へ復帰する（`TR-12`）。
  - 本棚画面（`SCR-01: /`）でバックボタンが押された際は、2秒以内の連続2回押下で `AppBridge.exitApp()` を呼び出してアプリを終了し、1回目押下時は画面下部に「もう一度バックボタンを押すと終了します」の一時確認トースト（`role="status"`、2秒後に自動消去）を表示する（`TR-13`）。

### 3.6 クラウド同期データ構造契約（`src/features/cloud-sync/types.ts`、Issue #120 / R1-35）

Google Drive（`appDataFolder`）上の同期ファイル `yommy-sync-state.json` および同期エンジン（`SyncEngine`）で共有されるデータ構造契約です。

```ts
import type { NovelSiteType } from "../../parsers/types";

/**
 * yommy-sync-state.json のルートデータ構造
 */
export interface YommySyncState {
  /** スキーマバージョン（初期値: 1） */
  version: 1;
  /** 最終同期日時（ISO 8601 UTC 文字列） */
  lastSyncedAt: string;
  /** 作品基本情報・しおり・既読マップ（キー: novelId） */
  novels: Record<string, SyncNovelData>;
  /** 削除済み作品の Tombstone マップ（キー: novelId, 値: 削除日時 ISO 8601） */
  deletedNovels: Record<string, string>;
}

/**
 * 同期対象の個別作品データ構造
 */
export interface SyncNovelData {
  id: string; // "{site_type}:{remote_work_id}"
  siteType: NovelSiteType;
  remoteWorkId: string;
  canonicalUrl: string; // 作品トップURL
  title: string;
  author: string;
  synopsis: string;
  totalChapters: number;
  isFavorite: number; // 0 | 1
  hasNewUpdate: number; // 0 | 1
  latestEpisodePublishedAt: string | null;
  bookmarkChapterIndex: number | null; // しおり話数（1始まり）
  lastReadAt: string | null; // 最終閲覧日時（ISO 8601）
  readChapterIds: string[]; // 既読エピソードID（remote_chapter_id）の配列
  createdAt: string; // 初回登録日時（ISO 8601）
  updatedAt: string; // レコード更新日時（ISO 8601）
}
```

### 3.7 キャッシュ鮮度・先読み・一括キャッシュ制御ポリシー（v0.3 新設）

読書体験の快適化（待ち時間ゼロ）と外部小説サーバーへの負荷低減（503 IP BAN 防止）を両立するため、共通定数モジュール（`src/shared/constants/cache.ts`）に以下の定数を定義し、制御ポリシーを適用します。

```ts
/** キャッシュの有効期間（7日間） */
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** 既存キャッシュが存在する場合の再取得短タイムアウト（3秒） */
export const SHORT_TIMEOUT_MS = 3000;
/** 未キャッシュ話等の初回取得標準タイムアウト（10秒） */
export const STANDARD_TIMEOUT_MS = 10000;
/** 先読みおよび一括キャッシュのリクエスト間隔ウェイト（1.5秒） */
export const PREFETCH_INTERVAL_MS = 1500;
/** 読書中の自動先読み対象話数（5話先まで） */
export const PREFETCH_COUNT = 5;
```

1. **キャッシュ鮮度判定（TTL 7日間）**:
   - `chapters.downloaded_at` が現在時刻から `CACHE_TTL_MS`（7日）以内の場合、キャッシュを「有効（Fresh）」とみなし、通信を行わず即座に SQLite の本文を描画する。
   - 先読みおよび一括キャッシュにおいても、有効なキャッシュを持つ話数はスキップされる。
2. **読書中 5 話自動先読み（`useReader` → `CacheScheduler` 優先度 `'medium'`）**:
   - 第 $N$ 話の本文読み込み完了後、バックグラウンドで $N+1 \sim \min(N+5, \text{totalChapters})$ のエピソードを昇順で順次取得・SQLite 保存する（なお現在話の即時取得は最優先 `'high'` として 0ms 待機・進行中 `'medium'`/`'low'` 即中断で実行）。
   - 対象サーバーの過負荷防止（第 $N$ 話取得直後の連続リクエスト抑止）のため、最初の先読み（第 $N+1$ 話）リクエスト開始前に `PREFETCH_INTERVAL_MS`（1.5秒）の初期インターバルを空け、以降も 1話の取得完了ごとに 1.5秒のウェイトを空けて直列実行する。
   - `CacheScheduler` 注入時はリーダーの先読み（`'medium'`）のみを `AbortController` / キャンセル ID で制御し、ユーザーが `goToChapter` で別エピソードへ移動した際やリーダー画面を離脱した際は、直前の `'medium'` タスク（進行中の HTTP 通信含む）のみを直ちにキャンセルしてリソースを解放する（`'low'` 一括キャッシュタスクは中断せず完了後に自動再開させる）。また先行先読みタスク（進行中の HTTP 通信含む）の完了・中断待機による直列化、初期ロード通信完了後のマウント状態ガード（`isMounted`）、および `AbortSignal` 連動により、画面離脱後の DB 書き込みを防止する（R1-29）。
3. **作品詳細での未取得話一括キャッシュと優先度スケジューラ・永続ダウンロードキュー統合（`useNovelDetail` → `CacheScheduler` 優先度 `'low'` / `QueueRepository`、`v0.3` Issue #81 / `v0.9` Issue #268 / `v1.2` Issue #344）**:
   - 作品詳細ヘッダーの3点メニュー内「未取得話を一括キャッシュ」（または中断後の「キャッシュを再開（残りN話）」、失敗後の「失敗した話を再試行（N話）」）操作（`TR-18`、`v1.1` Issue #343）により、未キャッシュエピソード（および TTL 7日経過した古いキャッシュ）を `CacheScheduler.enqueueBatchCache`（優先度 `'low'`）へ委譲し、`CacheScheduler` 内で `QueueRepository`（`download_queue` テーブル）へ `'pending'` 登録（キュー投入完了時に即時 resolve）した上で `PREFETCH_INTERVAL_MS`（1.5秒）間隔で順次直列取得する。
   - **`SCR-02` 非ブロッキング ＆ 画面離脱継続**: 一括キャッシュ実行中も `SCR-02` の閲覧操作・リーダー遷移（`TR-04`）をブロックせず、`SCR-02` を離脱（アンマウント）しても `CacheScheduler` 上の `'low'` タスクは中断せずアプリ起動中バックグラウンド継続する。リーダー遷移で `'high'`（即時取得）や `'medium'`（5話先読み）が投入された場合は `'low'` を自動退避（実行中の `'downloading'` 行は `retryCount` を増加させず `'pending'` へ巻き戻し）し、上位優先度キューが空になった時点で残 `'pending'` 話から自動再開する。
   - 1話取得開始時にステータスを `'downloading'`、保存成功時に `'completed'` へ更新し、進捗購読（`subscribeProgress`）経由で `SCR-02` 表示中または再訪問時にヘッダーの取得済み話数（`cachedChapters`）・容量および各話リストのキャッシュバッジをリアルタイムに更新する（`novels.updated_at` は更新せず保持する、R2-16）。`SCR-02` 再訪問時に `cacheScheduler.isNovelBatchCaching(novelId) === true` の場合は `resetInterruptedToPending` を呼び出さない。
   - 特定話の取得に失敗（通信エラー・タイムアウトかつ既存キャッシュなし）した場合は、ループ全体を中断せず `download_queue` に `status = 'failed'`（`retry_count = retry_count + 1`、`last_error` 記録）として保存し、1.5秒ウェイト後に後続の `'pending'` 話の取得を継続する。ループ完了後に失敗話が存在する場合は該当エピソード行に `取得失敗` バッジ（`episode-failed-badge`）、ヘッダーにエラー通知と `失敗した話を再試行（N話）` ボタンを表示する。
   - ユーザー手動中断（「中断」ボタン）時は `pauseNovelTasks` で安全に処理を停止して未完了 `'downloading'` 話を `'pending'` に戻して保持する（`キャッシュを再開（残りN話）` へ遷移）。作品削除・本文キャッシュ削除時は `cancelNovelTasks(novelId, { clearQueue })` / `cancelAllTasks({ clearQueue })` で書き込み完了を待機した上で、全削除（`onlyRead: false`）時のみキューをクリアし、既読のみ削除（`onlyRead: true`）時は未読 `'pending'`/`'failed'` キューを保持する（`R1-18`）。またリーダー閲覧・先読み・DOM インポートで既に有効キャッシュ済みとなった話は自動的にキューから除外され、全話取得完了時および全削除時にはキューレコードが自動クリーンアップされる。
   - **全画面自動 Pull（Tombstone 削除 ＆ 差分目次補完）とのバックグラウンド競合保護（`v1.1` `useBackgroundAutoPull` 協調）**: `useBackgroundAutoPull` は全画面で動作するため、`CacheScheduler` が `'low'`/`'medium'` タスクを実行中に他端末からの Tombstone 削除（`novelRepository.deleteNovel(novelId)` カスケード削除）が発生し得る。このレースコンディションによる `FOREIGN KEY` 例外・削除済み作品への幽霊書き込み・誤失敗記録を防ぐため、`CacheScheduler` は各話の **HTTP 通信直前** および **`httpClient.getHtml` 完了直後（`chapterRepository.saveChapterBody` / `queueRepository.updateStatus` 実行直前）** に `signal.aborted` に加えて **`await chapterRepository.getChapter(novelId, chapterIndex) !== null`** を検証する。`null`（作品または対象話が削除済み）が返った場合、`'low'` タスクであれば残存する同一 `novelId` のメモリ上未処理タスクを破棄し `status: "cancelled"` で安全終了（`saveChapterBody` / `updateStatus` / 失敗加算を実行しない）し、`'high'`/`'medium'` タスクも書き込みを行わず安全中断する。また `SyncEngine` の `mergeExistingNovel` による差分目次自動補完（`upsertNovelWithToc(..., { updateOnly: true })`、`R1-19`）、`saveChapterBody` のアトミックな `download_queue` 削除（`R1-44`）、および `saveChapterBody` / `recalculateNovelStats` の `novels.updated_at` 保持規律（`R1-01`）とも競合なく安全に共存する。

#### 3.7.1 `CacheScheduler` 契約（`src/features/cache/types.ts`、`v1.2` Issue #344 新設）

アプリ全体で単一インスタンスとして `ServiceProvider` が **`fallbackDefaultsRef`（`R1-24`）同様の `useRef` 等による安定参照**（再レンダリング時に再生成せずマウント期間中同一参照を保持し、アンマウント時のみ `dispose()` で解放）として保持・提供（`cacheScheduler?: CacheScheduler`）し、リーダー即時取得（`high`）・5話先読み（`medium`）・バックグラウンド一括キャッシュ（`low`）の優先順位調停および 1.5 秒レート制限を一元管理します：

```ts
export type CachePriority = "high" | "medium" | "low";

export type CacheBatchStatus =
  "idle" | "running" | "preempted" | "paused" | "completed" | "cancelled";

export interface CacheNovelProgress {
  novelId: string;
  isBatchCaching: boolean;
  status: CacheBatchStatus;
  current: number;
  total: number;
  failedCount: number;
  failedChapterIndexes: number[];
  pausedReason: "none" | "preempted";
}

export interface CacheScheduler {
  /** 指定優先度（high: 0ms割り込み［既存キャッシュ無ければ失敗時reject］ / medium: 1.5s先読み［失敗時は警告ログのみでrejectしない］）で単話/複数話を取得する */
  enqueuePrefetch(options: {
    novelId: string;
    chapterIndexes: number[];
    priority: "high" | "medium";
    signal?: AbortSignal;
  }): Promise<void>;
  /** 作品の未取得話を low 優先度バッチとして download_queue 登録・スケジュールし、キュー投入完了時に即時 resolve する（全話完了までは待機しない） */
  enqueueBatchCache(novelId: string, chapterIndexes: number[]): Promise<void>;
  /** 一時停止（実行中の 'downloading' は retryCount 非増加で 'pending' に戻し、既存キュー行を保持） */
  pauseNovelTasks(novelId: string): Promise<void>;
  /** 指定作品のタスクを中断・完了待機する（clearQueue !== false で clearNovelQueue を実行） */
  cancelNovelTasks(
    novelId: string,
    options?: { clearQueue?: boolean },
  ): Promise<void>;
  /** 全作品の全タスクを中断・完了待機する（SCR-05 設定画面キャッシュ一括整理前等に実行、clearQueue !== false で clearAllQueue） */
  cancelAllTasks(options?: { clearQueue?: boolean }): Promise<void>;
  /** 対象作品で現在バックグラウンド一括キャッシュがアクティブか判定 */
  isNovelBatchCaching(novelId: string): boolean;
  /** 対象作品の現在の進捗スナップショットを取得 */
  getNovelProgress(novelId: string): CacheNovelProgress | null;
  /** 進捗更新・完了・失敗通知を購読（アンマウント時は購読解除のみ行いタスク継続） */
  subscribeProgress(
    novelId: string,
    listener: (progress: CacheNovelProgress) => void,
  ): () => void;
  /** DOMインポート等の外部保存後にキュー・進捗を再同期 */
  syncNovelProgress(novelId: string): Promise<void>;
  /** ServiceProvider アンマウント時に全メモリタイマー・コントローラを破棄 */
  dispose(): void;
}
```

4. **7日経過キャッシュの短タイムアウトフォールバック**:
   - 取得から 7日以上経過したキャッシュは、閲覧時・先読み時・一括キャッシュ時に `SHORT_TIMEOUT_MS`（3秒）で再取得を試みる。
   - 3秒以内に取得成功した場合は新本文で DB および画面を更新する。
   - タイムアウト・オフライン・通信エラー等で失敗した場合は、**即座に既存の `bodyHtml` を使用してフォールバック表示** し（一括キャッシュ時は既存キャッシュを維持して次話へ進行）、エラー画面を表示せず読書を継続させる。

5. **複数ページ目次（`nextTocPageUrl`）の連続取得制御（v0.7 Issue #239 新設）**:
   - 小説家になろう（`ncode.syosetu.com`）の 100 話超作品のように作品目次が `?p=2`, `?p=3`... と複数ページに分割される場合、共通パイプライン `fetchFullNovelIndex`（`src/parsers/fetchFullNovelIndex.ts`）が `nextTocPageUrl` を順次辿って全目次ページを取得・結合する。
   - ページ間のリクエスト間隔ウェイトは `DEFAULT_TOC_PAGE_INTERVAL_MS`（`500ms`）、最大ページ上限は `MAX_TOC_PAGES`（`100` ページ ＝ 最大 10,000 話）とし、訪問済み URL セットによる無限ループ防止ガードを備える。
   - 2 ページ目以降の `nextTocPageUrl` 取得前には、SSRF および別作品混入を防ぐため **`https:` プロトコルかつ `parser.canParse(nextUrl) === true` かつ `parser.normalizeWorkUrl(nextUrl) === canonicalUrl`（同一作品）** を検証し、不一致の場合は通信を行わずループを終了する。
   - 2 ページ目以降の先頭エピソードに章見出し（`partTitle`）がない場合は直前ページ末尾の `partTitle` を引き継ぎ、全エピソードに `chapterIndex: 1..N` の連番を再採番する。
   - 途中ページの取得に失敗した場合は例外を送出して中断し、不完全な目次で既存 DB を上書きしない。

### 3.8 クラウド同期（Google Drive appDataFolder）および同期エンジンアーキテクチャ（v0.4 新設 / v0.7 マルチサイト拡張）

複数端末間での本棚登録作品・しおり位置・既読状態の同期、および機種変更時の引き継ぎを実現するため、Google Drive のアプリ専用領域（`appDataFolder`）に単一 JSON（`yommy-sync-state.json`）を保存・同期するアーキテクチャを導入します（Issue #120）。

#### 3.8.1 `CloudSyncBridge` インターフェース契約（`src/bridges/cloud-sync/types.ts`）

```ts
export type CloudSyncAuthState =
  | { status: "unlinked" }
  | { status: "authenticating" }
  | { status: "connected"; email?: string }
  | { status: "error"; message: string };

export interface CloudSyncBridge {
  /** 現在の Google 認証状態を取得する */
  getAuthState(): Promise<CloudSyncAuthState>;
  /** Google アカウント連携（認可フロー実行） */
  signIn(): Promise<CloudSyncAuthState>;
  /** 連携解除（OS トークン破棄および Google サーバーへの Revoke 実行） */
  signOut(): Promise<void>;
  /** appDataFolder から yommy-sync-state.json を取得する（存在しない場合は null） */
  pullFile(): Promise<string | null>;
  /** appDataFolder へ yommy-sync-state.json をアップロード・保存する */
  pushFile(content: string): Promise<void>;
}
```

- **`CapacitorCloudSyncBridge` における 401 判定（R2-14）**:
  - 作品 ID や URL に偶然 `"401"` が含まれる場合の誤判定を防ぐため、`isUnauthorizedError` では単語境界付き正規表現（`/\b401\s+Unauthorized\b/i`、`/\bHTTP\s+401\b/i`、`/\bstatus(?:\s*code)?\s*[:=]?\s*401\b/i`、`/\bUnauthorized\b/i`）で 401 認証エラーを厳格に検出する。

#### 3.8.2 同期エンジン（`SyncEngine`）の競合マージとゼロトラスト検証

- **ゼロトラスト検証**:
  - 受信した JSON に対し、通信前に厳格なランタイムスキーマ検証（`version === 1`、必須フィールド、数値範囲、プロトタイプ汚染防止）を実行する。
  - 作品 ID（`id`）が `${siteType}:${remoteWorkId}` と厳密に一致することを検証する。
  - `deletedNovels` のキーが空文字（`""`）や空白文字でないことを検証し、`novels` と `deletedNovels` の双方に同一キーが存在する場合は、作品の `createdAt` と `deletedAt` を比較し、`createdAt > deletedAt` であれば再登録を優先して `deletedNovels` から除外、`deletedAt >= createdAt` であれば削除を優先して `novels` から該当作品を除去する（R1-28, R1-05）。
  - 未登録作品の自動目次取得（`upsertNovelWithToc`）前に、`canonicalUrl` を `parseNovelUrl`（`https://kakuyomu.jp/works/<id>` および `https://ncode.syosetu.com/<ncode>/` のマルチサイトホワイトリスト検証、Issue #239）にかけ、不正な URL や未知ドメイン（`novel18.syosetu.com` 含む）へのリクエスト（SSRF）を遮断する。さらに `canonicalUrl` から抽出した `siteType` / `workId` とリモート作品データの整合性を検証し、正規化 URL および `fetchFullNovelIndex`（複数ページ目次対応）で通信を行う。
  - 401 Unauthorized エラーの判定は、作品 URL や作品 ID に偶然 `401` が含まれている場合の誤爆を防ぐため、HTTP ステータスコード 401、または単語境界を考慮した正規表現（`/\b401\s+Unauthorized\b/i` 等）を用いて厳格に行う（R1-13, R2-14）。
- **競合解決（マージ）ルール**:
  - 新規作品の自動目次補完: リモートにのみ存在する作品は `canonicalUrl` から目次を自動取得してローカル DB に登録し、リモートのしおり話数・既読状態、および最終読了日時（`lastReadAt`）・お気に入りフラグ（`isFavorite`）・初回登録日時（`createdAt`）・更新日時（`updatedAt`）を正しく復元・反映する（`novelRepository.updateSyncMetadata`、R1-12, R2-02）。
  - 作品単位のエラーハンドリング: リモート作品の目次取得・保存処理は作品単位で `try/catch` され、通信障害やパーサー不整合等で 1 作品の取り込みに失敗した場合でも警告ログを出力してスキップし、他の正常な作品の同期処理を継続する（R1-05）。
  - 作品削除の伝播（Tombstone）と再登録保護: `deletedNovels` の削除日時がローカル作品の登録日時より新しければ（`remoteDeletedAt >= localNovel.createdAt`）ローカル DB からカスケード削除し、その際リモートの `deletedAt` をローカル DB に保持する（ローカル現在時刻での上書き防止：R1-06）。ローカルで削除された作品は、削除後に他端末で明示的に再追加された場合（リモートの `createdAt` がローカルの `deletedAt` より後である場合）にのみ復元を許可し、単なる `updatedAt` の更新による意図しない削除作品の復活を防止する（R1-11, R1-05）。また新規作品 Pull 復元時（`mergeNewNovel`）に `remoteNovel.createdAt` および `remoteNovel.updatedAt` をローカル DB に同期保持することで、Pull 実行時のローカル現在時刻（`now`）によって後続の未 Push Tombstone 削除判定（`remoteDeletedAt >= created_at`）が妨げられる復活バグを防止する（R2-02）。本棚へ作品が再登録された際は `deleted_novels` テーブルから該当作品 ID の Tombstone を即座に削除する（R1-28）。さらに、定期更新チェック（`useBookshelf`）や目次再取得（`useNovelDetail`）では `upsertNovelWithToc(..., { updateOnly: true })` を使用し、作品削除との競合時に削除された作品が誤って再登録されたり Tombstone が消去されたりする競合を防止する（R1-02）。
  - Push 前の作品和集合およびフィールド単位マージ: `pushCurrentState` 実行時（`buildMergedSyncNovels`）、ローカルの `novels` のみでリモートを全上書きするのではなく、リモートに存在する `novels` と和集合をとってマージする（R1-10）。さらにリモートの `deletedNovels` に存在する削除作品がローカルに残存している場合はローカル DB からも削除して Push ペイロードから除外することでゾンビ復活を防止する（R1-43）。またローカルとリモートの双方に存在する作品（かつ新しい `deletedAt` で削除されていない作品）については、リモート値をローカル値で単純上書きせず、フィールド単位のマージ（`readChapterIds` の和集合、`lastReadAt` 比較による `bookmarkChapterIndex` / `lastReadAt` の LWW、`updatedAt` 比較による `isFavorite` / `updatedAt` の LWW）を実施して他端末の最新進捗消失を防止する（R2-01）。
  - 30日経過 Tombstone の自動パージ: 削除日時から30日（`TOMBSTONE_RETENTION_MS` = 30日）以上経過した古い Tombstone はローカル DB（`purgeExpiredDeletedNovels`）およびリモートへの Push 対象から自動的にパージし、同期データ容量の肥大化を防止する（R1-28）。
  - 既存作品の差分目次自動補完とオフライン/範囲外保護（`mergeExistingNovel` / `buildMergedSyncNovels`、`R1-19`）:
    - 既存作品の Pull マージ（`mergeExistingNovel`）では先にローカル `chapters` を取得し、`remoteNovel.totalChapters > localNovel.totalChapters`、`(remoteNovel.bookmarkChapterIndex !== null && remoteNovel.bookmarkChapterIndex > localNovel.totalChapters)`、または `remoteNovel.readChapterIds` にローカル未登録 ID が含まれる場合に、`parseNovelUrl`（`siteType` / `workId` 整合検証）と `fetchFullNovelIndex` 経由で最新目次を取得して `upsertNovelWithToc(..., { updateOnly: true })` でローカル目次を補完し、`localNovel` と `chapters` を再取得した上でしおり・既読マージを適用する。
    - オフライン・通信エラー等で差分目次取得に失敗した場合は例外で同期全体を止めず警告に留め、かつ `remoteIsNewer` かつ `remoteNovel.bookmarkChapterIndex > currentLocalNovel.totalChapters` の場合はローカル未存在話への不正なしおりおよび `lastReadAt` 上書きをスキップして整合性を保つ（`isFavorite` や既知 `readChapterIds` はマージ継続し、次回同期で再試行可能とする）。
    - Push マージ（`buildMergedSyncNovels`）では `totalChapters: Math.max(local.totalChapters, remoteNovel.totalChapters)`（および新しい `latestEpisodePublishedAt`）を保持し、旧目次のままの端末からの Push によるリモート話数ダウングレードを防止する。
  - しおり話数のマージ: 同一作品が両端末にある場合、`lastReadAt` が新しい方の `bookmarkChapterIndex` を採用する（話数変更時はスクロール率を `0.0` にリセット、同一話数の場合は端末ローカルのスクロール率を維持）。この際、`updateBookmark` による `last_read_at` のローカル現在時刻上書きを防ぐため、リモートの `lastReadAt` を `updateSyncMetadata` で復元・維持する（R1-07）。
  - お気に入り状態（`isFavorite`）の双方向 LWW マージと `updated_at` 保護規約（`v0.8` Issue #266 / R1-01 / R2-02）: 同一作品が両端末にある場合の Pull マージ（`mergeExistingNovel`）において、ローカル `localNovel.updatedAt` と `remoteNovel.updatedAt` を比較し、`Date.parse(remoteNovel.updatedAt) > Date.parse(localNovel.updatedAt)` の場合は `novelRepository.updateSyncMetadata(novelId, { isFavorite: remoteNovel.isFavorite === 1, updatedAt: remoteNovel.updatedAt })` を呼び出してローカルの `is_favorite` および `updated_at` をリモート側の最新状態へ更新する。また新規作品の Pull マージ（`mergeNewNovel`）時も `updateSyncMetadata` へリモート `createdAt` および `updatedAt` を伝播する（R1-19, R2-02）。さらに、定常的な目次更新チェック（`upsertNovelWithToc`）、読書時のしおり更新（`updateBookmark`）、本文キャッシュ保存・再集計（`saveChapterBody`, `recalculateNovelStats`）、キャッシュ削除（`deleteCachedBodies`）では `novels.updated_at` を更新せず既存値を保持する規律を徹底し、ローカルの定常動作によって `updated_at` が不当に進んで他端末の最新お気に入り状態が上書き消失する競合を防止する（R1-01）。これにより Push 時（`buildMergedSyncNovels`）および Pull 時の双方向でお気に入り状態の確実な Last-Write-Wins（LWW）同期が保証される。
  - 既読状態のマージ: 両端末の既読エピソード ID の和集合（Union）を採用する。
- **自動同期トリガーと排他・デバウンス制御**:
  - 未連携時のガード: `cloudSyncBridge.getAuthState()` が `connected` 状態でない場合、`pullAndMerge()` および `pushCurrentState()` は通信を行わず即座に安全にリターンする（R1-14）。
  - 自動 Pull と保留変更の自動 Push（`hasUnsyncedChanges`、`R1-23`）: アプリ起動時（`useBookshelf` 初回マウント）、および全画面共通のバックグラウンド復帰時（`useBackgroundAutoPull` により `AppContent` ルートで監視、休止から 5 分 `300,000ms` 以上経過、`v1.1` Issue #342 にて本棚限定から全画面へ拡張）に `pullAndMerge()` を自動実行する。`SyncEngine` は `scheduleDebouncedPush()` で `hasUnsyncedChanges = true` を記録（`cancelDebouncedPush()`・未連携時・`pushFile` 成功時に `false` クリア）しており、`pullAndMerge()` で `doPullAndMerge()` を完了した後に `hasUnsyncedChanges === true` が残っている場合は進行中デバウンスを解除して `pushCurrentState()` を即時実行する（送信失敗時は例外を送出せず `hasUnsyncedChanges = true` を保持して次回再送に備える）。
  - Pull 完了購読通知（`SyncEngine.subscribePullCompleted`、`v1.1` Issue #342 / `R1-23`）: `pullAndMerge()` 完了時に `{ pulled, mergedNovels }` を購読リスナーへ通知し、現在表示中の画面フック（`useBookshelf` サイレント再取得、`useNovelDetail` しおり・既読表示サイレント自動更新、`useReader` しおり話数競合検知、`useCloudSync` 最終同期日時再取得、`useStorageCache` ストレージ容量サイレント再集計）へ安全に伝播する。
  - 自動 Push: 本棚作品追加・削除、お気に入り（★）登録・解除（`SCR-01` / `SCR-02` での `toggleFavorite`）、およびリーダー話数遷移・既読更新・しおり進捗保存時に 2〜3秒（2500ms）デバウンス付き非同期実行（`syncEngine.notifyChanged()`）。なおリーダー未操作離脱時の `flushBookmark()` スキップ時は `notifyChanged()` を発火しない（`v1.1` Issue #342）。
  - 多重並行実行防止（排他制御・Single-flight）: `SyncEngine` 内部に排他制御機構（`isSyncing` フラグおよび FIFO キュー排他制御）を導入し、`pullAndMerge`、`pushCurrentState`、`sync` が同時に重なって実行されないよう安全にガードする。`sync()` が実行中に重複して呼び出された場合、実行中の Promise を再利用して単一実行に合流（Single-flight）させる。`scheduleDebouncedPush()` では生成した Promise に内部で `.catch(() => {})` を登録し、未処理例外（`UnhandledPromiseRejection`）を防止するとともに、`cancelDebouncedPush()` 実行時には保留中の Promise ハンドラーを漏れなく `resolve()` して呼び出し元のハングを防止する（R2-09）。

#### 3.8.3 ネイティブ Google Identity Services と 5 層セキュリティ設計

1. **OAuth クライアント識別と環境変数構成（R2-18）**: Android ネイティブ実装（`CloudSyncPlugin.java`）では、Google Identity Services（`AuthorizationClient`）が Google Cloud Console に登録された APK パッケージ名（`com.yommy.app`）と署名証明書の SHA-1 フィンガープリントによって OAuth クライアントを自動識別する（`AuthorizationRequest` にクライアント ID 文字列は渡さない）。一方、`.env.local`（`VITE_GOOGLE_CLIENT_ID`）は Web / 開発環境向けの任意設定参照用であり、Web ブラウザおよび自動テスト環境では `MockCloudSyncBridge` に安全にフォールバックする。
2. **非公開 Keystore 管理**: 公開 `android/debug.keystore` の SHA-1 は GCP に登録せず、GitHub Secrets で保護された非公開 Keystore の SHA-1 のみを登録して偽造 APK のなりすましを防ぐ。
3. **ネイティブ `AuthorizationClient` 認証（R2-02, R2-03, R2-14）**: サードパーティプラグインに依存せず、社内 Capacitor プラグイン（`CloudSyncPlugin.java`）経由で Android 公式 `Identity.getAuthorizationClient` を呼び出し、`client_secret` 排除・WebView 内トークン保存ゼロ（OS 側で短寿命アクセストークンを都度取得）とする。
   - **起動時の認証状態復元（`getAuthState`、R2-03）**: アプリ再起動時は `SharedPreferences`（`yommy_cloud_sync`）の連携状態に基づきサイレント再認可（`authorize`）でトークンを復元する。この際、`result.hasResolution()` が `true`（ユーザーが同意を取り消した等、対話的ログインが必須）の場合にのみ `SharedPreferences` をクリアして `unlinked` を返し、オフライン等の一時的な失敗時には `SharedPreferences` の連携設定を保持したまま `{ status: "error", message }` を返却する。
   - **401 失効時のキャッシュ破棄と再取得（R2-02, R2-14）**: `pullFile` / `pushFile` / `findSyncFileId` において `"401 Unauthorized"` を検知した際は、まず `Identity.getAuthorizationClient(activity).clearToken(ClearTokenRequest)` で Google Play 開発者サービス内のキャッシュ済み無効トークンを破棄してから `refreshAccessToken()` によるサイレント再取得・リトライを実行する。
   - **安全なファイル作成とライフサイクル管理**: ファイル初回作成時は `multipart/related`（`uploadType=multipart`）の 1 リクエストで作成し空ファイル残存を防止する。Activity 再生成時のコールバック消失防止（`saveCall` / `getSavedCall` / `freeSavedCall`）およびプラグイン破棄時の ExecutorService 解放（`handleOnDestroy`）を徹底する。
4. **最小権限スコープ（`drive.appdata` 限定）と即時 Revoke**: スコープを `drive.appdata` に限定し、連携解除時は OS トークン破棄＋Google サーバー即時 Revoke を実行。遠隔での認可解除（`401 Unauthorized`）検知時も自動で未連携状態へ安全にフォールバックする。
5. **SSRF / インジェクション防御**: スキーマ検証と `parseNovelUrl` ホワイトリスト検証を通過したデータのみを処理する。

### 3.9 キャッシュ容量フォーマット規約およびストレージ管理契約（Issue #170）

#### 3.9.1 バイト容量フォーマット共通ユーティリティ（`src/shared/utils/formatByteSize.ts`）

端末ストレージを圧迫するキャッシュデータを視認性高く提示するため、以下の規約でフォーマットする純粋関数を提供します：

```ts
export function formatByteSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

#### 3.9.2 ストレージ・キャッシュ管理フック契約（`src/features/settings/hooks/useStorageCache.ts`）

設定画面（`SCR-05`）における全体キャッシュ容量の可視化と一括本文キャッシュ削除（既読のみ／全話）を管理するカスタムフック契約です：

- `useStorageCache` は削除実行前（`clearCache(options)`）に `cacheScheduler?.cancelAllTasks({ clearQueue: !options.onlyRead })` を先行呼び出しし、バックグラウンド動作中タスクの書き込み競合を防止する（`onlyRead: true` 時は未読キューを保持、`R1-18`、`v1.2` Issue #344）。

```ts
export interface StorageCacheSummary {
  totalCachedChapters: number;
  totalByteSize: number;
}

export interface UseStorageCacheResult {
  summary: StorageCacheSummary;
  isLoading: boolean;
  isClearing: boolean;
  notice: string | null;
  error: string | null;
  clearCache: (options: { onlyRead: boolean }) => Promise<number>;
  refreshSummary: (options?: { silent?: boolean }) => Promise<void>;
}
```

### 3.10 ハードウェア音量キーブリッジ（`VolumeKeyBridge`）およびネイティブ連携アーキテクチャ（v0.6 新設: Issue #203）

リーダー画面（`SCR-03`）における片手持ち操作性向上のため、ハードウェア音量キー（Volume Down / Up）を捕捉し、Web 側のページ送り・スクロール送りと連携させるブリッジ層を導入します。

#### 3.10.1 `VolumeKeyBridge` インターフェース契約（`src/bridges/volume-key/types.ts`）

```ts
export type VolumeKeyDirection = "up" | "down";

export interface VolumeKeyEvent {
  direction: VolumeKeyDirection;
}

export type VolumeKeyListener = (event: VolumeKeyEvent) => void | Promise<void>;

export interface VolumeKeyBridge {
  /**
   * 音量キーインターセプトの有効/無効を切り替える。
   * Android 実機では有効時のみ KEYCODE_VOLUME_DOWN / KEYCODE_VOLUME_UP を捕捉し、OS 音量バー表示を抑止する。
   * リーダー離脱時や設定 OFF 時は false にすることで通常の OS 音量調整に戻す。
   */
  setVolumeKeyPagingEnabled(enabled: boolean): Promise<void>;

  /**
   * 音量キー押下イベントリスナーを登録する。
   * @param listener 音量キーイベントリスナー
   * @returns リスナー解除関数
   */
  addVolumeKeyListener(listener: VolumeKeyListener): () => void;
}
```

#### 3.10.2 Android ネイティブ層（`VolumeKeyPlugin` & `MainActivity`）連携仕様

1. **`VolumeKeyPlugin`**:
   - Capacitor プラグイン（`@CapacitorPlugin(name = "VolumeKey")`）として実装。
   - `setVolumeKeyPagingEnabled`: Web 側からの有効/無効状態を `private static volatile boolean volumeKeyPagingEnabled` に保持。
   - **ライフサイクル初期化・破棄保護（`R1-03`）**: `load()`（プラグイン初期化・WebView リロード時）および `handleOnDestroy()`（Activity 破棄・画面回転による再生成時）において必ず `volumeKeyPagingEnabled = false` にリセットし、Web 側の `cleanup` が呼ばれる前に Activity 再生成やリロードが発生した場合でも、リーダー外画面で音量キーが誤ってインターセプトされ続ける状態リークを防止する。
   - `onVolumeKeyDown(direction)`: `notifyListeners("volumeKeyEvent", { direction })` により Web 側リスナーへ非同期通知。
2. **`MainActivity`（`dispatchKeyEvent` インターセプト）**:
   - `dispatchKeyEvent(KeyEvent event)` をオーバーライドし、`KEYCODE_VOLUME_DOWN` または `KEYCODE_VOLUME_UP` を捕捉。
   - `VolumeKeyPlugin.isVolumeKeyPagingEnabled()` が `true` の場合：
     - `event.getAction() == KeyEvent.ACTION_DOWN`: 初回押下（`event.getRepeatCount() == 0`）時のみ `VolumeKeyPlugin.onVolumeKeyDown(direction)` を呼び出し、長押しによる意図しない高速連打や境界誤遷移を防止する。初回・リピート時ともに `return true;` で消費して **OS のシステム音量バー表示および音量変更を抑止** する。
     - `event.getAction() == KeyEvent.ACTION_UP`: キー離上時の OS 音量 HUD 漏れや端末ビープ音発生を防ぐため、同様に `return true;` でイベントを消費する。
   - `VolumeKeyPlugin.isVolumeKeyPagingEnabled()` が `false`（または音量キー以外）の場合は `super.dispatchKeyEvent(event)` を呼び出し、OS 標準の音量調整として透過的に動作させる。
3. **ブラウザ／テスト用モック（`MockVolumeKeyBridge`）**:
   - `triggerVolumeKey(direction)` メソッドを提供し、UT や Playwright IT で決定論的に音量キーイベントを発火可能にする。
   - Web 実行時の利便性として、`enabled === true` の間のみ `window` の `keydown` イベントでハードウェア音量キーコード（`AudioVolumeDown` / `VolumeDown` → `direction: "down"`、`AudioVolumeUp` / `VolumeUp` → `direction: "up"`）を捕捉し、登録済みリスナーへ通知する。

---

### 3.13 Bridge Layer 契約：WebViewDomBridge Interface（src/bridges/webview/）

対象サイトの DOM 構造変更、Cloudflare 等の Bot 対策認証画面、または年齢確認・ログイン必須ページに直面した際、内蔵ブラウザでページを表示して表示中の DOM（HTML 文字列・最終 URL）をキャプチャし、ローカルキャッシュ DB へ安全に取り込むためのブリッジ抽象インターフェースです（Issue #269）。

#### 3.13.1 TypeScript インターフェース契約（`src/bridges/webview/types.ts`）

```ts
export interface CapturedDomResult {
  html: string;
  url: string;
  title: string;
}

export interface OpenWebViewOptions {
  url: string;
  title?: string;
}

export interface WebViewDomBridge {
  /**
   * ネイティブ WebView ダイアログまたは内蔵ブラウザを開く。
   */
  open(options: OpenWebViewOptions): Promise<void>;

  /**
   * 開いている WebView を閉じる。
   */
  close(): Promise<void>;

  /**
   * 現在表示中のページの DOM (outerHTML), 最終 URL, タイトルをキャプチャする。
   */
  captureDom(): Promise<CapturedDomResult>;

  /**
   * 指定 URL が https: の安全なスキームか検証する。
   */
  canHandle(url: string): boolean;

  /**
   * ネイティブ内蔵ブラウザダイアログで DOM キャプチャ（「取込」ボタン等）が実行されたときの通知を購読する。
   * 返却値の関数を呼び出すことで購読を解除する。
   */
  addDomCapturedListener?(
    listener: (result: CapturedDomResult) => void,
  ): () => void;
}
```

#### 3.13.2 Android ネイティブ層（`WebViewDomPlugin.java` & `MainActivity.java`）仕様

1. **`WebViewDomPlugin`（`@CapacitorPlugin(name = "WebViewDom")`）**:
   - `android.app.Dialog` 上に全画面 `android.webkit.WebView` と操作バー（URL 表示、戻る/進む/リロード、「取り込み」確定ボタン、閉じるボタン）を展開。
   - `evaluateJavascript("(function(){return document.documentElement.outerHTML;})()", ...)` を実行し、表示中 DOM を抽出して React 側へ返却。
   - **スキーム検証とセキュリティ保護**: `WebViewClient.shouldOverrideUrlLoading` で `https:` 以外の危険・平文スキーム（平文 `http:`, `javascript:`, `data:`, `file:`, `intent:` 等）を即時遮断（平文 http は Android cleartextTraffic 制限およびセキュリティ境界の観点から遮断）。
   - **ライフサイクル破棄保護（2段階管理、`R1-27`）**: `btnClose` / `btnCapture` / `Dialog.onDismiss` によるダイアログ閉鎖時（`dismissDialogOnly()`）は後続の JS 側 `captureDom()` 呼び出しを成立させるため `webView` および直近 DOM キャッシュ（`lastCapturedHtml` / `lastCapturedUrl` / `lastCapturedTitle`）を保持し、セッション終了の `close()`・新規 `open()` 前の既存セッション破棄・`handleOnDestroy()` 時（`dismissAndDestroyDialog()`）に `webView.destroy()` と直近 DOM キャッシュの完全破棄を実行してリソースリークを防止。
2. **`MainActivity.java`**:
   - `registerPlugin(WebViewDomPlugin.class);` を登録。
3. **ブラウザ／テスト用モック（`MockWebViewDomBridge`）**:
   - `setMockPage(result: CapturedDomResult)` メソッドを提供し、Storybook や Vitest UT、Playwright IT で決定論的な HTML・URL・タイトルを返却可能にする。

---

### 3.14 Feature Layer 契約：内蔵ブラウザ・DOMインポート画面（SCR-04: src/features/webview-import/）

- **`useWebViewImport`**:
  - `initialUrl`, `initialNovelId`, `initialChapterIndex` を受け取り、URL バリデーション、DOM キャプチャ、および作品トップ vs 各話エピソードの自動判別保存を実行。
  - 作品トップ目次解析時: `parseNovelIndex` → `upsertNovelWithToc`（なろう短編時は本文も同時保存）→ `TR-11`（`/novels/:novelId` 遷移）。
  - 各話本文解析時: `parseChapterContent` → `saveChapterBody`（未登録時は目次自動補完試行）→ `queueRepository.deleteByNovelAndChapters` ＆ `cacheScheduler?.syncNovelProgress` で重複抑止同期 → `TR-11`（`/novels/:novelId/chapters/:chapterIndex` 遷移）。
- **`WebViewImportPage`**:
  - 100dvh 全画面シェル、固定 URL バー、操作ボタン（「内蔵ブラウザで直接操作」「表示中ページを取り込む」）、非対応 URL 警告トースト、下部 4 タブバー。
- **`WebViewImportContainer`**:
  - `useWebViewImport` とルーター（`navigate`）、`ServiceProvider` を接続。

---

## 4. テスト環境での DI（依存性注入）と決定論的初期化

- `src/app/ServiceProvider.tsx` を介して `HttpClientBridge`、`AppBridge`、`CloudSyncBridge`、`VolumeKeyBridge`、`WebViewDomBridge`、各 `Repository`（および基底の `DatabaseAdapter`）、およびアプリ共有 `cacheScheduler?: CacheScheduler`（`fallbackDefaultsRef` 同等の `useRef` による再レンダリング時参照安定化 `R1-24`・プロバイダアンマウント時 `dispose()` 解放）を React Context 経由で提供する。
- **Android / iOS ネイティブ実行時**: `Capacitor.isNativePlatform()` によりネイティブ環境を自動検知し、`CapacitorHttpClient`、`CapacitorAppBridge`、`CapacitorCloudSyncBridge`、`CapacitorVolumeKeyBridge`、`CapacitorWebViewDomBridge`、および `createDefaultNativeSqliteAdapter`（`CapacitorSqliteAdapter` ＋ `src/storage/schema.ts` の DDL 初期化）を注入する。
- **Web ブラウザ / Dev 実行時**: `createInMemoryDb`（`sql.js`）および `localStorage` への Base64 バイナリバックアップ（`yommy_sqlite_db_backup`）によるハイブリッド永続化を提供し、`createDefaultMockHttpClient`、`MockAppBridge`、`MockCloudSyncBridge`、`MockVolumeKeyBridge`、および `MockWebViewDomBridge` を使用する。既存 DB バイナリからの復元時にも `initializeDatabaseSchema` によるスキーママイグレーションを確実に実行する。
- **UT（Vitest）/ Storybook / Playwright IT 実行時**: `MockHttpClient` ＋ `MockAppBridge` ＋ `MockCloudSyncBridge` ＋ `MockVolumeKeyBridge` ＋ `MockWebViewDomBridge` ＋ `InMemoryDatabaseAdapter` を注入し、各テストの開始前に `resetTestDb()` を呼び出して 100% 決定論的な状態で検証する。
- **Worktree 運用・環境変数非依存設計**: すべてのテスト（Vitest, Storybook VRT, Playwright IT）およびビルドは、`.env.local` の有無に関わらず 100% 決定論的に PASS する設計（`ServiceProvider` による DI モック分離と安全なフォールバック）を必須とし、テスト実行時に環境変数未定義によるスキップや挙動のブレを生じさせない。

---

## 5. Android ビルド署名およびバージョン管理規約

Android Debug APK の継続的な検証と上書きインストール（`INSTALL_FAILED_UPDATE_INCOMPATIBLE` の抑止）を保証するため、以下のビルド署名・バージョン採番規約を適用します。

### 5.1 Debug 署名キーストアの固定化（`android/debug.keystore`）

- リポジトリ内 `android/debug.keystore` に開発・検証用共通デバッグキーストアを配置する。
- `android/app/build.gradle` において `signingConfigs.debug` に上記キーストア（Alias: `androiddebugkey`、Password: `android`）を明示指定し、CI ランナー上でのランダムキーストア自動生成を防止する。

### 5.2 `versionCode` / `versionName` の動的注入と CI コンパイル検証

- `android/app/build.gradle` の `defaultConfig` において、CI 環境変数（`BUILD_NUMBER`）および Gradle プロパティ（`versionCode` / `versionName`）から動的にバージョンを解決する。
- GitHub Actions（`.github/workflows/build-android.yml`）では `BUILD_NUMBER: ${{ github.run_number }}` を注入し、ビルドごとに `versionCode` を単調増加させる。また、GitHub Secrets（`ANDROID_KEYSTORE_BASE64` 等）を Gradle ビルドステップへ注入する。
- リモート CI（`.github/workflows/ci.yml`）の `quality-gate` において、`android-compile` ジョブによる `./gradlew compileDebugJavaWithJavac` を自動実行し、Java コンパイル安全性を保証する。
- ローカルビルド時はフォールバック値（`versionCode 1`、`versionName "1.0.0"`）を採用し、開発作業の利便性を損なわない構成とする。

### 5.3 Google OAuth 用署名鍵の秘密管理と SHA-1 なりすまし防止

- 公開 `android/debug.keystore` の SHA-1 は GCP に登録しない（第三者による偽造 APK の OAuth なりすまし防止）。
- GitHub Secrets（`ANDROID_KEYSTORE_BASE64` 等）に保管した非公開 Keystore の SHA-1 とパッケージ名（`com.yommy.app`）のみを GCP の Android OAuth クライアントに登録し、CI APK ビルド時に署名する。Secrets 未設定のローカル/PR 環境のみ `android/debug.keystore` へフォールバックする。

---

## 6. アーキテクチャ・ネイティブ・ビルド受入条件一覧

本セクションは、アーキテクチャ層、ネイティブ Bridge 層、ビルド・署名構成、およびアセット管理に属する受入条件（`AC-ICON-xx`, `AC-AB-xx`, `AC-APK-xx`, `AC-AUTH-xx`）の正本定義を管理します。

### 6.1 アプリアイコン・ブランディング（`AC-ICON-xx`）

|   受入条件 ID    | 項目                       | 内容                                                                                                                                                                 | 対応要件 ID  | 検証成果物                       |
| :--------------: | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------: | :------------------------------- |
| **`AC-ICON-01`** | マスター正本配置           | `assets/icon.png`（1024×1024）がマスター画像として配置され、`scripts/generate-icons.mjs` がマスター画像のみを参照して決定論的にアイコンアセットを生成すること。      | `SYS-REQ-15` | `scripts/generate-icons.test.ts` |
| **`AC-ICON-02`** | Android アプリアイコン反映 | 各 DPI（mdpi〜xxxhdpi）の `ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png` が生成され、Adaptive Icon 背景色 `#0D0E26` が設定されていること。 | `SYS-REQ-15` | `scripts/generate-icons.test.ts` |
| **`AC-ICON-03`** | Web Favicon 反映           | `public/favicon.ico`, `icon-192.png`, `apple-touch-icon.png` が配置され、`index.html` から正しくリンク参照されていること。                                           | `SYS-REQ-15` | `scripts/generate-icons.test.ts` |
| **`AC-ICON-04`** | 再現可能スクリプト         | `npm run generate:icons` を実行することで、全アイコンアセットがローカルで差分なく再生成できること。                                                                  | `SYS-REQ-15` | `scripts/generate-icons.test.ts` |

### 6.2 システム戻るボタン・階層遷移・終了 UX（`AC-AB-xx`）

|  受入条件 ID   | 項目                       | 内容                                                                                                                                                                                                                                                                   |   対応要件 ID    | 検証成果物                              |
| :------------: | :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------: | :-------------------------------------- |
| **`AC-AB-01`** | Bridge 抽象層の隔離        | `AppBridge`（`CapacitorAppBridge` / `MockAppBridge`）が整備され、Web/Vitest/Storybook 環境では Capacitor ネイティブ例外を一切発生させずにモック動作すること。                                                                                                          |   `SYS-REQ-16`   | `src/bridges/app/mockAppBridge.test.ts` |
| **`AC-AB-02`** | リーダー画面からの階層復帰 | `SCR-03` でバックボタン押下時、未保存のしおり進捗変更があれば `flushBookmark` で即時保存し（未操作時は `last_read_at` を上書きせず）、目次画面（`SCR-02`）へ復帰すること（`TR-06`）。なおしおり競合確認モーダル表示中は戻る遷移が抑止されること（`v1.1` Issue #342）。 | `SYS-REQ-12, 16` | `src/App.test.tsx` / `SCN-01`, `SCN-05` |
| **`AC-AB-03`** | 目次画面からの階層復帰     | `SCR-02` でバックボタン押下時、本棚画面（`SCR-01`）へ復帰すること（`TR-07`）。                                                                                                                                                                                         | `SYS-REQ-01, 16` | `src/App.test.tsx` / `SCN-01`           |
| **`AC-AB-04`** | 設定画面からの直前復帰     | `SCR-05` でバックボタン押下時、直前に開いていた画面へ正確に復帰すること（`TR-12`）。                                                                                                                                                                                   |   `SYS-REQ-16`   | `src/App.test.tsx` / `SCN-01`           |
| **`AC-AB-05`** | 本棚での終了確認トースト   | `SCR-01`（`/`）でバックボタン 1 回目押下時、アプリは終了せず「もう一度バックボタンを押すと終了します」のトーストが表示され、2秒後に自動消滅すること（`TR-13`）。                                                                                                       |   `SYS-REQ-16`   | `src/App.test.tsx` / `SCN-01`           |
| **`AC-AB-06`** | 本棚での二重押下アプリ終了 | `SCR-01`（`/`）でトースト表示中（2秒以内）に再度バックボタンを押下したとき、`appBridge.exitApp()` が呼び出されること（`TR-13`）。                                                                                                                                      |   `SYS-REQ-16`   | `src/App.test.tsx` / `SCN-01`           |

### 6.3 Android ビルド・署名・バージョン管理（`AC-APK-xx`）

|   受入条件 ID   | 項目                        | 内容                                                                                                                                                                                                                     | 対応要件 ID  | 検証成果物                             |
| :-------------: | :-------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------: | :------------------------------------- |
| **`AC-APK-01`** | Debug 署名鍵の固定化        | `android/debug.keystore` が配備され、`build.gradle` で明示指定されることで、再ビルドした APK 間で署名証明書フィンガープリントが一致し、上書きインストール（`INSTALL_FAILED_UPDATE_INCOMPATIBLE` 回避）が可能であること。 | `SYS-REQ-16` | `scripts/android-build-config.test.ts` |
| **`AC-APK-02`** | バージョン管理・単調増加    | `package.json` の `version`（`1.0.0`）に基づき `versionName` が解決され、GitHub Actions ビルド時に `github.run_number`（または `BUILD_NUMBER`）により `versionCode` がビルドごとに単調増加すること。                     | `SYS-REQ-16` | `scripts/android-build-config.test.ts` |
| **`AC-APK-03`** | CI 署名・キーストア保護構成 | CI 署名設定として `ANDROID_KEYSTORE_BASE64` が存在する場合のデコードと未設定時フォールバック構成が含まれること。                                                                                                         | `SYS-REQ-16` | `scripts/android-build-config.test.ts` |

### 6.4 Android ネイティブ認可・認証契約（`AC-AUTH-xx`）

|   受入条件 ID    | 項目                                             | 内容                                                                                                                                      | 対応要件 ID  | 検証成果物                             |
| :--------------: | :----------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :----------: | :------------------------------------- |
| **`AC-AUTH-01`** | Google Play Services Auth 依存定義               | `android/app/build.gradle` の dependencies に Google Play Services Auth が定義されていること。                                            | `SYS-REQ-16` | `scripts/android-build-config.test.ts` |
| **`AC-AUTH-02`** | Android ネイティブ Google 認証プラグイン認可契約 | `CloudSyncPlugin.java` が ActivityResultContracts、IntentSender、認可キャッシュ破棄、multipart/related アップロード等の契約を満たすこと。 | `SYS-REQ-16` | `scripts/android-build-config.test.ts` |
