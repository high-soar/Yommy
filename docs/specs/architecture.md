---
type: spec-architecture
title: 3層アーキテクチャと共通インターフェース契約（App 全体正本）
description: Http/Bridge、Parser、Storage、Viewer/UIの3層分離構造、ディレクトリ規約、およびTypeScript基底インターフェース契約の正本。
status: "Review (#78)"
updated: "2026-10-29"
tags:
  - architecture
  - parser
  - storage
  - bridge
  - sanitizer
  - assets
  - settings
  - shell
related_specs:
  - docs/specs/requirements.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/parsers/kakuyomu.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/reader-view.md
  - docs/specs/features/settings.md
  - docs/specs/changes/issue-78-apk-signing-and-back-button.md
  - docs/specs/changes/archive/issue-50-fullscreen-shell-and-settings.md
  - docs/specs/changes/archive/issue-51-novel-detail-layout-and-scroll.md
  - docs/specs/changes/archive/issue-52-reader-fullscreen-and-bottom-overlay.md
  - docs/specs/changes/archive/issue-12-bookshelf-and-routing.md
  - docs/specs/changes/archive/issue-13-novel-detail-and-toc.md
  - docs/specs/changes/archive/issue-14-reader-navigation-bookmark-settings.md
  - docs/specs/changes/archive/issue-15-app-icon-setup.md
  - docs/guidelines/testing.md
related_tests:
  - src/app/ServiceProvider.test.tsx
  - src/app/router.test.tsx
  - src/App.test.tsx
  - src/shared/ui/BottomTabBar.test.tsx
  - src/storage/schema.test.ts
  - scripts/generate-icons.test.ts
---

# 3層アーキテクチャと共通インターフェース契約（App 全体正本）

## 1. アーキテクチャ全体像と3層分離原則

AI による TDD 実装の確実性と保守性を最大化するため、Capacitor ネイティブ依存（HTTP 通信・SQLite・WebView ブリッジ）を薄いアダプター層に隔離し、アプリケーション全体を以下の3層（＋ Bridge 抽象層）に明確に分離します。

```mermaid
flowchart TB
    subgraph UILayer ["3. Viewer & UI Layer (src/features/*, src/shared/ui/*)"]
        Pages["Pages / Containers (SCR-01〜SCR-05)"]
        Components["Presentational UI Components<br>(縦書き vertical-rl / ルビ / テーマ / 本棚カード / BottomTabBar / サンプルプレビュー)"]
        Hooks["Application Hooks<br>(useBookshelf, useNovelDetail, useReader, useSettings, useDownloadQueue)"]
        Pages --> Components
        Pages --> Hooks
    end

    subgraph ParserLayer ["1. Parser Layer (src/parsers/*)"]
        Registry["ParserRegistry<br>(URL から適切な NovelParser を解決)"]
        Kakuyomu["KakuyomuParser<br>(kakuyomu.jp)"]
        Narou["NarouParser<br>(syosetu.com)"]
        Sanitizer["HtmlSanitizer / Formatter<br>(許可タグ <p>,<br>,<ruby>,<rb>,<rt>,<rp>,<em> のみ保持)"]
        Registry --> Kakuyomu
        Registry --> Narou
        Kakuyomu --> Sanitizer
        Narou --> Sanitizer
    end

    subgraph StorageLayer ["2. Storage Layer (src/storage/*)"]
        Repos["Repositories<br>(NovelRepository, ChapterRepository, QueueRepository, SettingsRepository)"]
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
    end

    Hooks --> Registry
    Hooks --> Repos
    Hooks --> HttpBridge
    Hooks --> AppBridge
    Hooks --> WebViewBridge
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
├── scripts/                           # 【ビルド・補助スクリプト】generate-icons.mjs 等
└── src/                               # 【アプリケーションソースコード】
    ├── App.tsx                        # ルートコンポーネント（テーマ適用・ルーター配置・OS戻るボタン連携）
    ├── App.stories.tsx
    ├── App.test.tsx
    ├── app/                           # アプリケーション共通設定・DI Provider
    │   ├── router.tsx                 # 画面ルーティング定義（SCR-01〜SCR-05）
    │   ├── router.stories.tsx
    │   ├── router.test.tsx
    │   ├── ServiceProvider.tsx        # Storage / HttpBridge / AppBridge / ParserRegistry の Context DI（実機・テスト差し替え点）
    │   ├── ServiceProvider.stories.tsx
    │   └── ServiceProvider.test.tsx
    ├── bridges/                       # 【Capacitor Bridge 抽象層】
    │   ├── app/                       # 【AppBridge】システム戻るボタン・アプリ終了制御（Issue #78）
    │   │   ├── types.ts               # AppBridge, BackButtonEvent, BackButtonListener 定義
    │   │   ├── capacitorAppBridge.ts  # @capacitor/app 実装
    │   │   └── mockAppBridge.ts       # UT / Storybook / IT 用モック実装（triggerBackButton）
    │   ├── http/
    │   │   ├── types.ts               # HttpClientBridge インターフェース定義
    │   │   ├── capacitorHttpClient.ts # CapacitorHttp 実装（CORS回避・User-Agent・タイムアウト制御）
    │   │   └── mockHttpClient.ts      # UT / Storybook / IT 用フィクスチャ応答クライアント
    │   └── webview/
    │       ├── types.ts               # WebViewDomBridge インターフェース定義（v0.4〜）
    │       └── webviewDomBridge.ts    # 内蔵WebView DOMキャプチャ実装
    ├── parsers/                       # 【1. Parser Layer（スクレイピング・DOM解析層）】
    │   ├── types.ts                   # NovelParser, ParsedNovelMetadata, ParsedChapterContent 等の型契約
    │   ├── parserRegistry.ts          # URL から対応サイト（kakuyomu / narou 等）を判定・ディスパッチ
    │   ├── sanitizer.ts               # 小説本文 HTML サニタイズ＆正規化（XSS防止・ルビ/傍点保持）
    │   ├── kakuyomu/                  # カクヨム用パーサーとローカル HTML フィクスチャ
    │   │   ├── KakuyomuParser.ts
    │   │   ├── KakuyomuParser.test.ts
    │   │   └── __fixtures__/
    │   └── narou/                     # 小説家になろう用パーサーとローカル HTML フィクスチャ（v0.4〜）
    │       ├── NarouParser.ts
    │       ├── NarouParser.test.ts
    │       └── __fixtures__/
    ├── storage/                       # 【2. Storage Layer（ローカルDB・キャッシュ管理層）】
    │   ├── types.ts                   # エンティティ型および各 Repository インターフェース契約
    │   ├── schema.ts                  # SQLite テーブル DDL および初期行定義（実機・インメモリ共有）
    │   ├── schema.test.ts
    │   ├── adapter/
    │   │   ├── types.ts               # DatabaseAdapter インターフェース
    │   │   ├── capacitorSqlite.ts     # @capacitor-community/sqlite アダプター実装
    │   │   └── inMemoryDb.ts          # テスト・Web開発用インメモリDB実装（resetTestDb() 提供）
    │   └── repositories/
    │       ├── novelRepository.ts     # novels テーブル操作
    │       ├── chapterRepository.ts   # chapters テーブル操作（本文キャッシュ保存・削除・容量集計）
    │       ├── queueRepository.ts     # download_queue テーブル操作（v0.3〜）
    │       └── settingsRepository.ts  # reader_settings 操作
    ├── features/                      # 【3. Viewer & UI Layer（画面・機能別モジュール）】
    │   ├── bookshelf/                 # SCR-01: 本棚一覧・作品URL追加
    │   ├── novel-detail/              # SCR-02: 作品詳細・目次一覧・取得操作
    │   ├── reader/                    # SCR-03: 小説リーダー（全画面100dvh・最下部タッチオーバーレイ・ルビ・しおり保存）
    │   ├── webview-import/            # SCR-04: 内蔵ブラウザ表示・DOMインポート（v0.4〜）
    │   └── settings/                  # SCR-05: 設定画面（組版・テーマ設定・サンプル文章プレビュー、v0.2〜）
    │       ├── hooks/
    │       │   ├── useSettings.ts
    │       │   └── useSettings.test.tsx
    │       └── components/
    │           ├── SampleTextPreview.tsx
    │           ├── SampleTextPreview.stories.tsx
    │           ├── SampleTextPreview.test.tsx
    │           ├── SettingsPage.tsx
    │           ├── SettingsPage.stories.tsx
    │           ├── SettingsPage.test.tsx
    │           ├── SettingsContainer.tsx
    │           ├── SettingsContainer.stories.tsx
    │           └── SettingsContainer.test.tsx
    └── shared/                        # 複数機能で共有する汎用 UI コンポーネント・ユーティリティ
        ├── ui/                        # BottomTabBar, Header, Button, Modal, Toast, Badge 等
        └── lib/                       # URL正規化、バイトサイズ整形、日時フォーマット等
```

### 2.2 アセット管理とアプリアイコン設計

- **マスターアセット（`assets/`）**:
  - `assets/icon.png`: 1024×1024 px（32bit RGBA PNG）のブランド正本マスター。将来の一時資料（`reference/`）削除後も恒久保持し、全プラットフォーム向けアイコンの生成元となる。
- **Android ネイティブアセット（`android/app/src/main/res/`）**:
  - Android 8.0+ Adaptive Icon: 背景 `#0D0E26`（`values/ic_launcher_background.xml`）＋ セーフゾーン（72dp / 108dp）前景イラスト（`mipmap-*/ic_launcher_foreground.png`、透過背景）。
  - レガシー用: 角丸正方形（`ic_launcher.png`）および円形（`ic_launcher_round.png`）。
- **Web 静的アセット（`public/` ＆ `index.html`）**:
  - `favicon.ico`（16/32/48px マルチアイコン）、`icon-192.png`、`icon-512.png`、`apple-touch-icon.png`（180px）。Vite ビルド時に `dist/` 直下へ完全展開され、`index.html` の `<link rel="icon">` / `<link rel="apple-touch-icon">` から参照される。
- **生成自動化（`scripts/generate-icons.mjs`）**:
  - DevContainer の Playwright Chromium を用いて決定論的かつオフラインで全アセットを再生成する（`npm run generate:icons`）。

#### Android アイコン解像度一覧表

| 密度 (DPI)       | ディレクトリ                               | `ic_launcher.png` (正方形) | `ic_launcher_round.png` (円形) | `ic_launcher_foreground.png` (前景) |
| :--------------- | :----------------------------------------- | :------------------------: | :----------------------------: | :---------------------------------: |
| **mdpi** (1x)    | `android/app/src/main/res/mipmap-mdpi/`    |         48 × 48 px         |           48 × 48 px           |            108 × 108 px             |
| **hdpi** (1.5x)  | `android/app/src/main/res/mipmap-hdpi/`    |         72 × 72 px         |           72 × 72 px           |            162 × 162 px             |
| **xhdpi** (2x)   | `android/app/src/main/res/mipmap-xhdpi/`   |         96 × 96 px         |           96 × 96 px           |            216 × 216 px             |
| **xxhdpi** (3x)  | `android/app/src/main/res/mipmap-xxhdpi/`  |        144 × 144 px        |          144 × 144 px          |            324 × 324 px             |
| **xxxhdpi** (4x) | `android/app/src/main/res/mipmap-xxxhdpi/` |        192 × 192 px        |          192 × 192 px          |            432 × 432 px             |

#### Web Favicon / Apple Touch Icon 仕様表

| ファイルパス                  |       解像度        | 用途・形式                                                                       |
| :---------------------------- | :-----------------: | :------------------------------------------------------------------------------- |
| `public/favicon.ico`          | 16×16, 32×32, 48×48 | デスクトップブラウザのタブ・ブックマーク用マルチアイコン                         |
| `public/icon-192.png`         |    192 × 192 px     | Web App / PWA マニフェスト用標準アイコン（濃紺背景＋角丸/全塗りイラスト）        |
| `public/icon-512.png`         |    512 × 512 px     | 高解像度スプラッシュ・PWA 用アイコン                                             |
| `public/apple-touch-icon.png` |    180 × 180 px     | iOS Safari「ホーム画面に追加」用（透過なし、濃紺背景 `#0D0E26` ＋ 中央イラスト） |

#### アプリアイコン受入条件一覧（`AC-ICON-xx`）

| 受入条件 ID      | 項目                       | 検証内容・合否判定基準                                                                                                                                               | 対応要件 ID  |
| :--------------- | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------- |
| **`AC-ICON-01`** | マスター正本配置           | `assets/icon.png`（1024×1024）が配置され、将来 `reference/` が削除されてもアセット再生成が可能であること。                                                           | `SYS-REQ-15` |
| **`AC-ICON-02`** | Android アプリアイコン反映 | 各 DPI（mdpi〜xxxhdpi）の `ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png` が生成され、Adaptive Icon 背景色 `#0D0E26` が設定されていること。 | `SYS-REQ-15` |
| **`AC-ICON-03`** | Web Favicon 反映           | `public/favicon.ico`, `icon-192.png`, `apple-touch-icon.png` が配置され、`index.html` から正しくリンク参照されていること。                                           | `SYS-REQ-15` |
| **`AC-ICON-04`** | 再現可能スクリプト         | `npm run generate:icons` を実行することで、全アイコンアセットがローカルで差分なく再生成できること。                                                                  | `SYS-REQ-15` |

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
}
```

#### 本文 HTML サニタイズ＆正規化規約（`src/parsers/sanitizer.ts`）

- **XSS 防止（ホワイトリスト方式）**:
  `<script>`, `<iframe>`, `<style>`, `<object>`, `<embed>`、およびすべての `on*` イベント属性・`javascript:` スキーム属性を完全に除去する。
- **許可する HTML 要素**:
  `<p>`, `<br>`, `<ruby>`, `<rb>`, `<rt>`, `<rp>`, `<em>`（傍点用のクラス `class="bouten"` のみ許可）に限定し、リーダー層が安全かつ一貫した CSS で縦書き・横書き・テーマ描画できるようにする。

### 3.4 Storage Layer 契約（`src/storage/types.ts`）

DB テーブル構造の詳細は [docs/specs/db-schema.md](db-schema.md) を正本とし、アプリケーション層は以下の Repository インターフェースを介してのみデータにアクセスします。

```ts
export interface NovelRepository {
  listNovels(): Promise<NovelSummary[]>;
  getNovelById(novelId: string): Promise<NovelRecord | null>;
  upsertNovelWithToc(
    index: ParsedNovelIndex,
    fetchedAt: string,
  ): Promise<NovelRecord>;
  updateBookmark(
    novelId: string,
    chapterIndex: number,
    scrollProgress: number,
  ): Promise<void>;
  deleteNovel(novelId: string): Promise<void>;
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
}

export interface SettingsRepository {
  getReaderSettings(): Promise<ReaderSettings>;
  updateReaderSettings(patch: Partial<ReaderSettings>): Promise<ReaderSettings>;
}
```

### 3.5 Application Router 契約（`src/app/router.tsx`）

外部ルーティングライブラリへの依存を持たず、History API（`window.history.pushState` / `popstate` / `replaceState`）と React Context による軽量ルーターで画面遷移（[docs/specs/screen-transitions.md](screen-transitions.md)）を管理します。

```ts
export type AppRoute =
  | { name: "bookshelf"; path: "/" }
  | { name: "novel-detail"; path: string; novelId: string }
  | { name: "reader"; path: string; novelId: string; chapterIndex: number }
  | { name: "settings"; path: "/settings" };

export interface NavigateToReaderOptions {
  replace?: boolean;
  fromBookshelfResume?: boolean;
}

export interface RouterContextValue {
  currentPath: string;
  route: AppRoute;
  previousPath?: string;
  navigate: (path: string) => void;
  navigateToBookshelf: () => void;
  navigateToNovelDetail: (novelId: string) => void;
  navigateToReader: (
    novelId: string,
    chapterIndex: number,
    options?: NavigateToReaderOptions,
  ) => void;
  navigateToSettings: () => void;
  back: () => void;
}
```

- `novelId`（例: `"kakuyomu:16817330658027210412"`）を URL パスに含める際は `encodeURIComponent` でエンコードし、ルート解決（`matchRoute`）時に `decodeURIComponent` でデコードする。
- `RouterProvider` は `initialPath?: string` プロパティを受け取り、Vitest 単体テストや Storybook において任意のルート状態を決定論的に再現できる。
- `navigate` は同一パスへの遷移呼び出し時（例: `/settings` での「設定」タブ再タップ）は履歴追加（`pushState`）および `previousPath` の上書きを行わず no-op とする。
- **OS バックキー（@capacitor/app の AppBridge 経由およびブラウザ戻る操作）の論理階層遷移制御**:
  - ブラウザ履歴順に依存せず、常に論理階層順（**各話View `SCR-03` → 目次 `SCR-02` → 本棚 `SCR-01`**、**設定 `SCR-05` → 直前画面**）で戻るよう制御する。
  - 本棚の「続きから読む」から各話Viewへ直行した場合も、ルーターが履歴スタックに目次（`/novels/:novelId`）を介在させることで、バックキー 1 回で確実に目次画面へ戻る。
  - リーダー画面内の前後話連続遷移（第1話 → 第2話）では `history.replaceState` を適用し、履歴の肥大化を防ぎつつバックキー 1 回で目次へ復帰できるようにする。
  - リーダー離脱時には最新の閲覧話数・スクロール進捗率を SQLite へ自動保存（`flushBookmark`）する。
  - 設定画面（`SCR-05`）からのバックキー操作時は、設定を開く直前の画面（本棚・目次・各話View）へ戻る。
  - 本棚画面（`SCR-01: /`）でバックボタンが押された際は、2秒以内の連続2回押下で `AppBridge.exitApp()` を呼び出してアプリを終了し、1回目押下時は画面下部に「もう一度バックボタンを押すと終了します」の一時確認トースト（`role="status"`、2秒後に自動消去）を表示する（`TR-13`）。

---

## 4. テスト環境での DI（依存性注入）と決定論的初期化

- `src/app/ServiceProvider.tsx` を介して `HttpClientBridge`、`AppBridge`、各 `Repository`（および基底の `DatabaseAdapter`）を React Context 経由で提供する。
- **Android / iOS ネイティブ実行時**: `Capacitor.isNativePlatform()` によりネイティブ環境を自動検知し、`CapacitorHttpClient`、`CapacitorAppBridge`、および `createDefaultNativeSqliteAdapter`（`CapacitorSqliteAdapter` ＋ `src/storage/schema.ts` の DDL 初期化）を注入する。
- **Web ブラウザ / Dev 実行時**: `createInMemoryDb`（`sql.js`）および `localStorage` への Base64 バイナリバックアップ（`yommy_sqlite_db_backup`）によるハイブリッド永続化を提供し、`createDefaultMockHttpClient` および `MockAppBridge` を使用する。なお `createDefaultMockHttpClient` は任意のカクヨム作品 URL（`/^https:\/\/kakuyomu\.jp\/works\/\d+$/`）およびエピソード URL（`/^https:\/\/kakuyomu\.jp\/works\/\d+\/episodes\/\d+$/`）に対してローカルフィクスチャ HTML を返却する。
- **UT（Vitest）/ Storybook / Playwright IT 実行時**: `MockHttpClient`（`__fixtures__/*.html` を返却）＋ `MockAppBridge`（`triggerBackButton` により安全にイベント再現）＋ `InMemoryDatabaseAdapter` を注入し、各テストの開始前に `resetTestDb()` を呼び出して 100% 決定論的な状態で検証する。

---

## 5. Android ビルド署名およびバージョン管理規約

Android Debug APK の継続的な検証と上書きインストール（`INSTALL_FAILED_UPDATE_INCOMPATIBLE` の抑止）を保証するため、以下のビルド署名・バージョン採番規約を適用します。

### 5.1 Debug 署名キーストアの固定化（`android/debug.keystore`）

- リポジトリ内 `android/debug.keystore` に開発・検証用共通デバッグキーストアを配置する。
- `android/app/build.gradle` において `signingConfigs.debug` に上記キーストア（Alias: `androiddebugkey`、Password: `android`）を明示指定し、CI ランナー上でのランダムキーストア自動生成を防止する。

### 5.2 `versionCode` / `versionName` の動的注入

- `android/app/build.gradle` の `defaultConfig` において、CI 環境変数（`BUILD_NUMBER`）および Gradle プロパティ（`versionCode` / `versionName`）から動的にバージョンを解決する。
- GitHub Actions（`.github/workflows/build-android.yml`）では `BUILD_NUMBER: ${{ github.run_number }}` を注入し、ビルドごとに `versionCode` を単調増加させる。
- ローカルビルド時はフォールバック値（`versionCode 1`、`versionName "0.3.0"`）を採用し、開発作業の利便性を損なわない構成とする。
