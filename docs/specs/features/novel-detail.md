---
type: spec-feature
title: "作品詳細・目次画面仕様書（SCR-02: Novel Detail & TOC）"
description: 登録済み作品のヘッダー情報・あらすじ表示、お気に入り（★）登録・解除、章見出し付きエピソード一覧（キャッシュ済み・既読・しおり状態）、目次更新（再取得）、作品削除、およびリーダー画面への閲覧遷移を提供する作品詳細・目次画面（SCR-02）の正本仕様。
status: "Review (#344)"
updated: "2026-11-14"
tags:
  [
    novel-detail,
    scr-02,
    toc,
    routing,
    ui,
    menu,
    shell,
    bottom-nav,
    four-tabs,
    prefetch,
    batch-cache,
    cache-scheduler,
    priority-queue,
    non-blocking,
    download-queue,
    queue-repository,
    retry,
    resume,
    cache-rules,
    cache-management,
    capacity-visualization,
    favorite,
    narou,
    multi-page-toc,
    webview-import,
    fallback,
    ho-24,
    ho-29,
    ho-32,
    ho-34,
    ho-35,
    ho-37,
    ho-38,
    ho-39,
  ]
related_specs:
  - docs/specs/changes/issue-344-priority-cache-scheduler.md
  - docs/specs/changes/archive/issue-342-cloud-sync-bookmark-protection.md
  - docs/specs/changes/archive/issue-343-novel-detail-header-menu.md
  - docs/specs/changes/archive/issue-269-webview-fallback-and-dom-import.md
  - docs/specs/features/webview-import.md
  - docs/specs/changes/archive/issue-268-persistent-download-queue.md
  - docs/specs/changes/archive/issue-266-bookshelf-favorite-and-sync.md
  - docs/specs/changes/archive/issue-239-narou-parser-and-multi-page-toc.md
  - docs/specs/parsers/narou.md
  - docs/specs/changes/archive/issue-170-cache-management-and-capacity-visualization.md
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/search.md
  - docs/specs/features/ranking.md
  - docs/specs/features/reader-view.md
  - docs/specs/features/settings.md
  - docs/specs/parsers/kakuyomu.md
  - docs/specs/changes/archive/issue-120-cloud-sync-google-drive.md
  - docs/specs/changes/archive/issue-79-four-tabs-search-ranking.md
  - docs/specs/changes/archive/issue-80-bookshelf-update-check-and-sort.md
  - docs/specs/changes/archive/issue-81-prefetch-and-cache-rules.md
  - docs/specs/changes/archive/issue-50-fullscreen-shell-and-settings.md
  - docs/specs/changes/archive/issue-51-novel-detail-layout-and-scroll.md
  - docs/specs/changes/archive/issue-13-novel-detail-and-toc.md
  - docs/specs/changes/archive/issue-14-reader-navigation-bookmark-settings.md
related_tests:
  - src/App.test.tsx
  - src/features/novel-detail/hooks/useNovelDetail.test.ts
  - src/features/novel-detail/components/NovelDetailHeader.test.tsx
  - src/features/novel-detail/components/EpisodeListItem.test.tsx
  - src/features/novel-detail/components/EpisodeList.test.tsx
  - src/features/novel-detail/components/DeleteConfirmDialog.test.tsx
  - src/features/novel-detail/components/ClearCacheConfirmDialog.test.tsx
  - src/features/novel-detail/components/NovelDetailPage.test.tsx
  - src/features/novel-detail/components/NovelDetailContainer.test.tsx
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
  - test/it/scenarios/scn02-search-ranking-discovery.spec.ts
  - test/it/scenarios/scn03-bookshelf-update-and-sort.spec.ts
  - test/it/scenarios/scn04-prefetch-and-cache.spec.ts
  - test/it/scenarios/scn05-cloud-sync.spec.ts
  - test/it/scenarios/scn07-webview-import-fallback.spec.ts
---

# 作品詳細・目次画面仕様書（SCR-02）

本ドキュメントは、本棚画面（`SCR-01`）で選択した作品の詳細情報・あらすじ・全エピソード目次を表示し、任意のエピソード閲覧（未キャッシュ時のオンデマンド本文取得連携）、目次の再取得（更新）、および作品の削除を提供する **作品詳細・目次画面（`SCR-02`: ルート `/novels/:novelId`）** の正本（Single Source of Truth）です。

---

## 1. 概要・スコープ

- **対象画面**: 作品詳細・目次画面（`SCR-02`、ルートパス `/novels/:novelId`）
- **対応要件**:
  - `SYS-REQ-01`（作品登録・目次取得：作品メタデータ・あらすじ・章見出し付きエピソード一覧の表示および目次再取得）
  - `SYS-REQ-02`（本文取得・オフライン閲覧：エピソード選択または読書開始ボタンによるリーダー遷移と、未キャッシュ話のオンデマンド本文取得・キャッシュ状態反映、および未取得話の一括キャッシュ・中断再開・失敗話再試行、`v0.9` Issue #268）
  - `SYS-REQ-03`（レートリミット・バックグラウンド取得：未取得話一括キャッシュ時の 1.5秒間隔ウェイト制御、途中話エラー時のスキップ継続、および永続ダウンロードキュー `download_queue` による中断再開・再試行制御、`v0.9` Issue #268）
  - `SYS-REQ-04`（更新チェック・差分取得・お気に入り管理：作品詳細画面表示時の本棚「NEW」バッジ自動解除、手動目次再取得と新着話数フィードバック表示、作品詳細ヘッダーからのお気に入り［★］登録・解除、`v0.8` Issue #266）
  - `SYS-REQ-05`（キャッシュ管理・容量整理：未取得話の一括キャッシュと完了時キュー自動クリーンアップ、確認ダイアログ付き作品削除と `chapters` / `download_queue` カスケード削除、作品別キャッシュデータ容量可視化、確認ダイアログ付き本文キャッシュ削除［既読話のみ／全話］と対象キュー自動クリーンアップ、`v0.5` Issue #170 / `v0.9` Issue #268）
  - `SYS-REQ-06`（クラウド同期・バックアップ：Google Drive クラウド同期による他端末からの作品追加・しおり位置・既読状態・お気に入り状態の反映、画面ロック・バックグラウンド 5 分以上休止後復帰時自動 Pull による詳細表示の自動更新［`v1.1` Issue #342］、および作品削除・お気に入り変更時の同期反映）
  - `SYS-REQ-12`（しおり・スクロール位置自動保存に基づくしおり位置マーク・既読バッジ表示および「続きから読む」導線）
  - `SYS-REQ-13`（アプリ内ブラウザ表示：作品詳細ヘッダーの3点メニュー内「内蔵ブラウザで開く」による `SCR-04` へのフォールバック導線、`v0.9` Issue #269 / `v1.1` Issue #343）
  - `SYS-REQ-16`（全画面シェル・下部タブ・論理階層遷移：100dvh 全画面シェル内配置、固定ヘッダー＋内部スクロール目次、下部タブバー連携）
  - `SYS-REQ-19`（探索一覧からの作品即時登録・遷移：検索・ランキングからの遷移元導線）
  - `SYS-REQ-20`（下部 4 タブナビゲーションおよび OS バックキーによる直前の遷移元［本棚/検索/ランキング］への論理階層復帰）
- **関連画面遷移**:
  - `TR-01`（下部タブバーによる 4 画面「本棚 `/`」「検索 `/search`」「ランキング `/ranking`」「設定 `/settings`」相互切替）
  - `TR-01b`（下部タブバーの「本棚」タブタップによる本棚画面 `SCR-01` `/` へのダイレクト遷移）
  - `TR-02`（本棚画面 `SCR-01` の作品カード本体タップによる `SCR-02` `/novels/:novelId` への遷移）
  - `TR-04`（目次リストのエピソード行タップ、または「最初から読む／続きから読む」ボタンタップによる小説リーダー画面 `SCR-03` `/novels/:novelId/chapters/:chapterIndex` への遷移）
  - `TR-06`（小説リーダー画面 `SCR-03` の上部オーバーレイ「← 目次」ボタン押下または OS バックキー操作による `SCR-02` `/novels/:novelId` への復帰）
  - `TR-07`（作品詳細画面からの戻り元復帰導線：作品未検出画面 `novel-detail-not-found` の「戻る」ボタン、作品削除確認ダイアログでの削除実行完了、または OS バックキー操作による直前の遷移元画面［本棚 `SCR-01` `/`、検索 `SCR-06` `/search`、ランキング `SCR-07` `/ranking`］への復帰。直前履歴が存在しない場合は本棚 `/` へ復帰。※`NovelDetailHeader` 内の「← 本棚へ戻る」ボタンは廃止。なお下部タブバー「本棚」タップ時は `TR-01b` が適用される）
  - `TR-14`（検索結果カードおよびランキング結果カード本体タップによる `SCR-02` `/novels/:novelId` への遷移）
  - `TR-18`（作品詳細ヘッダーの3点メニュー内「未取得話を一括キャッシュ」アクションによる順次本文取得・進捗表示・手動中断）
  - `TR-19`（作品詳細ヘッダーの3点メニュー内「本文キャッシュ整理」アクションによる本文キャッシュ削除［既読のみ／全話］・容量即時再計算、`v0.5` Issue #170）
  - `TR-09`（作品詳細ヘッダーの3点メニュー内「内蔵ブラウザで開く」アクションによる `SCR-04` `/browser?url=...&novelId=...` へのフォールバック遷移、`v0.9` Issue #269）
- **対象外スコープ（後続 Issue / Milestone）**:
  - エピソード閲覧に伴うしおり位置（`bookmarkChapterIndex`, `bookmarkScrollProgress`）および既読フラグ（`isRead`）の自動更新ロジック本体（Issue #14 の `SCR-03` リーダー画面拡張で一括実装）
  - 汎用 Web ブラウザとしてのマルチタブ・ブックマーク管理（小説フォールバック表示・DOM インポートに特化）

---

## 2. コンポーネント構成と責務境界

`docs/guidelines/testing.md` の親子分離原則および 1対1 Story/UT 原則に従い、`src/features/novel-detail/` 配下を以下のモジュール構成とします（Issue #12 で暫定配置された `NovelDetailPlaceholder.*` は `NovelDetailContainer` のルーター統合時に置き換えて廃止します）。

`SYS-REQ-16` に基づき、`NovelDetailPage` は 100dvh 全画面シェル（`h-full flex flex-col overflow-hidden`）内に配置され、ウィンドウ全体のスクロールを抑止した上で、作品詳細ヘッダーおよびエピソード目次一覧が中間領域（`flex-1 min-h-0 overflow-y-auto`）で独立して縦スクロールします。画面下部には共通下部タブバー（`BottomTabBar`）が直前の探索元（`novelOrigin`）のアクティブ状態で配置されます。

```text
src/features/novel-detail/
├── types.ts                               # 作品詳細機能全体のフック返却値・各コンポーネントProps型定義
├── hooks/
│   ├── useNovelDetail.ts                  # 作品情報・目次一覧取得、目次再取得、作品削除、状態管理フック
│   └── useNovelDetail.test.ts             # フック単体テスト（Vitest）
└── components/
    ├── NovelDetailHeader.tsx              # 作品メタ情報・あらすじ・統計・読書開始/お気に入り・目次更新アイコン・3点メニュー（一括キャッシュ/キャッシュ整理/WebView/削除）（Presentational）
    ├── NovelDetailHeader.stories.tsx
    ├── NovelDetailHeader.test.tsx
    ├── EpisodeListItem.tsx                # 単一エピソード行（話数・タイトル・日時・取得状態・既読・しおり表示）（Presentational）
    ├── EpisodeListItem.stories.tsx
    ├── EpisodeListItem.test.tsx
    ├── EpisodeList.tsx                    # 章見出し（partTitle）グルーピング＋エピソード一覧（Presentational）
    ├── EpisodeList.stories.tsx
    ├── EpisodeList.test.tsx
    ├── DeleteConfirmDialog.tsx            # 作品削除確認モーダルダイアログ（Presentational）
    ├── DeleteConfirmDialog.stories.tsx
    ├── DeleteConfirmDialog.test.tsx
    ├── ClearCacheConfirmDialog.tsx        # 本文キャッシュ削除確認モーダルダイアログ（既読のみ/全話）（Presentational, v0.5）
    ├── ClearCacheConfirmDialog.stories.tsx
    ├── ClearCacheConfirmDialog.test.tsx
    ├── NovelDetailPage.tsx                # 作品詳細・目次画面全体のレイアウト統合コンポーネント（Presentational）
    ├── NovelDetailPage.stories.tsx
    ├── NovelDetailPage.test.tsx
    ├── NovelDetailContainer.tsx           # ServiceProvider / Router / useNovelDetail を接続する Container
    ├── NovelDetailContainer.stories.tsx
    └── NovelDetailContainer.test.tsx
```

---

## 3. 各コンポーネント・フックの詳細契約

### 3.1 `NovelDetailHeader`（作品詳細ヘッダー）

作品のメタ情報（タイトル、著者、あらすじ、総話数・取得済み話数）、読書開始ボタン（「最初から読む」「続きから読む」）、目次更新ボタン、および作品削除ボタンを表示する Presentational コンポーネントです。画面上部に固定配置（`shrink-0`）され、あらすじの折りたたみトグルおよび省スペース化を提供します（画面内の「← 本棚へ戻る」ボタンは廃止）。

#### プロパティ契約（`NovelDetailHeaderProps`）

| プロパティ名             | 型                                           | 必須 | 説明                                                    |
| :----------------------- | :------------------------------------------- | :--- | :------------------------------------------------------ |
| `novel`                  | `NovelRecord`                                | 必須 | 表示対象の作品レコード                                  |
| `isRefreshing`           | `boolean`                                    | 必須 | 目次再取得（更新）通信中フラグ                          |
| `isBatchCaching`         | `boolean`                                    | 必須 | 未取得話一括キャッシュ実行中フラグ (`v0.3`)             |
| `batchCacheProgress`     | `{ current: number; total: number } \| null` | 必須 | 一括キャッシュ進行状況（現在話数/対象総数, `v0.3`）     |
| `isAllCached`            | `boolean`                                    | 必須 | 全話キャッシュ済み判定フラグ (`v0.3`)                   |
| `pendingCacheCount`      | `number`                                     | 任意 | キュー内の未完了 `'pending'` 話数（`v0.9` Issue #268）  |
| `failedCacheCount`       | `number`                                     | 任意 | キュー内の取得失敗 `'failed'` 話数（`v0.9` Issue #268） |
| `refreshMessage`         | `string \| null`                             | 任意 | 目次再取得・一括キャッシュ完了時の通知メッセージ        |
| `error`                  | `string \| null`                             | 任意 | 目次再取得失敗・一括キャッシュ失敗・削除のエラー        |
| `onStartFromBeginning`   | `() => void`                                 | 必須 | 「最初から読む（第1話）」ボタン押下時のコールバック     |
| `onResumeBookmark`       | `(chapterIndex: number) => void`             | 必須 | 「続きから読む（第N話）」ボタン押下時のコールバック     |
| `onRefreshToc`           | () => void \| Promise<void>                  | 必須 | 「目次を更新」ボタン押下時のコールバック                |
| `onStartBatchCache`      | () => void \| Promise<void>                  | 必須 | 「未取得話を一括キャッシュ」ボタン押下時 (`v0.3`)       |
| `onCancelBatchCache`     | `() => void`                                 | 必須 | 一括キャッシュ「中断」ボタン押下時 (`v0.3`)             |
| `onOpenDeleteDialog`     | `() => void`                                 | 必須 | 「作品を削除」ボタン押下時のコールバック                |
| `onOpenClearCacheDialog` | `() => void`                                 | 任意 | 「本文キャッシュ整理」ボタン押下時 (`v0.5` Issue #170)  |
| `onToggleFavorite`       | `() => void \| Promise<void>`                | 任意 | お気に入り（★）トグルボタン押下時 (`v0.8` Issue #266)   |
| `onOpenWebView`          | `() => void`                                 | 任意 | 「内蔵ブラウザで開く」ボタン押下時 (`v0.9` Issue #269)  |

#### 表示項目・セマンティック属性・活性制御ルール

- **ルート要素**: `data-testid="novel-detail-header"`、画面上部固定（`shrink-0`）
- **ナビゲーション**:
  - ヘッダー内の「← 本棚へ戻る」ボタン（`data-testid="back-to-bookshelf-button"`）は廃止（下部タブバーおよび OS バックキーにより復帰するため）。
- **作品メタ情報（省スペース配置）**:
  - **作品タイトル**: `data-testid="novel-detail-title"`（`novel.title`、コンパクトな見出しサイズ）
  - **著者名**: `data-testid="novel-detail-author"`（`novel.author`、空文字の場合は `著者不明`）
  - **話数・キャッシュ統計**: `data-testid="novel-detail-stats"`
    - `全 {novel.totalChapters} 話（取得済み {novel.cachedChapters} 話 / {formatByteSize(novel.totalByteSize)}）` の形式で表示する。
- **あらすじの折りたたみトグル（`synopsis`）**:
  - `data-testid="novel-detail-synopsis"`（`novel.synopsis`、空文字の場合は `あらすじはありません。`）
  - **初期状態（折りたたみ）**: 数行（2〜3行、`line-clamp-2` 等）のみ表示する。
  - **トグルボタン**: `data-testid="synopsis-toggle-button"`
    - 折りたたみ時ラベル: `あらすじを展開`、展開時ラベル: `あらすじを折りたたむ`
    - セマンティック属性: `aria-expanded={isSynopsisExpanded}`、`aria-controls="novel-detail-synopsis"`
  - **展開時の制御**: タップで全文を展開する。展開時も各話リスト領域が押し潰されないよう、最大高さ制限と内部スクロール（`max-h-40 overflow-y-auto`）を設ける。
  - ※`novel.synopsis` が空文字・未設定の場合は「あらすじはありません。」を表示し、トグルボタンは描画しない。
- **読書開始ボタンの表示制御（`TR-04`）**:
  - **しおり未設定時（`novel.bookmarkChapterIndex === null`）**:
    - プライマリボタン `data-testid="detail-read-first-button"`（ラベル: `最初から読む（第1話）`）の **1 ボタンのみ** を表示し、クリック時に `onStartFromBeginning()` を呼び出す（`detail-resume-button` は描画しない）。
  - **しおり設定時（`novel.bookmarkChapterIndex !== null`）**:
    - プライマリボタン `data-testid="detail-resume-button"`（ラベル: `続きから読む（第{novel.bookmarkChapterIndex}話）`、クリック時に `onResumeBookmark(novel.bookmarkChapterIndex)` を呼び出す）と、セカンダリボタン `data-testid="detail-read-first-button"`（ラベル: `最初から読む（第1話）`、クリック時に `onStartFromBeginning()` を呼び出す）の **2 ボタンを並べて表示** する。
  - ※`novel.totalChapters === 0` の場合のみ読書開始ボタンを `disabled` とする（`isBatchCaching === true` 中も非ブロッキングであり、押下してリーダー画面へ遷移可能、`v1.2` Issue #344）。
- **管理アクションバー（右寄せ・常時1行アイコンバー ＆ 3点メニュー集約、`v1.1` Issue #343 / 非ブロッキング拡張 `v1.2` Issue #344）**:
  - モバイル狭幅（375px）での折り返しによる画面上部圧迫を解消し本棚画面（`SCR-01`）と操作感を統一するため、タイトルの1段上に右寄せ1行のコンパクトなアイコンバー（`flex items-center justify-end gap-1.5 sm:gap-2 flex-nowrap`）を配置し、日常ワンタップ操作（お気に入り・目次更新）と3点リーダーメニュー（`⋮`）を並置する。一括キャッシュ実行中（`isBatchCaching === true`）は進捗テキストおよび中断ボタンをアイコン群の左側に直接表示しつつ、ヘッダーアイコン群・読書開始ボタン・目次一覧操作をブロックしない。
  - **一括キャッシュ進行状況および中断ボタン（`v0.3` / `v0.9` Issue #268, #311 / `v1.1` Issue #343）**:
    - `isBatchCaching === true` の場合のみアイコン群の左側に直接表示する（メニューを開かずに進捗確認・中断が可能）：
      - 進行表示要素 `data-testid="batch-cache-progress"`（`min-w-0 truncate` で狭幅1行維持。表示例: `キャッシュ中 (3/15)...`、取得失敗が存在する場合は `キャッシュ中 (3/15) [失敗 1話]...` のように失敗件数を警告色でリアルタイム表示。再開・再試行時は今回の対象残り話数 $N$ を分母として `0/N` 〜 `N/N` を表示）。
      - 中断ボタン `data-testid="batch-cache-cancel-button"`（ラベル: `中断`、`shrink-0`、クリック時に `onCancelBatchCache()` を呼び出す）。
  - **お気に入り（★）トグルボタン（`v0.8` Issue #266 / `v1.1` Issue #343）**: `data-testid="detail-favorite-toggle-button"`
    - セマンティック属性: 固定ラベル `aria-label="お気に入り"` ＋ `aria-pressed={Boolean(novel.isFavorite)}`（R1-10 / R2-01）。
    - アイコンのみ表示と枠線スタイル: 本棚画面（`BookshelfPage` / `NovelCard`）に合わせテキストを廃止し、`novel.isFavorite === true` のときは `★`（アンバー色強調スタイル、`border border-amber-300 dark:border-amber-700/60`）、`false` のときは `☆`（通常枠線スタイル、`border border-slate-200 dark:border-slate-600`）を表示する。ON/OFF 双方で常時 1px `border` と固定サイズ（`shrink-0`）を維持し、トグル時のレイアウトちらつきを防止する（R2-19）。
    - クリック時に `onToggleFavorite?.()` を呼び出す。`isRefreshing === true` の間のみ `disabled` とする（`isBatchCaching === true` 中も操作可能）。
  - **目次更新ボタン（`v1.1` Issue #343）**: `data-testid="refresh-toc-button"`
    - 本棚画面の更新ボタンと合わせテキストを廃止し、`🔄` アイコンのみ表示（`isRefreshing === true` の間はアイコン要素に `animate-spin` を適用）とする。
    - セマンティック属性: `aria-label="目次を更新"`。`isRefreshing === true` の間のみ `disabled`、`shrink-0`（`isBatchCaching === true` 中も操作可能）。
  - **3点メニューボタン（`v1.1` Issue #343）**: `data-testid="novel-detail-menu-button"`
    - `⋮` アイコンボタン（`shrink-0`）を配置し、タップで下記の管理アクション4件を格納したドロップダウンメニュー（`role="menu"`, `data-testid="novel-detail-menu"`）を開閉する。
    - セマンティック属性: `aria-label="作品メニュー"`, `aria-haspopup="menu"`, `aria-expanded={isMenuOpen}`, `aria-controls={isMenuOpen ? menuId : undefined}`（`useId()` 生成・展開時のみ付与）。
    - `isRefreshing === true` の間は `disabled` とし、開いていたメニューは自動的に閉じる（`isBatchCaching === true` 中も3点メニューボタン自体は開閉可能）。
  - **3点メニュー格納アクション（`role="menu"` 内、`role="menuitem"` として描画）**:
    - メニュー項目選択時は即座にメニューを閉じて対象アクションを発火する。またメニュー外領域のクリック（タップ）または `Escape` キー押下時（トリガーボタンへフォーカス復帰）にメニューを閉じる。
    1. **未取得話一括キャッシュ・再開・再試行ボタン（`v0.3` / `v0.9` Issue #268 / `v1.2` Issue #344 拡張）**: `data-testid="batch-cache-button"`
       - `novel.totalChapters === 0`（または `chapters.length === 0`）の場合: ラベル `未取得話を一括キャッシュ`、`disabled` 化（対象話が存在しないため）。
       - `isAllCached === true`（エピソードが存在し `novel.cachedChapters === novel.totalChapters` かつ全話有効キャッシュ）の場合: ラベル `全話キャッシュ済み`、`disabled` 化。
       - `isBatchCaching === true` の場合: 二重起動防止のためラベル `一括キャッシュ実行中...`、`disabled` 化（停止・キャンセルはアイコンバー常設の `batch-cache-cancel-button` から実行）。
       - `isBatchCaching !== true` かつ `pendingCacheCount > 0`（中断・再起動後の未完了 `'pending'` 話が残っている場合）: ラベル `キャッシュを再開（残り${pendingCacheCount + failedCacheCount}話）`、クリック時にメニューを閉じて `onStartBatchCache()` を呼び出す。`isRefreshing === true` の間は `disabled`。
       - `isBatchCaching !== true` かつ `pendingCacheCount === 0` かつ `failedCacheCount > 0`（`'pending'` 話が 0 件で取得失敗 `'failed'` 話が残っている場合）: ラベル `失敗した話を再試行（${failedCacheCount}話）`、クリック時にメニューを閉じて `onStartBatchCache()` を呼び出す。`isRefreshing === true` の間は `disabled`。
       - `isBatchCaching !== true` かつ上記以外で未取得話（または 7日経過キャッシュ）がある場合: ラベル `未取得話を一括キャッシュ`、クリック時にメニューを閉じて `onStartBatchCache()` を呼び出す。`isRefreshing === true` の間は `disabled`。
    2. **本文キャッシュ整理ボタン（`v0.5` Issue #170 / `v1.2` Issue #344 協調制御）**: `data-testid="open-clear-cache-dialog-button"`
       - ラベル: `本文キャッシュ整理`。クリック時にメニューを閉じて `onOpenClearCacheDialog()` を呼び出す。
       - `novel.cachedChapters === 0` または `isRefreshing === true` の間は `disabled`（`isBatchCaching === true` 中も押下可能とし、確定時に `confirmClearCache` 内でバックグラウンドタスクを安全停止する）。
    3. **「内蔵ブラウザで開く」ボタン（`v0.9` Issue #269）**: `data-testid="open-webview-button"`
       - ラベル: `内蔵ブラウザで開く`。クリック時にメニューを閉じて `onOpenWebView?.()` を呼び出す（`TR-09`）。
       - `isRefreshing === true` の間のみ `disabled`（`isBatchCaching === true` 中も操作可能）。
    4. **作品削除起動ボタン**: 区切り線（`role="separator"`）で上記3項目と分離した上で `data-testid="open-delete-dialog-button"`（ラベル: `作品を削除`、赤文字警告スタイル、`isRefreshing === true` の間のみ `disabled`、`isBatchCaching === true` 中も操作可能）を配置し、クリック時にメニューを閉じて `onOpenDeleteDialog()` を呼び出す。
- **インラインフィードバック表示**:
  - `refreshMessage` が非 null の場合: `data-testid="novel-detail-notice"` に通知メッセージ（例: `目次を更新しました（+2話）` または `全話のキャッシュを取得しました`、`最新の状態です`）を表示する。
  - `error` が非 null の場合: `data-testid="novel-detail-error"` に日本語エラーメッセージを表示する。

---

### 3.2 `EpisodeListItem`（単一エピソード行）

目次内の 1 エピソード（`ChapterSummary`）と、その本文キャッシュ状態・既読状態・しおり位置マークを表示し、タップ時にリーダー画面への遷移（`TR-04`）をトリガーする Presentational コンポーネントです。

#### プロパティ契約（`EpisodeListItemProps`）

| プロパティ名       | 型                               | 必須 | 説明                                                                                  |
| :----------------- | :------------------------------- | :--- | :------------------------------------------------------------------------------------ |
| `chapter`          | `ChapterSummary`                 | 必須 | 表示対象のエピソードサマリーレコード                                                  |
| `isBookmarked`     | `boolean`                        | 必須 | 現在のしおり位置（`novel.bookmarkChapterIndex === chapter.chapterIndex`）かどうか     |
| `isDownloadFailed` | `boolean`                        | 任意 | 一括キャッシュで取得失敗（`download_queue.status === 'failed'`）したかどうか (`v0.9`) |
| `onSelectEpisode`  | `(chapterIndex: number) => void` | 必須 | エピソード行タップ時のコールバック（`TR-04`）                                         |

#### 表示項目とセマンティック属性

- **ルート要素**: `data-testid="episode-item"`、`data-chapter-index={chapter.chapterIndex}`
  - クリック（タップ）時に `onSelectEpisode(chapter.chapterIndex)` を呼び出す（個別DLボタンは設けず、行全体のタップでリーダー遷移＆未キャッシュ時オンデマンド取得に統一）。
  - 一括キャッシュ実行中（`isBatchCaching === true`）であっても非ブロッキング方針（`v1.2` Issue #344）に基づきタップ操作を無効化しない（既読・未キャッシュ問わず即座に `SCR-03` へ遷移可能）。
- **エピソード番号・サブタイトル**: `data-testid="episode-item-title"`（`第{chapter.chapterIndex}話 {chapter.title}` または連番バッジ＋`chapter.title`）
- **公開・更新日時**: `chapter.publishedAt` が非 null の場合、`data-testid="episode-item-date"` に表示する。
- **状態バッジ群**:
  1. **本文キャッシュ状態バッジ**:
     - `chapter.downloadedAt !== null`（または `chapter.byteSize > 0`）の場合: `data-testid="episode-cached-badge"`（ラベル: `取得済み`）を表示する。
     - 未取得かつ `isDownloadFailed === true` の場合（`v0.9` Issue #268）: `data-testid="episode-failed-badge"`（ラベル: `取得失敗`、ローズ/赤系警告バッジスタイル）を表示する。
     - 上記以外の未取得の場合: `data-testid="episode-uncached-badge"`（ラベル: `未取得`）を表示する。
  2. **既読状態バッジ**:
     - `chapter.isRead === true` の場合: `data-testid="episode-read-badge"`（ラベル: `既読`）を表示する（`false` の場合は描画しない）。
  3. **しおり位置マーク**:
     - `isBookmarked === true` の場合: `data-testid="episode-bookmark-badge"`（ラベル: `しおり`）を表示する（`false` の場合は描画しない）。

---

### 3.3 `EpisodeList`（章見出し付きエピソード一覧）

全エピソード配列（`ChapterSummary[]`）を受け取り、章・部見出し（`partTitle`）の境界ごとにセクションヘッダーを挿入したフラットリストとして描画する Presentational コンポーネントです。`NovelDetailPage` の内部スクロール領域（`episode-list-container`）内に配置されます。

#### プロパティ契約（`EpisodeListProps`）

| プロパティ名           | 型                               | 必須 | 説明                                                    |
| :--------------------- | :------------------------------- | :--- | :------------------------------------------------------ |
| `chapters`             | `ChapterSummary[]`               | 必須 | `chapterIndex` 昇順のエピソード一覧                     |
| `bookmarkChapterIndex` | `number \| null`                 | 必須 | 作品の現在のしおり話数（未設定時は `null`）             |
| `failedChapterIndexes` | `number[]`                       | 任意 | 取得失敗状態の `chapterIndex` 配列（`v0.9` Issue #268） |
| `onSelectEpisode`      | `(chapterIndex: number) => void` | 必須 | 個別エピソードタップ時のコールバック（`TR-04`）         |

#### 章見出し（`partTitle`）グルーピングとセマンティック属性

- **空状態**: `chapters.length === 0` の場合は `data-testid="episode-list-empty"`（案内文: `エピソード目次がありません。`）を描画する。
- **一覧コンテナ**: `chapters.length > 0` の場合は `data-testid="episode-list"` を描画する。
- **章見出し（セクションヘッダー）挿入ルール**:
  - アコーディオン開閉は設けず、全話を一覧可能なフラットリスト形式で描画する。
  - 各 `chapter` を走査する際、`chapter.partTitle` が非 null（かつ空文字でない）であり、かつ直前のエピソードの `partTitle` と異なる場合（先頭エピソードを含む）に、該当エピソード行の直前に章見出し要素 `<div data-testid="chapter-section-header">{chapter.partTitle}</div>` を描画する。
  - `chapter.partTitle === null`（または空文字）のエピソードには章見出し要素を描画しない。
- **各話描画**:
  - 各 `chapter` に対して `EpisodeListItem` を描画し、`isBookmarked={bookmarkChapterIndex === chapter.chapterIndex}` および `isDownloadFailed={failedChapterIndexes?.includes(chapter.chapterIndex) ?? false}` を渡す。
  - 各話要素には `data-chapter-index={chapter.chapterIndex}` が付与されており、初期スクロール位置調整のターゲットとして使用される。

---

### 3.4 `DeleteConfirmDialog`（作品削除確認ダイアログ）

作品を本棚（ローカル DB）から完全に削除する前の確認モーダルダイアログです。

#### プロパティ契約（`DeleteConfirmDialogProps`）

| プロパティ名 | 型                          | 必須 | 説明                                    |
| :----------- | :-------------------------- | :--- | :-------------------------------------- |
| `isOpen`     | `boolean`                   | 必須 | ダイアログの表示状態                    |
| `novelTitle` | `string`                    | 必須 | 削除対象の作品タイトル                  |
| `isDeleting` | `boolean`                   | 必須 | 削除処理実行中フラグ                    |
| `onClose`    | `() => void`                | 必須 | キャンセル / 閉じる操作時のコールバック |
| `onConfirm`  | () => void \| Promise<void> | 必須 | 「削除する」確定時のコールバック        |

#### 機能・セマンティック属性

- `isOpen === false` の場合は何も描画しない（`null`）。
- **ダイアログコンテナ**: `role="dialog"`, `aria-modal="true"`, `data-testid="delete-confirm-dialog"`
- **確認メッセージ**: 削除対象の作品名（`novelTitle`）と、取得済み本文キャッシュを含む全データが削除される旨（例: `「{novelTitle}」を本棚から削除しますか？取得済みの本文データもすべて削除されます。`）を表示する。
- **削除確定ボタン**: `data-testid="confirm-delete-button"`
  - `isDeleting === true` の間は `disabled` とし、ラベルを `削除中...` に変更する（通常時は `削除する`）。
- **キャンセルボタン**: `data-testid="cancel-delete-button"`（ラベル: `キャンセル`、`isDeleting === true` の間は `disabled`）。
- **Escape キー連動**: キーボードの `Escape` キー押下時に `isDeleting === false` であれば `onClose()` を呼び出して閉じる。

---

### 3.5 `ClearCacheConfirmDialog`（本文キャッシュ削除確認ダイアログ: `v0.5` Issue #170）

作品の目次情報・既読状態・しおり位置を保持したまま、端末ストレージを解放するために本文キャッシュのみを削除（既読話のみ／全話）する確認モーダルダイアログです。

#### プロパティ契約（`ClearCacheConfirmDialogProps`）

| プロパティ名 | 型                                                                    | 必須 | 説明                                    |
| :----------- | :-------------------------------------------------------------------- | :--- | :-------------------------------------- |
| `isOpen`     | `boolean`                                                             | 必須 | ダイアログの表示状態                    |
| `novelTitle` | `string`                                                              | 必須 | 対象の作品タイトル                      |
| `isClearing` | `boolean`                                                             | 必須 | キャッシュ削除実行中フラグ              |
| `onClose`    | `() => void`                                                          | 必須 | キャンセル / 閉じる操作時のコールバック |
| `onConfirm`  | `(options: { onlyRead: boolean }) => void \| Promise<void \| number>` | 必須 | 削除確定時のコールバック                |

#### 機能・セマンティック属性

- `isOpen === false` の場合は何も描画しない（`null`）。
- **ダイアログコンテナ**: `role="dialog"`, `aria-modal="true"`, `data-testid="clear-cache-confirm-dialog"`
- **説明テキスト**: 目次一覧・既読状態・しおり位置は保持され、再度読む際は再取得可能である旨を明記する。
- **選択アクションボタン**:
  - **既読話のみ削除**: `data-testid="confirm-clear-read-cache-button"`（ラベル: `既読話の本文キャッシュのみ削除`、クリック時に `onConfirm({ onlyRead: true })` を呼び出す、`isClearing === true` の間は `disabled`）。
  - **全話削除**: `data-testid="confirm-clear-all-cache-button"`（ラベル: `すべての本文キャッシュを削除`、クリック時に `onConfirm({ onlyRead: false })` を呼び出す、`isClearing === true` の間は `disabled`）。
  - **キャンセル**: `data-testid="cancel-clear-cache-button"`（ラベル: `キャンセル`、クリック時に `onClose()` を呼び出す、`isClearing === true` の間は `disabled`）。
- **Escape キー連動**: キーボードの `Escape` キー押下時に `isClearing === false` であれば `onClose()` を呼び出して閉じる。

---

### 3.6 `NovelDetailPage`（作品詳細・目次画面 Presentational コンポーネント）

`NovelDetailHeader`、`EpisodeList`、`DeleteConfirmDialog`、および `ClearCacheConfirmDialog` を統合し、ローディング状態や未存在作品（Not Found）状態の排他描画、ヘッダー固定・各話リスト内部スクロールレイアウト、およびしおり話数への初期スクロール調整を制御する画面コンポーネントです。

#### プロパティ契約（`NovelDetailPageProps`）

| プロパティ名              | 型                                                                    | 必須 | 説明                                                                                        |
| :------------------------ | :-------------------------------------------------------------------- | :--- | :------------------------------------------------------------------------------------------ |
| `novel`                   | `NovelRecord \| null`                                                 | 必須 | 作品レコード（未取得・存在しない場合は `null`）                                             |
| `chapters`                | `ChapterSummary[]`                                                    | 必須 | エピソード目次一覧                                                                          |
| `isLoading`               | `boolean`                                                             | 必須 | 初回データ読み込み中フラグ                                                                  |
| `isRefreshing`            | `boolean`                                                             | 必須 | 目次再取得（更新）通信中フラグ                                                              |
| `isBatchCaching`          | `boolean`                                                             | 必須 | 未取得話一括キャッシュ実行中フラグ (`v0.3`)                                                 |
| `batchCacheProgress`      | `{ current: number; total: number } \| null`                          | 必須 | 一括キャッシュ進行状況 (`v0.3`)                                                             |
| `isAllCached`             | `boolean`                                                             | 必須 | 全話キャッシュ済み判定フラグ (`v0.3`)                                                       |
| `pendingCacheCount`       | `number`                                                              | 任意 | キュー内の未完了 `'pending'` 話数 (`v0.9`)                                                  |
| `failedCacheCount`        | `number`                                                              | 任意 | キュー内の取得失敗 `'failed'` 話数 (`v0.9`)                                                 |
| `failedChapterIndexes`    | `number[]`                                                            | 任意 | 取得失敗状態の `chapterIndex` 配列 (`v0.9`)                                                 |
| `isDeleteDialogOpen`      | `boolean`                                                             | 必須 | 作品削除確認ダイアログの開閉状態                                                            |
| `isDeleting`              | `boolean`                                                             | 必須 | 作品削除実行中フラグ                                                                        |
| `isClearCacheDialogOpen`  | `boolean`                                                             | 任意 | 本文キャッシュ削除ダイアログ開閉 (`v0.5`)                                                   |
| `isClearingCache`         | `boolean`                                                             | 任意 | 本文キャッシュ削除実行中フラグ (`v0.5`)                                                     |
| `refreshMessage`          | `string \| null`                                                      | 任意 | 目次再取得・一括キャッシュ完了時の通知文字列                                                |
| `error`                   | `string \| null`                                                      | 任意 | エラーメッセージ文字列                                                                      |
| `onBackToBookshelf`       | `() => void`                                                          | 必須 | 「本棚へ戻る」押下時（未検出エラー画面での復帰用）                                          |
| `onStartFromBeginning`    | `() => void`                                                          | 必須 | 「最初から読む（第1話）」押下時（`TR-04`）                                                  |
| `onResumeBookmark`        | `(chapterIndex: number) => void`                                      | 必須 | 「続きから読む（第N話）」押下時（`TR-04`）                                                  |
| `onSelectEpisode`         | `(chapterIndex: number) => void`                                      | 必須 | 個別エピソード行タップ時（`TR-04`）                                                         |
| `onRefreshToc`            | () => void \| Promise<void>                                           | 必須 | 「目次を更新」押下時                                                                        |
| `onStartBatchCache`       | () => void \| Promise<void>                                           | 必須 | 「未取得話を一括キャッシュ」押下時 (`v0.3`)                                                 |
| `onCancelBatchCache`      | `() => void`                                                          | 必須 | 一括キャッシュ「中断」押下時 (`v0.3`)                                                       |
| `onOpenDeleteDialog`      | `() => void`                                                          | 必須 | 「作品を削除」押下時                                                                        |
| `onCloseDeleteDialog`     | `() => void`                                                          | 必須 | 削除確認ダイアログのキャンセル時                                                            |
| `onConfirmDelete`         | () => void \| Promise<void>                                           | 必須 | 削除確認ダイアログの「削除する」確定時（`TR-07`）                                           |
| `onOpenClearCacheDialog`  | `() => void`                                                          | 任意 | 「本文キャッシュ整理」押下時 (`v0.5`)                                                       |
| `onCloseClearCacheDialog` | `() => void`                                                          | 任意 | キャッシュ削除ダイアログキャンセル時 (`v0.5`)                                               |
| `onConfirmClearCache`     | `(options: { onlyRead: boolean }) => void \| Promise<void \| number>` | 任意 | キャッシュ削除確定時 (`v0.5`)                                                               |
| `onToggleFavorite`        | `() => void \| Promise<void>`                                         | 任意 | お気に入り（★）トグル押下時 (`v0.8` Issue #266)                                             |
| `onOpenWebView`           | `(url: string) => void`                                               | 任意 | 内蔵ブラウザ画面（SCR-04）へフォールバック遷移（TR-09）するコールバック (`v0.9` Issue #269) |

#### セマンティック属性とレイアウト・排他描画ルール

- **画面ルート**: `data-testid="novel-detail-page"`（スタイル: `h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100`）
  - 画面全体の高さを占有し（100dvh 全画面シェル）、ウィンドウ自体のスクロールを防止する。
- **レイアウト構造**:
  - **上部固定ヘッダー**: `NovelDetailHeader` を `shrink-0` で上部に固定する。
  - **中央スクロール領域**: `<main data-testid="episode-list-container" className="flex-1 min-h-0 overflow-y-auto ...">` 内に `EpisodeList` を配置し、各話リストのみが内部スクロールする。一括キャッシュ実行中（`isBatchCaching === true`）であっても `pointer-events-none opacity-80` 等の操作・スクロールロックは付与せず、縦スクロールおよびエピソードタップを常時許可する（`v1.2` Issue #344）。
  - **最下部共通タブバー**: 画面最下部に `BottomTabBar` が直前の探索元（検索・ランキング・本棚）のアクティブ状態で常時固定配置される。
- **しおり話数（`bookmarkChapterIndex`）への初期スクロール位置自動調整**:
  - 初回データ読み込み完了時（`isLoading` が `false` に切り替わり `novel !== null` かつ `chapters.length > 0` となった初回）、作品にしおり（`novel.bookmarkChapterIndex !== null`）が設定されている場合は、該当話（`[data-chapter-index="${novel.bookmarkChapterIndex}"]`）の要素が各話リストスクロール領域の先頭（上端）に来るよう自動スクロール位置を調整する。
  - しおり未設定時（`novel.bookmarkChapterIndex === null`）はスクロール調整を行わず、先頭（`scrollTop = 0`）のままとする。
  - 初回スクロール完了フラグを管理し、同一画面内での「目次を更新」（`refreshToc`、`isRefreshing` の変化）実行時には自動スクロールを再実行せず、ユーザーの現在スクロール位置を維持する。
  - 作品 ID（`novelId`）が変化した際（別作品へ遷移時）はフラグをリセットし、新作品の初回表示時に再度しおりスクロールを行う。
- **メイン領域の排他描画ルール**:
  1. `isLoading === true` の場合: ローディング表示要素 `data-testid="novel-detail-loading"` を描画し、ヘッダー・目次一覧・未存在表示は描画しない。
  2. `isLoading === false` かつ `novel === null` の場合: 未存在・エラー案内領域 `data-testid="novel-detail-not-found"`（`error ?? "指定された作品が見つかりません。"`）および「本棚へ戻る」ボタン `data-testid="back-to-bookshelf-button"` を描画する。
  3. `isLoading === false` かつ `novel !== null` の場合: `NovelDetailHeader`（上部固定）、各話リスト内部スクロール領域（中央）、`DeleteConfirmDialog`、および `ClearCacheConfirmDialog` を描画する。

---

### 3.7 `NovelDetailContainer`（作品詳細・目次画面 Container コンポーネント）

`useNovelDetail(novelId)` フックとルーター遷移コールバック（または Props で注入された遷移コールバック）を接続し、`NovelDetailPage` を描画する Container コンポーネントです。

#### プロパティ契約（`NovelDetailContainerProps`）

| プロパティ名        | 型                                                | 必須 | 説明                                                                                                                   |
| :------------------ | :------------------------------------------------ | :--- | :--------------------------------------------------------------------------------------------------------------------- |
| `novelId`           | `string`                                          | 必須 | ルート `/novels/:novelId` から渡される対象作品 ID                                                                      |
| `onBackToBookshelf` | `() => void`                                      | 任意 | 探索元（または本棚）へ戻る遷移コールバック（省略時は直前の探索元へ復帰、履歴なし時は本棚へ復帰）                       |
| `onSelectEpisode`   | `(novelId: string, chapterIndex: number) => void` | 任意 | リーダー画面への遷移コールバック（省略時は `useRouter().navigateToReader` を使用）                                     |
| `onOpenWebView`     | `(url: string) => void`                           | 任意 | 内蔵ブラウザ画面への遷移コールバック（省略時は `useRouter().navigateToBrowser(url)` を使用、TR-09、`v0.9` Issue #269） |

---

## 4. データ取得・目次更新・作品削除パイプライン（`useNovelDetail`）

### 4.1 `useNovelDetail` フック契約（`UseNovelDetailResult`）

```ts
export interface UseNovelDetailResult {
  novel: NovelRecord | null;
  chapters: ChapterSummary[];
  isLoading: boolean;
  isRefreshing: boolean;
  isBatchCaching: boolean;
  batchCacheProgress: { current: number; total: number } | null;
  isAllCached: boolean;
  pendingCacheCount: number;
  failedCacheCount: number;
  failedChapterIndexes: number[];
  isDeleteDialogOpen: boolean;
  isDeleting: boolean;
  isClearCacheDialogOpen: boolean;
  isClearingCache: boolean;
  refreshMessage: string | null;
  error: string | null;
  refreshToc: () => Promise<boolean>;
  startBatchCache: () => Promise<void>;
  cancelBatchCache: () => void;
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
  confirmDeleteNovel: () => Promise<boolean>;
  openClearCacheDialog: () => void;
  closeClearCacheDialog: () => void;
  confirmClearCache: (options: { onlyRead: boolean }) => Promise<number>;
  toggleFavorite: () => Promise<boolean>;
  reloadDetail: (options?: { silent?: boolean }) => Promise<void>;
}
```

### 4.2 パイプライン仕様

1. **初回ロード（`reloadDetail`）と本棚「NEW」バッジ解除・永続ダウンロードキュー整合性同期**:
   - `ServiceProvider` の `isReady === true` 後、`novelRepository.getNovelById(novelId)` および `chapterRepository.listChaptersByNovelId(novelId)` を並行取得する。
   - `queueRepository` が利用可能な場合、以下の手順で `download_queue` を同期する（`v0.9` Issue #268 / `v1.2` Issue #344 拡張）：
     - `cacheScheduler?.isNovelBatchCaching(novelId) !== true` の場合のみ `queueRepository.resetInterruptedToPending(novelId)` を呼び出し、アプリ再起動等で `'downloading'` のまま残ったレコードを `'pending'` に戻す（バックグラウンド一括キャッシュ継続中に再訪問した場合は実行中の `'downloading'` レコードを誤って巻き戻さない）。
     - `cacheScheduler` が注入されている場合は、マウント時に `cacheScheduler.getNovelProgress(novelId)` から進行中状態（`isBatchCaching`, `batchCacheProgress`）を復元し、`cacheScheduler.subscribeProgress(novelId, ...)` を購読して各話取得ごとの進捗・キャッシュ完了済み話数・完了/失敗/中断通知をリアルタイムに反映する。
     - リーダー画面（`SCR-03`）での閲覧や 5話自動先読みにより既に有効キャッシュ済み（`isChapterFresh === true`）となった話数、または `'completed'` 状態のレコードがキューに残っている場合は `queueRepository.deleteByNovelAndChapters(novelId, freshOrCompletedIndexes)` で自動除去し、全話キャッシュ済み（`isAllCached === true`）であれば `queueRepository.clearNovelQueue(novelId)` でキューを空にする。
     - 残存する `download_queue` レコードから `pendingCacheCount`（`status === 'pending'` 件数）、`failedCacheCount`（`status === 'failed'` 件数）、および `failedChapterIndexes`（未キャッシュかつ `status === 'failed'` の話数連番昇順配列）を算出して State に反映する。
   - 読み込み完了時、対象作品の `novel.hasNewUpdate === true` の場合は `novelRepository.clearNewUpdate(novelId)` を呼び出して `has_new_update = 0` に解除し、本棚画面（`SCR-01`）復帰時にも「NEW」バッジが消去された状態を維持する。
   - 読み込み中は `isLoading = true` とし、完了後に `isLoading = false` とする（ただし `reloadDetail({ silent: true })` 時は `isLoading` を変更せず、一覧 DOM をアンマウントしない）。
   - **クラウド同期 Pull 完了時の自動最新化（`v1.1` Issue #342）**: マウント中に `syncEngine?.subscribePullCompleted` を購読し、`result.pulled === true` が通知された場合は `void reloadDetail({ silent: true })` を呼び出し、`isMountedRef` ガードのもとで他端末から同期されたしおり話数（`しおり` バッジ・`続きから読む（第N話）` ボタン）や既読バッジ（`既読`）を画面リロードおよび一覧 DOM アンマウントなしで自動反映する（既存の目次スクロール位置を維持し、`NovelDetailPage` の `scrolledNovelIdRef` により同一 `novel.id` でのしおり自動スクロール再発火を防止する）。
2. **目次再取得・差分更新（`refreshToc`、`v1.2` Issue #344 協調制御）**:
   - `novel === null` の場合は何もせず `false` を返す。
   - 対象作品のバックグラウンド一括キャッシュが動作中の場合は、`const wasBatchCaching = cacheScheduler?.isNovelBatchCaching(novelId) === true` を記録し、目次構造変更と書き込み競合を防ぐため `await cacheScheduler?.pauseNovelTasks(novelId)` で一旦安全にポーズする。
   - `isRefreshing = true`, `error = null`, `refreshMessage = null` にセットする。
   - **通信前パーサー解決と正規化**: `parserRegistry.requireParser(novel.canonicalUrl)` および `parser.normalizeWorkUrl(novel.canonicalUrl)` を実行する。
   - **目次 HTML 取得・解析・DB Upsert**:
     - `fetchFullNovelIndex(httpClient, parser, normalizedWorkUrl)` を用いて作品トップ（および `nextTocPageUrl` が存在する複数ページ目次全ページ、Issue #239）を取得・結合し、最新メタデータ・全話目次一覧を抽出する。
     - 更新前の話数 `prevCount = chapters.length` を保持した上で、`novelRepository.upsertNovelWithToc(novelIndex, new Date().toISOString())` を実行する（`chapters` テーブルの `ON CONFLICT(novel_id, remote_chapter_id) DO UPDATE` により、既存の `body_html` / `byte_size` / `is_read` / `downloaded_at` は破壊されず保持される）。
   - **状態再取得と完了フィードバック**:
     - DB から最新の `novel` と `chapters` を再取得して State を更新する。
     - 追加話数 `addedCount = Math.max(0, updatedChapters.length - prevCount)` を算出し、`addedCount > 0` の場合は `目次を更新しました（+${addedCount}話）`、`addedCount === 0` の場合は `最新の状態です` を `refreshMessage` にセットする。
     - `wasBatchCaching === true` かつ更新後目次にも未取得対象話が残存する場合は、新着話を含む残未キャッシュ話を自動的に `cacheScheduler` へ再エンキュー・再開した上で、`true` を返す。
   - **通信・パース失敗時**:
     - 例外発生時は既存の `novel` / `chapters` 表示を維持したまま、`error` に日本語エラーメッセージをセットして `false` を返す。
3. **作品削除とカスケード削除（`confirmDeleteNovel`）**:
   - `isDeleting = true`, `error = null` にセットし、実行中タスクとの競合を防ぐため `await cacheScheduler?.cancelNovelTasks(novelId, { clearQueue: true })` を先に実行した上で、`novelRepository.deleteNovel(novelId)` を実行する。
   - `syncEngine` が注入されている場合は `syncEngine.notifyChanged()` を非同期実行してクラウド同期（Tombstone Push）をスケジュールする。
   - SQLite の外部キー制約（`PRAGMA foreign_keys = ON` ＆ `FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE`）により、当該作品に紐づく `chapters`（および `download_queue`）の全レコードが一括カスケード削除される。
   - 削除成功時はダイアログを閉じ（`isDeleteDialogOpen = false`）、`true` を返す。呼び出し元の `NovelDetailContainer` は `true` を受け取って即座に `onBackToBookshelf()`（直前の探索元画面への復帰 `TR-07`、履歴なし時は本棚 `/` へ復帰）を実行する。
   - 削除失敗時はダイアログを閉じずに `error` をセットし、`isDeleting = false` に戻して `false` を返す。
4. **エピソード選択と未キャッシュ話オンデマンド本文取得（`TR-04` → `SCR-03`）**:
   - 目次一覧のエピソード行タップ、またはヘッダーの「最初から読む（第1話）」「続きから読む（第N話）」ボタンタップ時は、一括キャッシュ実行中であっても即座にリーダー画面ルート `/novels/:novelId/chapters/:chapterIndex`（`SCR-03`）へ遷移する。
   - 遷移先の `ReaderContainer`（`useReader`、`SCR-03`）にて、対象話の `bodyHtml === null`（未キャッシュ）の場合は `CacheScheduler` 優先度 `'high'`（0ms 即時割り込み）で自動的に `httpClient.getHtml` → `parser.parseChapterContent` → `chapterRepository.saveChapterBody`（＋ `recalculateNovelStats` による `cached_chapters` 更新）が実行され、併せて `markChapterRead` による既読化（`is_read = 1`）および `updateBookmark` によるしおり・スクロール進捗率更新が行われる。
   - リーダー画面からの上部オーバーレイ「← 目次」ボタン押下または OS バックキー操作（`TR-06`）で `SCR-02` へ戻ると、`useNovelDetail` のマウント時ロードおよび `CacheScheduler` 進捗購読により該当エピソードのバッジが `取得済み`（`episode-cached-badge`）・`既読`（`episode-read-badge`）・`しおり`（`episode-bookmark-badge`）に、ヘッダーの取得済み話数・読書再開ボタン・継続中の一括キャッシュ進捗が最新値に反映される。
5. **未取得話の一括キャッシュ・中断再開・再試行パイプライン（`TR-18`、`v0.3` Issue #81 / `v0.9` Issue #268 / `v1.2` Issue #344 非ブロッキング・優先度キュー統合）**:
   - `isBatchCaching === true` の間は同一作品の一括キャッシュ多重起動のみ防止する（読書開始ボタン、各話行タップ、お気に入り、目次更新、内蔵ブラウザ遷移、作品削除、他画面遷移は一切ブロックしない）。
   - `ServiceProvider` より `cacheScheduler` が提供されている場合は、`startBatchCache` は `priority: 'low'` として `cacheScheduler.enqueueBatchCache(novelId, ...)` へ委譲する（テスト等で未注入時は既存のフック内直列実行フォールバックを維持）。
   - 全話キャッシュ済み判定（`isAllCached`）は、エピソードが存在し（`chapters.length > 0`）かつ全話が 7日以内の有効なキャッシュを持つ場合（`chapters.every(c => c.downloadedAt !== null && (now - new Date(c.downloadedAt).getTime() < CACHE_TTL_MS))`）に `true` となる。総話数が 0 話（`chapters.length === 0`）の場合は `isAllCached = false` となり、ボタンは disabled 化される。
   - 開始時に `queueRepository.resetInterruptedToPending(novelId)`（新規エンキュー開始時のみ）および有効キャッシュ済み話のキュー除外を実行する。
   - 対象作品の全エピソード（`chapters`）から、未取得話（`downloadedAt === null`）または 7日経過した古いキャッシュ（`now - new Date(downloadedAt).getTime() >= CACHE_TTL_MS`）を抽出する。
   - 対象が 0 件の場合は `queueRepository.clearNovelQueue(novelId)` を実行し、即座に通知メッセージ（`全話キャッシュ済みです`）を表示して終了する。
   - 抽出した対象エピソード群を `queueRepository.enqueueChapters(novelId, targetInputs)` で `download_queue` へ `'pending'` として登録する（既存の `'failed'` 行も `status = 'pending'`, `last_error = NULL` にリセットされ、`retry_count` は保持される）。
   - 今回の実行対象話数 $N = \text{targets.length}$（初回は未取得全話数、中断再開・再試行時は残り話数）に対し、`isBatchCaching = true`, `batchCacheProgress = { current: 0, total: N }`, `error = null`, `refreshMessage = null` を設定する。
   - `CacheScheduler` が `low` 優先度として、上位優先度（リーダー即時取得 `high` / 5話先読み `medium`）が存在しない間のみ 1話ごとに `PREFETCH_INTERVAL_MS`（1.5秒）のウェイト間隔を空けながら直列に取得を実行する（上位タスク到達時は自動退避・一時停止し、上位タスク完了後に残 `'pending'` 話から自動再開）。
     - 各話取得開始時に `queueRepository.updateStatus(novelId, chapter.chapterIndex, 'downloading')` に更新する。
     - 7日経過キャッシュが存在する場合は短タイムアウト（3秒）、未キャッシュ話は標準タイムアウト（10秒）で取得する。
     - HTML 取得後、パーサーで解析して `chapterRepository.saveChapterBody` で SQLite に保存し、`queueRepository.updateStatus(novelId, chapter.chapterIndex, 'completed')` に更新する。
     - 1話保存成功ごとに進捗通知を通じて `novel`（`cachedChapters` および `totalByteSize` 更新。なおクラウド同期 LWW 用タイムスタンプである `novel.updatedAt` は変更せず既存値を保持する、R2-16）、`chapters`（`downloadedAt` / `byteSize` 更新）、および `failedChapterIndexes`（成功話の除外）の State を即時更新し、画面にリアルタイム反映する。
     - 取得またはパースに失敗した場合：
       - `signal.aborted === true`（明示的手動中断、`high` 割り込み中断、またはアプリ休止一時停止）の場合は、`queueRepository.updateStatus(novelId, chapter.chapterIndex, 'pending')` に戻す（`retryCount` は増加させない）。手動中断時のみ処理を完全終了し、割り込み中断時はキュー上で待機させて上位優先度完了後に自動再開する。
       - 既存キャッシュが存在する 7日経過話（`hasExistingCache === true`）の短タイムアウト失敗時は、既存キャッシュへフォールバックして `updateStatus(..., 'completed')` とし次話へ進む。
       - 未キャッシュ話の失敗時は、**ループを中断せず** `queueRepository.updateStatus(novelId, chapter.chapterIndex, 'failed', { lastError: errorMessage, incrementRetry: true })` を記録し、`failedChapterIndexes` State に該当 `chapterIndex` を即時追加した上で、後続の対象話がある場合は 1.5秒ウェイト後に次の `'pending'` 話の取得を継続する。
     - 1話処理完了ごとに進捗 `batchCacheProgress = { current: i + 1, total: N }` を更新する。
   - **明示的手動中断（`cancelBatchCache`）とアンマウント時継続（`v1.2` Issue #344）**:
     - `SCR-02` のアンマウント（`SCR-03` リーダー画面や `SCR-01` 本棚画面への遷移）では **`cancelBatchCache` や `abort()` を実行しない**（進捗購読の解除のみ行い、アプリが起動している限りバックグラウンド一括キャッシュは継続する）。
     - ユーザーがヘッダーの「中断」ボタン（`cancelBatchCache`）を押下した場合のみ `cacheScheduler.pauseNovelTasks(novelId)` により即座に停止し、実行中だった `'downloading'` 話を `'pending'` に戻して既存 `'pending'`/`'failed'` キューを保持する（取得済み話数は SQLite 内に保持され、再開ボタンに `キャッシュを再開（残りN話）` が表示される）。
   - ループ完走時（中断なし）：
     - **失敗 0 件（全対象話成功）の場合**: `queueRepository.clearNovelQueue(novelId)` で当該作品のキューレコードを全件削除（クリーンアップ）し、`novelRepository.getNovelById(novelId)` で作品最新情報を同期した上で、`pendingCacheCount = 0`, `failedCacheCount = 0`, `failedChapterIndexes = []`, `refreshMessage = "全話のキャッシュを取得しました"`, `isBatchCaching = false`, `batchCacheProgress = null` とする。
     - **1話以上が取得失敗（失敗数 $F \ge 1$）の場合**: 成功した `'completed'` レコードのみを `deleteByNovelAndChapters` で削除して `'failed'` レコードを `download_queue` に残し、`pendingCacheCount = 0`, `failedCacheCount = F`, `failedChapterIndexes` を更新した上で、`error = "${F}話の取得に失敗しました（再試行可能）"` を設定し、`isBatchCaching = false`, `batchCacheProgress = null` とする（ボタンラベルは `失敗した話を再試行（${F}話）` に切り替わる）。
6. **本文キャッシュ削除パイプライン（`TR-19`、`v0.5` Issue #170 / `v0.9` Issue #268 / `v1.2` Issue #344 協調制御）**:
   - `isClearingCache = true`, `error = null` にセットし、進行中の対象作品一括キャッシュ・先読みタスクによる削除直後の書き戻し競合を防ぐため、`await cacheScheduler?.cancelNovelTasks(novelId, { clearQueue: !options.onlyRead })` を先行実行する（`onlyRead: true` 時は未読 `'pending'`/`'failed'` キュー行を保持する `R1-18`）。
   - `deletedCount = await chapterRepository.deleteCachedBodies(novelId, options)` を実行する。
     - `options.onlyRead === true`: 既読話（`is_read = 1`）のみ本文キャッシュ（`body_html = NULL`, `byte_size = 0`, `downloaded_at = NULL`）および対応する `download_queue` レコードを破棄。
     - `options.onlyRead === false`: 全話の本文キャッシュおよび当該作品の全 `download_queue` レコードを破棄。
     - いずれの場合も目次情報（`chapters` レコード）、既読状態（`is_read`）、しおり位置（`bookmark_chapter_index` / `bookmark_scroll_progress`）は完全保持される。
   - 削除完了後、親作品レコード（`cached_chapters`, `total_byte_size`）、各話一覧（`ChapterSummary[]`）、および `download_queue` の状態（`pendingCacheCount`, `failedCacheCount`, `failedChapterIndexes`）を再取得して State を即時更新する。
   - ダイアログを閉じ（`isClearCacheDialogOpen = false`）、通知メッセージ `refreshMessage = "本文キャッシュを削除しました（${deletedCount}話）"` をセットし、`isClearingCache = false` として削除話数を返却する。
   - 削除失敗時はダイアログを閉じずに `error` をセットし、`isClearingCache = false` に戻す。
7. **作品のお気に入り登録・解除パイプライン（`toggleFavorite`、`v0.8` Issue #266 / `v1.2` Issue #344 拡張）**:
   - `novel === null` または排他対象処理実行中（`isRefreshing` / `isDeleting` / `isClearingCache`）の場合は何もせず `false` を返す（`isBatchCaching === true` 中もお気に入り変更可能）。
   - `nextIsFavorite = !novel.isFavorite` を算出し、`novelRepository.setFavorite(novelId, nextIsFavorite)` を実行して SQLite の `novels.is_favorite` と `novels.updated_at`（現在時刻 ISO 8601）を更新する。
   - 成功時は `novel` State の `isFavorite` および `updatedAt` を即時更新し、`syncEngine` が注入されている場合は `syncEngine.notifyChanged()` を呼び出してクラウド同期の自動 Push をスケジュールし、`true` を返す。
   - 失敗時は `error` にエラーメッセージを設定し、`false` を返す。

---

## 5. 受入条件一覧（Acceptance Criteria: `AC-ND-xx`）

| AC ID          | 対象機能                                                                          | 検証条件                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 関連要件 / 遷移                                   |
| :------------- | :-------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------ |
| **`AC-ND-01`** | 作品ヘッダー情報・あらすじトグル表示                                              | 作品詳細画面（`/novels/:novelId`）上部に `NovelDetailHeader` が固定配置（`shrink-0`）され、タイトル・著者・統計がコンパクトに表示されること。またあらすじは初期状態で折りたたまれ（2〜3行 clamp）、トグルボタン（`synopsis-toggle-button`）で全文展開／折りたたみが可能であり、展開時は最大高さ制限と内部スクロール（`max-h` ＋ `overflow-y-auto`）が適用されること。あらすじ空文字時は「あらすじはありません。」を表示しトグルは非表示であること。                                                                                                                                                                                                                                             | `SYS-REQ-01` / `TR-02`                            |
| **`AC-ND-02`** | 章見出しとエピソード一覧・内部スクロール                                          | エピソード一覧が固定ヘッダー下の独立スクロール領域（`flex-1 min-h-0 overflow-y-auto`）として描画され、`chapterIndex` 昇順で章見出し（`chapter-section-header`）、本文キャッシュ状態（`取得済み` / `取得失敗` / `未取得`）、既読状態（`既読`）、しおり位置（`しおり`）が正確に表示されること。                                                                                                                                                                                                                                                                                                                                                                                                   | `SYS-REQ-01`, `02`, `12`                          |
| **`AC-ND-03`** | 読書開始ボタンの表示制御と遷移                                                    | しおり未設定時は「最初から読む（第1話）」の1ボタンのみが表示され、しおり設定時は「続きから読む（第N話）」と「最初から読む（第1話）」の2ボタンが表示され、それぞれ該当話のリーダー画面（`/novels/:novelId/chapters/:chapterIndex`）へ遷移（`TR-04`）すること。                                                                                                                                                                                                                                                                                                                                                                                                                                   | `SYS-REQ-02`, `12` / `TR-04`                      |
| **`AC-ND-04`** | 未キャッシュ話選択とオンデマンド取得                                              | 目次一覧で未キャッシュ話をタップすると即座にリーダー画面（`SCR-03`）へ遷移（`TR-04`）して本文がオンデマンド取得・DB保存され、上部オーバーレイの「← 目次」ボタン押下または OS バックキー操作（`TR-06`）で戻ると該当話が `取得済み` バッジ・取得済み話数 `+1` に更新されていること。                                                                                                                                                                                                                                                                                                                                                                                                              | `SYS-REQ-02` / `TR-04`, `TR-06`                   |
| **`AC-ND-05`** | 目次再取得（更新）とフィードバック表示                                            | 目次更新アイコンボタン（`refresh-toc-button`, `aria-label="目次を更新"`）を押下すると更新中スピン表示（`animate-spin`）とともに `fetchFullNovelIndex` により作品目次（複数ページ目次を含む）を再取得して `upsertNovelWithToc` で既存キャッシュを保持したまま目次を更新し、完了時に新着話数に応じたインライン通知（`目次を更新しました（+N話）` / `最新の状態です`）、失敗時にエラーメッセージを表示すること。                                                                                                                                                                                                                                                                                   | `SYS-REQ-01`, `04`                                |
| **`AC-ND-06`** | 確認ダイアログ付き作品削除と戻り元復帰・クラウド同期伝播                          | 3点メニュー（`novel-detail-menu-button`）内の「作品を削除」（`open-delete-dialog-button`）から確認ダイアログを開き、「削除する」を確定すると `deleteNovel` により作品および関連 `chapters` がカスケード削除され、直前の遷移元画面（探索元画面、履歴なし時は本棚 `/`）へ復帰（`TR-07`）して一覧から消去されること。またクラウド同期連携時は `syncEngine.notifyChanged()` により Tombstone がクラウドへ Push されること。                                                                                                                                                                                                                                                                         | `SYS-REQ-05, 06` / `TR-07`                        |
| **`AC-ND-07`** | 戻り元復帰導線の整理と未存在フォールバック                                        | `NovelDetailHeader` 内の「← 本棚へ戻る」ボタンは廃止されていること。また存在しない `novelId` が指定された場合はクラッシュせず `novel-detail-not-found` と「戻る」導線（`back-to-bookshelf-button`）を表示し、タップ時に直前の遷移元画面（本棚 `/`、検索 `/search`、ランキング `/ranking`、履歴なし時は本棚 `/`）へ復帰できること（`TR-07`）。                                                                                                                                                                                                                                                                                                                                                   | `SYS-REQ-01, 16, 20` / `TR-07`                    |
| **`AC-ND-08`** | しおり位置への初期スクロール自動調整                                              | 対象作品に `bookmarkChapterIndex` が設定されている場合、初回データ読み込み完了時に該当話（`data-chapter-index`）の要素が各話リストスクロール領域の先頭（上端）に来るよう自動スクロールされること。また、「目次を更新」実行時には自動スクロールが再発火せず、ユーザーの現在スクロール位置が維持されること。                                                                                                                                                                                                                                                                                                                                                                                      | `SYS-REQ-01, 12`                                  |
| **`AC-ND-09`** | 100dvh 全画面シェル・下部タブ・階層復帰                                           | 作品詳細画面が `h-full flex flex-col overflow-hidden` の全画面シェル内に配置され、中間コンテンツ領域（`flex-1 min-h-0 overflow-y-auto`）のみがスクロール可能であること。画面下部に共通 `BottomTabBar`（`bottom-tab-bar`）が 4 タブ構成で表示され、各タブタップ（`TR-01`, `TR-01b`）により各画面へ遷移でき、OS バックキー（`TR-07`）により直前の遷移元画面（本棚 `SCR-01`、検索 `SCR-06`、ランキング `SCR-07`、履歴なし時は本棚 `/`）へ論理復帰できること。                                                                                                                                                                                                                                      | `SYS-REQ-16, 20` / `TR-01`, `TR-01b`, `TR-07`     |
| **`AC-ND-10`** | 作品詳細表示による本棚「NEW」バッジ解除                                           | 本棚で「NEW」バッジが表示されていた作品の詳細画面（`SCR-02`）を開いた際（`TR-02` 等）、`clearNewUpdate` が実行されて作品の `has_new_update` が 0 に解除され、本棚へ戻った際（`TR-07`）に対象作品カードの「NEW」バッジが消去されていること。                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `SYS-REQ-04` / `TR-02`, `TR-07`                   |
| **`AC-ND-11`** | 未取得話の一括キャッシュ実行と非ブロッキング進捗表示                              | 3点メニュー内の「未取得話を一括キャッシュ」（または再開・再試行）を押下すると、メニューが閉じて `CacheScheduler`（優先度 `low`）経由で対象話を `download_queue` に登録し 1.5秒間隔で順次本文を取得して SQLite に保存し、アクションバー（アイコン群の左側）に進行状況（`batch-cache-progress`）と中断ボタン（`batch-cache-cancel-button`）が表示され、各話取得ごとに取得済み話数・キャッシュ容量・キャッシュバッジ（`取得済み`）が即時更新されること。                                                                                                                                                                                                                                           | `SYS-REQ-02, 03, 05` / `TR-18`                    |
| **`AC-ND-12`** | 一括キャッシュの中断・離脱時継続と安全性                                          | 一括キャッシュ実行中に「中断」ボタン（`batch-cache-cancel-button`）を押下した際のみ通信が停止して未完了話が `download_queue` に `'pending'` として保持されること（それまでに保存された本文データは破損せず保持）。一方、`SCR-02` を離脱・アンマウントしてもバックグラウンド一括キャッシュは強制中断されず継続し、再訪問時に最新の進捗状態が自動復元されること（`v1.2` Issue #344）。                                                                                                                                                                                                                                                                                                            | `SYS-REQ-02, 03, 05` / `TR-18`                    |
| **`AC-ND-13`** | 全話取得済み時・実行中時のボタン状態制御                                          | 対象作品にエピソードが存在し（`chapters.length > 0`）、かつ全エピソードがキャッシュ済みかつ有効期間内（7日以内）である場合、3点メニュー内の一括キャッシュボタンが disabled 化され「全話キャッシュ済み」と表示されること。エピソードが 0 話の場合は `isAllCached = false` かつ一括キャッシュボタンが disabled（「未取得話を一括キャッシュ」）となること。また一括キャッシュ実行中は二重起動防止のため「一括キャッシュ実行中...」として同ボタンのみ disabled となること。                                                                                                                                                                                                                         | `SYS-REQ-02, 05` / `TR-18`                        |
| **`AC-ND-20`** | 作品ヘッダーでのキャッシュ容量表示                                                | 作品詳細ヘッダー（`data-testid="novel-detail-stats"`）において、`全 {novel.totalChapters} 話（取得済み {novel.cachedChapters} 話 / {formatByteSize(novel.totalByteSize)}）` の形式でキャッシュ容量がフォーマット表示されること。                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `SYS-REQ-05` / `TR-02`                            |
| **`AC-ND-21`** | 本文キャッシュ整理ボタンと確認ダイアログ                                          | 作品詳細ヘッダーの3点メニュー内の「本文キャッシュ整理」（`data-testid="open-clear-cache-dialog-button"`）から確認ダイアログ（`data-testid="clear-cache-confirm-dialog"`）が開き、「既読話の本文キャッシュのみ削除」（`data-testid="confirm-clear-read-cache-button"`）または「すべての本文キャッシュを削除」（`data-testid="confirm-clear-all-cache-button"`）を選択できること。また、`novel.cachedChapters === 0` または目次更新中は同ボタン（目次更新中は3点メニューボタン自体も）が disabled となること（一括キャッシュ中の削除確定時は事前に `cacheScheduler.cancelNovelTasks(novelId, { clearQueue: !onlyRead })` で安全停止後に削除実行され、既読のみ削除時は未読キューを保持すること）。 | `SYS-REQ-05` / `TR-19`                            |
| **`AC-ND-22`** | 本文キャッシュ削除の即時反映と安全性                                              | 本文キャッシュ削除実行時、目次情報・既読フラグ・しおり位置を保持したまま該当話の本文キャッシュ（`body_html = NULL`, `byte_size = 0`, `downloaded_at = NULL`）および対応する `download_queue` レコードが削除され、親作品の `cachedChapters` / `totalByteSize` および各話一覧のバッジ（取得済み→未取得）が即時再計算・反映され、完了通知（`novel-detail-notice`）が表示されること。                                                                                                                                                                                                                                                                                                               | `SYS-REQ-05` / `TR-19`                            |
| **`AC-ND-23`** | 作品詳細ヘッダーでのお気に入り登録・解除                                          | 作品詳細ヘッダーのお気に入りトグルアイコンボタン（`data-testid="detail-favorite-toggle-button"`）をタップすると、アイコン表示（`★` / `☆`、`aria-label="お気に入り"`、`aria-pressed`、常時 1px `border` による高さ・幅固定）が切り替わり、SQLite の `novels.is_favorite` と `novels.updated_at` が同時更新され、本棚画面復帰時やクラウド同期へ反映されること。                                                                                                                                                                                                                                                                                                                                   | `SYS-REQ-04`, `SYS-REQ-06`                        |
| **`AC-ND-24`** | 永続キューによる一括キャッシュ中断再開と進捗・自動整理                            | 一括キャッシュ実行中に対象話を `download_queue`（`pending` → `downloading` → `completed`）で永続管理し、「中断」押下時またはアプリ再起動時に未完了話が `pending` として保持され、3点メニュー内の一括キャッシュボタンラベルが `キャッシュを再開（残りN話）` に切り替わること。また再開時は残り $N$ 話を分母（`0/N` 〜 `N/N`）として進捗表示し、リーダー閲覧等で既に有効キャッシュ済みとなった話は自動的にキューから除外され、全話取得完了時にキューが自動削除されること。                                                                                                                                                                                                                        | `SYS-REQ-02, 03, 05` / `TR-18`                    |
| **`AC-ND-25`** | 取得失敗話のスキップ継続・取得失敗バッジ・再試行                                  | 一括キャッシュ中に特定話の取得が失敗（通信エラー・タイムアウトかつ既存キャッシュなし）した場合、該当話を `download_queue` に `status = 'failed'`（`retry_count` 加算、`last_error` 記録）として保存して残りの `pending` 話の取得を継続し、進行表示（`batch-cache-progress`）に失敗件数（`[失敗 N話]`）をリアルタイムに反映すること。ループ完了後に失敗話行に `取得失敗` バッジ（`episode-failed-badge`）、ヘッダーにエラー通知と3点メニュー内に `失敗した話を再試行（N話）` ボタンが表示され、再試行で取得成功すると `取得済み` へ遷移しキューがクリーンアップされること。                                                                                                                      | `SYS-REQ-02, 03, 05` / `TR-18`                    |
| **`AC-ND-26`** | 作品詳細ヘッダーからの内蔵ブラウザ導線（v0.9 Issue #269）                         | 作品詳細ヘッダーの3点メニュー内に「内蔵ブラウザで開く」ボタン（`data-testid="open-webview-button"`）が表示され、タップ時にメニューを閉じて該当作品の URL（`canonicalUrl`）と `novelId` をパラメータとして内蔵ブラウザ画面（`SCR-04`: `/browser?url=...&novelId=...`）へ遷移（`TR-09`）できること。                                                                                                                                                                                                                                                                                                                                                                                              | `SYS-REQ-13` / `TR-09`                            |
| **`AC-ND-27`** | 1行アイコンバー配置・3点メニュー開閉制御（v1.1 Issue #343）                       | 作品詳細ヘッダーのタイトル1段上に、お気に入り（`detail-favorite-toggle-button`）・目次更新（`refresh-toc-button`）・3点メニュー（`novel-detail-menu-button`, `aria-label="作品メニュー"`, `aria-haspopup="menu"`, `aria-expanded`）の3アイコンボタンが常時1行右寄せで配置されること。3点メニュータップで `role="menu"` が展開し、4項目（一括キャッシュ、本文キャッシュ整理、内蔵ブラウザで開く、区切り線＋赤文字の作品を削除）が表示され、項目選択・メニュー外クリック（タップ）・`Escape` キー押下・処理開始時に自動で閉じること。                                                                                                                                                             | `SYS-REQ-01`, `04`, `05`, `13`, `16`              |
| **`AC-ND-28`** | バックグラウンド復帰時自動 Pull によるしおり・既読表示自動更新（v1.1 Issue #342） | 作品詳細画面（`SCR-02`）を表示したまま画面ロック・バックグラウンドへ移行し 5 分（300,000ms）以上経過して復帰した際、自動 Pull（`syncEngine.pullAndMerge()`）完了後に `reloadDetail({ silent: true })` が `isLoading` を切り替えず自動実行され、ユーザーのスクロール位置を維持したまま他端末で更新されたしおり位置（`しおり` バッジ・「続きから読む」ボタン文言）および既読バッジ（`既読`）がリロードなしで最新化されること。                                                                                                                                                                                                                                                                    | `SYS-REQ-06, 12` / `SCN-05`                       |
| **`AC-ND-29`** | 一括キャッシュ中の非ブロッキング操作・即時読書遷移（v1.2 Issue #344）             | 対象作品の一括キャッシュ実行中（`isBatchCaching === true`）であっても、「最初から読む」「続きから読む」、お気に入り、目次更新、3点メニューボタン、目次領域（`episode-list-container`）の縦スクロール、および目次一覧の各エピソード行（既読・未取得問わず）がいずれも操作ロック（`pointer-events-none` 等）されず、任意の話（例: 第1話や未キャッシュ話）をタップして即座にリーダー画面（`SCR-03`）へ遷移できること。                                                                                                                                                                                                                                                                             | `SYS-REQ-02, 03` / `TR-04`, `TR-18`, `SCN-04`     |
| **`AC-ND-30`** | `SCR-02` 離脱時の継続実行および再訪問時の実行中状態競合ガード（v1.2 Issue #344）  | 一括キャッシュ実行中に `SCR-02` をアンマウント（`SCR-03` 等へ遷移）しても `CacheScheduler` のバックグラウンドタスクは中断されず継続し、再び `SCR-02` に戻った際、`useNovelDetail` は `resetInterruptedToPending` を誤実行せず進行中の `'downloading'` 話数を保持したまま現在の進捗（`batch-cache-progress`）と取得済み話数を正しく再接続・復元表示すること。                                                                                                                                                                                                                                                                                                                                    | `SYS-REQ-02, 03, 05` / `TR-06`, `TR-18`, `SCN-04` |

---

## 6. Playwright システム結合テスト（E2E シナリオ連携）

作品詳細・目次画面（`SCR-02`）に関連する E2E 動作は、`test/it/scenarios/` 配下の以下のシナリオで継続回帰検証されます（詳細は [docs/specs/screen-transitions.md §4](../screen-transitions.md#4-playwright-システム結合テストe2e-シナリオ-scn-01--scn-07マッピング) を参照）：

- **`SCN-01`（`test/it/scenarios/scn01-poc-vertical-reader.spec.ts`）**: 作品カード選択による目次表示・アイコンボタンによる目次更新、エピソード選択からリーダー閲覧、「← 目次」ボタンおよび OS バックキーでの復帰時の既読・しおり反映、3点メニュー経由の作品削除（`TR-02`, `TR-04`, `TR-06`, `TR-07`, `AC-ND-01`〜`09`, `27`）。
- **`SCN-02`（`test/it/scenarios/scn02-search-ranking-discovery.spec.ts`）**: 検索・ランキングからの作品カード選択による目次遷移と、OS バックキーによる直前の探索元画面への論理復帰（`TR-07`, `TR-14`, `AC-ND-07`, `09`）。
- **`SCN-03`（`test/it/scenarios/scn03-bookshelf-update-and-sort.spec.ts`）**: 作品詳細画面表示による本棚「NEW」バッジの自動解除、および作品詳細ヘッダーのアイコンボタンからのお気に入り登録・解除と本棚への反映（`TR-02`, `AC-ND-10`, `23`, `27`）。
- **`SCN-04`（`test/it/scenarios/scn04-prefetch-and-cache.spec.ts`）**: `CacheScheduler` 優先度キュー統合および永続ダウンロードキュー（`download_queue`）を用いた非ブロッキング一括キャッシュ（開始直後の「最初から読む」／未キャッシュ話タップによる即時 `SCR-03` 遷移、リーダー画面での即時取得 `high` と 5話先読み `medium` 実行、`SCR-02` 復帰時の自動継続・進捗復元）、中断ボタン押下による `キャッシュを再開（残りN話）`、途中話エラー時のスキップ継続と `取得失敗` バッジおよび `失敗した話を再試行（N話）`、作品ヘッダーでのキャッシュ容量表示、および3点メニュー経由の本文キャッシュ整理ダイアログ（既読話のみ／全話削除）による容量即時再計算・キュークリーンアップと目次・既読・しおり保持（`TR-04`, `TR-06`, `TR-18`, `TR-19`, `AC-ND-11`〜`13`, `20`〜`22`, `24`, `25`, `27`, `29`, `30`）。
- **`SCN-05`（`test/it/scenarios/scn05-cloud-sync.spec.ts`）**: 3点メニュー経由の作品削除時のクラウド同期 Tombstone 自動 Push 連携、お気に入りアイコン状態変更のクラウド同期反映、および画面ロック・5分復帰時自動 Pull による作品詳細表示の自動更新（`TR-07`, `AC-ND-06`, `23`, `27`, `28`）。
- **`SCN-07`（`test/it/scenarios/scn07-webview-import-fallback.spec.ts`）**: 作品詳細ヘッダーの3点メニュー内「内蔵ブラウザで開く」ボタン（`TR-09`）押下による `SCR-04` 遷移と目次 DOM インポート後の `SCR-02` 復帰・エピソード一覧更新検証（`TR-11`, `AC-ND-26`, `27`）。
