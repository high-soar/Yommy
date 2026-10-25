---
type: quality-log
title: 品質記録・バグ記録票 ＆ 申し送り管理シート（Bug & Handover Log）
description: 製品コードと支援成果物を分離したバグ記録（原因5分類 L/S/D/B/A）および後続タスクへの申し送り事項（HO-xx）を追跡する正本シート。
status: Approved
updated: "2026-10-25"
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

---

## 2. バグ記録一覧（Bug Log）

| No. | Issue / PR | 検出フェーズ・手段                   | 成果物区分 (`製品コード` / `支援成果物`) | 対象箇所                                              | 原因 (`L`/`S`/`D`/`B`/`A`) | 不備の概要と是正内容（原因 `D` は設計書同期コミット併記）                                                                                                                                                                             |
| :-: | :--------: | :----------------------------------- | :--------------------------------------: | :---------------------------------------------------- | :------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|  1  |     #3     | OKF検証 (`npm run lint:okf`)         |                支援成果物                | `.github/skills/sdd/scripts/validate-okf.mjs`         |            `L`             | `parseFrontmatter` においてクォート内の `#` がコメントとして一律除去され `status: "Review (#N)"` が不正ステータスと判定されていた不備を、クォート認識付きコメント除去関数 `stripYamlComment` を導入して是正。                         |
|  2  |     #3     | 単体テスト (`npm run test:coverage`) |                支援成果物                | `vite.config.ts`                                      |            `D`             | `docs/guidelines/testing.md` の除外規定（純粋な型定義ファイル `types.ts`）が `vite.config.ts` の `coverage.exclude` に未反映でカバレッジ閾値エラーとなっていた不備を、`src/**/types.ts` を除外リストに追加して是正。                  |
|  3  |     #4     | TDD Green / 結合 (`npm run test`)    |                製品コード                | `src/storage/adapter/inMemoryDb.ts`                   |            `S`             | `InMemoryDatabaseAdapter` の `execute` ごとに呼ばれる `onUpdate`（export）がトランザクション中に実行され、`sql.js` のトランザクションが不正終了していた不備。`inTransaction` フラグを導入し、コミット完了時のみ export するよう是正。 |
|  4  |     #4     | TypeScript ビルド (`npm run build`)  |                製品コード                | `src/app/ServiceProvider.tsx`                         |            `D`             | `createDefaultMockHttpClient` 内でモックレスポンスの `HttpResponse.headers` プロパティが未定義で型エラーとなっていた不備を、`headers: {}` を補完して是正（設計書 `docs/specs/architecture.md` のインターフェース契約に準拠）。        |
|  5  |     #4     | 結合テスト (`npm run test:it`)       |                支援成果物                | `test/it/scenarios/scn01-poc-vertical-reader.spec.ts` |            `D`             | カクヨム第1話タイトル期待値を「第1話 見知らぬ空」と誤認して結合テストが失敗した不備を、実際のフィクスチャ定義「プロローグ：目覚め」に合わせて是正。                                                                                   |

---

## 3. 申し送り事項追跡一覧（Handover Items: `HO-xx`）

設計時や PR 作業中に「現在の PR スコープ外だが、後続の Sub-issue や IT、実機確認で必ず検証・対応すべき事項」が発生した場合は、以下に `HO-xx` として登録し、解決ゲート（親 Issue クローズ前、または Milestone 完了前）までに確実に消化します。

|   ID    | 起票元 Issue / PR | 申し送り事項の内容                                                                                                                                                                                                              | 解決先（対象 Issue / 成果物） | 完了ゲート         | 状態 (`Open` / `Resolved`) |
| :-----: | :---------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------- | :----------------- | :------------------------: |
| `HO-01` |        #2         | カクヨム用のサイト別スクレイピング仕様書（`docs/specs/parsers/kakuyomu.md`）の策定、および HttpClientBridge・HtmlSanitizer・KakuyomuParser・Storage Layer（DatabaseAdapter/Repositories）のローカルフィクスチャ Vitest TDD 実装 | #3 (`[Phase 3-2a]`)           | Issue #3 PR マージ |         `Resolved`         |
| `HO-02` |        #2         | ServiceProvider 経由での Http/Storage/Parser 注入、縦書き・ルビ対応ミニマムリーダー UI、Storybook VRT、および Playwright IT（`SCN-01` 縦貫通シナリオ）の結合実装                                                                | #4 (`[Phase 3-2b]`)           | Issue #4 PR マージ |         `Resolved`         |

---

## 4. ミニリリース Milestone 品質振り返りサマリー（定期追記）

各節目（Phase 3 完了時、および Phase 4 以降の各ミニリリース Milestone 完了時）に、上記バグ記録を集計して傾向分析とプロセス改善（Kaizen）アクションを記録します（詳細レポートは `docs/quality/reports/` 配下に `type: quality-report` として格納）。

### [テンプレート] Milestone `vX.Y`（対象 Issue: `#XX` 〜 `#YY`）

- **製品コード不備件数**: 0 件（うち MK/UT/PRレビュー検出: 0 件、IT 流出: 0 件、実機流出: 0 件 → **UT段階 DRE: - %**）
- **支援成果物不備件数**: 0 件
- **原因分類内訳**: `L`: 0件 / `S`: 0件 / `D`: 0件 / `B`: 0件 / `A`: 0件
- **プロセス・スキル改善アクション（Kaizen）**:
  - （再発防止のために更新した `docs/guidelines/` や `.github/skills/*/SKILL.md` の変更内容を記載）
