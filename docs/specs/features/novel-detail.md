---
type: spec-feature
title: "作品詳細・目次画面仕様書（SCR-02: Novel Detail & TOC）"
description: 登録済み作品のヘッダー情報・あらすじ表示、章見出し付きエピソード一覧（キャッシュ済み・既読・しおり状態）、目次更新（再取得）、作品削除、およびリーダー画面への閲覧遷移を提供する作品詳細・目次画面（SCR-02）の正本仕様。
status: "Review (#81)"
updated: "2026-10-29"
tags:
  [
    novel-detail,
    scr-02,
    toc,
    routing,
    ui,
    shell,
    bottom-nav,
    four-tabs,
    prefetch,
    batch-cache,
    cache-rules,
  ]
related_specs:
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
  - docs/specs/changes/archive/issue-79-four-tabs-search-ranking.md
  - docs/specs/changes/issue-80-bookshelf-update-check-and-sort.md
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
  - src/features/novel-detail/components/NovelDetailPage.test.tsx
  - src/features/novel-detail/components/NovelDetailContainer.test.tsx
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
  - test/it/scenarios/scn03-prefetch-and-cache.spec.ts
---

# 作品詳細・目次画面仕様書（SCR-02）

本ドキュメントは、本棚画面（`SCR-01`）で選択した作品の詳細情報・あらすじ・全エピソード目次を表示し、任意のエピソード閲覧（未キャッシュ時のオンデマンド本文取得連携）、目次の再取得（更新）、および作品の削除を提供する **作品詳細・目次画面（`SCR-02`: ルート `/novels/:novelId`）** の正本（Single Source of Truth）です。

---

## 1. 概要・スコープ

- **対象画面**: 作品詳細・目次画面（`SCR-02`、ルートパス `/novels/:novelId`）
- **対応要件**:
  - `SYS-REQ-01`（作品登録・目次取得：作品メタデータ・あらすじ・章見出し付きエピソード一覧の表示および目次再取得）
  - `SYS-REQ-02`（本文取得・オフライン閲覧：エピソード選択または読書開始ボタンによるリーダー遷移と、未キャッシュ話のオンデマンド本文取得・キャッシュ状態反映、および未取得話の一括キャッシュ）
  - `SYS-REQ-03`（レートリミット・バックグラウンド取得：未取得話一括キャッシュ時の 1.5秒間隔ウェイト制御および中断制御）
  - `SYS-REQ-04`（更新チェック・差分取得：作品詳細画面表示時の本棚「NEW」バッジ自動解除、手動目次再取得と新着話数フィードバック表示）
  - `SYS-REQ-05`（キャッシュ管理・容量整理：未取得話の一括キャッシュ、確認ダイアログ付き作品削除と `chapters` カスケード削除）
  - `SYS-REQ-12`（しおり・スクロール位置自動保存に基づくしおり位置マーク・既読バッジ表示および「続きから読む」導線）
  - `SYS-REQ-16`（全画面シェル・下部タブ・論理階層遷移：100dvh 全画面シェル内配置、固定ヘッダー＋内部スクロール目次、下部タブバー連携）
  - `SYS-REQ-20`（下部 4 タブナビゲーションおよび OS バックキーによる直前の遷移元［本棚/検索/ランキング］への論理階層復帰）
- **関連画面遷移**:
  - `TR-01`（下部タブバーによる 4 画面「本棚 `/`」「検索 `/search`」「ランキング `/ranking`」「設定 `/settings`」相互切替）
  - `TR-01b`（下部タブバーの「本棚」タブタップによる本棚画面 `SCR-01` `/` へのダイレクト遷移）
  - `TR-02`（本棚画面 `SCR-01` の作品カード本体タップによる `SCR-02` `/novels/:novelId` への遷移）
  - `TR-04`（目次リストのエピソード行タップ、または「最初から読む／続きから読む」ボタンタップによる小説リーダー画面 `SCR-03` `/novels/:novelId/chapters/:chapterIndex` への遷移）
  - `TR-06`（小説リーダー画面 `SCR-03` の OS バックキー操作による `SCR-02` `/novels/:novelId` への復帰）
  - `TR-07`（作品詳細画面からの戻り元復帰導線：作品未検出画面 `novel-detail-not-found` の「戻る」ボタン、作品削除確認ダイアログでの削除実行完了、または OS バックキー操作による直前の遷移元画面［本棚 `SCR-01` `/`、検索 `SCR-06` `/search`、ランキング `SCR-07` `/ranking`］への復帰。直前履歴が存在しない場合は本棚 `/` へ復帰。※`NovelDetailHeader` 内の「← 本棚へ戻る」ボタンは廃止。なお下部タブバー「本棚」タップ時は `TR-01b` が適用される）
  - `TR-18`（作品詳細ヘッダーの「未取得話を一括キャッシュ」アクションによる順次本文取得・進捗表示・手動中断）
- **対象外スコープ（後続 Issue / Milestone）**:
  - エピソード閲覧に伴うしおり位置（`bookmarkChapterIndex`, `bookmarkScrollProgress`）および既読フラグ（`isRead`）の自動更新ロジック本体（Issue #14 の `SCR-03` リーダー画面拡張で一括実装）
  - 内蔵 WebView（`SCR-04`）での手動インポート連携（Milestone `v0.4`：`SYS-REQ-13, 14`, `TR-09`）
  - 作品単位の「本文キャッシュのみ削除（目次は残す）」操作（Milestone `v0.4`：`SYS-REQ-05`）

---

## 2. コンポーネント構成と責務境界

`docs/guidelines/testing.md` の親子分離原則および 1対1 Story/UT 原則に従い、`src/features/novel-detail/` 配下を以下のモジュール構成とします（Issue #12 で暫定配置された `NovelDetailPlaceholder.*` は `NovelDetailContainer` のルーター統合時に置き換えて廃止します）。

`SYS-REQ-16` に基づき、`NovelDetailPage` は 100dvh 全画面シェル（`h-full flex flex-col overflow-hidden`）内に配置され、ウィンドウ全体のスクロールを抑止した上で、作品詳細ヘッダーおよびエピソード目次一覧が中間領域（`flex-1 min-h-0 overflow-y-auto`）で独立して縦スクロールします。画面下部には共通下部タブバー（`BottomTabBar`）が「本棚」アクティブ状態で配置されます。

```text
src/features/novel-detail/
├── types.ts                               # 作品詳細機能全体のフック返却値・各コンポーネントProps型定義
├── hooks/
│   ├── useNovelDetail.ts                  # 作品情報・目次一覧取得、目次再取得、作品削除、状態管理フック
│   └── useNovelDetail.test.ts             # フック単体テスト（Vitest）
└── components/
    ├── NovelDetailHeader.tsx              # 作品メタ情報・あらすじ・統計・読書開始/更新/削除ボタン（Presentational）
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

| プロパティ名           | 型                                           | 必須 | 説明                                                |
| :--------------------- | :------------------------------------------- | :--- | :-------------------------------------------------- |
| `novel`                | `NovelRecord`                                | 必須 | 表示対象の作品レコード                              |
| `isRefreshing`         | `boolean`                                    | 必須 | 目次再取得（更新）通信中フラグ                      |
| `isBatchCaching`       | `boolean`                                    | 必須 | 未取得話一括キャッシュ実行中フラグ (`v0.3`)         |
| `batchCacheProgress`   | `{ current: number; total: number } \| null` | 必須 | 一括キャッシュ進行状況（現在話数/対象総数, `v0.3`） |
| `isAllCached`          | `boolean`                                    | 必須 | 全話キャッシュ済み判定フラグ (`v0.3`)               |
| `refreshMessage`       | `string \| null`                             | 任意 | 目次再取得・一括キャッシュ完了時の通知メッセージ    |
| `error`                | `string \| null`                             | 任意 | 目次再取得失敗・一括キャッシュ失敗・削除のエラー    |
| `onStartFromBeginning` | `() => void`                                 | 必須 | 「最初から読む（第1話）」ボタン押下時のコールバック |
| `onResumeBookmark`     | `(chapterIndex: number) => void`             | 必須 | 「続きから読む（第N話）」ボタン押下時のコールバック |
| `onRefreshToc`         | () => void \| Promise<void>                  | 必須 | 「目次を更新」ボタン押下時のコールバック            |
| `onStartBatchCache`    | () => void \| Promise<void>                  | 必須 | 「未取得話を一括キャッシュ」ボタン押下時 (`v0.3`)   |
| `onCancelBatchCache`   | `() => void`                                 | 必須 | 一括キャッシュ「中断」ボタン押下時 (`v0.3`)         |
| `onOpenDeleteDialog`   | `() => void`                                 | 必須 | 「作品を削除」ボタン押下時のコールバック            |

#### 表示項目・セマンティック属性・活性制御ルール

- **ルート要素**: `data-testid="novel-detail-header"`、画面上部固定（`shrink-0`）
- **ナビゲーション**:
  - ヘッダー内の「← 本棚へ戻る」ボタン（`data-testid="back-to-bookshelf-button"`）は廃止（下部タブバーおよび OS バックキーにより復帰するため）。
- **作品メタ情報（省スペース配置）**:
  - **作品タイトル**: `data-testid="novel-detail-title"`（`novel.title`、コンパクトな見出しサイズ）
  - **著者名**: `data-testid="novel-detail-author"`（`novel.author`、空文字の場合は `著者不明`）
  - **話数・キャッシュ統計**: `data-testid="novel-detail-stats"`
    - `全 {novel.totalChapters} 話（取得済み {novel.cachedChapters} 話）` の形式で表示する。
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
  - ※`novel.totalChapters === 0` または `isBatchCaching === true` の場合は読書開始ボタンを `disabled` とする。
- **管理アクションボタン（右寄せ）**:
  - **未取得話一括キャッシュボタン（`v0.3`）**: `data-testid="batch-cache-button"`
    - `novel.totalChapters === 0`（または `chapters.length === 0`）の場合: ラベル `未取得話を一括キャッシュ`、`disabled` 化（対象話が存在しないため）。
    - `isAllCached === true`（エピソードが存在し `novel.cachedChapters === novel.totalChapters` かつ全話有効キャッシュ）の場合: ラベル `全話キャッシュ済み`、`disabled` 化。
    - `isBatchCaching !== true` かつ未取得話（または 7日経過キャッシュ）がある場合: ラベル `未取得話を一括キャッシュ`、クリック時に `onStartBatchCache()` を呼び出す。`isRefreshing === true` の間は `disabled`。
  - **一括キャッシュ進行状況および中断ボタン（`v0.3`）**:
    - `isBatchCaching === true` の場合:
      - 進行表示要素 `data-testid="batch-cache-progress"`（表示例: `キャッシュ中 (3/15)...`）を表示。
      - 中断ボタン `data-testid="batch-cache-cancel-button"`（ラベル: `中断`）を表示し、クリック時に `onCancelBatchCache()` を呼び出す。
  - **目次更新ボタン**: `data-testid="refresh-toc-button"`
    - `isRefreshing === true` の間は `disabled` とし、ラベルを `更新中...` に変更する（通常時は `目次を更新`）。`isBatchCaching === true` の間も二重実行防止のため `disabled` とする。
  - **作品削除起動ボタン**: `data-testid="open-delete-dialog-button"`（ラベル: `作品を削除`、`isRefreshing === true` または `isBatchCaching === true` の間は `disabled`）。
- **インラインフィードバック表示**:
  - `refreshMessage` が非 null の場合: `data-testid="novel-detail-notice"` に通知メッセージ（例: `目次を更新しました（+2話）` または `全話のキャッシュを取得しました`、`最新の状態です`）を表示する。
  - `error` が非 null の場合: `data-testid="novel-detail-error"` に日本語エラーメッセージを表示する。

---

### 3.2 `EpisodeListItem`（単一エピソード行）

目次内の 1 エピソード（`ChapterSummary`）と、その本文キャッシュ状態・既読状態・しおり位置マークを表示し、タップ時にリーダー画面への遷移（`TR-04`）をトリガーする Presentational コンポーネントです。

#### プロパティ契約（`EpisodeListItemProps`）

| プロパティ名      | 型                               | 必須 | 説明                                                                              |
| :---------------- | :------------------------------- | :--- | :-------------------------------------------------------------------------------- |
| `chapter`         | `ChapterSummary`                 | 必須 | 表示対象のエピソードサマリーレコード                                              |
| `isBookmarked`    | `boolean`                        | 必須 | 現在のしおり位置（`novel.bookmarkChapterIndex === chapter.chapterIndex`）かどうか |
| `onSelectEpisode` | `(chapterIndex: number) => void` | 必須 | エピソード行タップ時のコールバック（`TR-04`）                                     |

#### 表示項目とセマンティック属性

- **ルート要素**: `data-testid="episode-item"`、`data-chapter-index={chapter.chapterIndex}`
  - クリック（タップ）時に `onSelectEpisode(chapter.chapterIndex)` を呼び出す（個別DLボタンは設けず、行全体のタップでリーダー遷移＆未キャッシュ時オンデマンド取得に統一）。
  - ※一括キャッシュ実行中（`isBatchCaching === true`）は、非同期競合および不用意な中断を防ぐため読書開始ボタン同様にタップ操作を無効化（no-op / `pointer-events-none`）する。
- **エピソード番号・サブタイトル**: `data-testid="episode-item-title"`（`第{chapter.chapterIndex}話 {chapter.title}` または連番バッジ＋`chapter.title`）
- **公開・更新日時**: `chapter.publishedAt` が非 null の場合、`data-testid="episode-item-date"` に表示する。
- **状態バッジ群**:
  1. **本文キャッシュ状態バッジ**:
     - `chapter.downloadedAt !== null`（または `chapter.byteSize > 0`）の場合: `data-testid="episode-cached-badge"`（ラベル: `取得済み`）を表示する。
     - 未取得の場合: `data-testid="episode-uncached-badge"`（ラベル: `未取得`）を表示する。
  2. **既読状態バッジ**:
     - `chapter.isRead === true` の場合: `data-testid="episode-read-badge"`（ラベル: `既読`）を表示する（`false` の場合は描画しない）。
  3. **しおり位置マーク**:
     - `isBookmarked === true` の場合: `data-testid="episode-bookmark-badge"`（ラベル: `しおり`）を表示する（`false` の場合は描画しない）。

---

### 3.3 `EpisodeList`（章見出し付きエピソード一覧）

全エピソード配列（`ChapterSummary[]`）を受け取り、章・部見出し（`partTitle`）の境界ごとにセクションヘッダーを挿入したフラットリストとして描画する Presentational コンポーネントです。`NovelDetailPage` の内部スクロール領域（`episode-list-container`）内に配置されます。

#### プロパティ契約（`EpisodeListProps`）

| プロパティ名           | 型                               | 必須 | 説明                                            |
| :--------------------- | :------------------------------- | :--- | :---------------------------------------------- |
| `chapters`             | `ChapterSummary[]`               | 必須 | `chapterIndex` 昇順のエピソード一覧             |
| `bookmarkChapterIndex` | `number \| null`                 | 必須 | 作品の現在のしおり話数（未設定時は `null`）     |
| `onSelectEpisode`      | `(chapterIndex: number) => void` | 必須 | 個別エピソードタップ時のコールバック（`TR-04`） |

#### 章見出し（`partTitle`）グルーピングとセマンティック属性

- **空状態**: `chapters.length === 0` の場合は `data-testid="episode-list-empty"`（案内文: `エピソード目次がありません。`）を描画する。
- **一覧コンテナ**: `chapters.length > 0` の場合は `data-testid="episode-list"` を描画する。
- **章見出し（セクションヘッダー）挿入ルール**:
  - アコーディオン開閉は設けず、全話を一覧可能なフラットリスト形式で描画する。
  - 各 `chapter` を走査する際、`chapter.partTitle` が非 null（かつ空文字でない）であり、かつ直前のエピソードの `partTitle` と異なる場合（先頭エピソードを含む）に、該当エピソード行の直前に章見出し要素 `<div data-testid="chapter-section-header">{chapter.partTitle}</div>` を描画する。
  - `chapter.partTitle === null`（または空文字）のエピソードには章見出し要素を描画しない。
- **各話描画**:
  - 各 `chapter` に対して `EpisodeListItem` を描画し、`isBookmarked={bookmarkChapterIndex === chapter.chapterIndex}` を渡す。
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

---

### 3.5 `NovelDetailPage`（作品詳細・目次画面 Presentational コンポーネント）

`NovelDetailHeader`、`EpisodeList`、および `DeleteConfirmDialog` を統合し、ローディング状態や未存在作品（Not Found）状態の排他描画、ヘッダー固定・各話リスト内部スクロールレイアウト、およびしおり話数への初期スクロール調整を制御する画面コンポーネントです。

#### プロパティ契約（`NovelDetailPageProps`）

| プロパティ名           | 型                                           | 必須 | 説明                                               |
| :--------------------- | :------------------------------------------- | :--- | :------------------------------------------------- |
| `novel`                | `NovelRecord \| null`                        | 必須 | 作品レコード（未取得・存在しない場合は `null`）    |
| `chapters`             | `ChapterSummary[]`                           | 必須 | エピソード目次一覧                                 |
| `isLoading`            | `boolean`                                    | 必須 | 初回データ読み込み中フラグ                         |
| `isRefreshing`         | `boolean`                                    | 必須 | 目次再取得（更新）通信中フラグ                     |
| `isBatchCaching`       | `boolean`                                    | 必須 | 未取得話一括キャッシュ実行中フラグ (`v0.3`)        |
| `batchCacheProgress`   | `{ current: number; total: number } \| null` | 必須 | 一括キャッシュ進行状況 (`v0.3`)                    |
| `isAllCached`          | `boolean`                                    | 必須 | 全話キャッシュ済み判定フラグ (`v0.3`)              |
| `isDeleteDialogOpen`   | `boolean`                                    | 必須 | 作品削除確認ダイアログの開閉状態                   |
| `isDeleting`           | `boolean`                                    | 必須 | 作品削除実行中フラグ                               |
| `refreshMessage`       | `string \| null`                             | 任意 | 目次再取得・一括キャッシュ完了時の通知文字列       |
| `error`                | `string \| null`                             | 任意 | エラーメッセージ文字列                             |
| `onBackToBookshelf`    | `() => void`                                 | 必須 | 「本棚へ戻る」押下時（未検出エラー画面での復帰用） |
| `onStartFromBeginning` | `() => void`                                 | 必須 | 「最初から読む（第1話）」押下時（`TR-04`）         |
| `onResumeBookmark`     | `(chapterIndex: number) => void`             | 必須 | 「続きから読む（第N話）」押下時（`TR-04`）         |
| `onSelectEpisode`      | `(chapterIndex: number) => void`             | 必須 | 個別エピソード行タップ時（`TR-04`）                |
| `onRefreshToc`         | () => void \| Promise<void>                  | 必須 | 「目次を更新」押下時                               |
| `onStartBatchCache`    | () => void \| Promise<void>                  | 必須 | 「未取得話を一括キャッシュ」押下時 (`v0.3`)        |
| `onCancelBatchCache`   | `() => void`                                 | 必須 | 一括キャッシュ「中断」押下時 (`v0.3`)              |
| `onOpenDeleteDialog`   | `() => void`                                 | 必須 | 「作品を削除」押下時                               |
| `onCloseDeleteDialog`  | `() => void`                                 | 必須 | 削除確認ダイアログのキャンセル時                   |
| `onConfirmDelete`      | () => void \| Promise<void>                  | 必須 | 削除確認ダイアログの「削除する」確定時（`TR-07`）  |

#### セマンティック属性とレイアウト・排他描画ルール

- **画面ルート**: `data-testid="novel-detail-page"`（スタイル: `h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100`）
  - 画面全体の高さを占有し（100dvh 全画面シェル）、ウィンドウ自体のスクロールを防止する。
- **レイアウト構造**:
  - **上部固定ヘッダー**: `NovelDetailHeader` を `shrink-0` で上部に固定する。
  - **中央スクロール領域**: `<main data-testid="episode-list-container" className="flex-1 min-h-0 overflow-y-auto ...">` 内に `EpisodeList` を配置し、各話リストのみが内部スクロールする。
  - **最下部共通タブバー**: 画面最下部に `BottomTabBar` が直前の探索元（検索・ランキング・本棚）のアクティブ状態で常時固定配置される。
- **しおり話数（`bookmarkChapterIndex`）への初期スクロール位置自動調整**:
  - 初回データ読み込み完了時（`isLoading` が `false` に切り替わり `novel !== null` かつ `chapters.length > 0` となった初回）、作品にしおり（`novel.bookmarkChapterIndex !== null`）が設定されている場合は、該当話（`[data-chapter-index="${novel.bookmarkChapterIndex}"]`）の要素が各話リストスクロール領域の先頭（上端）に来るよう自動スクロール位置を調整する。
  - しおり未設定時（`novel.bookmarkChapterIndex === null`）はスクロール調整を行わず、先頭（`scrollTop = 0`）のままとする。
  - 初回スクロール完了フラグを管理し、同一画面内での「目次を更新」（`refreshToc`、`isRefreshing` の変化）実行時には自動スクロールを再実行せず、ユーザーの現在スクロール位置を維持する。
  - 作品 ID（`novelId`）が変化した際（別作品へ遷移時）はフラグをリセットし、新作品の初回表示時に再度しおりスクロールを行う。
- **メイン領域の排他描画ルール**:
  1. `isLoading === true` の場合: ローディング表示要素 `data-testid="novel-detail-loading"` を描画し、ヘッダー・目次一覧・未存在表示は描画しない。
  2. `isLoading === false` かつ `novel === null` の場合: 未存在・エラー案内領域 `data-testid="novel-detail-not-found"`（`error ?? "指定された作品が見つかりません。"`）および「本棚へ戻る」ボタン `data-testid="back-to-bookshelf-button"` を描画する。
  3. `isLoading === false` かつ `novel !== null` の場合: `NovelDetailHeader`（上部固定）、各話リスト内部スクロール領域（中央）、および `DeleteConfirmDialog` を描画する。

---

### 3.6 `NovelDetailContainer`（作品詳細・目次画面 Container コンポーネント）

`useNovelDetail(novelId)` フックとルーター遷移コールバック（または Props で注入された遷移コールバック）を接続し、`NovelDetailPage` を描画する Container コンポーネントです。

#### プロパティ契約（`NovelDetailContainerProps`）

| プロパティ名        | 型                                                | 必須 | 説明                                                                               |
| :------------------ | :------------------------------------------------ | :--- | :--------------------------------------------------------------------------------- |
| `novelId`           | `string`                                          | 必須 | ルート `/novels/:novelId` から渡される対象作品 ID                                  |
| `onBackToBookshelf` | `() => void`                                      | 任意 | 本棚へ戻る遷移コールバック（省略時は `useRouter().navigateToBookshelf` を使用）    |
| `onSelectEpisode`   | `(novelId: string, chapterIndex: number) => void` | 任意 | リーダー画面への遷移コールバック（省略時は `useRouter().navigateToReader` を使用） |

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
  isDeleteDialogOpen: boolean;
  isDeleting: boolean;
  refreshMessage: string | null;
  error: string | null;
  refreshToc: () => Promise<boolean>;
  startBatchCache: () => Promise<void>;
  cancelBatchCache: () => void;
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
  confirmDeleteNovel: () => Promise<boolean>;
  reloadDetail: () => Promise<void>;
}
```

### 4.2 パイプライン仕様

1. **初回ロード（`reloadDetail`）と本棚「NEW」バッジ解除**:
   - `ServiceProvider` の `isReady === true` 後、`novelRepository.getNovelById(novelId)` および `chapterRepository.listChaptersByNovelId(novelId)` を並行取得する。
   - 読み込み完了時、対象作品の `novel.hasNewUpdate === true` の場合は `novelRepository.clearNewUpdate(novelId)` を呼び出して `has_new_update = 0` に解除し、本棚画面（`SCR-01`）復帰時にも「NEW」バッジが消去された状態を維持する。
   - 読み込み中は `isLoading = true` とし、完了後に `isLoading = false` とする。
2. **目次再取得・差分更新（`refreshToc`）**:
   - `novel === null` の場合は何もせず `false` を返す。
   - `isRefreshing = true`, `error = null`, `refreshMessage = null` にセットする。
   - **通信前パーサー解決と正規化**: `parserRegistry.requireParser(novel.canonicalUrl)` および `parser.normalizeWorkUrl(novel.canonicalUrl)` を実行する。
   - **目次 HTML 取得・解析・DB Upsert**:
     - `httpClient.getHtml({ url: normalizedWorkUrl })` で作品トップ HTML を取得し、`parser.parseNovelIndex(response.html, normalizedWorkUrl)` で最新メタデータ・目次一覧を抽出する。
     - 更新前の話数 `prevCount = chapters.length` を保持した上で、`novelRepository.upsertNovelWithToc(novelIndex, new Date().toISOString())` を実行する（`chapters` テーブルの `ON CONFLICT(novel_id, remote_chapter_id) DO UPDATE` により、既存の `body_html` / `byte_size` / `is_read` / `downloaded_at` は破壊されず保持される）。
   - **状態再取得と完了フィードバック**:
     - DB から最新の `novel` と `chapters` を再取得して State を更新する。
     - 追加話数 `addedCount = Math.max(0, updatedChapters.length - prevCount)` を算出し、`addedCount > 0` の場合は `目次を更新しました（+${addedCount}話）`、`addedCount === 0` の場合は `最新の状態です` を `refreshMessage` にセットし、`true` を返す。
   - **通信・パース失敗時**:
     - 例外発生時は既存の `novel` / `chapters` 表示を維持したまま、`error` に日本語エラーメッセージをセットして `false` を返す。
3. **作品削除とカスケード削除（`confirmDeleteNovel`）**:
   - `isDeleting = true`, `error = null` にセットし、`novelRepository.deleteNovel(novelId)` を実行する。
   - SQLite の外部キー制約（`PRAGMA foreign_keys = ON` ＆ `FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE`）により、当該作品に紐づく `chapters`（および `download_queue`）の全レコードが一括カスケード削除される。
   - 削除成功時はダイアログを閉じ（`isDeleteDialogOpen = false`）、`true` を返す。呼び出し元の `NovelDetailContainer` は `true` を受け取って即座に `onBackToBookshelf()`（`/` への遷移 `TR-07`）を実行する。
   - 削除失敗時はダイアログを閉じずに `error` をセットし、`isDeleting = false` に戻して `false` を返す。
4. **エピソード選択と未キャッシュ話オンデマンド本文取得（`TR-04` → `SCR-03`）**:
   - 目次一覧のエピソード行タップ、またはヘッダーの「最初から読む（第1話）」「続きから読む（第N話）」ボタンタップ時は、即座にリーダー画面ルート `/novels/:novelId/chapters/:chapterIndex`（`SCR-03`）へ遷移する。
   - 遷移先の `ReaderContainer`（`useReader`、`SCR-03`）にて、対象話の `bodyHtml === null`（未キャッシュ）の場合は自動的に `httpClient.getHtml` → `parser.parseChapterContent` → `chapterRepository.saveChapterBody`（＋ `recalculateNovelStats` による `cached_chapters` 更新）が実行され、併せて `markChapterRead` による既読化（`is_read = 1`）および `updateBookmark` によるしおり・スクロール進捗率更新が行われる。
   - リーダー画面からの OS バックキー（`TR-06`）で `SCR-02` へ戻ると、`useNovelDetail` のマウント時ロードにより該当エピソードのバッジが `取得済み`（`episode-cached-badge`）・`既読`（`episode-read-badge`）・`しおり`（`episode-bookmark-badge`）に、ヘッダーの取得済み話数・読書再開ボタンが最新値に反映される。
5. **未取得話の一括キャッシュパイプライン（`TR-18`）**:
   - `isBatchCaching === true` の間は多重実行を防止する（読書開始ボタン、各話行タップ、目次更新ボタン、作品削除ボタンも無効化される）。
   - 全話キャッシュ済み判定（`isAllCached`）は、エピソードが存在し（`chapters.length > 0`）かつ全話が 7日以内の有効なキャッシュを持つ場合（`chapters.every(c => c.downloadedAt !== null && (now - new Date(c.downloadedAt).getTime() < CACHE_TTL_MS))`）に `true` となる。総話数が 0 話（`chapters.length === 0`）の場合は `isAllCached = false` となり、ボタンは disabled 化される。
   - 対象作品の全エピソード（`chapters`）から、未取得話（`downloadedAt === null`）または 7日経過した古いキャッシュ（`now - new Date(downloadedAt).getTime() >= CACHE_TTL_MS`）を抽出する。
   - 対象が 0 件の場合は即座に通知メッセージ（`全話キャッシュ済みです`）を表示して終了する。
   - `isBatchCaching = true`, `batchCacheProgress = { current: 0, total: targets.length }`, `error = null` を設定する。
   - `AbortController` を生成し、1話ごとに `PREFETCH_INTERVAL_MS`（1.5秒）のウェイト間隔を空けながら直列に取得を実行する。
     - 7日経過キャッシュが存在する場合は短タイムアウト（3秒）、未キャッシュ話は標準タイムアウト（10秒）で取得する。
     - HTML 取得後、パーサーで解析して `chapterRepository.saveChapterBody` で SQLite に保存する。
     - 1話保存成功ごとに `novel`（`cachedChapters` 更新）および `chapters`（`downloadedAt` 更新）の State を即時更新し、画面にリアルタイム反映する。
     - 進捗 `batchCacheProgress = { current: i + 1, total: targets.length }` を更新する。
   - 手動中断（`cancelBatchCache`）または画面離脱（アンマウント）時は `AbortController.abort()` で直ちに安全に処理を停止する（取得済み話数は SQLite 内に保持される）。
   - 全話取得成功時は `refreshMessage = "全話のキャッシュを取得しました"`（または `"N話のキャッシュを取得しました"`）を設定し、`isBatchCaching = false`, `batchCacheProgress = null` とする。
   - 取得失敗時は処理を中断し、`error = "第X話の取得に失敗したためキャッシュを中断しました"` を設定して `isBatchCaching = false` とする。

---

## 5. 受入条件一覧（Acceptance Criteria: `AC-ND-xx`）

| AC ID          | 対象機能                                   | 検証条件                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 関連要件 / 遷移                               |
| :------------- | :----------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------- |
| **`AC-ND-01`** | 作品ヘッダー情報・あらすじトグル表示       | 作品詳細画面（`/novels/:novelId`）上部に `NovelDetailHeader` が固定配置（`shrink-0`）され、タイトル・著者・統計がコンパクトに表示されること。またあらすじは初期状態で折りたたまれ（2〜3行 clamp）、トグルボタン（`synopsis-toggle-button`）で全文展開／折りたたみが可能であり、展開時は最大高さ制限と内部スクロール（`max-h` ＋ `overflow-y-auto`）が適用されること。あらすじ空文字時は「あらすじはありません。」を表示しトグルは非表示であること。        | `SYS-REQ-01` / `TR-02`                        |
| **`AC-ND-02`** | 章見出しとエピソード一覧・内部スクロール   | エピソード一覧が固定ヘッダー下の独立スクロール領域（`flex-1 min-h-0 overflow-y-auto`）として描画され、`chapterIndex` 昇順で章見出し（`chapter-section-header`）、本文キャッシュ状態（`取得済み` / `未取得`）、既読状態（`既読`）、しおり位置（`しおり`）が正確に表示されること。                                                                                                                                                                           | `SYS-REQ-01`, `02`, `12`                      |
| **`AC-ND-03`** | 読書開始ボタンの表示制御と遷移             | しおり未設定時は「最初から読む（第1話）」の1ボタンのみが表示され、しおり設定時は「続きから読む（第N話）」と「最初から読む（第1話）」の2ボタンが表示され、それぞれ該当話のリーダー画面（`/novels/:novelId/chapters/:chapterIndex`）へ遷移（`TR-04`）すること。                                                                                                                                                                                              | `SYS-REQ-02`, `12` / `TR-04`                  |
| **`AC-ND-04`** | 未キャッシュ話選択とオンデマンド取得       | 目次一覧で未キャッシュ話をタップすると即座にリーダー画面（`SCR-03`）へ遷移（`TR-04`）して本文がオンデマンド取得・DB保存され、OS バックキー（`TR-06`）で戻ると該当話が `取得済み` バッジ・取得済み話数 `+1` に更新されていること。                                                                                                                                                                                                                          | `SYS-REQ-02` / `TR-04`, `TR-06`               |
| **`AC-ND-05`** | 目次再取得（更新）とフィードバック表示     | 「目次を更新」ボタンを押下すると作品トップ HTML を再取得して `upsertNovelWithToc` で既存キャッシュを保持したまま目次を更新し、完了時に新着話数に応じたインライン通知（`目次を更新しました（+N話）` / `最新の状態です`）、失敗時にエラーメッセージを表示すること。                                                                                                                                                                                          | `SYS-REQ-01`, `04`                            |
| **`AC-ND-06`** | 確認ダイアログ付き作品削除と本棚復帰       | 「作品を削除」ボタンから確認ダイアログを開き、「削除する」を確定すると `deleteNovel` により作品および関連 `chapters` がカスケード削除され、本棚画面（`/`）へ遷移（`TR-07`）して一覧から消えていること。                                                                                                                                                                                                                                                    | `SYS-REQ-05` / `TR-07`                        |
| **`AC-ND-07`** | 戻り元復帰導線の整理と未存在フォールバック | `NovelDetailHeader` 内の「← 本棚へ戻る」ボタンは廃止されていること。また存在しない `novelId` が指定された場合はクラッシュせず `novel-detail-not-found` と「戻る」導線（`back-to-bookshelf-button`）を表示し、タップ時に直前の遷移元画面（本棚 `/`、検索 `/search`、ランキング `/ranking`、履歴なし時は本棚 `/`）へ復帰できること（`TR-07`）。                                                                                                              | `SYS-REQ-01, 16, 20` / `TR-07`                |
| **`AC-ND-08`** | しおり位置への初期スクロール自動調整       | 対象作品に `bookmarkChapterIndex` が設定されている場合、初回データ読み込み完了時に該当話（`data-chapter-index`）の要素が各話リストスクロール領域の先頭（上端）に来るよう自動スクロールされること。また、「目次を更新」実行時には自動スクロールが再発火せず、ユーザーの現在スクロール位置が維持されること。                                                                                                                                                 | `SYS-REQ-01, 12`                              |
| **`AC-ND-09`** | 100dvh 全画面シェル・下部タブ・階層復帰    | 作品詳細画面が `h-full flex flex-col overflow-hidden` の全画面シェル内に配置され、中間コンテンツ領域（`flex-1 min-h-0 overflow-y-auto`）のみがスクロール可能であること。画面下部に共通 `BottomTabBar`（`bottom-tab-bar`）が 4 タブ構成で表示され、各タブタップ（`TR-01`, `TR-01b`）により各画面へ遷移でき、OS バックキー（`TR-07`）により直前の遷移元画面（本棚 `SCR-01`、検索 `SCR-06`、ランキング `SCR-07`、履歴なし時は本棚 `/`）へ論理復帰できること。 | `SYS-REQ-16, 20` / `TR-01`, `TR-01b`, `TR-07` |
| **`AC-ND-10`** | 作品詳細表示による本棚「NEW」バッジ解除    | 本棚で「NEW」バッジが表示されていた作品の詳細画面（`SCR-02`）を開いた際（`TR-02` 等）、`clearNewUpdate` が実行されて作品の `has_new_update` が 0 に解除され、本棚へ戻った際（`TR-07`）に対象作品カードの「NEW」バッジが消去されていること。                                                                                                                                                                                                                | `SYS-REQ-04` / `TR-02`, `TR-07`               |
| **`AC-ND-11`** | 未取得話の一括キャッシュ実行と進捗表示     | 「未取得話を一括キャッシュ」ボタンを押下すると、未キャッシュ話を対象に 1.5秒間隔のウェイト制御を挟んで順次本文を取得して SQLite に保存し、進行状況（`batch-cache-progress`）が表示され、各話取得ごとに取得済み話数・キャッシュバッジ（`取得済み`）が即時更新されること。                                                                                                                                                                                   | `SYS-REQ-02, 03, 05` / `TR-18`                |
| **`AC-ND-12`** | 一括キャッシュの中断と安全性               | 一括キャッシュ実行中に「中断」ボタン（`batch-cache-cancel-button`）を押下した際、または画面離脱（アンマウント）時に `AbortController` により直ちに通信が停止し、それまでに保存された本文データが破損せず SQLite に保持されること。                                                                                                                                                                                                                         | `SYS-REQ-03, 05` / `TR-18`                    |
| **`AC-ND-13`** | 全話取得済み時のボタン状態制御             | 対象作品にエピソードが存在し（`chapters.length > 0`）、かつ全エピソードがキャッシュ済みかつ有効期間内（7日以内）である場合、一括キャッシュボタンが disabled 化され「全話キャッシュ済み」と表示されること。エピソードが 0 話の場合は `isAllCached = false` かつ一括キャッシュボタンが disabled（「未取得話を一括キャッシュ」）となること。                                                                                                                  | `SYS-REQ-02, 05` / `TR-18`                    |
