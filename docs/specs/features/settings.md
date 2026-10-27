---
type: spec-feature
title: 設定画面仕様書（SCR-05: Settings）
description: 小説リーダーの組版設定（縦書き/横書き、4カラーテーマ、文字サイズ、行間）の一括カスタマイズ・永続化、ルビ・傍点を含むサンプル文章プレビュー、および下部タブ・OSバックキー連携を提供する設定画面（SCR-05）の正本仕様。
status: "Review (#50)"
updated: "2026-10-27"
tags: [settings, scr-05, typography, theme, preview, bottom-nav, ui]
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/reader-view.md
  - docs/specs/changes/issue-50-fullscreen-shell-and-settings.md
related_tests:
  - src/App.test.tsx
  - src/app/router.test.tsx
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 設定画面仕様書（SCR-05）

本ドキュメントは、Yommy における組版・表示カスタマイズを提供する **設定画面（`SCR-05`: ルート `/settings`）** の画面レイアウト、Presentational / Container コンポーネント契約、ルビ・傍点を含むサンプル文章プレビュー、設定永続化パイプライン（`useSettings`）、および受入条件（`AC-ST-xx`）を定める正本（Single Source of Truth）です。

---

## 1. 概要・スコープ

- **対象画面**: 設定画面（`SCR-05`、ルートパス `/settings`）
- **対応要件**:
  - `SYS-REQ-08`（縦書き `vertical-rl` / 横書き `horizontal-tb` 切り替え）
  - `SYS-REQ-09`（文字サイズ `12〜32px`、行間 `1.4〜2.4` のカスタマイズと永続化 ※フォント種別・余白は `v0.3`）
  - `SYS-REQ-10`（4カラーテーマ `light` / `sepia` / `dark` / `black` 切り替え）
  - `SYS-REQ-16`（全画面シェル・下部タブバー・論理階層遷移：下部タブ「設定」からの直接遷移、および OS バックキーによる直前画面復帰）
- **関連画面遷移**:
  - `TR-01`（下部タブバー「設定」タップによる各画面から `SCR-05` への遷移）
  - `TR-01b`（下部タブバー「本棚」タップによる `SCR-05` から本棚画面 `SCR-01` `/` への直接遷移）
  - `TR-12`（OS バックキー操作による `SCR-05` から設定を開く直前の画面［本棚 `SCR-01` / 目次 `SCR-02` / 各話View `SCR-03`］への復帰遷移）
- **対象外スコープ（後続 Milestone）**:
  - フォント種別（`fontFamily`）の選択および画面余白（`pageMarginPx`）の設定（Milestone `v0.3`：`SYS-REQ-09` 拡張）
  - タップ送り（`enableTapPaging`）・音量キー送り（`enableVolumeKeyPaging`）のトグル設定（Milestone `v0.3`：`SYS-REQ-11` 拡張）
  - バックグラウンド DL キュー管理およびレートリミット制御（Milestone `v0.3`：`SYS-REQ-03`）
  - 全体および作品別キャッシュ使用量の可視化、既読キャッシュ一括削除（Milestone `v0.4`：`SYS-REQ-05`）
  - 設定データ・しおりのバックアップ（JSON エクスポート/インポート）（Milestone `v0.4`：`SYS-REQ-06`）

---

## 2. コンポーネント構成と責務境界

`docs/guidelines/testing.md` の親子分離原則および 1対1 Story/UT 原則に従い、`src/features/settings/` 配下を以下のモジュール構成とします。

```text
src/features/settings/
├── hooks/
│   ├── useSettings.ts                     # reader_settings 読み出し・更新・永続化フック
│   └── useSettings.test.ts                # フック単体テスト（Vitest）
└── components/
    ├── SampleTextPreview.tsx              # ルビ・傍点を含む固定小説文のリアルタイム組版プレビュー（Presentational）
    ├── SampleTextPreview.stories.tsx
    ├── SampleTextPreview.test.tsx
    ├── SettingsPage.tsx                   # 設定項目（組み方向・テーマ・文字サイズ・行間）とプレビュー枠のレイアウト統合（Presentational）
    ├── SettingsPage.stories.tsx
    ├── SettingsPage.test.tsx
    ├── SettingsContainer.tsx              # useSettings / Router を接続する Container
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

| プロパティ名          | 型                             | 必須 | 既定値  | 説明                                                   |
| :-------------------- | :----------------------------- | :--- | :------ | :----------------------------------------------------- |
| `writingMode`         | `WritingMode`                  | 必須 | -       | 現在の組み方向                                         |
| `theme`               | `ReaderTheme`                  | 必須 | -       | 現在のカラーテーマ                                     |
| `fontSizePx`          | `number`                       | 任意 | `18`    | 現在の文字サイズ (`12 〜 32` px)                       |
| `lineHeight`          | `number`                       | 任意 | `1.8`   | 現在の行間倍率 (`1.4 〜 2.4`)                          |
| `isLoading`           | `boolean`                      | 任意 | `false` | 設定読み込み中フラグ                                   |
| `onToggleWritingMode` | `() => void`                   | 必須 | -       | 組み方向切替ボタン押下時のコールバック                 |
| `onChangeTheme`       | `(theme: ReaderTheme) => void` | 必須 | -       | テーマ選択ボタン押下時のコールバック                   |
| `onChangeFontSize`    | `(nextSizePx: number) => void` | 必須 | -       | 文字サイズ変更ボタン（`−` / `＋`）押下時のコールバック |
| `onChangeLineHeight`  | `(nextHeight: number) => void` | 必須 | -       | 行間変更ボタン（`−` / `＋`）押下時のコールバック       |

#### 表示項目・セマンティック属性・境界制御ルール

- **画面ルート**: `data-testid="settings-page"`、全画面シェルの内部でスクロール可能な構造（`h-full flex flex-col overflow-y-auto`）。
- **画面ヘッダー**: `data-testid="settings-header"`（「設定」タイトル）。
- **設定セクション群**:
  1. **表示・組版設定セクション (`data-testid="typography-settings-section"`)**:
     - **組み方向切替**: `data-testid="toggle-orientation"` ボタン
       - 現在が縦書き（`vertical-rl`）のときは `横書き表示に切替`、横書き（`horizontal-tb`）のときは `縦書き表示に切替` を表示。
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

---

### 3.3 `SettingsContainer`（設定画面 Container コンポーネント）

`useSettings` フックを呼び出し、`SettingsPage` に現在設定と変更ハンドラーを注入する Container コンポーネントです。

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
  isLoading: boolean;
  error: string | null;
  toggleWritingMode: () => Promise<void>;
  changeTheme: (theme: ReaderTheme) => Promise<void>;
  changeFontSize: (fontSizePx: number) => Promise<void>;
  changeLineHeight: (lineHeight: number) => Promise<void>;
}
```

### 4.2 永続化パイプライン仕様

1. **初期ロード**:
   - `ServiceProvider` の `isReady` 完了後、`settingsRepository.getReaderSettings()` を呼び出し、保存済みの `writingMode` (既定値 `'vertical-rl'`), `theme` (既定値 `'light'`), `fontSizePx` (既定値 `18`), `lineHeight` (既定値 `1.8`) を復元する。
2. **変更の即時反映と非同期永続化**:
   - `toggleWritingMode`, `changeTheme`, `changeFontSize`（`12〜32` にクランプ）, `changeLineHeight`（`1.4〜2.4` にクランプ・小数第1位丸め）実行時は、即座に React State を更新（楽観的更新）すると同時に `settingsRepository.updateReaderSettings(patch)` を呼び出して SQLite / ローカル永続化層へ書き込む。
   - 更新された設定はリーダー画面（`SCR-03`）の `useReader` でも共有され、リーダーを開いた際に同じ設定が自動適用される。

---

## 5. 受入条件一覧（Acceptance Criteria: `AC-ST-xx`）

| AC ID          | 対象機能                             | 検証条件                                                                                                                                                                                                                       | 関連要件 / 遷移          |
| :------------- | :----------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------- |
| **`AC-ST-01`** | 設定画面表示と下部タブ連携           | 下部タブバーの「設定」タブをタップしたとき、ルート `/settings` に遷移し、「設定」タブがアクティブ表示となり、設定ヘッダー・組版設定項目・サンプルプレビューが表示されること。                                                  | `SYS-REQ-16` / `TR-01`   |
| **`AC-ST-02`** | サンプル文章プレビューと組版即時反映 | プレビュー枠内にルビ（`<ruby>`）および傍点（`<em class="bouten">`）を含む固定文章が表示され、組み方向切替・テーマ変更・文字サイズ変更・行間変更が即座にプレビュー枠のスタイルへ反映されること。                                | `SYS-REQ-07, 08, 09, 10` |
| **`AC-ST-03`** | 縦書き / 横書き切替と永続化          | `toggle-orientation` ボタンで `vertical-rl` と `horizontal-tb` を相互に切り替えられ、`reader_settings` テーブルへ永続化され、リロード後およびリーダー画面（`SCR-03`）でも同じ組み方向が維持されること。                        | `SYS-REQ-08`             |
| **`AC-ST-04`** | 4カラーテーマ切替と永続化            | `theme-{light\|sepia\|dark\|black}` ボタンでテーマを切り替えられ、選択中ボタンに `aria-pressed="true"` が設定され、プレビュー枠にテーマが反映されるとともに `reader_settings` へ永続化されること（外枠は標準UIテーマを維持）。 | `SYS-REQ-10`             |
| **`AC-ST-05`** | 文字サイズ・行間ステッパー境界制御   | 文字サイズ（`12〜32px`、`±2px` 刻み）および行間（`1.4〜2.4`、`±0.2` 刻み）の `−` / `＋` ボタンで値が変更でき、上限・下限で各ボタンが `disabled` となり、プレビュー枠および `reader_settings` へ即時反映されること。            | `SYS-REQ-09`             |
| **`AC-ST-06`** | OS バックキーによる直前画面復帰      | 設定画面（`/settings`）で OS バックキー（ブラウザ戻る操作）を実行したとき、設定を開く直前の画面（本棚 `/`、目次 `/novels/:novelId`、リーダー `/novels/:novelId/chapters/:chapterIndex`）へ正しく復帰すること。                 | `SYS-REQ-16` / `TR-12`   |
