---
type: spec-feature
title: 本棚画面仕様書（SCR-01: Bookshelf）
description: 登録済み小説カード一覧の表示、URLからの新規作品登録ダイアログ、しおり位置からのワンタップ読書再開を提供する本棚画面（SCR-01）の正本仕様。
status: "Review (#12)"
updated: "2026-10-26"
tags: [bookshelf, scr-01, routing, url-registration, ui]
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/reader-view.md
  - docs/specs/parsers/kakuyomu.md
related_tests:
  - src/features/bookshelf/hooks/useBookshelf.test.ts
  - src/features/bookshelf/components/BookshelfEmptyState.test.tsx
  - src/features/bookshelf/components/NovelCard.test.tsx
  - src/features/bookshelf/components/AddNovelDialog.test.tsx
  - src/features/bookshelf/components/BookshelfPage.test.tsx
  - src/features/bookshelf/components/BookshelfContainer.test.tsx
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 本棚画面仕様書（SCR-01）

本ドキュメントは、Yommy のホーム画面である **本棚画面（`SCR-01`: ルート `/`）** の画面構成、Presentational / Container コンポーネント契約、URL からの作品登録パイプライン、および受入条件（`AC-BS-xx`）を定める正本（Single Source of Truth）です。

---

## 1. 概要・スコープ

- **対象画面**: 本棚画面（`SCR-01`、ルートパス `/`）
- **対応要件**:
  - `SYS-REQ-01`（作品登録・目次取得）
  - `SYS-REQ-02`（本文取得・オフライン閲覧：未キャッシュ話に対する「続きから読む」遷移時のオンデマンド本文取得導線）
  - `SYS-REQ-12`（しおり・スクロール位置自動保存に基づく読書再開導線）
- **関連画面遷移**:
  - `TR-02`（作品カード本体タップによる作品詳細・目次画面 `SCR-02` `/novels/:novelId` への遷移）
  - `TR-03`（「続きから読む」ボタンタップによる小説リーダー画面 `SCR-03` `/novels/:novelId/chapters/:chapterIndex` への直接遷移）
- **対象外スコープ（Milestone `v0.2` 以降）**:
  - お気に入りフィルタおよび新着一括更新チェック（`SYS-REQ-04`）
  - 下部タブナビゲーションによる管理・設定画面（`SCR-05` `/manage`）への本格遷移（`TR-01`）

---

## 2. コンポーネント構成と責務境界

`docs/guidelines/testing.md` の親子分離原則および 1対1 Story/UT 原則に従い、`src/features/bookshelf/` 配下を以下のモジュール構成とします。

```text
src/features/bookshelf/
├── hooks/
│   ├── useBookshelf.ts                    # 本棚一覧取得・URL作品登録・状態管理フック
│   └── useBookshelf.test.ts               # フック単体テスト（Vitest）
└── components/
    ├── BookshelfEmptyState.tsx            # 未登録時の空状態案内 UI（Presentational）
    ├── BookshelfEmptyState.stories.tsx
    ├── BookshelfEmptyState.test.tsx
    ├── NovelCard.tsx                      # 登録済み1作品のカード表示 UI（Presentational）
    ├── NovelCard.stories.tsx
    ├── NovelCard.test.tsx
    ├── AddNovelDialog.tsx                 # URLから作品を追加するモーダルダイアログ UI（Presentational）
    ├── AddNovelDialog.stories.tsx
    ├── AddNovelDialog.test.tsx
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
    - 既存の `NovelSummary` スキーマに準拠し、`全 {novel.totalChapters} 話（取得済み {novel.cachedChapters} 話）` の形式で表示する。
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

本棚に登録作品が 0 件のときに表示される Presentational コンポーネントです。

#### プロパティ契約（`BookshelfEmptyStateProps`）

| プロパティ名 | 型           | 必須 | 説明                                            |
| :----------- | :----------- | :--- | :---------------------------------------------- |
| `onOpenAdd`  | `() => void` | 必須 | 「URLから作品を追加」ボタン押下時のコールバック |

#### セマンティック属性

- **ルート要素**: `data-testid="bookshelf-empty"`
- **案内テキスト**: 「本棚に作品が登録されていません」「カクヨムの作品URLを入力して小説を追加しましょう」等の案内文
- **追加起動ボタン**: `data-testid="empty-add-novel-button"`（クリックで `onOpenAdd()` を呼び出す）

---

### 3.3 `AddNovelDialog`（URLから作品を追加ダイアログ）

カクヨムの作品トップ URL またはエピソード URL を入力して新規作品を登録するモーダルダイアログです。

#### プロパティ契約（`AddNovelDialogProps`）

| プロパティ名   | 型                                       | 必須 | 説明                                           |
| :------------- | :--------------------------------------- | :--- | :--------------------------------------------- |
| `isOpen`       | `boolean`                                | 必須 | ダイアログの表示状態                           |
| `isSubmitting` | `boolean`                                | 必須 | 作品取得・保存処理の実行中フラグ               |
| `error`        | `string \| null`                         | 任意 | バリデーションエラーまたは通信エラーメッセージ |
| `onClose`      | `() => void`                             | 必須 | キャンセル / 閉じる操作時のコールバック        |
| `onSubmit`     | `(url: string) => void \| Promise<void>` | 必須 | URL 送信時のコールバック                       |

#### 機能・セマンティック属性

- `isOpen === false` の場合は何も描画しない（`null`）。
- **ダイアログコンテナ**: `role="dialog"`, `aria-modal="true"`, `data-testid="add-novel-dialog"`
- **URL 入力フィールド**: `data-testid="add-novel-url-input"`（`type="url"`、プレースホルダ `https://kakuyomu.jp/works/...`）
- **サンプル URL 入力補助ボタン**: `data-testid="fill-sample-url-button"`
  - Web ブラウザ開発環境や手動検証での入力を補助するため、クリックすると検証用カクヨム作品 URL（`https://kakuyomu.jp/works/16817330658027210412`）を入力欄へ自動セットする。
- **エラー表示領域**: `error` が非 null の場合、`data-testid="add-novel-error"` に日本語エラーメッセージを表示する。入力値はクリアせず保持し、ユーザーが修正・再試行できるようにする。
- **送信ボタン**: `data-testid="add-novel-submit-button"`
  - `isSubmitting === true` または入力値が空文字（空白のみ含む）の場合は `disabled` とする。
  - `isSubmitting === true` の間はラベルを `取得中...` に変更する。
- **キャンセルボタン**: `data-testid="add-novel-cancel-button"`（`isSubmitting === true` の間は `disabled`）。

---

### 3.4 `BookshelfPage`（本棚画面 Presentational コンポーネント）

ヘッダーアクション（「URLから作品を追加」ボタン）、作品カード一覧（または空状態 UI）、および `AddNovelDialog` を統合配置する画面コンポーネントです。

#### プロパティ契約（`BookshelfPageProps`）

| プロパティ名    | 型                                                | 必須 | 説明                                      |
| :-------------- | :------------------------------------------------ | :--- | :---------------------------------------- |
| `novels`        | `NovelSummary[]`                                  | 必須 | 登録済み作品一覧                          |
| `isLoading`     | `boolean`                                         | 必須 | 初回一覧読み込み中フラグ                  |
| `isDialogOpen`  | `boolean`                                         | 必須 | URL 追加ダイアログの開閉状態              |
| `isSubmitting`  | `boolean`                                         | 必須 | URL 追加処理中フラグ                      |
| `dialogError`   | `string \| null`                                  | 任意 | URL 追加ダイアログ内のエラー文字列        |
| `onOpenDialog`  | `() => void`                                      | 必須 | 「URLから作品を追加」ボタン押下時         |
| `onCloseDialog` | `() => void`                                      | 必須 | ダイアログを閉じる操作時                  |
| `onAddNovel`    | `(url: string) => void \| Promise<void>`          | 必須 | URL 追加実行時                            |
| `onSelectNovel` | `(novelId: string) => void`                       | 必須 | 作品カード本体タップ時（`TR-02`）         |
| `onResumeNovel` | `(novelId: string, chapterIndex: number) => void` | 必須 | 「続きから読む」ボタンタップ時（`TR-03`） |

#### セマンティック属性と状態別描画ルール

- **画面ルート**: `data-testid="bookshelf-page"`
- **ヘッダー追加ボタン**: `data-testid="open-add-novel-button"`（ラベル: `URLから作品を追加`）
- **メイン領域の排他描画ルール**:
  1. `isLoading === true` の場合: ローディング表示要素 `data-testid="bookshelf-loading"` を描画し、`bookshelf-empty` および `novel-list` は描画しない。
  2. `isLoading === false` かつ `novels.length === 0` の場合: `BookshelfEmptyState`（`data-testid="bookshelf-empty"`）を描画する。
  3. `isLoading === false` かつ `novels.length > 0` の場合: 作品一覧コンテナ `data-testid="novel-list"` を描画し、その配下に各作品の `NovelCard` を描画する。

---

### 3.5 `BookshelfContainer`（本棚画面 Container コンポーネント）

`useBookshelf` フックおよびルーター遷移コールバック（または Props で注入された遷移コールバック）を接続し、`BookshelfPage` を描画する Container コンポーネントです。

#### プロパティ契約（`BookshelfContainerProps`）

| プロパティ名    | 型                                                | 必須 | 説明                                                                                            |
| :-------------- | :------------------------------------------------ | :--- | :---------------------------------------------------------------------------------------------- |
| `onSelectNovel` | `(novelId: string) => void`                       | 任意 | 作品カード本体タップ時の遷移コールバック（省略時は `useRouter().navigateToNovelDetail` を使用） |
| `onResumeNovel` | `(novelId: string, chapterIndex: number) => void` | 任意 | 「続きから読む」タップ時の遷移コールバック（省略時は `useRouter().navigateToReader` を使用）    |

---

## 4. URL 作品登録パイプラインとエラーハンドリング（`useBookshelf`）

### 4.1 `useBookshelf` フック契約（`UseBookshelfResult`）

```ts
export interface UseBookshelfResult {
  novels: NovelSummary[];
  isLoading: boolean;
  isDialogOpen: boolean;
  isSubmitting: boolean;
  dialogError: string | null;
  openDialog: () => void;
  closeDialog: () => void;
  addNovelByUrl: (url: string) => Promise<boolean>;
  reloadNovels: () => Promise<void>;
}
```

### 4.2 パイプライン仕様

1. **初回ロード**:
   - `ServiceProvider` の `isReady === true` 後、`novelRepository.listNovels()` を呼び出して本棚一覧を取得する（`last_read_at DESC, created_at DESC` 順）。読み込み中は `isLoading = true` とし、完了後に `isLoading = false` とする。
2. **URL バリデーションと正規化（通信前チェック）**:
   - `addNovelByUrl(url)` 実行時、入力された URL 文字列（前後空白トリム済み）に対し、**HTTP 通信を行う前に** `parserRegistry.requireParser(trimmedUrl)` および `parser.normalizeWorkUrl(trimmedUrl)` を実行する。
   - 未対応サイトの URL や不正な URL 形式の場合は、通信を行わずに直ちに日本語エラーメッセージ（例: `対応していないURLです。カクヨムの作品URLを入力してください。`）を `dialogError` にセットし、`false` を返す。
3. **作品トップ（目次）取得と DB 保存**:
   - 正規化された作品トップ URL（`https://kakuyomu.jp/works/{workId}`）に対して `httpClient.getHtml({ url: normalizedWorkUrl })` を実行する。
   - `parser.parseNovelIndex(response.html, normalizedWorkUrl)` で作品メタデータ（タイトル・著者・あらすじ）と全エピソード目次（`chapters`）を抽出する。
   - `novelRepository.upsertNovelWithToc(novelIndex, new Date().toISOString())` を呼び出し、`novels` テーブルおよび `chapters` テーブルへ一括保存する。
   - ※登録処理を高速に完了させるため、本棚での URL 登録時点ではエピソード本文の通信取得は行わず、リーダー画面遷移時（`TR-03` 等）に未キャッシュ話をオンデマンド取得する。
4. **登録完了後の振る舞い**:
   - 保存成功後、`novelRepository.listNovels()` を再取得して本棚の `novels` ステートを最新化し、ダイアログを閉じる（`isDialogOpen = false`, `dialogError = null`）とともに `true` を返し、本棚画面（`SCR-01`）上に追加された作品カードを即時表示する。
5. **通信・パース失敗時のエラーハンドリング**:
   - `httpClient.getHtml` または `parseNovelIndex` が例外を送出した場合、ダイアログを閉じずにエラーメッセージを `dialogError` に表示し、`isSubmitting = false` に戻して `false` を返し再試行可能とする。

---

## 5. 受入条件一覧（Acceptance Criteria: `AC-BS-xx`）

| AC ID          | 対象機能                   | 検証条件                                                                                                                                                                                                                                                       | 関連要件 / 遷移                      |
| :------------- | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------- |
| **`AC-BS-01`** | 空状態表示                 | 登録作品が 0 件のとき、`bookshelf-empty` が表示され、「URLから作品を追加」ボタンから登録ダイアログを開けること。                                                                                                                                               | `SYS-REQ-01`                         |
| **`AC-BS-02`** | URL 正規化と作品・目次登録 | カクヨムの作品トップ URL またはエピソード URL を入力して登録を実行すると、`normalizeWorkUrl` で正規化された上で作品情報と全話目次が DB に保存され、ダイアログが閉じて本棚一覧に作品カードが追加されること。                                                    | `SYS-REQ-01`                         |
| **`AC-BS-03`** | 未対応 URL・通信エラー表示 | カクヨム以外の URL や不正文字列を入力した場合は HTTP 通信を行わずにエラーメッセージを表示し、通信エラー発生時もダイアログ内にエラーを表示して入力値を保持したまま再試行できること。                                                                            | `SYS-REQ-01`                         |
| **`AC-BS-04`** | 作品カード情報表示         | 登録済み作品カードにタイトル、著者名、全話数・取得済み話数（`totalChapters` / `cachedChapters`）、およびしおり位置（`bookmarkChapterIndex` または `未読`）が正確に表示されること。                                                                             | `SYS-REQ-01`, `SYS-REQ-12`           |
| **`AC-BS-05`** | 作品詳細画面への遷移       | 作品カード本体（`novel-card-select`）をタップすると、対象作品の詳細・目次画面（`/novels/:novelId`）へ遷移（`TR-02`）すること。                                                                                                                                 | `SYS-REQ-01` / `TR-02`               |
| **`AC-BS-06`** | 続きから読むワンタップ起動 | 作品カードの「続きから読む」ボタン（`novel-card-resume`）をタップすると、`bookmarkChapterIndex`（未設定時は第1話）のリーダー画面（`/novels/:novelId/chapters/:chapterIndex`）へ直接遷移（`TR-03`）し、未キャッシュ時は本文をオンデマンド取得して表示すること。 | `SYS-REQ-02`, `SYS-REQ-12` / `TR-03` |
