---
type: spec-feature
title: 作品詳細・目次画面仕様書（SCR-02: Novel Detail & TOC）
description: 登録済み作品のヘッダー情報・あらすじ表示、章見出し付きエピソード一覧（キャッシュ済み・既読・しおり状態）、目次更新（再取得）、作品削除、およびリーダー画面への閲覧遷移を提供する作品詳細・目次画面（SCR-02）の正本仕様。
status: Approved
updated: "2026-10-27"
tags: [novel-detail, scr-02, toc, routing, ui]
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/reader-view.md
  - docs/specs/parsers/kakuyomu.md
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
---

# 作品詳細・目次画面仕様書（SCR-02）

本ドキュメントは、本棚画面（`SCR-01`）で選択した作品の詳細情報・あらすじ・全エピソード目次を表示し、任意のエピソード閲覧（未キャッシュ時のオンデマンド本文取得連携）、目次の再取得（更新）、および作品の削除を提供する **作品詳細・目次画面（`SCR-02`: ルート `/novels/:novelId`）** の正本（Single Source of Truth）です。

---

## 1. 概要・スコープ

- **対象画面**: 作品詳細・目次画面（`SCR-02`、ルートパス `/novels/:novelId`）
- **対応要件**:
  - `SYS-REQ-01`（作品登録・目次取得：作品メタデータ・あらすじ・章見出し付きエピソード一覧の表示および目次再取得）
  - `SYS-REQ-02`（本文取得・オフライン閲覧：エピソード選択または読書開始ボタンによるリーダー遷移と、未キャッシュ話のオンデマンド本文取得・キャッシュ状態反映）
  - `SYS-REQ-04`（更新チェック・差分取得の一部：作品詳細画面での手動目次再取得と新着話数フィードバック表示）
  - `SYS-REQ-05`（キャッシュ管理・容量整理の一部：確認ダイアログ付き作品削除と `chapters` カスケード削除）
  - `SYS-REQ-12`（しおり・スクロール位置自動保存に基づくしおり位置マーク・既読バッジ表示および「続きから読む」導線）
- **関連画面遷移**:
  - `TR-02`（本棚画面 `SCR-01` の作品カード本体タップによる `SCR-02` `/novels/:novelId` への遷移）
  - `TR-04`（目次リストのエピソード行タップ、または「最初から読む／続きから読む」ボタンタップによる小説リーダー画面 `SCR-03` `/novels/:novelId/chapters/:chapterIndex` への遷移）
  - `TR-06`（小説リーダー画面 `SCR-03` の「作品詳細へ（目次へ戻る）」ボタンによる `SCR-02` `/novels/:novelId` への復帰）
  - `TR-07`（作品詳細ヘッダーの「本棚へ戻る」ボタン、または作品削除確認ダイアログでの削除実行完了による本棚画面 `SCR-01` `/` への遷移）
- **対象外スコープ（後続 Issue / Milestone）**:
  - エピソード閲覧に伴うしおり位置（`bookmarkChapterIndex`, `bookmarkScrollProgress`）および既読フラグ（`isRead`）の自動更新ロジック本体（Issue #14 の `SCR-03` リーダー画面拡張で一括実装）
  - レートリミット付きバックグラウンド DL キューによる未取得全話の一括ダウンロード（Milestone `v0.2`：`SYS-REQ-03`, `TR-08`）
  - 内蔵 WebView（`SCR-04`）での手動インポート連携（Milestone `v0.3`：`SYS-REQ-13, 14`, `TR-09`）
  - 作品単位の「本文キャッシュのみ削除（目次は残す）」操作（Milestone `v0.3`：`SYS-REQ-05`）

---

## 2. コンポーネント構成と責務境界

`docs/guidelines/testing.md` の親子分離原則および 1対1 Story/UT 原則に従い、`src/features/novel-detail/` 配下を以下のモジュール構成とします（Issue #12 で暫定配置された `NovelDetailPlaceholder.*` は `NovelDetailContainer` のルーター統合時に置き換えて廃止します）。

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

作品のメタ情報（タイトル、著者、あらすじ、総話数・取得済み話数）、読書開始ボタン（「最初から読む」「続きから読む」）、目次更新ボタン、作品削除ボタン、および「本棚へ戻る」ナビゲーションを表示する Presentational コンポーネントです。

#### プロパティ契約（`NovelDetailHeaderProps`）

| プロパティ名           | 型                               | 必須 | 説明                                                |
| :--------------------- | :------------------------------- | :--- | :-------------------------------------------------- |
| `novel`                | `NovelRecord`                    | 必須 | 表示対象の作品レコード                              |
| `isRefreshing`         | `boolean`                        | 必須 | 目次再取得（更新）通信中フラグ                      |
| `refreshMessage`       | `string \| null`                 | 任意 | 目次再取得完了時のインライン通知メッセージ          |
| `error`                | `string \| null`                 | 任意 | 目次再取得失敗または削除失敗時のエラーメッセージ    |
| `onBackToBookshelf`    | `() => void`                     | 必須 | 「本棚へ戻る」ボタン押下時のコールバック（`TR-07`） |
| `onStartFromBeginning` | `() => void`                     | 必須 | 「最初から読む（第1話）」ボタン押下時のコールバック |
| `onResumeBookmark`     | `(chapterIndex: number) => void` | 必須 | 「続きから読む（第N話）」ボタン押下時のコールバック |
| `onRefreshToc`         | () => void \| Promise<void>      | 必須 | 「目次を更新」ボタン押下時のコールバック            |
| `onOpenDeleteDialog`   | `() => void`                     | 必須 | 「作品を削除」ボタン押下時のコールバック            |

#### 表示項目・セマンティック属性・活性制御ルール

- **ルート要素**: `data-testid="novel-detail-header"`
- **ナビゲーション**:
  - **本棚へ戻るボタン**: `data-testid="back-to-bookshelf-button"`（クリック時に `onBackToBookshelf()` を呼び出す）
- **作品メタ情報**:
  - **作品タイトル**: `data-testid="novel-detail-title"`（`novel.title`）
  - **著者名**: `data-testid="novel-detail-author"`（`novel.author`、空文字の場合は `著者不明`）
  - **話数・キャッシュ統計**: `data-testid="novel-detail-stats"`
    - `全 {novel.totalChapters} 話（取得済み {novel.cachedChapters} 話）` の形式で表示する。
  - **あらすじ**: `data-testid="novel-detail-synopsis"`（`novel.synopsis`、空文字の場合は `あらすじはありません。`）
- **読書開始ボタンの表示制御（`TR-04`）**:
  - **しおり未設定時（`novel.bookmarkChapterIndex === null`）**:
    - プライマリボタン `data-testid="detail-read-first-button"`（ラベル: `最初から読む（第1話）`）の **1 ボタンのみ** を表示し、クリック時に `onStartFromBeginning()` を呼び出す（`detail-resume-button` は描画しない）。
  - **しおり設定時（`novel.bookmarkChapterIndex !== null`）**:
    - プライマリボタン `data-testid="detail-resume-button"`（ラベル: `続きから読む（第{novel.bookmarkChapterIndex}話）`、クリック時に `onResumeBookmark(novel.bookmarkChapterIndex)` を呼び出す）と、セカンダリボタン `data-testid="detail-read-first-button"`（ラベル: `最初から読む（第1話）`、クリック時に `onStartFromBeginning()` を呼び出す）の **2 ボタンを並べて表示** する。
  - ※`novel.totalChapters === 0` の場合は読書開始ボタンを `disabled` とする。
- **管理アクションボタン**:
  - **目次更新ボタン**: `data-testid="refresh-toc-button"`
    - `isRefreshing === true` の間は `disabled` とし、ラベルを `更新中...` に変更する（通常時は `目次を更新`）。
  - **作品削除起動ボタン**: `data-testid="open-delete-dialog-button"`（ラベル: `作品を削除`、`isRefreshing === true` の間は `disabled`）。
- **インラインフィードバック表示**:
  - `refreshMessage` が非 null の場合: `data-testid="novel-detail-notice"` に通知メッセージ（例: `目次を更新しました（+2話）` または `最新の状態です`）を表示する。
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

全エピソード配列（`ChapterSummary[]`）を受け取り、章・部見出し（`partTitle`）の境界ごとにセクションヘッダーを挿入したフラットリストとして描画する Presentational コンポーネントです。

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

`NovelDetailHeader`、`EpisodeList`、および `DeleteConfirmDialog` を統合し、ローディング状態や未存在作品（Not Found）状態の排他描画を制御する画面コンポーネントです。

#### プロパティ契約（`NovelDetailPageProps`）

| プロパティ名           | 型                               | 必須 | 説明                                              |
| :--------------------- | :------------------------------- | :--- | :------------------------------------------------ |
| `novel`                | `NovelRecord \| null`            | 必須 | 作品レコード（未取得・存在しない場合は `null`）   |
| `chapters`             | `ChapterSummary[]`               | 必須 | エピソード目次一覧                                |
| `isLoading`            | `boolean`                        | 必須 | 初回データ読み込み中フラグ                        |
| `isRefreshing`         | `boolean`                        | 必須 | 目次再取得（更新）通信中フラグ                    |
| `isDeleteDialogOpen`   | `boolean`                        | 必須 | 作品削除確認ダイアログの開閉状態                  |
| `isDeleting`           | `boolean`                        | 必須 | 作品削除実行中フラグ                              |
| `refreshMessage`       | `string \| null`                 | 任意 | 目次再取得完了時のインライン通知文字列            |
| `error`                | `string \| null`                 | 任意 | エラーメッセージ文字列                            |
| `onBackToBookshelf`    | `() => void`                     | 必須 | 「本棚へ戻る」押下時（`TR-07`）                   |
| `onStartFromBeginning` | `() => void`                     | 必須 | 「最初から読む（第1話）」押下時（`TR-04`）        |
| `onResumeBookmark`     | `(chapterIndex: number) => void` | 必須 | 「続きから読む（第N話）」押下時（`TR-04`）        |
| `onSelectEpisode`      | `(chapterIndex: number) => void` | 必須 | 個別エピソード行タップ時（`TR-04`）               |
| `onRefreshToc`         | () => void \| Promise<void>      | 必須 | 「目次を更新」押下時                              |
| `onOpenDeleteDialog`   | `() => void`                     | 必須 | 「作品を削除」押下時                              |
| `onCloseDeleteDialog`  | `() => void`                     | 必須 | 削除確認ダイアログのキャンセル時                  |
| `onConfirmDelete`      | () => void \| Promise<void>      | 必須 | 削除確認ダイアログの「削除する」確定時（`TR-07`） |

#### セマンティック属性と排他描画ルール

- **画面ルート**: `data-testid="novel-detail-page"`
- **メイン領域の排他描画ルール**:
  1. `isLoading === true` の場合: ローディング表示要素 `data-testid="novel-detail-loading"` を描画し、ヘッダー・目次一覧・未存在表示は描画しない。
  2. `isLoading === false` かつ `novel === null` の場合: 未存在・エラー案内領域 `data-testid="novel-detail-not-found"`（`error ?? "指定された作品が見つかりません。"`）および「本棚へ戻る」ボタン `data-testid="back-to-bookshelf-button"` を描画する。
  3. `isLoading === false` かつ `novel !== null` の場合: `NovelDetailHeader`、`EpisodeList`、および `DeleteConfirmDialog` を描画する。

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
  isDeleteDialogOpen: boolean;
  isDeleting: boolean;
  refreshMessage: string | null;
  error: string | null;
  refreshToc: () => Promise<boolean>;
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
  confirmDeleteNovel: () => Promise<boolean>;
  reloadDetail: () => Promise<void>;
}
```

### 4.2 パイプライン仕様

1. **初回ロード（`reloadDetail`）**:
   - `ServiceProvider` の `isReady === true` 後、`novelRepository.getNovelById(novelId)` および `chapterRepository.listChaptersByNovelId(novelId)` を並行取得する。
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
   - リーダー画面の「作品詳細へ」（`reader-back-to-detail`、`TR-06`）で `SCR-02` へ戻ると、`useNovelDetail` のマウント時ロードにより該当エピソードのバッジが `取得済み`（`episode-cached-badge`）・`既読`（`episode-read-badge`）・`しおり`（`episode-bookmark-badge`）に、ヘッダーの取得済み話数・読書再開ボタンが最新値に反映される。

---

## 5. 受入条件一覧（Acceptance Criteria: `AC-ND-xx`）

| AC ID          | 対象機能                                 | 検証条件                                                                                                                                                                                                                                                          | 関連要件 / 遷移                 |
| :------------- | :--------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------ |
| **`AC-ND-01`** | 作品ヘッダー情報・統計表示               | 作品詳細画面（`/novels/:novelId`）に作品タイトル、著者名、あらすじ、および全話数・取得済み話数（`全 N 話（取得済み M 話）`）が正確に表示されること。                                                                                                              | `SYS-REQ-01` / `TR-02`          |
| **`AC-ND-02`** | 章見出しとエピソード一覧・状態表示       | エピソード一覧が `chapterIndex` 昇順で表示され、`partTitle` の変化箇所に章見出しヘッダー（`chapter-section-header`）が挿入されること。また各話の本文キャッシュ状態（`取得済み` / `未取得`）、既読状態（`既読`）、しおり位置（`しおり`）が正確に表示されること。   | `SYS-REQ-01`, `02`, `12`        |
| **`AC-ND-03`** | 読書開始ボタンの表示制御と遷移           | しおり未設定時は「最初から読む（第1話）」の1ボタンのみが表示され、しおり設定時は「続きから読む（第N話）」と「最初から読む（第1話）」の2ボタンが表示され、それぞれ該当話のリーダー画面（`/novels/:novelId/chapters/:chapterIndex`）へ遷移（`TR-04`）すること。     | `SYS-REQ-02`, `12` / `TR-04`    |
| **`AC-ND-04`** | 未キャッシュ話選択とオンデマンド取得     | 目次一覧で未キャッシュ話をタップすると即座にリーダー画面（`SCR-03`）へ遷移（`TR-04`）して本文がオンデマンド取得・DB保存され、「作品詳細へ」（`TR-06`）で戻ると該当話が `取得済み` バッジ・取得済み話数 `+1` に更新されていること。                                | `SYS-REQ-02` / `TR-04`, `TR-06` |
| **`AC-ND-05`** | 目次再取得（更新）とフィードバック表示   | 「目次を更新」ボタンを押下すると作品トップ HTML を再取得して `upsertNovelWithToc` で既存キャッシュを保持したまま目次を更新し、完了時に新着話数に応じたインライン通知（`目次を更新しました（+N話）` / `最新の状態です`）、失敗時にエラーメッセージを表示すること。 | `SYS-REQ-01`, `04`              |
| **`AC-ND-06`** | 確認ダイアログ付き作品削除と本棚復帰     | 「作品を削除」ボタンから確認ダイアログを開き、「削除する」を確定すると `deleteNovel` により作品および関連 `chapters` がカスケード削除され、本棚画面（`/`）へ遷移（`TR-07`）して一覧から消えていること。                                                           | `SYS-REQ-05` / `TR-07`          |
| **`AC-ND-07`** | 本棚へ戻る導線と未存在作品フォールバック | ヘッダーの「本棚へ戻る」ボタン押下時に本棚画面（`/`）へ遷移（`TR-07`）すること。また存在しない `novelId` が指定された場合はクラッシュせず `novel-detail-not-found` と「本棚へ戻る」導線を表示すること。                                                           | `SYS-REQ-01` / `TR-07`          |
