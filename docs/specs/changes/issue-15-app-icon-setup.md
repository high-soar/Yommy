---
type: spec-delta
title: アプリアイコン（Android Adaptive Icon / Web Favicon）設定の差分仕様
description: Issue #15 に対するアプリアイコン・Favicon生成、配置先規約、Adaptive Icon仕様、テスト計画、およびSub-issue分割計画。
issue: "#15"
status: "Review (#15)"
updated: "2026-10-26"
tags: [delta, icon, android, favicon, branding]
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/quality/bug-and-handover-log.md
related_tests: []
---

# 差分仕様書：アプリアイコン（Android / Web Favicon）の設定（Issue #15）

## 1. 変更の背景・目的（Why）

- 現在の Android プロジェクト（`android/app/src/main/res/mipmap-*`）および Web 側（`index.html`）は Capacitor / Vite の初期デフォルトアイコン（未配置の `/vite.svg` や Capacitor デフォルトロボットロゴ）のままとなっている。
- `reference/image.png`（Yommy オリジナルの紫の魔導書・彼岸花モチーフのアイコン画像）をベースに、Android 実機ホーム画面および Web ブラウザタブで Yommy らしいアプリアイコンが表示されるよう、高品質なアイコンアセット群の生成と設定を行う。
- また、`reference/` ディレクトリは将来削除されるため、正本マスターアセットの保管場所（`assets/icon.png`）を定義し、プロジェクト内で再現可能にアセットを再生成できる自動化スクリプトを整備する。

---

## 2. 仕様・設計の差分（What Changes）

### 2.1 マスターアセットの正本管理（`assets/icon.png`）

- **保管先**: プロジェクトルート直下の `assets/icon.png`（Capacitor 標準のアセット管理規約に準拠）。
- **仕様**: 1024×1024 ピクセル、PNG 形式（32bit RGBA）。
- **移行手順**: 初期参考ファイル `reference/image.png` から本番マスターとして `assets/icon.png` へコピー・配備する。

### 2.2 Android アプリアイコン仕様

Android 8.0（API レベル 26）以降で導入された **Adaptive Icon 規格** に完全準拠し、端末ランチャー（円形、角丸正方形、ティアドロップ等）のマスク適用時にフチ切れや二重枠が発生しないよう、以下の 2 レイヤー構成とする。

1. **Adaptive Icon 背景レイヤー**:
   - `android/app/src/main/res/values/ic_launcher_background.xml` のカラー値を `#0D0E26`（濃紺）に更新する。
2. **Adaptive Icon 前景レイヤー（`ic_launcher_foreground.png`）**:
   - キャンバスサイズ: 各 DPI 規定サイズ（108dp 相当）。
   - 中央セーフゾーン: 直径 72dp 相当（全体の 66.6%）の領域に、マスター画像中央の魔導書・彼岸花イラストをバランスよく配置する。
   - 背景: 透過（transparent）。外周の白余白や元画像の角丸枠・シャドウは完全に除去する。
3. **レガシーアプリアイコン（Android 7.1 以前 / 一部ホームアプリ用）**:
   - `ic_launcher.png`: 正方形角丸（濃紺背景 `#0D0E26` ＋ 中央イラスト）。
   - `ic_launcher_round.png`: 円形マスク（濃紺背景 `#0D0E26` ＋ 中央イラスト）。

#### Android アイコン解像度一覧表

| 密度 (DPI)       | ディレクトリ                               | `ic_launcher.png` (正方形) | `ic_launcher_round.png` (円形) | `ic_launcher_foreground.png` (前景) |
| :--------------- | :----------------------------------------- | :------------------------: | :----------------------------: | :---------------------------------: |
| **mdpi** (1x)    | `android/app/src/main/res/mipmap-mdpi/`    |         48 × 48 px         |           48 × 48 px           |            108 × 108 px             |
| **hdpi** (1.5x)  | `android/app/src/main/res/mipmap-hdpi/`    |         72 × 72 px         |           72 × 72 px           |            162 × 162 px             |
| **xhdpi** (2x)   | `android/app/src/main/res/mipmap-xhdpi/`   |         96 × 96 px         |           96 × 96 px           |            216 × 216 px             |
| **xxhdpi** (3x)  | `android/app/src/main/res/mipmap-xxhdpi/`  |        144 × 144 px        |          144 × 144 px          |            324 × 324 px             |
| **xxxhdpi** (4x) | `android/app/src/main/res/mipmap-xxxhdpi/` |        192 × 192 px        |          192 × 192 px          |            432 × 432 px             |

### 2.3 Web Favicon / アイコン仕様

Vite の静的アセットディレクトリ `public/` を新設し、ブラウザおよび PWA / ホーム画面追加用の標準アセットを配置する。

| ファイルパス                  |       解像度        | 用途・形式                                                                       |
| :---------------------------- | :-----------------: | :------------------------------------------------------------------------------- |
| `public/favicon.ico`          | 16×16, 32×32, 48×48 | デスクトップブラウザのタブ・ブックマーク用マルチアイコン                         |
| `public/icon-192.png`         |    192 × 192 px     | Web App / PWA マニフェスト用標準アイコン（濃紺背景＋角丸/全塗りイラスト）        |
| `public/icon-512.png`         |    512 × 512 px     | 高解像度スプラッシュ・PWA 用アイコン                                             |
| `public/apple-touch-icon.png` |    180 × 180 px     | iOS Safari「ホーム画面に追加」用（透過なし、濃紺背景 `#0D0E26` ＋ 中央イラスト） |

#### `index.html` の更新差分

```html
<!-- 変更前 -->
<link rel="icon" type="image/svg+xml" href="/vite.svg" />

<!-- 変更後 -->
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
```

### 2.4 自動生成スクリプト仕様（`scripts/generate-icons.mjs`）

- DevContainer 内に導入済みの Playwright Chromium（Headless Browser）の HTML5 Canvas API を活用し、外部バイナリや追加 npm パッケージに依存せず、決定論的に全アセットを生成する。
- 実行コマンド: `npm run generate:icons`（`package.json` の `scripts` に追加）。
- 処理フロー:
  1. `assets/icon.png`（または `reference/image.png`）を読み込み、中央のスクワークル領域およびイラストを解析。
  2. Android 5 解像度 × 3 種（計 15 個の PNG）を生成して `android/app/src/main/res/mipmap-*/` へ書き出し。
  3. Web 向け 4 ファイル（`favicon.ico`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`）を `public/` へ書き出し。
  4. `android/app/src/main/res/values/ic_launcher_background.xml` を `#0D0E26` に更新。

### 2.5 新規受入条件一覧（`AC-ICON-xx`）

| 受入条件 ID      | 項目                       | 検証内容・合否判定基準                                                                                                                                               | 対応要件 ID  |
| :--------------- | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------- |
| **`AC-ICON-01`** | マスター正本配置           | `assets/icon.png`（1024×1024）が配置され、将来 `reference/` が削除されてもアセット再生成が可能であること。                                                           | `SYS-REQ-15` |
| **`AC-ICON-02`** | Android アプリアイコン反映 | 各 DPI（mdpi〜xxxhdpi）の `ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png` が生成され、Adaptive Icon 背景色 `#0D0E26` が設定されていること。 | `SYS-REQ-15` |
| **`AC-ICON-03`** | Web Favicon 反映           | `public/favicon.ico`, `icon-192.png`, `apple-touch-icon.png` が配置され、`index.html` から正しくリンク参照されていること。                                           | `SYS-REQ-15` |
| **`AC-ICON-04`** | 再現可能スクリプト         | `npm run generate:icons` を実行することで、全アイコンアセットがローカルで差分なく再生成できること。                                                                  | `SYS-REQ-15` |

---

## 3. テスト計画（UT / VRT / IT の検証観点）

### 3.1 単体テスト（UT）観点

- `scripts/generate-icons.test.ts`（Vitest）:
  - 生成対象の全ファイル（Android 15 ファイル ＋ Web 4 ファイル）が存在すること。
  - 各画像の幅・高さが規定解像度（48px〜512px）と厳密に一致すること。
  - `ic_launcher_background.xml` のカラー定義が `#0D0E26` であること。

### 3.2 視覚的確認・結合テスト（IT）観点

- Playwright IT（`test/it/smoke.spec.ts` 等）:
  - ブラウザ起動時に `index.html` 内の `<link rel="icon">` および `<link rel="apple-touch-icon">` の URL が 200 OK で解決されること。
- Android ビルド整合性:
  - DevContainer 内で `npx cap sync android` が正常終了すること。

---

## 4. 実装 Sub-issue 分割計画

|    Sub-issue    |  区分  | タイトル・目的                                                                     | 主な対象ファイル                                                                                                                                             | 完了ゲート                                                               |
| :-------------: | :----: | :--------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| **Sub-issue ①** | **MK** | `[v0.1] アプリアイコン生成スクリプト実装と各解像度アセット（Android / Web）の配置` | `assets/icon.png`<br>`scripts/generate-icons.mjs`<br>`scripts/generate-icons.test.ts`<br>`android/app/src/main/res/mipmap-*`<br>`public/*`<br>`package.json` | TDD Green / UT PASS / Task Completion Gate                               |
| **Sub-issue ②** | **IT** | `[v0.1] index.html の Favicon 設定と結合検証・申し送り精算・仕様アーカイブ`        | `index.html`<br>`test/it/smoke.spec.ts`<br>`docs/quality/bug-and-handover-log.md`<br>`docs/specs/changes/archive/` 移動                                      | Playwright IT 100% PASS / HO-06 精算 / Task Completion Gate (Closes #15) |

---

## 5. 申し送り事項（Handover Items: `HO-xx`）

- **`HO-06`**: Android 実機およびエミュレータ環境におけるホーム画面アプリアイコンの表示（Adaptive Icon 各種マスク形状、解像度ごとの視認性）および Web ブラウザでの Favicon 表示の確認。
  - 解決先: Sub-issue ② (IT PR)
  - 完了ゲート: Issue #15 PR マージ
