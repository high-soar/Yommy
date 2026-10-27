---
type: quality-log
title: 品質記録・バグ記録票 ＆ 申し送り管理シート（Bug & Handover Log）
description: 製品コードと支援成果物を分離したバグ記録（原因5分類 L/S/D/B/A）および後続タスクへの申し送り事項（HO-xx）を追跡する正本シート。
status: Approved
updated: "2026-10-27"
tags: [quality, bug-log, handover, dre, kaizen]
related_specs:
  - docs/index.md
  - docs/guidelines/workflow.md
  - docs/guidelines/testing.md
related_tests: []
---

# 品質記録・バグ記録票 ＆ 申し送り管理シート（Bug & Handover Log）

本ドキュメントは、Yommy の開発プロセス（TDD 実装、単体テスト、VRT、結合テスト、独立 AI レビュー、節目横断レビュー）において検出された不備の記録、および後続タスクへの申し送り事項（Handover Items）を追跡管理する正本シートです。

---

## 1. バグ記録の記入ルール

1. **記録対象と除外基準**:
   - **記録対象**: 実装後のテスト失敗、AI レビュー（`pr-reviewer` / `phase-final-reviewer`）での指摘事項、VRT 差分検知、IT（結合テスト）や実機確認で発覚した仕様違反・バグ・設計不整合を 1 件として記録します。
   - **除外対象**: TDD の初回 Red ステップ（未実装機能に対する意図的なテスト失敗）や、作業中の単純なタイポ・フォーマッタ自動整形は除外します。
2. **成果物区分の厳格分離**:
   - **`製品コード`**: `src/` 配下の本番アプリケーションコードの不備（製品バグ密度および欠陥除去率 DRE の分子として集計）。
   - **`支援成果物`**: テストコード（`*.test.*`, `test/it/`）、Storybook（`*.stories.tsx`）、HTML フィクスチャ、モック、設計ドキュメント単体の記述ミス、CI/設定ファイルの不備。
3. **原因分類コード（5分類）**:
   - **`L` (Logic)**: 条件分岐・アルゴリズム・DOM セレクタ抽出等のロジック誤り
   - **`S` (State)**: React State・キャッシュ状態・しおり位置等の状態遷移誤り
   - **`D` (Design)**: 仕様・設計書（`docs/specs/`）の誤認、インターフェース契約や DB スキーマとの不一致、設計考慮漏れ
   - **`B` (Boundary)**: 空文字、0件、長大テキスト、不正 HTML、特殊文字等の境界値・エッジケース考慮漏れ
   - **`A` (Async)**: 非同期競合（Race Condition）、レートリミット・キュー制御、AbortController 未連携、二重実行防止漏れ
4. **【重要】原因分類 `D` の設計書即時同期義務**:
   - 原因が **`D`** の場合、**コードのみを修正して設計書を放置することは厳禁**です。必ず対応する `docs/specs/` の設計書（App 全体正本および進行中の差分仕様）も同時修正し、下表の是正内容欄に **コード修正コミットと設計書同期コミットの双方** を記録してください。
5. **【運用】Milestone 完了時のアーカイブ移動ルール**:
   - 各ミニリリース Milestone（`v0.1`, `v0.2` 等）や Phase 完了の節目（Step 3：一括 `Approved` 化 PR）において、当該マイルストーンで検出されたバグ記録一覧および解決済み（`Resolved`）の申し送り事項を `docs/quality/archive/<milestone>-log.md`（OKF `type: quality-log`, `status: Completed (Archived)`）へ移動しアーカイブ化します。
   - 本シート（`docs/quality/bug-and-handover-log.md`）には、平時は「現在作業中マイルストーンのバグ記録」「作業中マイルストーンで解決した申し送り事項」「未解決（`Open`）の申し送り事項」のみを保持し、ドキュメントの肥大化を防止して高い一覧性とメンテナンス性を維持します。

---

## 2. バグ記録一覧（Bug Log）

> [!NOTE]
> **完了済みマイルストーンのアーカイブ記録**:
> 過去のマイルストーンで完了したバグ記録は、以下のアーカイブファイルへ移動・保存されています：
>
> - **Phase 3（PoC 実証、No. 1〜31）**: [docs/quality/archive/phase3-poc-log.md](archive/phase3-poc-log.md)
> - **Milestone `v0.1`（カクヨム MVP、No. 32〜70）**: [docs/quality/archive/v0.1-mvp-log.md](archive/v0.1-mvp-log.md)
>
> 現在作業中の **Milestone `v0.2`（UI/UX ＆ 開発インフラ改善）** で検出されたバグ記録は、本表へ No. 71 より連番で記入します。

| No. | Issue / PR | 検出フェーズ・手段                        | 成果物区分 (`製品コード` / `支援成果物`) | 対象箇所                                                                                                    | 原因 (`L`/`S`/`D`/`B`/`A`) | 不備の概要と是正内容（原因 `D` は設計書同期コミット併記）                                                                                                                                                                                                                                                                                                                                                                                                                |
| :-: | :--------: | :---------------------------------------- | :--------------------------------------: | :---------------------------------------------------------------------------------------------------------- | :------------------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 71  | #52 / PR58 | 独立AIレビュー (`pr-reviewer` 指摘1)      |                支援成果物                | `docs/specs/features/reader-view.md`                                                                        |            `D`             | `ReaderPageProps` テーブルにおいて `initialOverlayOpen?: boolean` が正本から欠落し差分仕様と不整合であった不備。正本 `reader-view.md` に追加定義して同期是正。                                                                                                                                                                                                                                                                                                           |
| 72  | #52 / PR58 | 独立AIレビュー (`pr-reviewer` 指摘2)      |                支援成果物                | `docs/specs/screen-transitions.md`, `docs/specs/features/reader-view.md`                                    |            `D`             | `screen-transitions.md` において `TR-06` 遷移先カラムの `SCR-05` 記載漏れ、および Mermaid 図での遷移 ID 誤表記（`TR-01`）。遷移先カラム（`SCR-02 / SCR-01 / SCR-05`）、Mermaid ラベル（`TR-06`）、および `reader-view.md` の `TR-06` 説明を完全同期是正。                                                                                                                                                                                                                |
| 73  | #52 / PR58 | 独立AIレビュー (`pr-reviewer` 指摘3)      |                支援成果物                | `docs/specs/screen-transitions.md`                                                                          |            `D`             | `screen-transitions.md` の `SCR-05` ルートパスが旧定義（`/manage`）のまま残留し `reader-view.md` の `/settings` と乖離していた不備。Table 1 および Mermaid 図のパスを `/settings`・画面名を「設定」へ更新して同期是正。                                                                                                                                                                                                                                                  |
| 74  | #52 / PR58 | 独立AIレビュー (`pr-reviewer` 指摘4)      |                支援成果物                | `docs/specs/requirements.md`                                                                                |            `D`             | `requirements.md` の `SYS-REQ-08` 受入条件 ID 列に全画面テキスト表示化 `AC-RD-09` が記載されておらず順方向トレーサビリティが切れていた不備。受入条件 ID 列に `AC-RD-09` を追記して同期是正。                                                                                                                                                                                                                                                                             |
| 75  | #50 / PR60 | 設計 PR 独立 AI レビュー（`pr-reviewer`） |                支援成果物                | `docs/specs/`                                                                                               |            `D`             | 独立 AI レビューにより、① `screen-transitions.md` の OKF 概要（TR-01〜12）および `TR-01` 遷移元・Mermaid 図における `SCR-02` 脱落、② `requirements.md` の `SYS-REQ-16` における `AC-RD-08, 09` トレーサビリティ欠落、③ `novel-detail.md` 対象外スコープの旧マイルストーン番号（v0.2/v0.3 残存）、④ `settings.md` 受入条件での `TR-01b` 明記漏れ、⑤ `reader-view.md` 受入条件でのツールバー廃止・全画面化（`AC-RD-09`）欠落を是正。各全体正本および差分仕様書を同期修正。 |
| 76  | #61 / PR68 | 独立AIレビュー (`pr-reviewer` 指摘1)      |                支援成果物                | `docs/specs/changes/issue-52-reader-fullscreen-and-bottom-overlay.md`, `docs/specs/features/reader-view.md` |            `D`             | `ReaderBottomOverlay` の下部タブ（`reader-bottom-tab-bookshelf`, `reader-bottom-tab-settings`）および閉じるボタン（`reader-bottom-overlay-close`）の `data-testid` 仕様が差分仕様書と不一致かつ正本仕様書に未記載であった不備。コード実装（`f67abab`）の名前空間設計に基づき、差分仕様書 §3.2 および正本仕様書 `reader-view.md` §3.3 に個別属性仕様を追記・同期是正。                                                                                                    |
| 77  |    #62     | TDD Green 実装・IT 検証                   |                製品コード                | `src/features/reader/components/ReaderPage.tsx`                                                             |            `L`             | `ReaderPage` の初期マウント時、エピソードデータ読み込み中（`isLoading = true`, `chapter = null`）において `!hasBodyHtml` 条件を満たしてしまい、`isOpen` が `true` に誤初期化されて初期非表示要件（`AC-RD-10`）に反していた不備。初期値計算および `useEffect` 双方に `!isLoading` ガードを追加し、通信完了前はオーバーレイを表示しないよう是正。                                                                                                                          |
| 78  |    #62     | 単体テスト（UT）                          |                支援成果物                | `src/App.test.tsx`                                                                                          |            `D`             | `App.test.tsx` のリーダー画面遷移テストにおいて、Phase 3 の旧ツールバー要素（`reader-toolbar`, `reader-back-to-bookshelf`, `reader-back-to-detail`）に依存したアサーションが残留していた不備。新設計（Issue #52、先行 PR #58 / #60 にて設計書側は反映済み）に準拠し、最下部タッチゾーン（`reader-bottom-touch-zone`）経由の下部オーバーレイ「本棚」タブ遷移、および OS バックキー（`popstate`）による目次復帰のテストケースへ改修。                                      |

---

## 3. 申し送り事項追跡一覧（Handover Items: `HO-xx`）

設計時や PR 作業中に「現在の PR スコープ外だが、後続の Sub-issue や IT、実機確認で必ず検証・対応すべき事項」が発生した場合は、以下に `HO-xx` として登録し、解決ゲート（親 Issue クローズ前、または Milestone 完了前）までに確実に消化します。

> [!NOTE]
> **解決済み申し送り事項（`HO-01`〜`HO-09`）のアーカイブ**:
>
> - Phase 3 で解決済みの申し送り（`HO-01`〜`HO-03`）: [docs/quality/archive/phase3-poc-log.md](archive/phase3-poc-log.md)
> - Milestone `v0.1` で解決済みの申し送り（`HO-04`〜`HO-09`）: [docs/quality/archive/v0.1-mvp-log.md](archive/v0.1-mvp-log.md)

|   ID    | 起票元 Issue / PR | 申し送り事項の内容                                                                                                                                                                            | 解決先（対象 Issue / 成果物）                                     | 完了ゲート          | 状態 (`Open` / `Resolved`) |
| :-----: | :---------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------- | :------------------ | :------------------------: |
| `HO-10` |        #42        | `scripts/generate-icons.test.ts` の `chromium.launch` モック化または CI 分離による `lint-and-unit` ジョブの完全ブラウザレス化（所要時間 20 秒前後への極限短縮）                               | Milestone `v0.2` インフラ改善 (#49)                               | Issue #49 PR マージ |         `Resolved`         |
| `HO-11` |        #51        | 作品詳細・目次画面（`SCR-02`）のヘッダー固定・あらすじトグル・各話内部スクロール・しおり位置初期スクロールに関する Playwright 実ブラウザ IT シナリオ（`SCN-01` 等）での回帰検証および動作確認 | Issue #51 Sub-issue ② (#57 IT PR)                                 | Issue #51 PR マージ |           `Open`           |
| `HO-12` |        #52        | 小説リーダー画面（`SCR-03`）の全画面テキスト化および最下部ゾーンタップ判定（ドラッグ/スワイプ誤検知防止、72px / 15% 領域）の実機・Playwright IT検証                                           | Milestone `v0.2` リーダー全画面化 (#52) Sub-issue ③ (#52-3 IT PR) | Issue #52 PR マージ |           `Open`           |
| `HO-13` |        #50        | 100dvh 全画面シェル・下部タブ・設定画面・OS バックキーの実ブラウザ結合テスト SCN-01 および Android 実機確認                                                                                   | Issue #50 MK-3 / IT PR                                            | Issue #50 PR マージ |           `Open`           |

---

## 4. ミニリリース Milestone 品質振り返りサマリー（定期追記）

各節目（Phase 3 完了時、および Phase 4 以降の各ミニリリース Milestone 完了時）に、上記バグ記録を集計して傾向分析とプロセス改善（Kaizen）アクションを記録します（詳細レポートは `docs/quality/reports/` 配下に `type: quality-report` として格納）。

### Phase 3: PoC（Walking Skeleton 実証、対象 Issue: #1, #2, #3, #4、記録 No. 1〜31）

- **アーカイブ記録**: [docs/quality/archive/phase3-poc-log.md](archive/phase3-poc-log.md)
- **詳細分析レポート**: [docs/quality/reports/phase3-poc.md](reports/phase3-poc.md)
- **製品コード不備件数**: 11 件（うち MK/UT/PRレビュー検出: 2 件、横断レビュー検出: 7 件、IT 流出: 0 件、Step 3-3 実機検証検出: 2 件 → **UT/レビュー段階 DRE: $9/11 \approx 81.8\%$**）
- **支援成果物不備件数**: 20 件（OKF・正本同期 13 件、テストコード・VRT 衛生 7 件）
- **原因分類内訳**: `L`: 11 件（製品 4 / 支援 7） / `S`: 1 件（製品 1） / `D`: 17 件（製品 4 / 支援 13） / `B`: 2 件（製品 2） / `A`: 0 件（計 31 件）
- **プロセス・スキル改善アクション（Kaizen）**:
  - `docs/guidelines/testing.md` のカバレッジ除外規定（`src/main.tsx`, `src/test/**`）を明文化。
  - セレクタ優先順位の厳格化（配列順次探索 `queryFirst`）と `chapters` 一意キー `(novel_id, remote_chapter_id)` の正本化。
  - ネイティブ DI 自動配線（`Capacitor.isNativePlatform()`）および共有 DDL（`src/storage/schema.ts`、`reader_settings` 初期行含む）の整備。
  - VRT の固定待機排除・アサーションベース待機化、0件空振り防止アサーションの義務化。

### Milestone `v0.1`: カクヨム MVP（3画面基本完成・アプリアイコン設定、対象 Issue: #12, #13, #14, #15, #42, #16、記録 No. 32〜70）

- **アーカイブ記録**: [docs/quality/archive/v0.1-mvp-log.md](archive/v0.1-mvp-log.md)
- **詳細分析レポート**: [docs/quality/reports/v0.1-mvp.md](reports/v0.1-mvp.md)
- **製品コード不備件数**: 7 件（うち MK/UT/PRレビュー検出: 0 件、横断コードレビュー検出: 5 件、実データ動作確認検出: 2 件［`R1-26`, `R1-27`］、リリース後流出: 0 件 → **自動テスト・コードレビュー段階 DRE: $5/7 \approx 71.4\%$、Milestone リリース前 DRE: 100%**）
- **支援成果物不備件数**: 32 件（独立 AI PR レビュー設計・レポート同期 6 件、MK/IT/CI テスト・スクリプト是正 6 件、節目横断レビュー正本/テスト/CI 是正 20 件）
- **原因分類内訳（Milestone `v0.1` 単体 39 件）**: `D`: 21 件（製品 3 / 支援 18） / `L`: 15 件（製品 2 / 支援 13） / `A`: 2 件（製品 1 / 支援 1） / `B`: 1 件（製品 1 / 支援 0） / `S`: 0 件（計 39 件、Phase 3 からの累計 70 件）
- **プロセス・スキル改善アクション（Kaizen）**:
  - **実サイト HTML 構造・埋め込みデータ事前調査の義務化（`R1-27` 再発防止）**: `docs/guidelines/testing.md` §2.1 および `.github/skills/c-ut-workflow/SKILL.md` に、外部小説サイトパーサー実装時の初期表示 DOM 制限（直近7話等）・トグル非表示章・`__NEXT_DATA__` 埋め込み JSON の事前調査と 7話超・複数章フィクスチャ検証を明文化。
  - **直交フロー（縦書き `vertical-rl`）の幅制約と長文 Overflow Story / IT 検証の義務化（`R1-26` 再発防止）**: `docs/guidelines/testing.md` §2.3 および `.github/skills/c-ut-workflow/SKILL.md` に、直交フロー要素の `w-full max-w-full` 幅制約、1280px/375px 双方で Overflow する長文 Story の必須化、および実ブラウザ IT での負の `scrollLeft` 検証を明文化。
  - **OKF 検証スクリプトの強化（`R1-08` 再発防止）**: `.github/skills/sdd/scripts/validate-okf.mjs` を拡張し、`related_specs` に加えて `related_tests` 配列内のテストファイルパス実在性を機械検証するよう強化。
  - **1対1 Story/UT 原則の例外明記（`R1-14` 解消）**: `docs/guidelines/testing.md` §1.5 に `src/main.tsx`（§5.2 項4）の例外参照を明記し規約間の整合性を確立。
