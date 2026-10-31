---
type: spec-delta
title: "設定画面からのOSバックキー直前画面復帰（リーダー・作品詳細・本棚）"
description: "Issue #124 に対する差分仕様、影響する全体正本、テスト計画、および実装Sub-issue分割計画。"
issue: "#124"
status: "Review (#124)"
updated: "2026-10-31"
tags:
  - delta
  - settings
  - reader
  - routing
  - back-button
  - app-bridge
  - screen-transitions
related_specs:
  - docs/specs/screen-transitions.md
  - docs/specs/features/settings.md
  - docs/specs/architecture.md
  - docs/specs/requirements.md
related_tests:
  - src/app/router.test.tsx
  - src/App.test.tsx
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 差分仕様書：設定画面からのOSバックキー直前画面復帰（Issue #124）

本ドキュメントは、Issue #124「`[v0.4] リーダー画面や作品詳細から設定画面を開いた際のOSバックキー直前画面復帰（リーダー復帰）の改善`」に対する差分仕様、影響する App 全体正本の一覧、UT/IT テスト計画、および実装 Sub-issue 分割計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

- **現状の課題**:
  - 小説リーダー画面（`SCR-03`）で読書中に文字サイズ・行間・テーマ等を調整するため下部オーバーレイから設定画面（`SCR-05`）を開いた後、設定を終えて OS バックキー（戻るボタン、`router.back()`）を押下した際、読書中のリーダー画面ではなくホームの本棚画面（`SCR-01`: `/`）へ戻ってしまう（`TR-12` の画一的本棚復帰定義による）。
  - 作品詳細画面（`SCR-02`: `/novels/:novelId`）から下部タブで設定画面（`SCR-05`）へ遷移した場合も同様に、OS バックキーで作品詳細ではなく本棚画面へ戻ってしまう。
  - これにより、読書を再開するために本棚から再度作品を探して「続きから読む」をタップし直す必要が生じ、読書体験が著しく損なわれている。
- **改善目的**:
  - リーダー画面（`SCR-03`: `/novels/:novelId/chapters/:chapterIndex`）または作品詳細画面（`SCR-02`: `/novels/:novelId`）から設定画面（`SCR-05`: `/settings`）へ遷移した場合、OS バックキー押下時（`AppBridge` 経由または `router.back()` 実行時）に直前のリーダー画面または作品詳細画面へスムーズに復帰させる（`TR-12` の論理復帰条件分岐）。
  - 下部タブ（本棚・検索・ランキング）から直接設定を開いた場合、または履歴情報が存在しない場合は、従来通りホームの本棚画面（`SCR-01`: `/`）へ復帰する。
  - 設定画面を経由しても、探索元コンテキスト（`novelOrigin`: `/search` または `/ranking`）を破壊せず維持し、作品詳細からのバック復帰が正しく動作するように保護する。

---

## 2. 変更仕様の詳細（What）

### 2.1 `TR-12` 画面遷移定義の改善

設定画面（`SCR-05`）における OS バックキー遷移（`TR-12`）の遷移先・ガード条件を以下の通り改定する。

- **遷移元**: `SCR-05`（設定画面 `/settings`）
- **遷移先**:
  1. **リーダー画面（`SCR-03`）から遷移してきた場合**: 直前のリーダー画面パス（`/novels/:novelId/chapters/:chapterIndex`）へ復帰。対象話数とスクロール状態がそのまま維持される。
  2. **作品詳細画面（`SCR-02`）から遷移してきた場合**: 直前の作品詳細画面パス（`/novels/:novelId`）へ復帰。
  3. **下部タブ（本棚 `/`、検索 `/search`、ランキング `/ranking`）から直接遷移した場合、または直接アクセス時**: 従来通りホームの本棚画面（`SCR-01`: `/`）へ復帰。
- ※検索画面（`SCR-06`: `/search`）およびランキング画面（`SCR-07`: `/ranking`）での OS バックキー操作は、従来通りホームの本棚画面（`SCR-01`: `/`）への復帰を維持する（対象外スコープ）。

### 2.2 `router.tsx` における状態管理・ナビゲーション制御

1. **`settingsOrigin` の保持**:
   - `RouterContextValue` に `settingsOrigin: string | null` を追加する。
   - `settingsOriginRef = useRef<string | null>(null)` で最新状態を保持する。
   - `navigate(to)` 実行時:
     - 遷移先 `to === "/settings"` の場合:
       - 現在パス `current` が `/novels/` で始まる場合（`SCR-02` または `SCR-03`）、`settingsOriginRef.current = current` として遷移元パスを記録する。
       - それ以外（`/`、`/search`、`/ranking` など）の場合は `settingsOriginRef.current = null` とする。
     - 遷移先 `to !== "/settings"` の場合:
       - `settingsOriginRef.current = null` にリセットする（ユーザーが他のタブへ自主遷移したため）。
   - `back()` 実行時（`route.name === "settings"` の場合）:
     - `settingsOriginRef.current` が存在し、`/novels/` で始まる場合:
       - 記録されていた遷移元パスを取得し、`settingsOriginRef.current = null` にリセットした上で、そのパスへ `navigate(origin)` する。
     - それ以外の場合:
       - `navigate("/")` を実行する。
2. **`novelOrigin`（探索元コンテキスト）の保護**:
   - 現在の `navigate(to)` では `to` が `/novels/` で始まらない場合に一律 `novelOriginRef.current = null` としているが、一時的に `/settings` へ入った場合に探索元（`/search` や `/ranking`）が消失してしまう。
   - そのため、`to === "/settings"` かつ直前が `/novels/` であった場合は、`novelOriginRef.current` を破棄せず維持する。
   - また、設定画面からリーダーまたは作品詳細へ `back()` で復帰した際、`navigate(to)` が `novelOriginRef.current` を `/settings` で上書きしないようガードする（`novelOrigin` の値域は `/`、`/search`、`/ranking` のみ）。

---

## 3. 全体正本への影響一覧（Where）

| 正本仕様書                         | 種別         | 影響内容                                                                                                                                                         |
| :--------------------------------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/specs/screen-transitions.md` | App全体正本  | Mermaid 遷移図の `SCR05` からの戻る遷移に `SCR03`/`SCR02`/`SCR01` への分岐矢印を追加。`TR-12` の遷移先・説明文を直前画面復帰（リーダー・作品詳細・本棚）に更新。 |
| `docs/specs/features/settings.md`  | 機能仕様正本 | `1. 概要・スコープ` の `TR-12` 記述を直前画面復帰に更新。受入条件 `AC-ST-06` を「OS バックキーによる直前画面（リーダー・作品詳細・本棚）復帰」へ改定。           |
| `docs/specs/architecture.md`       | App全体正本  | `5.6 画面遷移・ライフサイクル設計` 内の `TR-12` 記述を設定からの直前画面復帰に同期。                                                                             |
| `docs/specs/requirements.md`       | App全体正本  | `SYS-REQ-20` の OS バックキー論理復帰記述を設定からの直前画面復帰に同期。                                                                                        |

---

## 4. テスト計画（How to test）

### 4.1 単体テスト（UT / C0・C1 100%）

- **`src/app/router.test.tsx`**:
  - リーダー画面（`/novels/test-novel/chapters/2`）から `navigateToSettings()` 呼び出し後、`back()` 実行時に元のリーダー画面へ復帰することを検証。
  - 作品詳細画面（`/novels/test-novel`）から `navigateToSettings()` 呼び出し後、`back()` 実行時に元の作品詳細画面へ復帰することを検証。
  - 本棚画面（`/`）から `navigateToSettings()` 呼び出し後、`back()` 実行時に本棚（`/`）へ復帰することを検証。
  - 検索画面（`/search`）またはランキング画面（`/ranking`）から `navigateToSettings()` 呼び出し後、`back()` 実行時に本棚（`/`）へ復帰することを検証。
  - 初期パス `/settings` で起動後、`back()` 実行時に本棚（`/`）へ復帰することを検証。
  - 検索（`/search`）から作品詳細・リーダーへ遷移後、設定を開いて `back()` でリーダーへ戻り、さらにリーダーから `back()` で作品詳細、作品詳細から `back()` で `/search` へ戻れること（探索元コンテキスト保持）を検証。
- **`src/App.test.tsx`**:
  - `appBridge` の戻るボタンイベント経由で、リーダー画面から設定画面へ遷移した後に戻るボタンを押下した際、リーダー画面が再描画されることを統合検証。

### 4.2 統合テスト（Playwright IT / SCN-01+）

- **`test/it/scenarios/scn01-poc-vertical-reader.spec.ts`**:
  - リーダー画面（`SCR-03`）で下部オーバーレイを開き、「設定」タブをタップして設定画面（`SCR-05`）へ遷移。
  - 設定画面でブラウザ戻る操作（または戻るボタンシミュレーション）を実行し、リーダー画面（`SCR-03`）に復帰して縦書き本文が表示されていることをアサート。

---

## 5. Sub-issue 分割計画

| #   | プレフィックス / タイトル                                                                               | スコープ                                                                                                                                                                 | 完了条件                                                     |
| :-- | :------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------- |
| 1   | `[MK] 設定画面からのOSバックキー直前復帰（リーダー・作品詳細・本棚）実装と単体テスト（Refs #124）`      | `src/app/router.tsx` における `settingsOrigin` 追跡・`back()` 条件分岐ロジック・`novelOrigin` 保護実装、および `src/app/router.test.tsx`, `src/App.test.tsx` の TDD 実装 | C0/C1 100%、全単体テスト PASS                                |
| 2   | `[IT] 設定画面バックキー復帰のPlaywright ITシナリオ検証・全体回帰および差分仕様アーカイブ（Refs #124）` | `test/it/scenarios/` へのシナリオ追加・E2E 全体回帰、申し送り・バグ記録確認、および差分仕様アーカイブ                                                                    | E2E 全件 PASS、差分仕様書アーカイブ完了、Issue #124 クローズ |
