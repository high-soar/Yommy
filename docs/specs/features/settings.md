---
type: spec-feature
title: "設定画面仕様書（SCR-05: Settings）"
description: 小説リーダーの組版設定（縦書き/横書き、ページ送りモード、4カラーテーマ、文字サイズ、行間）の一括カスタマイズ・永続化、ルビ・傍点を含むサンプル文章プレビュー、および下部タブ・OSバックキー連携を提供する設定画面（SCR-05）の正本仕様。
status: "Review (#122)"
updated: "2026-10-31"
tags:
  [
    settings,
    scr-05,
    typography,
    theme,
    preview,
    bottom-nav,
    ui,
    cloud-sync,
    google-drive,
    paging,
  ]
related_specs:
  - docs/specs/changes/issue-122-reader-page-turning.md
  - docs/specs/changes/issue-120-cloud-sync-google-drive.md
  - docs/specs/changes/archive/issue-124-settings-back-button-navigation.md
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/search.md
  - docs/specs/features/ranking.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/reader-view.md
  - docs/specs/changes/archive/issue-78-apk-signing-and-back-button.md
  - docs/specs/changes/archive/issue-79-four-tabs-search-ranking.md
  - docs/specs/changes/archive/issue-50-fullscreen-shell-and-settings.md
related_tests:
  - src/App.test.tsx
  - src/app/router.test.tsx
  - src/features/settings/hooks/useSettings.test.tsx
  - src/features/settings/components/SampleTextPreview.test.tsx
  - src/features/settings/components/SettingsPage.test.tsx
  - src/features/settings/components/SettingsContainer.test.tsx
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 設定画面仕様書（SCR-05）

本ドキュメントは、Yommy における組版・表示カスタマイズを提供する **設定画面（`SCR-05`: ルート `/settings`）** の画面レイアウト、Presentational / Container コンポーネント契約、ルビ・傍点を含むサンプル文章プレビュー、設定永続化パイプライン（`useSettings`）、および受入条件（`AC-ST-xx`）を定める正本（Single Source of Truth）です。

---

## 1. 概要・スコープ

- **対象画面**: 設定画面（`SCR-05`、ルートパス `/settings`）
- **対応要件**:
  - `SYS-REQ-06`（Google Drive appDataFolder による本棚・しおり・既読のクラウド同期・マージ、手動即時同期、アカウント連携/解除）
  - `SYS-REQ-07`（ルビ・傍点の正確な描画：サンプル文章プレビュー枠内でのルビ・傍点レンダリング）
  - `SYS-REQ-08`（縦書き `vertical-rl` / 横書き `horizontal-tb` 切り替え）
  - `SYS-REQ-09`（文字サイズ `12〜32px`、行間 `1.4〜2.4` のカスタマイズと永続化 ※フォント種別・余白は `v0.4`）
  - `SYS-REQ-10`（4カラーテーマ `light` / `sepia` / `dark` / `black` 切り替え）
  - `SYS-REQ-11`（ページ送りモード［自動/ページめくり/スクロール］の選択と永続化、v0.4 Issue #122）
  - `SYS-REQ-16`（全画面シェル・下部タブバー・論理階層遷移：下部タブ「設定」からの直接遷移、および OS バックキーによるホーム「本棚 `/`」への復帰）
  - `SYS-REQ-20`（下部4タブナビゲーションおよびOSバックキー論理階層遷移）
- **関連画面遷移**:
  - `TR-01`（下部タブバー「設定」タップによる各画面から `SCR-05` への遷移）
  - `TR-01b`（下部タブバー「本棚」タップによる `SCR-05` から本棚画面 `SCR-01` `/` への直接遷移）
  - `TR-12`（設定画面（`/settings`）で OS バックキーを実行したとき、直前の画面（リーダー `SCR-03`、作品詳細 `SCR-02`）またはホームの本棚画面（`SCR-01`）へ復帰すること）
- **対象外スコープ（後続 Milestone）**:
  - フォント種別（`fontFamily`）の選択および画面余白（`pageMarginPx`）の設定（Milestone `v0.4`：`SYS-REQ-09` 拡張）
  - ハードウェア音量キー送り（`enableVolumeKeyPaging`）のトグル設定（Milestone `v0.4`：`SYS-REQ-11` 拡張、本Issueでは対象外）
  - 全体および作品別キャッシュ使用量の可視化、既読キャッシュ一括削除（Milestone `v0.4`：`SYS-REQ-05`）

---

## 2. コンポーネント構成と責務境界

`docs/guidelines/testing.md` の親子分離原則および 1対1 Story/UT 原則に従い、`src/features/settings/` 配下を以下のモジュール構成とします。

```text
src/features/settings/
├── hooks/
│   ├── useSettings.ts                     # reader_settings 読み出し・更新・永続化フック
│   ├── useSettings.test.tsx               # フック単体テスト（Vitest）
│   ├── useCloudSync.ts                    # Google Drive クラウド同期状態管理・操作フック（v0.4）
│   └── useCloudSync.test.ts               # クラウド同期フック単体テスト（Vitest）
└── components/
    ├── SampleTextPreview.tsx              # ルビ・傍点を含む固定小説文のリアルタイム組版プレビュー（Presentational）
    ├── SampleTextPreview.stories.tsx
    ├── SampleTextPreview.test.tsx
    ├── CloudSyncSection.tsx               # Google Drive クラウド同期カード（連携・解除・即時同期・状態表示）（Presentational, v0.4）
    ├── CloudSyncSection.stories.tsx
    ├── CloudSyncSection.test.tsx
    ├── SettingsPage.tsx                   # 設定項目（組版・プレビュー・クラウド同期）のレイアウト統合（Presentational）
    ├── SettingsPage.stories.tsx
    ├── SettingsPage.test.tsx
    ├── SettingsContainer.tsx              # useSettings / useCloudSync / Router を接続する Container
    ├── SettingsContainer.stories.tsx
    └── SettingsContainer.test.tsx
```

---

## 3. 各コンポーネント・フックの詳細契約

### 3.1 `SampleTextPreview`（サンプル文章プレビュー枠）

設定項目（組み方向・テーマ・文字サイズ・行間）の変更を即時反映し、読書時の見え方を事前に確認できる Presentational コンポーネントです。

#### プロパティ契約（`SampleTextPreviewProps`）

| プロパティ名  | 型            | 必須 | 既定値 | 説明                                                              |
| :------------ | :------------ | :--- | :----- | :---------------------------------------------------------------- |
| `writingMode` | `WritingMode` | 必須 | -      | 組み方向（`'vertical-rl'` または `'horizontal-tb'`）              |
| `theme`       | `ReaderTheme` | 必須 | -      | プレビュー枠内のカラーテーマ（`light`, `sepia`, `dark`, `black`） |
| `fontSizePx`  | `number`      | 必須 | -      | 文字サイズ (`12 〜 32` px)                                        |
| `lineHeight`  | `number`      | 必須 | -      | 行間倍率 (`1.4 〜 2.4`)                                           |

#### サンプル文章内容とセマンティック属性

- **ルート要素**: `data-testid="sample-text-preview"`
  - `data-writing-mode`: 現在の組み方向（`"vertical-rl"` または `"horizontal-tb"`）
  - `data-theme`: 現在のカラーテーマ（`"light"`, `"sepia"`, `"dark"`, `"black"`）
  - `data-font-size`: 現在の文字サイズ数値（`String(fontSizePx)`）
  - `data-line-height`: 現在の行間倍率（`String(lineHeight)`）
- **サンプル文章固定テキスト**:
  本文リーダー画面（`SCR-03`）と同じく、ルビ（`<ruby>`）および傍点（`<em class="bouten">`）を含む以下の固定テキストをサニタイズ描画する：
  ```html
  <p>
    吾輩は<ruby>猫<rp>（</rp><rt>ねこ</rt><rp>）</rp></ruby
    >である。名前はまだ無い。
  </p>
  <p>
    どこで生れたかとんと<em class="bouten">見当</em
    >がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。
  </p>
  ```
- **スタイル規約**:
  - 外枠は丸角カード（`rounded-xl border shadow-xs`）、固定の高さ・幅（例: `h-64 w-full`）を保ち、テキストが溢れた場合は枠内スクロール（縦書き時は水平スクロール、横書き時は垂直スクロール）とする。
  - 背景色・文字色・フォント設定は渡された `theme`, `writingMode`, `fontSizePx`, `lineHeight` をプレビュー枠の内側にのみ適用し、設定画面自体の外枠・ヘッダー・タブバーは標準 UI テーマ（`bg-slate-50 dark:bg-slate-900`）を維持する。

---

### 3.2 `SettingsPage`（設定画面 Presentational コンポーネント）

画面上部ヘッダー、組版設定 4 項目（組み方向切替、4カラーテーマ選択、文字サイズステッパー、行間ステッパー）、および `SampleTextPreview` を統合する画面レイアウトコンポーネントです。

#### プロパティ契約（`SettingsPageProps`）

| プロパティ名            | 型                                 | 必須 | 既定値                   | 説明                                                                       |
| :---------------------- | :--------------------------------- | :--- | :----------------------- | :------------------------------------------------------------------------- |
| `writingMode`           | `WritingMode`                      | 必須 | -                        | 現在の組み方向                                                             |
| `theme`                 | `ReaderTheme`                      | 必須 | -                        | 現在のカラーテーマ                                                         |
| `fontSizePx`            | `number`                           | 任意 | `18`                     | 現在の文字サイズ (`12 〜 32` px)                                           |
| `lineHeight`            | `number`                           | 任意 | `1.8`                    | 現在の行間倍率 (`1.4 〜 2.4`)                                              |
| `pagingMode`            | `ReaderPagingMode`                 | 任意 | `'auto'`                 | 現在のページ送りモード（`'auto'`, `'paged'`, `'scroll'`、v0.4 Issue #122） |
| `isLoading`             | `boolean`                          | 任意 | `false`                  | 設定読み込み中フラグ                                                       |
| `error`                 | `string \| null`                   | 任意 | `null`                   | 設定保存・読込エラーメッセージ                                             |
| `cloudSyncAuthState`    | `CloudSyncAuthState`               | 任意 | `{ status: 'unlinked' }` | Google アカウント認証状態（v0.4）                                          |
| `cloudSyncLastSyncedAt` | `string \| null`                   | 任意 | `null`                   | 最終同期完了日時（ISO 8601、v0.4）                                         |
| `isCloudSyncing`        | `boolean`                          | 任意 | `false`                  | クラウド同期処理中フラグ（v0.4）                                           |
| `cloudSyncError`        | `string \| null`                   | 任意 | `null`                   | クラウド同期エラーメッセージ（v0.4）                                       |
| `onToggleWritingMode`   | `() => void`                       | 必須 | -                        | 組み方向切替ボタン押下時のコールバック                                     |
| `onChangePagingMode`    | `(mode: ReaderPagingMode) => void` | 任意 | -                        | ページ送りモード変更時のコールバック（v0.4 Issue #122）                    |
| `onChangeTheme`         | `(theme: ReaderTheme) => void`     | 必須 | -                        | テーマ選択ボタン押下時のコールバック                                       |
| `onChangeFontSize`      | `(nextSizePx: number) => void`     | 必須 | -                        | 文字サイズ変更ボタン（`−` / `＋`）押下時のコールバック                     |
| `onChangeLineHeight`    | `(nextHeight: number) => void`     | 必須 | -                        | 行間変更ボタン（`−` / `＋`）押下時のコールバック                           |
| `onSignInGoogle`        | `() => Promise<void>`              | 任意 | -                        | Google 連携ボタン押下時のコールバック（v0.4）                              |
| `onSignOutGoogle`       | `() => Promise<void>`              | 任意 | -                        | Google 連携解除ボタン押下時のコールバック（v0.4）                          |
| `onSyncNow`             | `() => Promise<void>`              | 任意 | -                        | 今すぐ同期ボタン押下時のコールバック（v0.4）                               |

#### 表示項目・セマンティック属性・境界制御ルール

- **画面ルート**: `data-testid="settings-page"`、全画面シェルの内部でスクロール可能な構造（`h-full flex flex-col overflow-y-auto`）。
- **画面ヘッダー**: `data-testid="settings-header"`（「設定」タイトル）。
- **エラー通知枠**: `error` が指定されている場合、ヘッダー直下に `role="alert"`（`data-testid="settings-error-alert"`）を表示し、保存失敗の旨を明示する。
- **設定セクション群**:
  1. **表示・組版設定セクション (`data-testid="typography-settings-section"`)**:
     - **組み方向切替**: `data-testid="toggle-orientation"` ボタン
       - 現在が縦書き（`vertical-rl`）のときは `横書き表示に切替`、横書き（`horizontal-tb`）のときは `縦書き表示に切替` を表示。
     - **ページ送りモード切替 (`data-testid="paging-mode-select"`, v0.4 Issue #122)**:
       - 選択肢: 「自動（縦書き: めくり / 横書き: スクロール）」（`auto`）、「ページめくり」（`paged`）、「連続スクロール」（`scroll`）。
       - 選択変更時に `onChangePagingMode(mode)` を呼び出し、即座に State 更新および `reader_settings` へ非同期永続化。
     - **カラーテーマ選択**: `data-testid="theme-{light|sepia|dark|black}"` ボタングループ
       - 各テーマボタン（ライト、セピア、ダーク、ブラック）。選択中のボタンには `aria-pressed="true"` を設定。
     - **文字サイズステッパー (`12px 〜 32px`、`±2px` 刻み)**:
       - 縮小ボタン: `data-testid="font-size-decrease"`（クリック時に `onChangeFontSize(Math.max(12, fontSizePx - 2))` を呼び出す。`fontSizePx <= 12` で `disabled`）。
       - 現在値表示: `data-testid="font-size-value"`（`{fontSizePx}px` を表示）。
       - 拡大ボタン: `data-testid="font-size-increase"`（クリック時に `onChangeFontSize(Math.min(32, fontSizePx + 2))` を呼び出す。`fontSizePx >= 32` で `disabled`）。
     - **行間ステッパー (`1.4 〜 2.4`、`±0.2` 刻み)**:
       - 縮小ボタン: `data-testid="line-height-decrease"`（クリック時に `onChangeLineHeight(Math.max(1.4, Math.round((lineHeight - 0.2) * 10) / 10))` を呼び出す。`lineHeight <= 1.4` で `disabled`）。
       - 現在値表示: `data-testid="line-height-value"`（`{lineHeight.toFixed(1)}` を表示）。
       - 拡大ボタン: `data-testid="line-height-increase"`（クリック時に `onChangeLineHeight(Math.min(2.4, Math.round((lineHeight + 0.2) * 10) / 10))` を呼び出す。`lineHeight >= 2.4` で `disabled`）。
  2. **プレビューセクション (`data-testid="preview-section"`)**:
     - セクション見出し「組版プレビュー」
     - `SampleTextPreview` コンポーネントを配置。
  3. **クラウド同期セクション (`data-testid="cloud-sync-section"`, v0.4)**:
     - セクション見出し「クラウド同期 (Google Drive)」
     - `CloudSyncSection` コンポーネントを配置。

---

### 3.3 `CloudSyncSection`（Google Drive クラウド同期 Presentational コンポーネント: v0.4）

Google Drive（`appDataFolder`）とのアカウント連携・解除、手動即時同期、および最終同期日時の表示を提供する Presentational コンポーネントです。

#### プロパティ契約（`CloudSyncSectionProps`）

| プロパティ名   | 型                    | 必須 | 既定値  | 説明                                                                     |
| :------------- | :-------------------- | :--- | :------ | :----------------------------------------------------------------------- |
| `authState`    | `CloudSyncAuthState`  | 必須 | -       | 現在の認証連携状態（`unlinked`, `authenticating`, `connected`, `error`） |
| `lastSyncedAt` | `string \| null`      | 必須 | -       | 最終同期日時（ISO 8601 文字列、未同期は `null`）                         |
| `isSyncing`    | `boolean`             | 必須 | `false` | 同期通信処理中フラグ                                                     |
| `error`        | `string \| null`      | 任意 | `null`  | 同期または認証エラーメッセージ                                           |
| `onSignIn`     | `() => Promise<void>` | 必須 | -       | 「Google アカウントと連携」ボタン押下時のコールバック                    |
| `onSignOut`    | `() => Promise<void>` | 必須 | -       | 「連携解除」確認ダイアログ承認時のコールバック                           |
| `onSyncNow`    | `() => Promise<void>` | 必須 | -       | 「今すぐ同期」ボタン押下時のコールバック                                 |

#### 表示項目・セマンティック属性

- **セクションルート**: `data-testid="cloud-sync-section"`
- **セクションタイトル**: 「クラウド同期 (Google Drive)」
- **説明文**: 「Google Drive のアプリ専用領域に本棚・しおりを自動保存し、複数端末間で共有します。」
- **状態表示 (`data-testid="cloud-sync-status"`)**:
  - `status === 'unlinked'`: 「未連携（端末内保存のみ）」
  - `status === 'authenticating'`: 「Google 認証中...」
  - `status === 'connected'`: 「連携中 (`${authState.email}`)」
  - `status === 'error'`: 「認証エラー」
- **最終同期日時 (`data-testid="cloud-sync-last-synced-at"`)**:
  - `lastSyncedAt` がある場合: 「最終同期: YYYY/MM/DD HH:mm:ss」
  - 未同期の場合: 「最終同期: 未同期」
- **エラー警告枠 (`data-testid="cloud-sync-error-alert"`)**: `error` が存在する場合、`role="alert"` でエラーメッセージを表示。
- **アクションボタン群**:
  - 未連携時: `data-testid="cloud-sync-auth-button"`「Google アカウントと連携」
  - 連携中:
    - `data-testid="cloud-sync-now-button"`「今すぐ同期」（`isSyncing` 時は disabled 化しスピナーまたは「同期中...」表示）
    - `data-testid="cloud-sync-disconnect-button"`「連携解除」（押下時に `data-testid="cloud-sync-disconnect-dialog"` 確認ダイアログを表示し、ユーザー承認時に `onSignOut` を実行）

---

### 3.4 `SettingsContainer`（設定画面 Container コンポーネント）

`useSettings` および `useCloudSync` フックを呼び出し、`SettingsPage` に現在設定、クラウド同期状態、および各種操作ハンドラーを注入する Container コンポーネントです。

#### プロパティ契約（`SettingsContainerProps`）

```ts
export interface SettingsContainerProps {
  /** テスト用または単体表示用のカスタムクラス（任意） */
  className?: string;
}
```

---

## 4. 状態管理・設定永続化パイプライン（`useSettings`）

### 4.1 `useSettings` フック契約（`UseSettingsResult`）

```ts
export interface UseSettingsResult {
  writingMode: WritingMode;
  theme: ReaderTheme;
  fontSizePx: number;
  lineHeight: number;
  pagingMode: ReaderPagingMode; // 【新設: v0.4 Issue #122】
  isLoading: boolean;
  error: string | null;
  toggleWritingMode: () => Promise<void>;
  changeTheme: (theme: ReaderTheme) => Promise<void>;
  changeFontSize: (fontSizePx: number) => Promise<void>;
  changeLineHeight: (lineHeight: number) => Promise<void>;
  changePagingMode: (pagingMode: ReaderPagingMode) => Promise<void>; // 【新設: v0.4 Issue #122】
}
```

### 4.2 永続化パイプライン仕様

1. **初期ロード**:
   - `ServiceProvider` の `isReady` 完了後、`settingsRepository.getReaderSettings()` を呼び出し、保存済みの `writingMode` (既定値 `'vertical-rl'`), `theme` (既定値 `'light'`), `fontSizePx` (既定値 `18`), `lineHeight` (既定値 `1.8`), `pagingMode` (既定値 `'auto'`) を復元する。
2. **変更の即時反映と非同期永続化**:
   - `toggleWritingMode`, `changeTheme`, `changeFontSize`（`12〜32` にクランプ）, `changeLineHeight`（`1.4〜2.4` にクランプ・小数第1位丸め）, `changePagingMode`（`'auto' | 'paged' | 'scroll'`）実行時は、即座に React State を更新（楽観的更新）すると同時に `settingsRepository.updateReaderSettings(patch)` を呼び出して SQLite / ローカル永続化層へ書き込む。
   - 万一 `updateReaderSettings` が失敗（reject）した場合、直前の設定値に State をロールバックし、`error` を設定して画面上（`SettingsPage` ヘッダー直下）に `role="alert"`（`data-testid="settings-error-alert"`）でエラーメッセージを表示する。
   - 正常に更新された設定はリーダー画面（`SCR-03`）の `useReader` でも共有され、リーダーを開いた際に同じ設定が自動適用される。

### 4.3 `useCloudSync` フック契約・同期パイプライン（v0.4 新設: Issue #120）

```ts
export interface UseCloudSyncResult {
  authState: CloudSyncAuthState;
  lastSyncedAt: string | null;
  isSyncing: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}
```

1. **初期化パイプライン**:
   - `ServiceProvider` から `CloudSyncBridge`、`SyncEngine`、`AppSettingsRepository` を取得。
   - `appSettingsRepository.getSetting('cloud_sync_last_synced_at')` より保存済みの最終同期日時を復元。
   - `cloudSyncBridge.getAuthState()` を呼び出し、現在の接続状態（`unlinked` / `connected`）を初期化。
2. **アカウント連携 (`signIn`)**:
   - `cloudSyncBridge.signIn()` を呼び出す。成功時に `authState` を `connected` に更新し、その場で初回の Pull → Merge → Push 同期を自動実行する。
3. **連携解除 (`signOut`)**:
   - 確認ダイアログで承認後、`cloudSyncBridge.signOut()` を実行し、OS トークンキャッシュ破棄および Google サーバーへの Revoke を実行する。
   - ローカル DB（`novels`, `chapters`）は一切削除せず安全に保持する。
   - `authState` を `unlinked` にリセットし、`lastSyncedAt` 設定をクリアする。
4. **手動即時同期 (`syncNow`)**:
   - `isSyncing = true` を設定し、`syncEngine.sync()`（Pull → マージ → Push）を実行する。
   - 完了時に `cloud_sync_last_synced_at` を現在時刻で `app_settings` へ更新し、`isSyncing = false` とする。
   - 失敗時は直前の状態を維持し、`error` をセットして画面上に通知する。

---

## 5. 受入条件一覧（Acceptance Criteria: `AC-ST-xx`）

| AC ID          | 対象機能                                                    | 検証条件                                                                                                                                                                                                                                                                                               | 関連要件 / 遷移                |
| :------------- | :---------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------- |
| **`AC-ST-01`** | 設定画面表示と下部タブ連携                                  | 下部タブバーの「設定」タブをタップしたとき、ルート `/settings` に遷移（`TR-01`）し、「設定」タブがアクティブ表示となり、設定ヘッダー・組版設定項目・サンプルプレビューが表示されること。また、下部タブバーの「本棚」タブをタップしたときは本棚画面（`/`）へ直接復帰（`TR-01b`）すること。              | `SYS-REQ-16` / `TR-01, TR-01b` |
| **`AC-ST-02`** | サンプル文章プレビューと組版即時反映                        | プレビュー枠内にルビ（`<ruby>`）および傍点（`<em class="bouten">`）を含む固定文章が表示され、組み方向切替・テーマ変更・文字サイズ変更・行間変更が即座にプレビュー枠のスタイルへ反映されること。                                                                                                        | `SYS-REQ-07, 08, 09, 10`       |
| **`AC-ST-03`** | 縦書き / 横書き切替と永続化                                 | `toggle-orientation` ボタンで `vertical-rl` と `horizontal-tb` を相互に切り替えられ、`reader_settings` テーブルへ永続化され、リロード後およびリーダー画面（`SCR-03`）でも同じ組み方向が維持されること。                                                                                                | `SYS-REQ-08`                   |
| **`AC-ST-04`** | 4カラーテーマ切替と永続化                                   | `theme-{light\|sepia\|dark\|black}` ボタンでテーマを切り替えられ、選択中ボタンに `aria-pressed="true"` が設定され、プレビュー枠にテーマが反映されるとともに `reader_settings` へ永続化されること（外枠は標準UIテーマを維持）。                                                                         | `SYS-REQ-10`                   |
| **`AC-ST-05`** | 文字サイズ・行間ステッパー境界制御                          | 文字サイズ（`12〜32px`、`±2px` 刻み）および行間（`1.4〜2.4`、`±0.2` 刻み）の `−` / `＋` ボタンで値が変更でき、上限・下限で各ボタンが `disabled` となり、プレビュー枠および `reader_settings` へ即時反映されること。                                                                                    | `SYS-REQ-09`                   |
| **`AC-ST-06`** | OS バックキーによる直前画面（リーダー・作品詳細・本棚）復帰 | 設定画面（`/settings`）で OS バックキー（`AppBridge` またはブラウザ戻る操作）を実行したとき、直前の画面がリーダー画面（`SCR-03`）または作品詳細画面（`SCR-02`）であればその直前画面へ復帰し、下部タブからの直接遷移時または履歴なしの場合はホームである本棚画面（`SCR-01`: `/`）へ正しく復帰すること。 | `SYS-REQ-16, 20` / `TR-12`     |
| **`AC-ST-07`** | 設定保存失敗時のロールバックとエラー通知                    | 設定変更（組み方向・テーマ・文字サイズ・行間）の永続化処理が失敗した場合、直前の値へ状態が自動ロールバックされ、画面上部ヘッダー直下に `role="alert"`（`data-testid="settings-error-alert"`）でエラーメッセージが表示されること。                                                                      | `SYS-REQ-08, 09, 10`           |
| **`AC-ST-08`** | Google アカウント連携と状態表示                             | 設定画面のクラウド同期セクションで「Google アカウントと連携」を押下したとき、Google 認可フローが起動し、成功時に連携中表示（メールアドレス表示）および初回の自動同期（Pull → マージ → Push）が行われること。                                                                                           | `SYS-REQ-06` / `TR-01`         |
| **`AC-ST-09`** | 「今すぐ同期」による手動即時同期                            | 連携中状態で「今すぐ同期」ボタンを押下したとき、即座に Pull → マージ → Push が実行され、処理中はボタンが disabled となり、成功時に最終同期日時が更新されること。                                                                                                                                       | `SYS-REQ-06`                   |
| **`AC-ST-10`** | 連携解除確認と Revoke・ローカル保持                         | 「連携解除」ボタン押下時に確認ダイアログが表示され、確定時に Google サーバーへの Revoke および OS トークン破棄が実行され、未連携状態に戻ること（端末内の登録作品・しおりデータは消去されず安全に保持されること）。                                                                                     | `SYS-REQ-06`                   |
| **`AC-ST-11`** | 遠隔認可解除（401）検知時の未連携フォールバック             | Google アカウント管理から遠隔で権限が取り消された場合、次回通信時の 401 Unauthorized を検知して自動的に安全な未連携状態へ遷移し、セクション内にエラー通知が表示されること。                                                                                                                            | `SYS-REQ-06`                   |
| **`AC-ST-12`** | クライアントID未設定時の安全なフォールバック                | `VITE_GOOGLE_CLIENT_ID` が未設定または空文字の場合、アプリや画面がクラッシュすることなく、連携ボタンが disabled 化されるか安全なモックモードとして振る舞うこと。                                                                                                                                       | `SYS-REQ-06`                   |
| **`AC-ST-13`** | ページ送りモード切替と永続化                                | ページ送りモードセレクター（`paging-mode-select`）で「自動 / ページめくり / 連続スクロール」を切り替えられ、`reader_settings` テーブルへ永続化され、リロード後およびリーダー画面（`SCR-03`）でも設定が維持・反映されること。                                                                           | `SYS-REQ-11`                   |
