---
type: spec-feature
title: "本棚画面仕様書（SCR-01: Bookshelf）"
description: "登録済み小説カード一覧の表示、しおり位置からのワンタップ読書再開、および検索・ランキング画面への誘導を提供する本棚画面（SCR-01）の正本仕様。"
status: "Review (#79)"
updated: "2026-10-29"
tags:
  - bookshelf
  - scr-01
  - routing
  - ui
  - shell
  - bottom-nav
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/search.md
  - docs/specs/features/ranking.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/reader-view.md
  - docs/specs/features/settings.md
  - docs/specs/parsers/kakuyomu.md
  - docs/specs/changes/issue-78-apk-signing-and-back-button.md
  - docs/specs/changes/issue-79-four-tabs-search-ranking.md
  - docs/specs/changes/archive/issue-50-fullscreen-shell-and-settings.md
  - docs/specs/changes/archive/issue-12-bookshelf-and-routing.md
related_tests:
  - src/App.test.tsx
  - src/features/bookshelf/hooks/useBookshelf.test.ts
  - src/features/bookshelf/components/BookshelfEmptyState.test.tsx
  - src/features/bookshelf/components/NovelCard.test.tsx
  - src/features/bookshelf/components/BookshelfPage.test.tsx
  - src/features/bookshelf/components/BookshelfContainer.test.tsx
  - test/it/smoke.spec.ts
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 本棚画面仕様書（SCR-01）

本ドキュメントは、Yommy のホーム画面である **本棚画面（`SCR-01`: ルート `/`）** の画面構成、Presentational / Container コンポーネント契約、および受入条件（`AC-BS-xx`）を定める正本（Single Source of Truth）です。

> [!NOTE]
> **v0.3（Issue #79）における登録導線の刷新**:
> v0.2 までは本画面の「URLから作品を追加」ダイアログ（`AddNovelDialog`）による直接 URL 入力を行っていましたが、v0.3 より URL 直接入力機能は廃止され、検索画面（`SCR-06: /search`）およびランキング画面（`SCR-07: /ranking`）からのワンタップ登録へ一本化されました。空状態（`BookshelfEmptyState`）からも直接検索・ランキングへ誘導します。

---

## 1. 概要・スコープ

- **対象画面**: 本棚画面（`SCR-01`、ルートパス `/`）
- **対応要件**:
  - `SYS-REQ-01`（作品登録・目次取得：検索・ランキングからの登録への一本化に伴い、本棚画面は登録済み作品の閲覧・管理に専念）
  - `SYS-REQ-02`（本文取得・オフライン閲覧：未キャッシュ話に対する「続きから読む」遷移時のオンデマンド本文取得導線）
  - `SYS-REQ-12`（しおり・スクロール位置自動保存に基づく読書再開導線）
  - `SYS-REQ-16`（100dvh 全画面シェル・下部 4 タブバー固定・作品一覧内部縦スクロール）
  - `SYS-REQ-20`（下部 4 タブナビゲーション）
- **関連画面遷移**:
  - `TR-01`（下部タブ「検索 `/search`」「ランキング `/ranking`」「設定 `/settings`」タップによる各画面への遷移）
  - `TR-01b`（下部タブ「本棚」タップによる本棚トップ `/` への直接復帰遷移）
  - `TR-02`（作品カード本体タップによる作品詳細・目次画面 `SCR-02` `/novels/:novelId` への遷移）
  - `TR-03`（「続きから読む」ボタンタップによる小説リーダー画面 `SCR-03` `/novels/:novelId/chapters/:chapterIndex` への直接遷移 ※目次介在）
  - `TR-14`（空状態からの検索画面 `SCR-06` またはランキング画面 `SCR-07` への遷移）
- **対象外スコープ（Milestone `v0.3` 以降）**:
  - お気に入りフィルタおよび新着一括更新チェック（`SYS-REQ-04`）

---

## 2. コンポーネント構成と責務境界

`docs/guidelines/testing.md` の親子分離原則および 1対1 Story/UT 原則に従い、`src/features/bookshelf/` 配下を以下のモジュール構成とします（`AddNovelDialog` は廃止）。

```text
src/features/bookshelf/
├── hooks/
│   ├── useBookshelf.ts                    # 本棚一覧取得・状態管理フック
│   └── useBookshelf.test.ts               # フック単体テスト（Vitest）
└── components/
    ├── BookshelfEmptyState.tsx            # 未登録時の空状態案内 UI（検索・ランキング誘導、Presentational）
    ├── BookshelfEmptyState.stories.tsx
    ├── BookshelfEmptyState.test.tsx
    ├── NovelCard.tsx                      # 登録済み1作品のカード表示 UI（Presentational）
    ├── NovelCard.stories.tsx
    ├── NovelCard.test.tsx
    ├── BookshelfPage.tsx                  # 本棚画面全体のレイアウト統合コンポーネント（Presentational）
    ├── BookshelfPage.stories.tsx
    ├── BookshelfPage.test.tsx
    ├── BookshelfContainer.tsx             # ServiceProvider / Router / useBookshelf を接続する Container
    ├── BookshelfContainer.stories.tsx
    └── BookshelfContainer.test.tsx
```

---

## 3. 各コンポーネント・フックの詳細契約

### 3.1 `NovelCard`（登録済み作品カード）

登録済みの 1 作品（`NovelSummary`）を表示し、作品詳細画面への遷移（`TR-02`）およびリーダー画面での読書再開（`TR-03`）をトリガーする Presentational コンポーネントです。

#### プロパティ契約（`NovelCardProps`）

| プロパティ名 | 型                                                | 必須 | 説明                                                                 |
| :----------- | :------------------------------------------------ | :--- | :------------------------------------------------------------------- |
| `novel`      | `NovelSummary`                                    | 必須 | 表示対象の作品サマリーレコード                                       |
| `onSelect`   | `(novelId: string) => void`                       | 必須 | カード本体（タイトル・情報領域）タップ時のコールバック（`TR-02` 用） |
| `onResume`   | `(novelId: string, chapterIndex: number) => void` | 必須 | 「続きから読む」ボタンタップ時のコールバック（`TR-03` 用）           |

#### 表示項目とセマンティック属性

- **ルート要素**: `data-testid="novel-card"`、`data-novel-id={novel.id}`
- **表示情報**:
  - **作品タイトル**: `data-testid="novel-card-title"`（`novel.title`）
  - **著者名**: `data-testid="novel-card-author"`（`novel.author`、空文字の場合は「著者不明」等を表示）
  - **話数・キャッシュ進捗**: `data-testid="novel-card-chapters"`
    - `全 {novel.totalChapters} 話（取得済み {novel.cachedChapters} 話）` の形式で表示する。
  - **しおり位置バッジ**: `data-testid="novel-card-bookmark"`
    - `novel.bookmarkChapterIndex !== null` の場合: `しおり: 第{novel.bookmarkChapterIndex}話`
    - `novel.bookmarkChapterIndex === null` の場合: `未読`
- **操作アクション**:
  - **カード詳細遷移ボタン/領域**: `data-testid="novel-card-select"`
    - クリック時に `onSelect(novel.id)` を呼び出す。
  - **「続きから読む」ボタン**: `data-testid="novel-card-resume"`
    - ラベル: `novel.bookmarkChapterIndex !== null` の場合は `第{novel.bookmarkChapterIndex}話から読む`（または `続きから読む`）、`null` の場合は `第1話から読む`（または `続きから読む`）。
    - クリック時にターゲット話数 `targetChapter = novel.bookmarkChapterIndex ?? 1` を引数として `onResume(novel.id, targetChapter)` を呼び出す（親カードへのクリックイベント伝播 `stopPropagation` を制御し、`onSelect` と二重発火しないこと）。

---

### 3.2 `BookshelfEmptyState`（未登録時の空状態 UI）

本棚に登録作品が 0 件のときに表示され、検索・ランキング画面への遷移を促す Presentational コンポーネントです。

#### プロパティ契約（`BookshelfEmptyStateProps`）

| プロパティ名        | 型           | 必須 | 説明                                                         |
| :------------------ | :----------- | :--- | :----------------------------------------------------------- |
| `onNavigateSearch`  | `() => void` | 必須 | 「小説を検索する」ボタン押下時のコールバック（`TR-14` 用）   |
| `onNavigateRanking` | `() => void` | 必須 | 「ランキングを見る」ボタン押下時のコールバック（`TR-14` 用） |

#### セマンティック属性

- **ルート要素**: `data-testid="bookshelf-empty"`
- **案内テキスト**: 「本棚に作品が登録されていません」「作品を検索したりランキングから探して、本棚に追加しましょう」等の案内文
- **誘導ボタン**:
  - **検索誘導ボタン**: `data-testid="empty-search-button"`（クリックで `onNavigateSearch()` を呼び出す）
  - **ランキング誘導ボタン**: `data-testid="empty-ranking-button"`（クリックで `onNavigateRanking()` を呼び出す）

---

### 3.3 `BookshelfPage`（本棚画面 Presentational コンポーネント）

ヘッダータイトル、作品カード一覧（または空状態 UI）を統合配置する画面コンポーネントです。

#### プロパティ契約（`BookshelfPageProps`）

| プロパティ名        | 型                                                | 必須 | 説明                                      |
| :------------------ | :------------------------------------------------ | :--- | :---------------------------------------- |
| `novels`            | `NovelSummary[]`                                  | 必須 | 登録済み作品一覧                          |
| `isLoading`         | `boolean`                                         | 必須 | 初回一覧読み込み中フラグ                  |
| `onNavigateSearch`  | `() => void`                                      | 必須 | 空状態時の検索画面遷移コールバック        |
| `onNavigateRanking` | `() => void`                                      | 必須 | 空状態時のランキング画面遷移コールバック  |
| `onSelectNovel`     | `(novelId: string) => void`                       | 必須 | 作品カード本体タップ時（`TR-02`）         |
| `onResumeNovel`     | `(novelId: string, chapterIndex: number) => void` | 必須 | 「続きから読む」ボタンタップ時（`TR-03`） |

#### セマンティック属性と状態別描画ルール

- **画面ルート**: `data-testid="bookshelf-page"`
- **ヘッダー**: タイトル「📚 本棚」を固定表示（URL追加ボタンは廃止）。
- **メイン領域の排他描画ルール**:
  1. `isLoading === true` の場合: ローディング表示要素 `data-testid="bookshelf-loading"` を描画し、`bookshelf-empty` および `novel-list` は描画しない。
  2. `isLoading === false` かつ `novels.length === 0` の場合: `BookshelfEmptyState`（`data-testid="bookshelf-empty"`）を描画する。
  3. `isLoading === false` かつ `novels.length > 0` の場合: 作品一覧コンテナ `data-testid="novel-list"` を描画し、その配下に各作品の `NovelCard` を描画する。

---

### 3.4 `BookshelfContainer`（本棚画面 Container コンポーネント）

`useBookshelf` フックおよびルーター遷移コールバックを接続し、`BookshelfPage` を描画する Container コンポーネントです。

#### プロパティ契約（`BookshelfContainerProps`）

| プロパティ名    | 型                                                | 必須 | 説明                                                                                            |
| :-------------- | :------------------------------------------------ | :--- | :---------------------------------------------------------------------------------------------- |
| `onSelectNovel` | `(novelId: string) => void`                       | 任意 | 作品カード本体タップ時の遷移コールバック（省略時は `useRouter().navigateToNovelDetail` を使用） |
| `onResumeNovel` | `(novelId: string, chapterIndex: number) => void` | 任意 | 「続きから読む」タップ時の遷移コールバック（省略時は `useRouter().navigateToReader` を使用）    |

---

## 4. `useBookshelf` フック契約

```typescript
export interface UseBookshelfResult {
  novels: NovelSummary[];
  isLoading: boolean;
  error: string | null;
  reloadNovels: () => Promise<void>;
}
```

1. **初回ロードおよび手動リロード（`reloadNovels`）**:
   - `ServiceProvider` の `isReady === true` 後、`novelRepository.listNovels()` を呼び出して本棚一覧を取得する（`last_read_at DESC, created_at DESC` 順）。
   - 失敗した場合は `error` ステートにエラーメッセージを設定する。

---

## 5. 受入条件一覧（Acceptance Criteria: `AC-BS-xx`）

| AC ID          | 対象機能                         | 検証条件                                                                                                                                                                                                                                                       | 関連要件 / 遷移                                |
| :------------- | :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------- |
| **`AC-BS-01`** | 空状態表示と検索・ランキング誘導 | 登録作品が 0 件のとき、`bookshelf-empty` が表示され、「小説を検索する」ボタン（`empty-search-button`）および「ランキングを見る」ボタン（`empty-ranking-button`）からそれぞれ `/search` および `/ranking` へ遷移できること。                                    | `SYS-REQ-01` / `TR-14`                         |
| **`AC-BS-02`** | （廃止）                         | v0.3 にて直接 URL 入力機能は廃止され、検索・ランキングからの登録へ一本化。                                                                                                                                                                                     | -                                              |
| **`AC-BS-03`** | （廃止）                         | v0.3 にて URL 入力ダイアログは廃止。                                                                                                                                                                                                                           | -                                              |
| **`AC-BS-04`** | 作品カード情報表示               | 登録済み作品カードにタイトル、著者名、全話数・取得済み話数（`totalChapters` / `cachedChapters`）、およびしおり位置（`bookmarkChapterIndex` または `未読`）が正確に表示されること。                                                                             | `SYS-REQ-01`, `SYS-REQ-12`                     |
| **`AC-BS-05`** | 作品詳細画面への遷移             | 作品カード本体（`novel-card-select`）をタップすると、対象作品の詳細・目次画面（`/novels/:novelId`）へ遷移（`TR-02`）すること。                                                                                                                                 | `SYS-REQ-01` / `TR-02`                         |
| **`AC-BS-06`** | 続きから読むワンタップ起動       | 作品カードの「続きから読む」ボタン（`novel-card-resume`）をタップすると、`bookmarkChapterIndex`（未設定時は第1話）のリーダー画面（`/novels/:novelId/chapters/:chapterIndex`）へ直接遷移（`TR-03`）し、未キャッシュ時は本文をオンデマンド取得して表示すること。 | `SYS-REQ-02`, `SYS-REQ-12` / `TR-03`           |
| **`AC-BS-07`** | 全画面シェルと下部4タブ固定      | 画面全体が 100dvh 固定シェルに収まりウィンドウスクロールが発生せず、画面上部ヘッダー固定、作品カード一覧が枠内縦スクロール（`overflow-y-auto`）可能で、画面最下部に下部タブバー（`BottomTabBar`）が 4 タブ構成で「本棚」アクティブ状態で固定表示されること。   | `SYS-REQ-16`, `SYS-REQ-20` / `TR-01`, `TR-01b` |
