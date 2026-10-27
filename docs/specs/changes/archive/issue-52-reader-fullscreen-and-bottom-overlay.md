---
type: spec-delta
title: 小説リーダー画面（SCR-03）の全画面テキスト表示化と下部オーバーレイ（前後話ナビ＋下部タブ）の実装
description: Issue #52 に対する差分仕様。小説リーダー画面（SCR-03）の全画面テキスト表示化（外枠余白・枠線・常時表示バー撤廃、100dvh化）、画面最下部タッチによる下部オーバーレイ（ReaderBottomOverlay: 前後話ナビ＋下部タブ）のスライドイン表示制御、スクロール・再タップ・話移動時の自動非表示、エラー・空状態時の初期表示、OSバックキー・下部タブ遷移時のしおり自動保存、テスト計画、およびSub-issue分割計画。
issue: "#52"
status: "Completed (Archived)"
updated: "2026-10-28"
tags:
  - delta
  - reader
  - scr-03
  - fullscreen
  - bottom-overlay
  - chapter-nav
  - bottom-tab
  - bookmark
  - touch
related_specs:
  - docs/specs/features/reader-view.md
  - docs/specs/screen-transitions.md
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/changes/archive/issue-14-reader-navigation-bookmark-settings.md
related_tests:
  - src/App.test.tsx
  - src/features/reader/hooks/useReader.test.ts
  - src/features/reader/components/ReaderChapterNav.test.tsx
  - src/features/reader/components/ReaderBottomOverlay.test.tsx
  - src/features/reader/components/ReaderView.test.tsx
  - src/features/reader/components/ReaderPage.test.tsx
  - src/features/reader/components/ReaderContainer.test.tsx
  - test/vrt/vrt.spec.ts
  - test/it/smoke.spec.ts
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 差分仕様書：小説リーダー画面（SCR-03）の全画面テキスト表示化と下部オーバーレイ（前後話ナビ＋下部タブ）の実装（Issue #52）

## 1. 変更の背景・目的（Why）

- Milestone `v0.1` の小説リーダー画面（`SCR-03`）では、上部ツールバー（`ReaderToolbar`）、前後話ナビゲーションバー（`ReaderChapterNav`）、および外側パディング（`p-3 md:p-6`）やカード枠線・影（`rounded-lg border shadow-sm`）が常時表示されていたため、小説本文の表示エリアが `70vh` 程度に圧迫されていた。
- 読書中の没入感とテキスト表示面積を最大化するため、外側の余白・枠線・常時表示バーをすべて撤廃し、画面全体（`100dvh`）を小説テキスト表示エリアとする。
- 一方で読書中の話数確認・前後話遷移や本棚・設定への移動導線を担保するため、**画面最下部ゾーンをタップしたときのみ下からスライドインする下部オーバーレイ（`ReaderBottomOverlay`：前後話ナビ ＋ 下部タブバー）** を新設する。
- スクロール操作を邪魔しないタップ判定、本文スクロールや領域外再タップ時の自動非表示、エラー・空状態時の初期表示、および画面離脱時（OSバックキー・下部タブ遷移）のしおり自動保存を整備し、極限の没入感と直感的な操作性を両立する。

---

## 2. 仕様・設計の差分（What Changes）

### 2.1 全画面テキスト表示化（外枠装飾・余白・常時表示バー撤廃）

1. **`ReaderPage` のレイアウト刷新**:
   - 常時表示されていた上部ツールバー（`ReaderToolbar` は Issue #50 で廃止・設定画面へ移設）および常時表示の `ReaderChapterNav` を画面上から撤廃する。
   - ルート要素および外枠コンテナのパディング（`p-3 md:p-6`）を撤廃し、画面高さ（`h-dvh` / `100dvh`）・全幅（`w-full`）をフルに使った全画面構成とする。
2. **`ReaderView` のカード枠線・高さ制限撤廃**:
   - カード装飾（`rounded-lg border shadow-sm`）を撤廃する。
   - 高さ制限（`h-[70vh] / max-h-[70vh]`）を撤廃し、親コンテナいっぱいに広がる `h-full w-full`（縦書き時は横スクロール `overflow-x-auto overflow-y-hidden`、横書き時は縦スクロール `overflow-y-auto overflow-x-hidden`）とする。

### 2.2 最下部タッチによる下部オーバーレイ（`ReaderBottomOverlay`）の表示・非表示制御

1. **`ReaderBottomOverlay`（下部オーバーレイ）の新設**:
   - 画面下端に固定配置（`fixed bottom-0 left-0 right-0 z-40`）され、下からスライドイン（`translate-y-0` ⇄ `translate-y-full`）するオーバーレイコンポーネント。
   - 2段構成とし、上段に「前後話ナビゲーション（前の話へ / 第N話インジケーター / 次の話へ）」、下段に「下部タブバー（本棚 / 設定、アクティブタブ: 本棚）」を一体化して描画する。
2. **最下部タッチゾーンのタップ判定**:
   - 画面最下部（下端から約 72px または画面高さの 15% の領域）に透明なタッチ検知領域を設けるか、画面下部へのタップイベントを検知する。
   - **スクロール操作との誤判定防止**: `pointerdown` から `pointerup` までの移動量（`Math.hypot(dx, dy)`）が閾値（10px未満）かつ短時間（500ms未満）のタップ操作のみでオーバーレイの開閉をトリガーし、本文スクロールのためのスワイプ・ドラッグ操作ではオーバーレイが開かないように制御する。
3. **自動非表示（Auto-Hide）トリガー**:
   - 以下のいずれかが発生した際、オーバーレイを自動的に隠す（`isOpen = false`）：
     - ① 本文エリアのスクロール操作（`onScroll`）
     - ② オーバーレイ外（本文エリア）の再タップ
     - ③ 前後話への遷移実行（「前の話へ」「次の話へ」押下）
4. **エラー表示・空状態時の初期表示ルール**:
   - エラー表示（`reader-error`）や空状態（`reader-empty`）のときは、本文が存在せずスクロールも行われないため、OSバックキーだけでなく画面上から直ちに本棚や設定へ戻れるよう、**初期状態で下部オーバーレイを表示状態（`isOpen = true`）とする**（最下部タッチゾーンのタップによる開閉も可能）。

### 2.3 OSバックキーおよび下部タブ遷移時のしおり自動保存（`flushBookmark`）

- 読者が本文閲覧中に、下部オーバーレイの「本棚」タブや「設定」タブをタップして別画面へ遷移する場合、および Android OS バックキー（ブラウザ戻る操作）で目次画面（`SCR-02`）へ戻る場合、現在のスクロール進捗率（`flushBookmark`）を確実に SQLite DB へ保存してから画面遷移を行う。

---

## 3. コンポーネント構成と契約の差分

### 3.1 モジュール構成

```text
src/features/reader/
├── hooks/
│   ├── useReader.ts
│   └── useReader.test.ts
└── components/
    ├── ReaderBottomOverlay.tsx            # 【新設】前後話ナビ＋下部タブを統合したスライドインオーバーレイ（Presentational）
    ├── ReaderBottomOverlay.stories.tsx    # 【新設】Storybookストーリー
    ├── ReaderBottomOverlay.test.tsx       # 【新設】単体テスト（Portable Stories）
    ├── ReaderChapterNav.tsx               # 前後話ナビゲーション（Presentational、オーバーレイ内部で再利用）
    ├── ReaderChapterNav.stories.tsx
    ├── ReaderChapterNav.test.tsx
    ├── ReaderView.tsx                     # 【改修】全画面テキスト組版（枠線・70vh撤廃、h-full w-full）
    ├── ReaderView.stories.tsx
    ├── ReaderView.test.tsx
    ├── ReaderPage.tsx                     # 【改修】全画面レイアウト、最下部タッチ検知、オーバーレイ開閉・自動非表示制御
    ├── ReaderPage.stories.tsx
    ├── ReaderPage.test.tsx
    ├── ReaderContainer.tsx                # 【改修】下部タブ遷移時・OSバックキー時のしおり保存（flushBookmark）接続
    ├── ReaderContainer.stories.tsx
    ├── ReaderContainer.test.tsx
    ├── ReaderToolbar.tsx                  # （Issue #50 で廃止・設定画面 SCR-05 へ移設）
    ├── ReaderToolbar.stories.tsx
    └── ReaderToolbar.test.tsx
```

### 3.2 `ReaderBottomOverlay` のプロパティ契約（`ReaderBottomOverlayProps`）

| プロパティ名    | 型                                         | 必須 | 既定値        | 説明                                                                        |
| :-------------- | :----------------------------------------- | :--- | :------------ | :-------------------------------------------------------------------------- |
| `isOpen`        | `boolean`                                  | 必須 | -             | オーバーレイの表示状態（`true` でスライドイン表示、`false` で画面外へ退避） |
| `chapterIndex`  | `number`                                   | 必須 | -             | 現在表示中のエピソード連番（1始まり）                                       |
| `totalChapters` | `number`                                   | 必須 | -             | 作品の全エピソード数                                                        |
| `isLoading`     | `boolean`                                  | 任意 | `false`       | エピソード通信中フラグ                                                      |
| `activeTab`     | `'bookshelf' \| 'settings'`                | 任意 | `'bookshelf'` | リーダー画面の論理所属タブ（常に `'bookshelf'` をアクティブ表示）           |
| `onPrevChapter` | `() => void`                               | 必須 | -             | 「前の話へ」押下時のコールバック                                            |
| `onNextChapter` | `() => void`                               | 必須 | -             | 「次の話へ」押下時のコールバック                                            |
| `onSelectTab`   | `(tab: 'bookshelf' \| 'settings') => void` | 任意 | -             | 下部タブ（本棚 / 設定）押下時のコールバック                                 |
| `onClose`       | `() => void`                               | 任意 | -             | オーバーレイを閉じる要求コールバック                                        |

#### セマンティック属性とアクセシビリティ

- ルート要素: `data-testid="reader-bottom-overlay"`、`aria-hidden={!isOpen}`
- 閉じるボタン: `data-testid="reader-bottom-overlay-close"`（`onClose` 提供時に描画、`aria-label="オーバーレイを閉じる"`）
- 前後話ナビ部: `ReaderChapterNav`（`data-testid="reader-chapter-nav"`）を内包
- 下部タブ部: `data-testid="reader-bottom-tabs"`（`role="tablist"`）、各タブボタン `data-testid="reader-bottom-tab-bookshelf"`, `data-testid="reader-bottom-tab-settings"`

### 3.3 `ReaderPage` のプロパティ契約変更（`ReaderPageProps`）

- 削除: `onBackToDetail`, `onBackToBookshelf`, `onToggleWritingMode`, `onChangeTheme`, `onChangeFontSize`, `onChangeLineHeight`, `onFetchNovel`（これらは Issue #50 で設定画面へ移設または OS バックキーへ一元化）
- 追加:
  - `onSelectTab?: (tab: 'bookshelf' | 'settings') => void`: オーバーレイ内のタブ選択コールバック
  - `initialOverlayOpen?: boolean`: エラー・空状態時のオーバーレイ初期表示制御用（既定値: `false`、エラー/空状態時は内部で `true`）

---

## 4. 受入条件（Acceptance Criteria: `AC-RD-xx`）の差分

| AC ID          | 区分 | 対象機能                                 | 検証条件                                                                                                                                                                                                                                       | 関連要件 / 遷移               |
| :------------- | :--: | :--------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------- |
| **`AC-RD-09`** | 新規 | 全画面テキスト表示化                     | 外枠パディング、カード枠線・角丸、および常時表示のツールバー・章ナビが撤廃され、画面全体（`100dvh`）に本文が縦書き（横スクロール）または横書き（縦スクロール）で表示されること。                                                               | `SYS-REQ-08, 11`              |
| **`AC-RD-10`** | 新規 | 最下部タッチによる下部オーバーレイ開閉   | 画面最下部ゾーン（下端約 72px または 15% 領域）のタップで `ReaderBottomOverlay` がスライドイン表示され、本文スクロール・本文エリア再タップ・前後話遷移で自動的に隠れること。またエラー時（`reader-error`）や空状態時は最初から表示されること。 | `SYS-REQ-11` / `TR-05`        |
| **`AC-RD-06`** | 変更 | 前後エピソード連続遷移とオーバーレイ連携 | `ReaderBottomOverlay` 内の「前の話へ」「次の話へ」ボタンで同一作品の前後エピソードへ遷移でき、第1話・最終話での `disabled` 境界制御、未キャッシュ時のオンデマンド取得、および遷移後のオーバーレイ自動非表示が正常に機能すること。              | `SYS-REQ-11` / `TR-05`        |
| **`AC-RD-08`** | 変更 | 画面離脱・タブ遷移時のしおり自動保存     | 本文スクロール時の進捗率更新に加え、下部オーバーレイの「本棚」「設定」タブ遷移時および OS バックキーによる目次復帰時にも `flushBookmark` が実行され、現在のエピソード番号とスクロール進捗率が確実に保存されること。                            | `SYS-REQ-12` / `TR-05, TR-06` |

---

## 5. テスト計画（UT / VRT / IT の検証観点）

### 5.1 単体テスト（Vitest UT: C0/C1/Functions 100%）

- **`ReaderBottomOverlay.test.tsx`**:
  - `isOpen: true` での可視表示と `isOpen: false` での非表示・退避状態
  - 前後話ナビゲーションボタン（前の話へ / 次の話へ）の活性・非活性制御およびコールバック発火
  - 下部タブ（本棚 / 設定）の描画、アクティブタブ表示、タップ時の `onSelectTab` コールバック発火
- **`ReaderView.test.tsx`**:
  - 全画面サイズ（`h-full w-full`）での縦書き・横書き組版レンダリング
  - 枠線・影装飾が存在しないことの確認
  - スクロール進捗率（`0.0〜1.0`）算出および位置復元の維持確認
- **`ReaderPage.test.tsx`**:
  - 通常表示時: 初期状態でオーバーレイが非表示（本文全画面）であること
  - 最下部タッチゾーンのタップでオーバーレイが表示されること
  - タップ判定がドラッグ・スワイプ等の移動を伴うジェスチャーでは発火しないこと
  - オーバーレイ表示中に本文スクロールイベント、本文エリアタップ、前後話遷移が発生した際にオーバーレイが自動非表示になること
  - エラー表示（`reader-error`）および空状態（`reader-empty`）において、オーバーレイが最初から表示されること
- **`ReaderContainer.test.tsx`**:
  - 下部オーバーレイの「本棚」タブ押下時に `flushBookmark()` が完了してから `navigateToBookshelf()` が呼ばれること
  - 「設定」タブ押下時に `flushBookmark()` が完了してから設定画面遷移が呼ばれること
  - OS バックキー（`popstate` / `onBack`）契機で `flushBookmark()` が実行されること

### 5.2 視覚的回帰テスト（Storybook VRT: 1280px / 375px）

- `ReaderBottomOverlay`（表示状態 / 非表示状態 / 第1話 / 最終話）
- `ReaderView`（全画面・縦書き・横書き・各テーマ）
- `ReaderPage`（全画面本文表示 / オーバーレイ展開時 / エラー表示時 / 空状態時）
- `ReaderContainer`（全画面リーダー）
- Desktop（1280×800）および Mobile（375×667）の双方向で VRT スナップショットを更新・検証

### 5.3 実ブラウザ結合テスト（Playwright IT: `SCN-01` 拡張）

- `test/it/scenarios/scn01-poc-vertical-reader.spec.ts` を拡張：
  1. リーダー画面（`SCR-03`）遷移時、本文が全画面（100dvh）で描画され、上部・下部バーが隠れていることを確認。
  2. 画面最下部ゾーンをクリック（タップ）し、`ReaderBottomOverlay`（前後話ナビ＋下部タブ）がスライドイン表示されることを確認。
  3. 本文エリアをスクロール操作するとオーバーレイが自動的に隠れることを確認。
  4. 再度オーバーレイを表示し、「次の話へ」をクリックして第2話へ遷移すること、および遷移後にオーバーレイが隠れることを確認。
  5. オーバーレイから「本棚」タブをタップした際、第2話のスクロール進捗率が DB に保存された上で本棚画面（`/`）へ遷移することを確認。

---

## 6. 実装 Sub-issue 分割計画

1 PR あたり 200〜400 行目安の規律に従い、以下の 3 つの Sub-issue に分割して直列（逐次）実装する。

| Sub-issue                   | 種別 | タイトル                                                                                          | 主な作業範囲・成果物                                                                                                                                                                                                                                                                |
| :-------------------------- | :--: | :------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sub-issue ① (#61: MK-1)** | MK-1 | `[v0.2] ReaderBottomOverlay 新設と ReaderView 全画面化 (#52-1)`                                   | ・`ReaderBottomOverlay`（前後話ナビ＋下部タブ）の実装<br>・`ReaderView` のカード枠線・余白・70vh制限撤廃と全画面スタイル化<br>・各コンポーネントの 1対1 `*.stories.tsx` ＆ Portable Stories `*.test.tsx`<br>・VRT スナップショット（1280px / 375px）更新                            |
| **Sub-issue ② (#62: MK-2)** | MK-2 | `[v0.2] ReaderPage 全画面統合・最下部タッチ判定・ReaderContainer しおり保存統合 (#52-2)`          | ・`ReaderPage` の常時表示バー撤廃、最下部タッチゾーン判定（スワイプ誤検知防止）、オーバーレイ自動非表示・エラー時初期表示の実装<br>・`ReaderContainer` の下部タブ遷移時・OSバックキー時の `flushBookmark` 連携<br>・1対1 Story/UT（C0/C1 100%）および VRT 更新                      |
| **Sub-issue ③ (#63: IT)**   |  IT  | `[v0.2] 小説リーダー全画面化・オーバーレイ開閉の Playwright IT（SCN-01）拡張とアーカイブ (#52-3)` | ・`scn01-poc-vertical-reader.spec.ts` への全画面表示・オーバーレイ開閉・自動非表示（スクロール / 外側タップ / 前後話移動）・タブ遷移しおり保存の結合テストシナリオ統合<br>・申し送り事項 `HO-12` の解決記録<br>・差分仕様書の `docs/specs/changes/archive/` への移動と `Closes #52` |

---

## 7. 申し送り事項（Handover Items: `HO-xx`）

|   ID    | 申し送り事項の内容                                                                                                                                  | 解決先（対象 Issue / 成果物）             | 完了ゲート          |    状態    |
| :-----: | :-------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------- | :------------------ | :--------: |
| `HO-12` | 小説リーダー画面（`SCR-03`）の全画面テキスト化および最下部ゾーンタップ判定（ドラッグ/スワイプ誤検知防止、72px / 15% 領域）の実機・Playwright IT検証 | Issue #52 Sub-issue ③ (#52-3 IT PR / #63) | Issue #52 PR マージ | `Resolved` |
