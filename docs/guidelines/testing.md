---
type: guideline
title: テスト・実装規律の正本（SSOT）
description: Yommyの3層テスト体系（Parser/Storage/Viewer）、TDDコミット規約、1対1 Story/UT、親子分離、C0/C1 100%、縦書きVRT、および原因D設計同期ルールの正本。
status: Approved
updated: "2026-10-31"
tags: [testing, tdd, vrt, storybook, vitest, playwright, coverage]
related_specs:
  - docs/index.md
  - docs/guidelines/workflow.md
  - docs/specs/architecture.md
  - docs/quality/bug-and-handover-log.md
related_tests: []
---

# テスト・実装規律の正本（SSOT）

本ドキュメントは、Yommy（React + TypeScript + Vite + Capacitor）における TDD（テスト駆動開発）、3層アーキテクチャのテスト責務境界、Storybook / Portable Stories / VRT 規約、カバレッジ基準、およびバグ記録・設計書同期ルールの正本（Single Source of Truth）です。

---

## 1. 基本原則（9つの鉄則）

1. **仕様・設計正本（SSOT）準拠**:
   `docs/specs/` 配下の設計書（`architecture.md`, `db-schema.md`, `features/*.md`, `parsers/*.md`）に定義された契約・受け入れ条件（`AC-xx`）を忠実に実装する。未定義の仕様を推測で実装してはならない。
2. **テストファースト（TDD）の徹底**:
   すべての機能実装・バグ修正は、単体テストを先に書く **Red（失敗確認） → Green（最小実装） → Refactor（構造改善）** のサイクルで進め、各ステップで個別にコミットを刻む。
3. **3層アーキテクチャと Capacitor Bridge の抽象化分離**:
   `Parser Layer`、`Storage Layer`、`Viewer & Bridge Layer` の責務を明確に分離し、Capacitor ネイティブ機能（`CapacitorHttp`, SQLite プラグイン, WebView インジェクション等）は薄いアダプター／インターフェース層で抽象化して、Node.js（Vitest）やブラウザ（Storybook / Playwright）上で決定論的にテスト可能にする。
4. **テスト配置の統一（Co-location）**:
   単体テスト（`*.test.ts`, `*.test.tsx`）および Storybook ファイル（`*.stories.tsx`）は、対象ソースファイルと同一ディレクトリに配置する。
5. **例外なしの 1 対 1 対応原則**:
   - 全 `*.tsx` ファイル（ただし §5.2 項4 に定めるブラウザ初期マウントエントリーポイント `src/main.tsx` を除く）に対して、同階層に **`*.stories.tsx`（必須）** と **`*.test.tsx`（Portable Stories `composeStories` 全件実行 ＋ ロジック補完）** を 1 対 1 で作成する。
   - 全 `*.ts` ファイル（型定義専用ファイルを除く）に対して、同階層に **`*.test.ts`（または `.test.tsx`）** を 1 対 1 で作成する。なお、実行時定数定義ファイル（`src/**/constants/*.ts` 等）およびバレルエクスポート（`src/**/index.ts` 等）も型専用ファイルに該当しないため、1 対 1 単体テスト（`*.test.ts`）を必須とする。
6. **親子コンポーネント分離原則（相乗りテスト禁止）**:
   親（Page / Container）のテストでは「状態管理・Loading/Error/Ready の切り替え・子への Props 渡し」のみを検証し、子コンポーネントの表示バリエーション・境界値・イベント発火は必ず子自身の `.stories.tsx` / `.test.tsx` で独立して検証する。
7. **C0 / C1 / Functions 100% カバレッジ原則**:
   `src/` 配下の全対象ファイルにおいて、ステートメント（C0）・分岐（C1）・関数（Functions）カバレッジ **100%** を必須基準とする。
8. **日本語組版・縦書き/ルビを含む VRT の UT（Storybook）一本化**:
   視覚的回帰テスト（VRT）は Storybook の全 Story を対象として **1280px（デスクトップ/タブレット幅）および 375px（モバイル幅）** の2系統で実施する。結合テスト（Playwright IT）では VRT を行わず、画面遷移とエンドツーエンドの振る舞い検証に専念する。
9. **不備記録と原因分類 `D`（設計不備）の即時設計同期義務**:
   実装・テスト・AIレビュー中に検出された不備は製品コードと支援成果物を分離して記録する。原因が `D`（設計・仕様の誤認や不備）である場合、**コードのみを修正して設計書を放置することは厳禁**とし、必ず同一 PR 内で `docs/specs/` の設計書（App 全体正本および進行中の差分仕様）も同時修正する。

---

## 2. Yommy 3層アーキテクチャ別の SSOT とテスト規律

前プロジェクトにおける「OpenAPI ＋ MSW」の規律を、Web小説リーダー（React + Vite + Capacitor）の特性に合わせて以下の3層テスト規律として適用します。

```mermaid
flowchart TB
    subgraph L1 ["1. Parser Layer (スクレイピング・DOM解析層)"]
        P_SSOT["<b>SSOT</b>: <code>NovelParser</code> 型契約<br>＋ <code>__fixtures__/*.html</code><br>＋ <code>docs/specs/parsers/*.md</code>"]
        P_TEST["<b>UT (Vitest)</b>: 実通信なし。ローカルHTMLフィクスチャを入力し<br>タイトル・目次・ルビ/傍点付き本文HTML抽出を 100% 検証"]
    end

    subgraph L2 ["2. Storage Layer (ローカルDB・キャッシュ管理層)"]
        S_SSOT["<b>SSOT</b>: <code>docs/specs/db-schema.md</code><br>＋ Storage Repository インターフェース"]
        S_TEST["<b>UT / IT</b>: SQLiteプラグインをアダプター抽象化。<br>テスト用インメモリDB (<code>resetTestDb()</code>) で CRUD・容量計算を決定論的検証"]
    end

    subgraph L3 ["3. Viewer & Bridge Layer (表示・ブラウザ連携・UI層)"]
        V_SSOT["<b>SSOT</b>: <code>docs/specs/features/*.md</code><br>＋ Http/WebView Bridge インターフェース"]
        V_TEST["<b>UT & VRT (Storybook + Vitest)</b>: 1対1 Story/UT、親子分離、<br>縦書き (<code>vertical-rl</code>)・ルビ・テーマ表示の 1280px/375px VRT"]
    end

    L1 --> L2 --> L3
```

### 2.1 Parser Layer（スクレイピング・DOM解析層）

- **SSOT（正本）**:
  - `NovelParser` 共通インターフェース契約（`docs/specs/architecture.md`）
  - サイト別スクレイピング仕様書（`docs/specs/parsers/*.md`）
  - 各小説サイトのサンプル HTML フィクスチャ（`__fixtures__/*.html`）
- **TDD・テスト規律**:
  - 単体テストでは外部ネットワーク通信を一切行わない。
  - ローカルのサンプル HTML フィクスチャ（正常ページ、ルビ `<ruby><rb><rt><rp>` や傍点を含む本文、複数ページ目次、短編、構造変更時の異常 HTML 等）を入力として、小説タイトル・著者・目次リスト・サニタイズ＆整形済み本文 HTML が正確に抽出されることを Vitest で C0/C1 100% 網羅する。
  - **実サイト HTML 構造・動的展開制限の事前調査鉄則**: 外部小説サイトのパーサー策定・実装時は、現行サイトの初期表示 DOM 件数制限（例: カクヨム作品トップの直近7話のみ DOM 表示）やトグル非表示章、`<script id="__NEXT_DATA__">` 等の埋め込み JSON データ構造を実サイト HTML で必ず事前調査し、7話超・複数章構成を含むフィクスチャで全件取得を検証すること。
  - 小説サイト側の DOM 仕様変更が発生した際は、まず新しい HTML フィクスチャをテストに追加して Red を確認してからパーサーのセレクタ・抽出ロジックを修正する。

### 2.2 Storage Layer（ローカルDB・キャッシュ管理層）

- **SSOT（正本）**:
  - `docs/specs/db-schema.md`（`novels`, `chapters`, `download_queue`, 設定テーブル等のスキーマ・制約定義）
  - Storage Repository インターフェース（`docs/specs/architecture.md`）
- **TDD・テスト独立性規律**:
  - `@capacitor-community/sqlite` 等のネイティブプラグインを UI やフックから直接呼び出さず、必ず Storage アダプター／リポジトリ層で抽象化する。
  - UT（Vitest）、Storybook、および Playwright IT（Webブラウザ実行）では、同一のインターフェースを満たすテスト用インメモリ DB（または SQLite アダプターのインメモリ実装）を使用する。
  - テスト間でデータが漏洩しないよう、`beforeEach` / `afterEach`（および IT の各テスト開始前）に必ず **`resetTestDb()`** を呼び出し、決定論的な初期シード状態にリセットする。

### 2.3 Viewer & Bridge Layer（表示・ブラウザ連携・UIコンポーネント層）

- **Capacitor Bridge の分離**:
  - CORS 回避用のネイティブ HTTP 通信（`CapacitorHttp`）、レートリミット・ダウンロードキュー制御、および内蔵 WebView からの DOM 抽出ブリッジは薄いインターフェースとして分離し、UT / Storybook / IT ではモックまたはフィクスチャ応答を注入可能にする。
- **小説組版 UI 単体テスト & VRT**:
  - 縦書き（`writing-mode: vertical-rl`）/ 横書き切り替え、ルビ（`<ruby>`）・傍点表示、フォント切り替え（Noto CJK / IPAex / BIZ UD明朝・ゴシック / Klee）、カラーテーマ（白 / セピア / ダーク / 純黒）、しおり位置復元などの UI 状態を Storybook の Story として網羅する。
  - **スクロール・Overflow（直交フロー）検証の必須化**: スクロール・Overflow を伴う表示コンポーネント（特に親 `horizontal-tb` 内で `writing-mode: vertical-rl` となる直交フロー要素）では、`w-full max-w-full`（および親コンテナの `min-w-0`）等の幅制約を明示するとともに、画面外にはみ出す長文データを含めた Story（1280px / 375px 双方で Overflow するケース）を必須とし、VRT と実ブラウザ IT（負の `scrollLeft` 検証）の双方でスクロール可能性を保証すること。
  - **VRT 孤児スナップショット検知ガードの義務化**: Storybook のストーリー削除・置換時に古いスナップショット PNG が孤児アセットとして残存するのを防ぐため、`test/vrt/vrt.spec.ts` において `storybook-static/index.json` の対象ストーリー一覧と `test/vrt/snapshots/` 内 PNG のファイル一覧が 1 対 1 で完全一致すること（孤児スナップショット 0 件）を機械検証すること。
  - **非同期永続化におけるロールバック ＆ `role="alert"` エラー通知規律**: 設定画面等の非同期更新において、DB/ストレージ書き込み失敗時に直前の state へ状態をロールバックし、画面上部（ヘッダー直下等）に `role="alert"`（`data-testid="*-error-alert"`）でエラーメッセージを明示すること。
  - **ルーティング同一パスガード（no-op 制御）**: 下部タブバー等のナビゲーション操作において、既に表示中の同一パスへの遷移要求は重複して `history.pushState` を行わず no-op とし、OS バックキーの直前画面復帰（`TR-12` 等）の履歴破壊を防止すること。
  - DevContainer と GitHub Actions で同一の日本語フォント環境を使用し、Storybook 全 Story に対して **1280px / 375px の VRT（視覚的回帰テスト）** を実行して組版崩れを機械的に検知する。

---

## 3. 単体テスト（UT / VRT）と結合テスト（IT）の責務マトリクス

| 観点                | UT（単体テスト & VRT）                                                                                                                                 | IT（結合テスト）                                                                                                     | Android 実機 / APK 検証                                                                                        |
| :------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| **実行環境**        | Node.js（Vitest + `jsdom`/`happy-dom`）＋ Storybook                                                                                                    | Chromium 実ブラウザ（Playwright Test）                                                                               | Android Studio エミュレータ / 実機（または Actions APK ビルド）                                                |
| **外部通信・DB**    | HTML フィクスチャ ＋ モック Bridge ＋ インメモリ DB（`resetTestDb()`）                                                                                 | ローカル開発サーバー ＋ フィクスチャ通信モック ＋ インメモリ DB 初期化                                               | 実 `CapacitorHttp` ＋ 実 `@capacitor-community/sqlite` ＋ 内蔵 WebView                                         |
| **検証対象**        | ・Parser 抽出ロジック・異常系<br>・Storage CRUD・容量計算・キュー制御<br>・Hooks 状態遷移・非同期競合防止<br>・全 `.tsx` の Props 分岐・操作（`play`） | ・画面間のルーティング遷移（`TR-xx`）<br>・URL取得〜DB保存〜リーダー閲覧〜キャッシュ削除の一貫シナリオ（`SCN-01`〜） | ・ネイティブ CORS 回避通信<br>・ネイティブ SQLite 永続化<br>・WebView フォールバック連携・ハードウェアキー操作 |
| **VRT（視覚検証）** | **実施（Storybook に一本化）**: 全 Story を 1280px / 375px でスナップショット検証                                                                      | **不実施**: 画面遷移と機能結合の振る舞い検証に特化                                                                   | 節目（Phase 3 / ミニMilestone）での実機表示確認                                                                |

### システム全体回帰保証（IT の進化原則）

- 結合テスト（`test/it/`）のシナリオ（`SCN-01`〜）は、今回追加した機能だけを孤立してテストするのではなく、**これまでに実装した全機能が現在のシステム仕様のもとで一貫して動作することを保証する統合スイート** として維持・進化させる。
- 過去のテストシナリオを古い仕様のまま放置・スキップ（`.skip`）することは禁止し、常に `test/it/` 全件 100% PASS を維持する。

---

## 4. TDD サイクルとコミット規約

### 4.1 Red → Green → Refactor の手順とコミット証跡

TDD の実践を Git 履歴から客観的に監査できるよう、各ステップで個別にコミットを刻みます。

| ステップ        | コミットメッセージ例                                                | コミット時点の状態と検証内容                                                                                           |
| :-------------- | :------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------- |
| **1. Red**      | `test(parser): カクヨム小説本文のルビ抽出テストを追加（Red）`       | テストコード（およびフィクスチャ/Story）のみ追加。対象 UT を実行し、**未実装により期待通りの理由で失敗する**ことを確認 |
| **2. Green**    | `feat(parser): カクヨム小説本文のルビ・傍点抽出処理を実装（Green）` | テストを通す最小限の実装を追加（YAGNI 原則）。対象 UT を実行し、**全件 PASS する**ことを確認                           |
| **3. Refactor** | `refactor(parser): DOMサニタイズ処理を共通関数へ抽出（Refactor）`   | 振る舞いを変えずに可読性・型安全性を改善。対象 UT が**引き続き PASS する**ことを確認                                   |

### 4.2 テスト名・Storybook の日本語記述規約

- **Vitest テスト名（`it`）**:
  「〜すること」「〜する」等の自然な日本語で記述し、対応する受け入れ条件（`AC-xx`）があれば末尾に付記する（例: `it("ルビタグを保持したまま本文HTMLを抽出する (AC-02)", ...)`）。
- **Storybook ストーリー定義（必須チェックリスト）**:
  - [ ] **英語識別子**: エクスポート識別子は PascalCase の英語名（`export const VerticalDarkTheme: Story = ...`）とする。
  - [ ] **日本語 JSDoc**: 各 Story の直前に日本語の JSDoc コメント（ストーリーの意図・描画状態の説明）を付与する。
  - [ ] **日本語 `name` プロパティ**: `name: "縦書き・ダークテーマ"` のように、Storybook サイドバーに表示される日本語名を必ず明示する（省略時の英語自動変換に依存しない）。
  - [ ] **Portable Stories テスト連携**: 同階層の `.test.tsx` では `@storybook/react` の `composeStories` を用いて全 Story の描画および `play` 関数を実行し、Story だけで届かないエッジケース分岐を Vitest ケースとして補完する。

---

## 5. カバレッジ基準と除外ルール

### 5.1 必須基準

- **C0（Statements / Lines）**: **100%**
- **C1（Branches）**: **100%**
- **Functions**: **100%**

### 5.2 除外が許容されるケース

安易な `/* v8 ignore next */` の使用は禁止します。カバレッジ集計（`vite.config.ts` の `coverage.exclude`）から除外してよいのは以下の5点のみです：

1. 実行可能な JS コードを含まない純粋な型定義ファイル（`types.ts`, `*.d.ts`）
2. Storybook のストーリー定義ファイル自体（`*.stories.tsx`。実行検証は `.test.tsx` 側で行うため）
3. テスト環境セットアップ支援ファイル（`src/test/**`）
4. ブラウザ DOM ルートへの React 初期マウントエントリーポイント（`src/main.tsx`。結合テスト `smoke.spec.ts` で起動検証）
5. TypeScript の網羅性チェック用の到達不能分岐（`default: const _exhaustiveCheck: never = value;` 等、理由コメントを明記した場合のみ）

---

## 6. バグ記録と原因分類 `D`（設計不備）の即時同期ルール

TDD の Green/Refactor 段階、自動テスト、または独立 AI レビュー（`pr-reviewer` / `phase-final-reviewer`）において不備が検出された場合は、[docs/quality/bug-and-handover-log.md](../quality/bug-and-handover-log.md) および PR 本文に記録します（通常の TDD 初回 Red は除外し、既存実装の不備やレビュー指摘等を記録対象とする）。

### 6.1 成果物区分と原因 5 分類

- **成果物区分**:
  - `製品コード`: `src/` 配下の本番アプリケーションコード（製品バグ密度や DRE 計測の集計対象）
  - `支援成果物`: テストコード、Storybook、HTML フィクスチャ、モック、CI/設定ファイル等
- **原因分類コード（5分類）**:
  - **`L` (Logic)**: 条件式・アルゴリズム・セレクタ抽出等のロジック誤り
  - **`S` (State)**: React State・キャッシュ状態・しおり位置等の状態遷移誤り
  - **`D` (Design)**: 仕様・設計書の誤認、インターフェース契約や DB スキーマとの不一致、設計考慮漏れ
  - **`B` (Boundary)**: 空文字、0件、長大テキスト、不正 HTML、特殊文字等の境界値・エッジケース考慮漏れ
  - **`A` (Async)**: 非同期競合（Race Condition）、レートリミット制御、AbortController 未連携、二重実行防止漏れ

### 6.2 【最重要】原因分類 `D` の設計書即時同期義務

不備の原因が **`D`（設計・仕様不備）** に該当する場合、**コードやテストだけを修正して終わらせることは厳格に禁止**します。

1. 必ず対応する `docs/specs/` 配下の設計書（**App 全体正本、および進行中の差分仕様 `docs/specs/changes/issue-XX-*.md` の双方**）も同一 PR 内で修正し、設計と実装の 1 対 1 整合を回復させる。
2. バグ記録の是正内容欄には、**コード修正コミットと設計書修正コミットの双方** を明記する。
