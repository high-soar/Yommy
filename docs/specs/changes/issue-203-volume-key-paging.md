---
type: spec-delta
title: "ハードウェア音量キーによるページ送り・スクロール送り対応と設定画面ON/OFFトグルの実装設計"
description: "Issue #203 に対する差分仕様、影響する全体正本、テスト計画、および実装Sub-issue分割計画。"
issue: "#203"
status: "Review (#203)"
updated: "2026-11-03"
tags:
  - delta
  - volume-key
  - hardware-key
  - paging
  - settings
  - reader
  - scr-03
  - scr-05
  - sys-req-11
  - ho-28
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/features/settings.md
  - docs/specs/features/reader-view.md
related_tests:
  - src/features/settings/components/SettingsPage.test.tsx
  - src/features/settings/hooks/useSettings.test.tsx
  - src/features/reader/components/ReaderPage.test.tsx
  - src/features/reader/components/ReaderContainer.test.tsx
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 差分仕様書：ハードウェア音量キーによるページ送り・スクロール送り対応と設定画面ON/OFFトグルの実装（Issue #203）

本ドキュメントは、Issue #203「`[v0.6] ハードウェア音量キーによるページ送り・スクロール送り対応と設定画面ON/OFFトグルの実装（SYS-REQ-11拡張）`」に対する差分仕様、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、および実装 Sub-issue 分割計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

- `docs/specs/requirements.md`（**SYS-REQ-11**）および `docs/specs/features/reader-view.md` / `settings.md` において、ハードウェア音量キー（`enableVolumeKeyPaging`）によるページ送りは `v0.6〜` の拡張スコープとして位置づけられていた。
- DB スキーマ（`reader_settings` テーブルの `enable_volume_key_paging INTEGER NOT NULL DEFAULT 0`）および `SqlSettingsRepository` のカラム定義は既に先行して定義されているが、以下の機能が未実装となっている：
  1. 設定画面（`SCR-05`）における「音量キーでページ送り」ON/OFF トグル UI および永続化
  2. Android ネイティブ層（`MainActivity` / Capacitor プラグイン `VolumeKeyPlugin`）での音量キー捕捉（OS 音量バー抑止）と Web ブリッジ連携
  3. リーダー画面（`SCR-03`）における音量キー押下時のページ送り（水平スライドアニメーション）・連続スクロール送り・エピソード端 2 段階遷移連携
- 本 Issue にてこれらを一気通貫で実装し、片手持ちでの快適な読書操作体験を実現する。

---

## 2. 要求仕様と設計合意事項（What）

### 2.1 設定画面（`SCR-05`: `SettingsPage` / `useSettings`）の拡張

1. **設定トグル UI**:
   - 「表示・組版設定」セクション（`data-testid="typography-settings-section"`）に **「音量キーでページ送り」ON / OFF トグルボタン**（`data-testid="toggle-volume-key-paging"`, `aria-pressed={enableVolumeKeyPaging}`）を追加する。
   - **初期値**: **`false`（OFF）**（音楽再生や通話等のメディア音量調整を妨げないよう、必要なユーザーが明示的に ON にできる安全な初期設計とする）。
   - 説明ラベルまたは注記として「音量［ー］で次へ、音量［＋］で前へ移動します」を表示する。
2. **永続化とロールバック**:
   - トグル切り替え時に即座に React State を更新し、`settingsRepository.updateReaderSettings({ enableVolumeKeyPaging })` で SQLite へ永続化する。
   - 保存失敗時は直前の値へ自動ロールバックし、画面上部に `role="alert"`（`data-testid="settings-error-alert"`）でエラーメッセージを表示する（`AC-ST-07` と共通の堅牢性）。
3. **フック契約（`useSettings`）の拡張**:
   ```ts
   export interface UseSettingsResult {
     // ... 既存フィールド ...
     enableVolumeKeyPaging: boolean;
     toggleVolumeKeyPaging: () => Promise<void>;
   }
   ```

---

### 2.2 Android ネイティブ層 ＆ `VolumeKeyBridge` 設計

1. **インターフェース契約（`src/bridges/volume-key/types.ts`）**:

   ```ts
   export type VolumeKeyDirection = "up" | "down";

   export interface VolumeKeyEvent {
     direction: VolumeKeyDirection;
   }

   export type VolumeKeyListener = (event: VolumeKeyEvent) => void;

   export interface VolumeKeyBridge {
     /**
      * 音量キーインターセプトの有効/無効を切り替える。
      * Android 実機では有効時のみ KEYCODE_VOLUME_DOWN / KEYCODE_VOLUME_UP を捕捉し、OS 音量バー表示を抑止する。
      * リーダー離脱時や設定 OFF 時は false にすることで通常の OS 音量調整に戻す。
      */
     setVolumeKeyPagingEnabled(enabled: boolean): Promise<void>;

     /**
      * 音量キー押下イベントリスナーを登録する。
      * @param listener 音量キーイベントリスナー
      * @returns リスナー解除関数
      */
     addVolumeKeyListener(listener: VolumeKeyListener): () => void;
   }
   ```

2. **Android ネイティブ層実装（`VolumeKeyPlugin.java` & `MainActivity.java`）**:
   - `VolumeKeyPlugin`: Capacitor プラグイン（`@CapacitorPlugin(name = "VolumeKey")`）として登録し、`setVolumeKeyPagingEnabled` メソッドおよび `volumeKeyEvent` のイベント通知（`notifyListeners`）を提供する。
   - `MainActivity`: `dispatchKeyEvent(KeyEvent event)` をオーバーライドし、以下の制御を行う：
     - `event.getAction() == KeyEvent.ACTION_DOWN` かつ `keyCode` が `KEYCODE_VOLUME_DOWN` または `KEYCODE_VOLUME_UP` の場合：
       - `VolumeKeyPlugin.isVolumeKeyPagingEnabled()` が `true` の場合、イベントを捕捉して `VolumeKeyPlugin.onVolumeKeyDown(direction)` を呼び出し、**`return true;` で OS のシステム音量バー表示および音量変更を抑止**する。
       - `false` の場合は `super.dispatchKeyEvent(event)` を呼び出し、Android 標準の音量調整として動作させる。
   - リーダー画面以外（本棚・検索・ランキング・設定・作品詳細）を表示中、または設定が OFF のときは一切インターセプトせず、OS の標準音量操作を妨げない。

3. **ブラウザ / テスト用モック（`MockVolumeKeyBridge`）**:
   - `triggerVolumeKey(direction: VolumeKeyDirection): void` メソッドを提供し、UT や Playwright IT で決定論的に音量キーイベントを発火できるようにする。
   - Web 実行時の利便性向上として、`window.addEventListener("keydown", ...)` によるキーボードキー（`AudioVolumeDown` / `AudioVolumeUp` 等）のシミュレーション連携もサポートする。

4. **DI コンテキスト（`ServiceProvider.tsx`）への追加**:
   - `ServiceContextValue` に `volumeKeyBridge: VolumeKeyBridge` を追加。
   - 実機環境（`Capacitor.isNativePlatform()`）では `CapacitorVolumeKeyBridge`、ブラウザ／テスト環境では `MockVolumeKeyBridge` を注入する。

---

### 2.3 リーダー画面（`SCR-03`）での音量キー操作・ページ送り・スクロール送り連携

1. **キー割り当て**:
   - **音量［ー］（Volume Down）**: **次へ進む**
     - 縦書きページめくりモード（実効 `paged`）: 次のページへ 2段階水平スライドアニメーション付きで移動（`nextPage()`）
     - 連続スクロールモード（実効 `scroll`）: 約 1 画面分（コンテナ幅／高さの 85% 分）順方向スクロール
   - **音量［＋］（Volume Up）**: **前へ戻る**
     - 縦書きページめくりモード（実効 `paged`）: 前のページへ 2段階水平スライドアニメーション付きで移動（`prevPage()`）
     - 連続スクロールモード（実効 `scroll`）: 約 1 画面分（コンテナ幅／高さの 85% 分）逆方向スクロール

2. **有効化ライフサイクル制御**:
   - リーダー画面（`ReaderPage` / `ReaderContainer`）のマウント時、`readerSettings.enableVolumeKeyPaging === true` であれば `volumeKeyBridge.setVolumeKeyPagingEnabled(true)` を呼び出し、キーリスナーを登録する。
   - アンマウント時、または設定が OFF の場合は `volumeKeyBridge.setVolumeKeyPagingEnabled(false)` を呼び出して安全に解除する。

3. **エピソード境界（最終ページ／第1ページ・スクロール端）での 2段階操作（誤遷移防止）**:
   - 左右端タップ（`AC-RD-18`）および端スワイプ（`AC-RD-19`）と完全に統一した **2段階操作（案内ヒント表示 → 2.5秒以内の再操作で遷移）** とする。
   - **最終ページ（またはスクロール末尾到達時）** で音量［ー］を押した 1 回目で案内ヒント（「もう一度操作で次の話へ」）を表示し、2.5 秒以内の 2 回目押下で次のエピソードへ遷移する。
   - **第1ページ（またはスクロール先頭到達時）** で音量［＋］を押した 1 回目で案内ヒント（「もう一度操作で前の話へ」）を表示し、2.5 秒以内の 2 回目押下で前のエピソードへ遷移する。
   - 第1話での前話遷移や最終話での次話遷移は行わず、無効とする。

4. **オーバーレイ展開中の自動非表示**:
   - 上下オーバーレイ（`ReaderTopOverlay` / `ReaderBottomOverlay`）が展開中に音量キーでページ送り／スクロール送りを行った場合は、左右端タップ等の通常操作と同様にオーバーレイを自動で閉じる（`isOpen = false`）。

---

## 3. 受入条件（Acceptance Criteria）とマッピング

| AC ID          | 対象機能                                                              | 検証条件                                                                                                                                                                                                                                                                                                                        | 関連要件 / 遷移                  |
| :------------- | :-------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------- |
| **`AC-ST-19`** | 音量キー送りトグル設定と永続化                                        | 設定画面（`SCR-05`）の「表示・組版設定」セクションに「音量キーでページ送り」ON/OFF トグル（`data-testid="toggle-volume-key-paging"`, 初期値 `false`）が表示され、タップで ON/OFF 切替でき、`reader_settings` へ永続化されること。保存失敗時は直前の値へロールバックされ、エラー警告（`settings-error-alert`）が表示されること。 | `SYS-REQ-11` / `SCR-05`          |
| **`AC-RD-26`** | 音量キーによるページ送り・スクロール送り連携                          | `enableVolumeKeyPaging === true` のとき、リーダー画面（`SCR-03`）で音量［ー］押下により次ページ（または約85%順方向スクロール）、音量［＋］押下により前ページ（または約85%逆方向スクロール）へ移動すること。縦書きページめくり時は水平スライドアニメーションが適用されること。設定が OFF のときは反応しないこと。                | `SYS-REQ-11` / `SCR-03`          |
| **`AC-RD-27`** | 音量キー操作におけるエピソード端2段階遷移およびオーバーレイ自動非表示 | 最終ページ（またはスクロール末尾）で音量［ー］を押した際、1回目で案内ヒントが表示され、2.5秒以内の2回目押下で次エピソードへ遷移すること（第1ページでの音量［＋］も同様）。また上下オーバーレイ展開中に音量キー操作を行った際、自動的にオーバーレイが閉じること。                                                                | `SYS-REQ-11` / `SCR-03`, `TR-05` |

---

## 4. 影響する App 全体正本一覧（Review 状態への更新）

| 仕様書ファイルパス                     | 種別         | 本 Issue による改訂概要                                                                                                                                                                                                               |
| :------------------------------------- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/specs/requirements.md`           | App 全体正本 | `SYS-REQ-11`（リーダー組版・操作体験）へハードウェア音量キー（音量［ー］次へ／音量［＋］前へ、設定画面トグル初期値OFF、エピソード端2段階遷移、オーバーレイ自動非表示）の要件を反映し、フロントマター `status: Review (#203)` へ更新。 |
| `docs/specs/features/settings.md`      | App 全体正本 | 設定画面（`SCR-05`）の「表示・組版設定」セクションに「音量キーでページ送り」トグル UI（`AC-ST-19`）を追加し、フック契約（`useSettings`）を更新。フロントマター `status: Review (#203)` へ更新。                                       |
| `docs/specs/features/reader-view.md`   | App 全体正本 | リーダー画面（`SCR-03`）に音量キーページ送り・スクロール送り仕様（`AC-RD-26`）およびエピソード端2段階遷移・オーバーレイ連動（`AC-RD-27`）を追加。フロントマター `status: Review (#203)` へ更新。                                      |
| `docs/specs/architecture.md`           | App 全体正本 | ブリッジ層に `VolumeKeyBridge`（`src/bridges/volume-key/`）および `ServiceProvider` の DI 構成、Android ネイティブプラグイン構成を追加。フロントマター `status: Review (#203)` へ更新。                                               |
| `docs/quality/bug-and-handover-log.md` | 品質正本     | 申し送り事項 **`HO-28`**（Android 実機における音量キーインターセプト・OS音量バー抑止・通常音量復帰の検証）を登録。                                                                                                                    |

---

## 5. テスト計画

### 5.1 単体テスト（Unit Tests: Vitest）

- `src/features/settings/hooks/useSettings.test.tsx`:
  - `enableVolumeKeyPaging` の初期値（`false`）、トグル切替時の `updateReaderSettings` 呼び出しと永続化検証。
  - 永続化失敗時のロールバックおよび `error` 設定検証。
- `src/features/settings/components/SettingsPage.test.tsx`:
  - `toggle-volume-key-paging` ボタンの表示、`aria-pressed` の状態変化、クリックイベント検証。
  - Portable Stories（`composeStories`）を用いた 1 対 1 テスト。
- `src/bridges/volume-key/mockVolumeKeyBridge.test.ts`:
  - `setVolumeKeyPagingEnabled` の状態管理、`addVolumeKeyListener` の登録・解除、`triggerVolumeKey` のイベント通知検証。
- `src/bridges/volume-key/capacitorVolumeKeyBridge.test.ts`:
  - Capacitor プラグインメソッドの呼び出し、イベントリスナーの登録・解除検証。
- `src/features/reader/components/ReaderPage.test.tsx` / `ReaderContainer.test.tsx`:
  - `enableVolumeKeyPaging === true` 時の `volumeKeyBridge.setVolumeKeyPagingEnabled(true)` 呼び出しとアンマウント時の解除検証。
  - 音量［ー］/［＋］による次ページ・前ページ移動（縦書きスライド遷移）および連続スクロール移動検証。
  - 最終ページ / 第1ページでの 1 回目押下時ヒント表示、2.5 秒以内再押下時のエピソード遷移検証。
  - オーバーレイ展開中の音量キー操作によるオーバーレイ自動非表示検証。
  - `enableVolumeKeyPaging === false` 時に音量キー操作でページ移動しないことの検証。
- **カバレッジ目標**: 対象ファイルすべてにおいて **C0/C1/Functions 100%**。

### 5.2 ビジュアル回帰テスト（VRT: Storybook + Playwright）

- `SettingsPage.stories.tsx`:
  - 「音量キーでページ送り」OFF（初期状態）および ON バリエーションのストーリー作成。
  - 1280px（Desktop）および 375px（Mobile）の両ビューポートでスナップショットを取得・検証。
- `ReaderPage.stories.tsx`:
  - 既存ストーリーにおけるレイアウト崩れ・差分がないことを検証。

### 5.3 システム結合テスト（IT: Playwright）

- `test/it/scenarios/scn07-volume-key-paging.spec.ts`（新規シナリオ）:
  1. 設定画面（`SCR-05`）へ遷移し、「音量キーでページ送り」トグルを ON に切り替えて永続化を確認。
  2. リーダー画面（`SCR-03`）で作品エピソードを開く。
  3. 音量［ー］操作（モックイベント）で次ページへ進むことを確認。
  4. 最終ページで音量［ー］を 1 回押して案内ヒントが表示され、2 回目押下で次エピソードへ遷移することを確認。
  5. 画面中央タップで上下オーバーレイを展開後、音量キー操作でオーバーレイが自動で閉じることを確認。
  6. 設定画面に戻りトグルを OFF に切り替えた後、リーダー画面で音量キー操作を行ってもページが移動しないことを確認。

---

## 6. 実装 Sub-issue 分割計画（推奨分割粒度: 200〜350行目安）

| Sub-issue                 | 役割  | タイトルと主な作業範囲                                                                                                                                                                                                                                                                                                                                                                                                                                | 想定規模  | 完了条件                                        |
| :------------------------ | :---: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------: | :---------------------------------------------- |
| **Sub-issue ①**<br>(#223) | `MK1` | **設定画面（SCR-05）の「音量キーでページ送り」ON/OFF トグル UI および永続化の実装**（#223）<br>・`useSettings.ts`: `enableVolumeKeyPaging`, `toggleVolumeKeyPaging` 追加、永続化・ロールバック<br>・`SettingsPage.tsx`: 「表示・組版設定」に `toggle-volume-key-paging` トグル追加<br>・`SettingsPage.stories.tsx`: ON/OFF ストーリー追加<br>・単体テスト（C0/C1/Functions 100%）および Storybook VRT（1280px / 375px）更新                           | 約 200 行 | Gate 1〜6 PASS<br>AI 自律マージ                 |
| **Sub-issue ②**<br>(#224) | `MK2` | **Android ネイティブ層（VolumeKeyPlugin / MainActivity）および VolumeKeyBridge の実装**（#224）<br>・`src/bridges/volume-key/`: `types.ts`, `mockVolumeKeyBridge.ts`, `capacitorVolumeKeyBridge.ts`<br>・`android/`: `VolumeKeyPlugin.java`, `MainActivity.java`（音量キー捕捉・OS音量バー抑止）<br>・`src/app/ServiceProvider.tsx`: `volumeKeyBridge` DI 注入<br>・単体テスト（C0/C1/Functions 100%）                                                | 約 250 行 | Gate 1〜6 PASS<br>AI 自律マージ                 |
| **Sub-issue ③**<br>(#225) | `MK3` | **リーダー画面（SCR-03）における音量キーページ送り・スクロール送り・境界2段階遷移連携の実装**（#225）<br>・リーダー画面での `volumeKeyBridge` 有効化・リスナー購読・ライフサイクル制御<br>・音量［ー］/［＋］によるページめくり（スライド移動）およびスクロール移動<br>・エピソード境界 2 段階遷移（案内ヒント・2.5秒タイマー）およびオーバーレイ自動非表示<br>・`ReaderPage.test.tsx` / `ReaderContainer.test.tsx` 単体テスト（100%）および VRT 検証 | 約 300 行 | Gate 1〜6 PASS<br>AI 自律マージ                 |
| **Sub-issue ④**<br>(#226) | `IT`  | **Playwright システム結合テスト（SCN-07 音量キー操作）および仕様書アーカイブ**（#226）<br>・新規 Playwright IT シナリオ（`scn07-volume-key-paging.spec.ts`）の実装と全回帰 PASS 検証<br>・申し送り事項 `HO-28` の登録確認<br>・差分仕様 `docs/specs/changes/issue-203-volume-key-paging.md` のアーカイブ移動                                                                                                                                          | 約 250 行 | Gate 1〜6 PASS<br>人間マージ（親Issueクローズ） |

---

## 7. 申し送り事項（Handover Items）

|     ID      | 起票元 Issue | 申し送り事項の内容                                                                                                                                                                           | 解決先（対象 Issue / 成果物）          | 完了ゲート              |  状態  |
| :---------: | :----------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- | :---------------------- | :----: |
| **`HO-28`** |  Issue #203  | Android 実機におけるハードウェア音量キー（Volume Down/Up）インターセプト（リーダー画面かつ設定ON時のみ OS 音量バー抑止・Webイベント連携、リーダー離脱時や設定OFF時の標準音量復帰）の動作検証 | Milestone `v0.6` 実機検証 / Issue #204 | Milestone `v0.6` 完了前 | `Open` |
