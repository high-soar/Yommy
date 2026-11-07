---
type: quality-log
title: 品質記録・バグ記録票 ＆ 申し送り管理シート（Bug & Handover Log）
description: 製品コードと支援成果物を分離したバグ記録（原因5分類 L/S/D/B/A）および後続タスクへの申し送り事項（HO-xx）を追跡する正本シート。
status: "Approved"
updated: "2026-11-06"
tags: [quality, bug-log, handover, dre, kaizen]
related_specs:
  - docs/specs/changes/archive/issue-240-narou-search-ranking-and-site-selector.md
  - docs/specs/changes/archive/issue-239-narou-parser-and-multi-page-toc.md
  - docs/specs/parsers/narou.md
  - docs/specs/changes/archive/issue-238-loading-ux-clarification.md
  - docs/specs/changes/archive/issue-203-volume-key-paging.md
  - docs/specs/changes/archive/issue-202-reader-top-overlay-and-seekbar.md
  - docs/specs/changes/archive/issue-201-reader-page-slide-animation.md
  - docs/specs/changes/archive/issue-169-font-and-margin-customization.md
  - docs/specs/changes/archive/issue-170-cache-management-and-capacity-visualization.md
  - docs/specs/changes/archive/issue-168-reader-pagination-and-touch-refinement.md
  - docs/specs/changes/archive/issue-122-reader-page-turning.md
  - docs/specs/changes/archive/issue-123-reader-bottom-overlay-ui-improvement.md
  - docs/specs/changes/archive/issue-124-settings-back-button-navigation.md
  - docs/specs/changes/archive/issue-120-cloud-sync-google-drive.md
  - docs/quality/archive/v0.4-cloud-sync-reader-ux-log.md
  - docs/quality/archive/v0.5-reader-customization-and-cache-log.md
  - docs/quality/archive/v0.6-reader-animation-overlay-and-volume-key-log.md
  - docs/quality/reports/v0.4-cloud-sync-reader-ux.md
  - docs/quality/reports/v0.5-reader-customization-and-cache.md
  - docs/quality/reports/v0.6-reader-animation-overlay-and-volume-key.md
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
   - 各ミニリリース Milestone（`v0.1`, `v0.2` 等）や Phase 完了の節目（Step 3：品質分析 Kaizen・ログアーカイブ・一括 `Approved` 化 PR）において、当該マイルストーンで検出されたバグ記録一覧および解決済み（`Resolved`）の申し送り事項を `docs/quality/archive/<milestone>-log.md`（OKF `type: quality-log`, `status: Completed (Archived)`）へ移動しアーカイブ化します。
   - 本シート（`docs/quality/bug-and-handover-log.md`）には、平時は「現在作業中マイルストーンのバグ記録」「作業中マイルストーンで解決した申し送り事項」「未解決（`Open`）の申し送り事項」のみを保持し、ドキュメントの肥大化を防止して高い一覧性とメンテナンス性を維持します。

---

## 2. バグ記録一覧（Bug Log）

> [!NOTE]
> **完了済みマイルストーンのアーカイブ記録**:
> 過去のマイルストーンで完了したバグ記録は、以下のアーカイブファイルへ移動・保存されています：
>
> - **Phase 3（PoC 実証、No. 1〜31）**: [docs/quality/archive/phase3-poc-log.md](archive/phase3-poc-log.md)
> - **Milestone `v0.1`（カクヨム MVP、No. 32〜70）**: [docs/quality/archive/v0.1-mvp-log.md](archive/v0.1-mvp-log.md)
> - **Milestone `v0.2`（UI/UX 刷新 ＆ 開発基盤整備、No. 71〜99）**: [docs/quality/archive/v0.2-ui-ux-log.md](archive/v0.2-ui-ux-log.md)
> - **Milestone `v0.3`（検索/ランキング・先読みキャッシュ・更新チェック ＆ 実機基盤改善、No. 100〜132）**: [docs/quality/archive/v0.3-search-prefetch-log.md](archive/v0.3-search-prefetch-log.md)
> - **Milestone `v0.4`（クラウド同期・ページめくり・リーダーUI改善、No. 133〜168）**: [docs/quality/archive/v0.4-cloud-sync-reader-ux-log.md](archive/v0.4-cloud-sync-reader-ux-log.md)
> - **Milestone `v0.5`（縦書きリーダー組版・ページめくり抜本改善・カスタマイズUI・キャッシュ管理、No. 169〜180）**: [docs/quality/archive/v0.5-reader-customization-and-cache-log.md](archive/v0.5-reader-customization-and-cache-log.md)
> - **Milestone `v0.6`（リーダーページ送り水平スライドアニメーション・上下連動オーバーレイ＆シークバー・ハードウェア音量キー操作、No. 181〜201）**: [docs/quality/archive/v0.6-reader-animation-overlay-and-volume-key-log.md](archive/v0.6-reader-animation-overlay-and-volume-key-log.md)
>
> 次期作業中の **Milestone `v0.7`（小説家になろう［narou］対応［パーサー・複数ページ目次・同期・検索 / ランキング / SiteSelector］＆ Web アクセス時ローディング UX 改善）** で検出されたバグ記録は、本表へ No. 202 より連番で記入します。

| No. |     Issue / PR     | 検出フェーズ・手段            | 成果物区分 (`製品コード` / `支援成果物`) | 対象箇所                                                                                                                                                                                                                                        | 原因 (`L`/`S`/`D`/`B`/`A`) | 不備の概要と是正内容（原因 `D` は設計書同期コミット併記）                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| :-: | :----------------: | :---------------------------- | :--------------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 202 |    #236 / #237     | PRレビュー (`pr-reviewer`)    |                支援成果物                | `.github/agents/phase-final-reviewer.agent.md`, `docs/guidelines/review-comment-format.md`, `docs/index.md`, `.github/skills/sdd/SKILL.md`, `docs/quality/bug-and-handover-log.md`                                                              |            `D`             | PR #237 レビューにて、`phase-final-reviewer.agent.md` および `review-comment-format.md` §4.C に残存していた Milestone Step 2/Step 3 の旧名称記述、および `docs/index.md` §3・`sdd/SKILL.md`・`bug-and-handover-log.md` §1 項5 の実機検証計画・Step 3 表記を正本 `workflow.md` に同期是正（コミット `bb4d3e8` にて是正）。                                                                                                                                                                                                 |
| 203 |    #244 / #246     | pre-push (test:coverage)      |                支援成果物                | `src/features/reader/components/ReaderContainer.test.tsx`                                                                                                                                                                                       |            `A`             | `ReaderContainer` の本文スクロール時進捗更新テストにおいて、孫コンポーネント `ReaderView` の DOM を直接操作していたため、高負荷並行実行時に `settingsRepository.getSettings()` の非同期解決前にスクロールが発火して `isPaged` によるガードでタイムアウトする非同期競合が発生。`vi.spyOn(ReaderPageModule, "ReaderPage")` を用いた親子分離（`R1-01`, `R1-11`）を徹底し、`onScrollProgressChange` の呼び出し受け渡し検証へ是正（コミット `3ab574c` にて是正）。                                                             |
| 204 |    #239 / #251     | PRレビュー (`pr-reviewer`)    |                支援成果物                | `docs/specs/requirements.md`, `docs/specs/parsers/narou.md`, `docs/specs/architecture.md`, `docs/specs/changes/archive/issue-239-narou-parser-and-multi-page-toc.md`, `docs/specs/features/bookshelf.md`, `docs/specs/features/novel-detail.md` |            `D`             | PR #251 レビュー（Round 1）にて検出された① `requirements.md` §3・§4 の `SYS-REQ-xx` と `AC-NR-01`〜`10` の双方向トレーサビリティ追記漏れ、② `nextTocPageUrl` の同一作品・HTTPS 検証（SSRF 防止境界条件）明文化、③ 差分仕様書のサブタイトルセレクタ優先順および `bookshelf.md` / `novel-detail.md` 記述整合を同一 PR 内で同期是正（コミット `6db72fc` にて是正）。                                                                                                                                                         |
| 205 | #240 / #254 / #257 | TDD (Green/test:coverage)     |                支援成果物                | `src/features/search/hooks/useNovelSearch.test.ts`, `src/features/ranking/hooks/useNovelRanking.test.ts`                                                                                                                                        |            `S`             | `NarouParser` への検索・ランキング機能実装により `narou` が探索対応サイトとなったため、旧来「未対応サイト」の代表値として `narou` を指定していた `useNovelSearch.test.ts` および `useNovelRanking.test.ts` の未実装エラー検証テスト（計3件）が失敗。探索未対応サイトの検証対象を `generic` に切り替え、テスト契約を是正（コミット `4641ca5` にて是正）。                                                                                                                                                                  |
| 206 |    #238 / #247     | PRレビュー (`pr-reviewer`)    |                支援成果物                | `test/it/scenarios/scn02-search-ranking-discovery.spec.ts`                                                                                                                                                                                      |            `S`             | PR #247 レビュー指摘1：SCN-02 のジャンル切替テストにて `if (await fantasyGenreBtn.isVisible())` の条件分岐が存在し、UI 非表示時にテストが暗黙スキップされるリスクがあったため、`toBeVisible()` による明示的かつ決定論的なアサーションに是正（コミット `b7d02c0` にて是正）。                                                                                                                                                                                                                                              |
| 207 |    #238 / #247     | PRレビュー (`pr-reviewer`)    |                支援成果物                | `test/it/scenarios/scn02-search-ranking-discovery.spec.ts`                                                                                                                                                                                      |            `S`             | PR #247 レビュー指摘2：SCN-02 のテスト名に「ローディング表示および操作無効化」と記載されていたが、インメモリ MockHttpClient 環境では即時解決されるため実際は一覧再取得・更新の検証となっていた。テスト名を実態に即して整理し、一時的ローディング表示は UT/VRT で担保する旨の注記を追加（コミット `b7d02c0` にて是正）。                                                                                                                                                                                                   |
| 208 |    #238 / #247     | PRレビュー (`pr-reviewer`)    |                支援成果物                | `docs/specs/changes/archive/issue-238-loading-ux-clarification.md`                                                                                                                                                                              |            `D`             | PR #247 レビュー指摘3：差分仕様書 §6.3 テスト計画において SCN-01 と SCN-02 の記載が実際の結合テスト配置と乖離していたため、リーダー話遷移の検証先（SCN-02 `reader-next-chapter`）および各テスト層の責務分担に合わせて整合（コミット `b7d02c0` にて是正）。                                                                                                                                                                                                                                                                |
| 209 |    #241 / #259     | 横断レビュー (`R1-01`)        |                製品コード                | `src/features/search/hooks/useNovelSearch.ts`, `src/features/ranking/hooks/useNovelRanking.ts`                                                                                                                                                  |            `L`             | 検索・ランキングで `loadMore`（次ページ取得）の非同期通信中にサイトや検索条件を切り替えると、旧条件の結果が新条件の一覧に混入・上書きされる競合リスク。リクエスト ID 発行による最新リクエスト検証ガードおよび通信中のピル・セレクター非活性化を実装（コミット `a5c79dc` にて是正）。                                                                                                                                                                                                                                      |
| 210 |    #241 / #259     | 横断レビュー (`R1-02`)        |                支援成果物                | `test/it/scenarios/scn05-cloud-sync.spec.ts`, `test/it/scenarios/scn02-search-ranking-discovery.spec.ts`                                                                                                                                        |            `S`             | SCN-05 および SCN-02 において、なろう本文の縦書き組版属性、前書き・区切り線・後書き（`AC-NR-06`）、ルビ `<ruby>`、傍点 `<em class="bouten">`（`AC-NR-07`）の結合アサーションが欠落していたため、実ブラウザ E2E 検証を追加（コミット `d8648d5` にて是正）。                                                                                                                                                                                                                                                                |
| 211 |    #241 / #259     | 横断レビュー (`R1-03`)        |                支援成果物                | `docs/specs/screen-transitions.md`, `docs/specs/parsers/narou.md`                                                                                                                                                                               |            `D`             | SCN-05 E2E シナリオマッピング表になろう複数ページ目次の自動補完 Pull（`AC-NR-04`, `AC-NR-05`, `SYS-REQ-02, 12`）が記載されておらず、また `narou.md` に IT シナリオ（SCN-02, SCN-05）対応節が欠落していたため追記是正（本コミットにて是正）。                                                                                                                                                                                                                                                                              |
| 212 |    #241 / #259     | 横断レビュー (`R1-04`)        |                製品コード                | `src/parsers/fetchFullNovelIndex.ts`                                                                                                                                                                                                            |            `L`             | 複数ページ目次取得パイプラインにおいて上限（100ページ）・循環参照・SSRF ガードで打ち切られた際、警告なしに途中までの目次を正常値として返却していたため、`console.warn` による安全停止理由の明示ログ出力を追加（コミット `a126787` にて是正）。                                                                                                                                                                                                                                                                            |
| 213 |    #241 / #259     | 横断レビュー (`R1-05`)        |                支援成果物                | `docs/specs/changes/archive/issue-238-loading-ux-clarification.md`                                                                                                                                                                              |            `D`             | 差分仕様書の IT 計画（§2.4, §7）で SCN-01/02 を更新と記載されていたが、実績（SCN-02 更新・SCN-01 はリーダー回帰確認で充分と判断）と乖離していたため同期是正（本コミットにて是正）。                                                                                                                                                                                                                                                                                                                                       |
| 214 |    #241 / #259     | 横断レビュー (`R1-06`)        |                支援成果物                | `test/it/scenarios/scn05-cloud-sync.spec.ts`, `src/app/ServiceProvider.tsx`                                                                                                                                                                     |            `S`             | SCN-05 端末 A のシード登録において `fetchFullNovelIndex` を使用せず手動配列結合で登録し、`partTitle` を捏造していたため、`ServiceProvider` 経由で本番と同一の複数ページ目次取得パイプラインを通す形式へ是正（コミット `d8648d5` にて是正）。                                                                                                                                                                                                                                                                              |
| 215 |    #241 / #259     | 横断レビュー (`R1-07`)        |                支援成果物                | `docs/quality/bug-and-handover-log.md`                                                                                                                                                                                                          |            `D`             | 品質記録台帳 §2 L77 の Milestone v0.7 スコープ表記に旧計画の内蔵 WebView / DOM インポートが残存していたため、なろう対応（パーサー・複数ページ目次・同期・検索/ランキング/SiteSelector）＆ Webアクセス時ローディング UX 改善へ是正（本コミットにて是正）。                                                                                                                                                                                                                                                                 |
| 216 |    #241 / #259     | 横断レビュー (`R1-08`)        |                支援成果物                | `test/it/scenarios/scn06-volume-key-paging.spec.ts`, `test/it/scenarios/scn01-poc-vertical-reader.spec.ts`                                                                                                                                      |            `S`             | 結合テスト IT 内に残存していた `waitForTimeout` 固定待機（SCN-06: 3箇所、SCN-01: 1箇所）が高負荷時の Flakiness 要因となっていたため、状態アサーション（`expect.poll` / `toHaveAttribute`）に置き換え排除（コミット `d8648d5` にて是正）。                                                                                                                                                                                                                                                                                 |
| 217 |    #241 / #259     | 横断レビュー (`R1-09`)        |                支援成果物                | `docs/specs/requirements.md`, `docs/specs/screen-transitions.md`                                                                                                                                                                                |            `D`             | 未キャッシュ話遷移時ローディング受入条件 `AC-RD-28` が `SYS-REQ-02`, `SYS-REQ-11` の受入条件 ID 欄および `screen-transitions.md` の SCN-01 行から欠落していたため、双方向トレーサビリティを追記是正（本コミットにて是正）。                                                                                                                                                                                                                                                                                               |
| 218 |    #241 / #259     | 横断レビュー (`R1-10`)        |                支援成果物                | `docs/specs/requirements.md`                                                                                                                                                                                                                    |            `D`             | `requirements.md` §4 Milestone ロードマップ表の Milestone v0.7 対象要件 ID 欄から `11（未キャッシュ話遷移時ローディング明示 #238）` が欠落していたため追記是正（本コミットにて是正）。                                                                                                                                                                                                                                                                                                                                    |
| 219 |    #241 / #259     | 横断レビュー (`R1-11`)        |                支援成果物                | `docs/quality/bug-and-handover-log.md`                                                                                                                                                                                                          |            `D`             | PR #247（Issue #238 IT PR）の独立 AI レビュー（Round 1）指摘 3 件（支援成果物 S/D）がバグ記録一覧へ転記・記録漏れしていたため、No. 206〜208 として追記是正（本コミットにて是正）。                                                                                                                                                                                                                                                                                                                                        |
| 220 |    #241 / #259     | 横断レビュー (`R1-12`)        |                支援成果物                | `docs/quality/bug-and-handover-log.md`                                                                                                                                                                                                          |            `D`             | バグ記録 No. 202〜205 において、是正コミット SHA の記述漏れ、No. 203 の Issue/PR 番号誤り（#244 → #244/#246）、および No. 205 の原因分類誤り（テスト契約是正のため D → S）が存在したため是正（本コミットにて是正）。                                                                                                                                                                                                                                                                                                      |
| 221 |    #241 / #259     | 横断レビュー (`R1-13`)        |                支援成果物                | `src/features/bookshelf/hooks/useBookshelf.test.ts`                                                                                                                                                                                             |            `S`             | `useBookshelf.test.ts` のアンマウントテストにおいて `waitFor` 既定タイムアウト（1000ms）に依存し高並列実行時に Flakiness のリスクがあったため、明示的タイムアウト指定（3000ms）と検証強化により安定化（コミット `dbd58e4` にて是正）。                                                                                                                                                                                                                                                                                    |
| 222 |    #241 / #259     | 横断レビュー (`R1-14`)        |                支援成果物                | `docs/specs/requirements.md`, `docs/specs/architecture.md`, `docs/specs/screen-transitions.md`                                                                                                                                                  |            `D`             | 正本仕様書 3 冊の OKF YAML フロントマター `tags` 配列において申し送り事項 `ho-30` が記載漏れしていたため追記是正（本コミットにて是正）。                                                                                                                                                                                                                                                                                                                                                                                  |
| 223 |    #241 / #259     | 横断レビュー (`R1-15`)        |                支援成果物                | `docs/specs/db-schema.md`                                                                                                                                                                                                                       |            `D`             | `db-schema.md` の YAML フロントマター `related_specs` に `docs/specs/parsers/narou.md` が参照漏れ（非対称性）となっていたため追記是正（本コミットにて是正）。                                                                                                                                                                                                                                                                                                                                                             |
| 224 |    #241 / #259     | 横断レビュー (`R1-16`)        |                支援成果物                | `test/it/scenarios/scn03-bookshelf-update-and-sort.spec.ts`, `test/it/scenarios/scn05-cloud-sync.spec.ts`                                                                                                                                       |            `S`             | 結合テスト内の受入条件コメントに残存していた旧番号 `AC-RD-11`（既読バッジ同期復元等）を、現行正本の `AC-RD-03` / `AC-RD-07` に同期是正（コミット `d8648d5` にて是正）。                                                                                                                                                                                                                                                                                                                                                   |
| 225 |    #241 / #259     | 横断レビュー (`R1-17`)        |                支援成果物                | `docs/specs/changes/archive/issue-238-loading-ux-clarification.md`                                                                                                                                                                              |            `D`             | アーカイブ差分仕様書 #238 §6.3 L264 付近の受入条件 ID タイポ（`AC-RD-08` → `AC-RD-28`）を是正（本コミットにて是正）。                                                                                                                                                                                                                                                                                                                                                                                                     |
| 226 |    #241 / #259     | 横断レビュー (`R1-18`)        |                製品コード                | `src/features/reader/hooks/useReader.ts`                                                                                                                                                                                                        |            `L`             | 未キャッシュ話遷移（`goToChapter`）および `fetchNovelFromUrl` にアンマウントガードがなく、画面離脱後にしおり上書き・未閲覧話の既読化・先読みループ再起動が起こる潜在リスク。`isMounted` ガードを徹底して後続処理を遮断（コミット `ea97ab5` にて是正）。                                                                                                                                                                                                                                                                   |
| 227 |    #241 / #259     | 横断レビュー (`R1-19`)        |                製品コード                | `src/features/reader/hooks/useReader.ts`                                                                                                                                                                                                        |            `L`             | `useReader.ts` の Web フォールバック取得（`fetchNovelFromUrl`）が `fetchFullNovelIndex` を使用しておらず、101話以上のなろう小説で1ページ目（100話）しか取得されない不備。`fetchFullNovelIndex` 経由での全話取得へ統一（コミット `ea97ab5` にて是正）。                                                                                                                                                                                                                                                                    |
| 228 |    #241 / #259     | 横断レビュー (`R1-20`)        |                支援成果物                | `src/features/search/hooks/useNovelSearch.test.ts`, `src/features/ranking/hooks/useNovelRanking.test.ts`                                                                                                                                        |            `S`             | `AC-SE-09` / `AC-RK-08` の「古い非同期リクエストの遅延解決テスト」が 1 回目の解決後に 2 回目を発火しており、並行・逆順解決を正しく再現できていなかったため、未解決状態での競合ガードを厳密に検証するテストへ是正（コミット `a5c79dc` にて是正）。                                                                                                                                                                                                                                                                         |
| 229 |    #241 / #259     | 横断レビュー (`R1-21`)        |                支援成果物                | `src/features/search/components/SearchContainer.test.tsx`, `src/features/ranking/components/RankingContainer.test.tsx`                                                                                                                          |            `S`             | `SearchContainer.test.tsx` と `RankingContainer.test.tsx` で親子コンポーネント分離規律（`vi.spyOn` による Presentational Props 伝搬検証）が守られていなかったため、親子分離テストへ全面刷新（コミット `6a40fb8` にて是正）。                                                                                                                                                                                                                                                                                              |
| 230 |    #241 / #259     | 横断レビュー (`R1-22`)        |                支援成果物                | `docs/specs/parsers/narou.md`, `architecture.md`, `search.md`, `ranking.md`, `reader-view.md`, `#239`, `#240`                                                                                                                                   |            `D`             | 正本仕様書およびアーカイブ差分仕様書において、`related_tests` / `related_specs` の登録漏れ、ディレクトリ構成図への `genres.ts` 追記漏れ、および単体テスト見出しの不整合が存在したため最新化（本コミットにて是正）。                                                                                                                                                                                                                                                                                                       |
| 231 |    #241 / #259     | 横断レビュー (`R1-23`)        |                支援成果物                | `docs/specs/requirements.md`, `screen-transitions.md`, `architecture.md`, `novel-detail.md`, `reader-view.md`, `bookshelf.md`                                                                                                                   |            `D`             | 正本仕様書内の未着手機能（内蔵 WebView・`QueueRepository`）の対象 Milestone 表記残存（`v0.6〜`/`v0.7〜` → `v0.8〜予定`）を統一し、`screen-transitions.md` §4 の `TR-13` / `AC-BS-12` 表記位置を SCN-03 行から SCN-01 行へ是正（本コミットにて是正）。                                                                                                                                                                                                                                                                     |
| 232 |    #241 / #259     | 横断レビュー (`R1-24`)        |                支援成果物                | `test/it/scenarios/scn02-search-ranking-discovery.spec.ts`                                                                                                                                                                                      |            `S`             | SCN-02 の検索条件変更テストにおいて並び順・連載状態フィルタ・ジャンルピルの選択状態アサーション（`toHaveValue("popular")`, `aria-pressed="true"`）が欠落していたため追記補強（コミット `d8648d5` にて是正）。                                                                                                                                                                                                                                                                                                             |
| 233 |    #241 / #261     | CI (`main` push #42316483353) |                製品コード                | `src/features/reader/hooks/useReader.ts`, `src/features/reader/components/ReaderContainer.test.tsx`                                                                                                                                             |            `A`             | `useReader` の初期ロード時（`loadInitialData`）において `novelRef.current` が同期設定されず `useEffect([novel])` を待つ構造だったため、高負荷並行実行時に初回レンダリング直後の `onScrollProgressChange` 呼び出しで `novelRef.current` が `null` と判定され `updateBookmark` がスキップされる非同期競合（Flakiness）が発生。`loadInitialData` / `fetchNovelFromUrl` での `novelRef.current` 同期設定および `novelRef.current ?? novel` フォールバックを追加し、`ReaderContainer.test.tsx` の Props 取得も堅牢化して是正。 |

---

## 3. 申し送り事項追跡一覧（Handover Items: `HO-xx`）

設計時や PR 作業中に「現在の PR スコープ外だが、後続の Sub-issue や IT、実機確認で必ず検証・対応すべき事項」が発生した場合は、以下に `HO-xx` として登録し、解決ゲート（親 Issue クローズ前、または Milestone 完了前）までに確実に消化します。

> [!NOTE]
> **解決済み申し送り事項（`HO-01`〜`HO-28`）のアーカイブ**:
>
> - Phase 3 で解決済みの申し送り（`HO-01`〜`HO-03`）: [docs/quality/archive/phase3-poc-log.md](archive/phase3-poc-log.md)
> - Milestone `v0.1` で解決済みの申し送り（`HO-04`〜`HO-09`）: [docs/quality/archive/v0.1-mvp-log.md](archive/v0.1-mvp-log.md)
> - Milestone `v0.2` で解決済みの申し送り（`HO-10`〜`HO-13`）: [docs/quality/archive/v0.2-ui-ux-log.md](archive/v0.2-ui-ux-log.md)
> - Milestone `v0.3` で解決済みの申し送り（`HO-14`, `HO-16`〜`HO-21`）: [docs/quality/archive/v0.3-search-prefetch-log.md](archive/v0.3-search-prefetch-log.md)
> - Milestone `v0.5` で解決済みの申し送り（`HO-15`, `HO-22`, `HO-23`, `HO-24`, `HO-25`）: [docs/quality/archive/v0.5-reader-customization-and-cache-log.md](archive/v0.5-reader-customization-and-cache-log.md)
> - Milestone `v0.6` で解決済みの申し送り（`HO-26`〜`HO-28`）: [docs/quality/archive/v0.6-reader-animation-overlay-and-volume-key-log.md](archive/v0.6-reader-animation-overlay-and-volume-key-log.md)

現在、未解決（`Open`）の申し送り事項は 3 件（`HO-29`, `HO-30`, `HO-31`）です。Milestone `v0.7` 作業中に発生した追加の申し送り事項は、本表へ `HO-32` より連番で登録します。

|     ID      | 起票元 Issue / PR | 申し送り事項の内容                                                                                                                           | 解決先（対象 Issue / 成果物）          | 完了ゲート              | 状態 (`Open` / `Resolved`) |
| :---------: | :---------------: | :------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- | :---------------------- | :------------------------: |
| **`HO-29`** | Issue #239, #240  | 小説家になろう（`narou`: `ncode.syosetu.com`）作品の複数ページ目次取得・クラウド同期および検索・ランキング探索の実機検証                     | Milestone `v0.7` 実機検証 / Issue #241 | Milestone `v0.7` 完了前 |           `Open`           |
| **`HO-30`** |    Issue #238     | Android 実機での低速モバイル回線下におけるランキング・検索の条件切替、およびリーダー未キャッシュ話遷移時のローディング表示 UX の実機体感確認 | Milestone `v0.7` 実機検証 / Issue #241 | Milestone `v0.7` 完了前 |           `Open`           |
| **`HO-31`** |    Issue #240     | 除外キーワード指定や複数ジャンル AND/OR モーダル等の高度な検索フィルタ機能の検討・実装（Issue #240 §3 対象外スコープ）                       | 将来 Milestone（`v0.8〜`）             | Milestone `v0.8` 以降   |           `Open`           |

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

### Milestone `v0.2`: UI/UX 刷新 ＆ 開発基盤整備（100dvh全画面シェル・設定画面新設・全画面リーダー・CIブラウザレス化、対象 Issue: #49, #50, #51, #52, #53、記録 No. 71〜99）

- **アーカイブ記録**: [docs/quality/archive/v0.2-ui-ux-log.md](archive/v0.2-ui-ux-log.md)
- **詳細分析レポート**: [docs/quality/reports/v0.2-ui-ux.md](reports/v0.2-ui-ux.md)
- **製品コード不備件数**: 3 件（うち MK/UT/PRレビュー検出: 1 件［No. 77 / #62］、横断コードレビュー検出: 2 件［No. 98: `R1-20`, No. 99: `R1-21`］、リリース後流出: 0 件 → **マイルストーン完了前 DRE: 100%**）
- **支援成果物不備件数**: 26 件（設計同期・OKF 15 件、テスト・IT 7 件、記録・規律・VRT衛生 4 件）
- **原因分類内訳（Milestone `v0.2` 単体 29 件）**: `D`: 19 件（製品 2 / 支援 17） / `L`: 1 件（製品 1 / 支援 0） / `S`: 2 件（製品 0 / 支援 2） / `A`: 7 件（製品 0 / 支援 7） / `B`: 0 件（計 29 件、Phase 3 からの累計 99 件）
- **プロセス・スキル改善アクション（Kaizen）**:
  - **VRT 孤児スナップショット検知ガードの自動化（`R1-12` 再発防止）**: `test/vrt/vrt.spec.ts` において、`storybook-static/index.json` の対象ストーリー一覧と `test/vrt/snapshots/` 内 PNG 一覧の完全一致を機械検証し、削除・名称変更されたストーリーの孤児ファイル残存を CI で阻止。
  - **非同期永続化におけるエラー通知・ロールバック規律（`R1-20` 再発防止）**: 設定変更等の非同期保存処理において、失敗時に直前の state へロールバックし、画面上に `role="alert"` でエラーを明示する UI/Container 設計規律を確立。
  - **ルーティング同一パスガード規律（`R1-21` 再発防止）**: 同一ルートへの遷移要求において重複 `pushState` を抑止するガードを導入し、OS バックキー・直前画面復帰（`TR-12` 等）の履歴破壊を防止。

### Milestone `v0.3`: 検索/ランキング・先読みキャッシュ・更新チェック ＆ 実機基盤改善（対象 Issue: #78, #79, #80, #81, #82、記録 No. 100〜132）

- **アーカイブ記録**: [docs/quality/archive/v0.3-search-prefetch-log.md](archive/v0.3-search-prefetch-log.md)
- **詳細分析レポート**: [docs/quality/reports/v0.3-search-prefetch.md](reports/v0.3-search-prefetch.md)
- **製品コード不備件数**: 13 件（うち MK/UT/PRレビュー検出: 5 件［No. 108, 111, 112, 113, 117］、結合テスト段階検出: 3 件［No. 119, 120, 121］、PR レビュー検出: 1 件［No. 123］、横断レビュー検出: 4 件［No. 125, 126, 127, 128］、リリース後流出: 0 件 → **マイルストーン完了前 DRE: 100%**）
- **支援成果物不備件数**: 20 件（設計同期・OKF 13 件、テスト・IT 3 件、Storybook/定数テスト規律 4 件）
- **原因分類内訳（Milestone `v0.3` 単体 33 件）**: `D`: 21 件（製品 5 / 支援 16） / `L`: 4 件（製品 4 / 支援 0） / `S`: 3 件（製品 1 / 支援 2） / `A`: 4 件（製品 2 / 支援 2） / `B`: 1 件（製品 1 / 支援 0）（計 33 件、Phase 3 からの累計 132 件）
- **プロセス・スキル改善アクション（Kaizen）**:
  - **実行時定数定義およびバレルエクスポートの1対1単体テスト配置規律徹底（`R1-09` 再発防止）**: `docs/guidelines/testing.md` §1 Rule 5 に、定数定義ファイル（`src/**/constants/*.ts`）やバレルファイル（`src/**/index.ts`）も 1対1 単体テスト（`*.test.ts`）必須であることを明記。
  - **Storybook ストーリー定義における日本語表示名（`name`）および JSDoc 義務化の徹底（`R1-08` 再発防止）**: `docs/guidelines/testing.md` §4.2 に Storybook ストーリー定義時の日本語 `name` プロパティおよび JSDoc 付与チェックリストを明確化。
  - **結合テスト（IT）新設時のシナリオ ID 衝突防止プロトコル（`R1-04` 再発防止）**: `docs/specs/screen-transitions.md` および `test/it/scenarios/` における一意採番（SCN-01〜SCN-04）を機械的に整合。
  - **非同期処理における多重呼び出しガードおよび関数型ステート更新（`R1-13`, `R1-20` 再発防止）**: 連続操作や並行処理時の `addingWorkId` 競合解除、一括キャッシュ時のフォールバックおよび中断制御の安全性を担保。

### Milestone `v0.4`: クラウド同期（Google Drive appDataFolder）・ページめくり表示・リーダーUI改善（対象 Issue: #120, #122, #123, #124, #126、記録 No. 133〜168）

- **アーカイブ記録**: [docs/quality/archive/v0.4-cloud-sync-reader-ux-log.md](archive/v0.4-cloud-sync-reader-ux-log.md)
- **詳細分析レポート**: [docs/quality/reports/v0.4-cloud-sync-reader-ux.md](reports/v0.4-cloud-sync-reader-ux.md)
- **製品コード不備件数**: **23 件**（うち MK/PRレビュー検出: 4 件［No. 135, 136, 158, 160］、CI/結合テスト段階検出: 2 件［No. 138, 140］、横断レビュー Round 1 検出: 13 件［No. 141, 143〜154］、横断レビュー Round 2・実ブラウザIT検証検出: 4 件［No. 163〜166］、リリース後流出: 0 件 → **マイルストーン完了前 DRE: 100%（23/23）**）
- **支援成果物不備件数**: **13 件**（設計同期・OKF・スキル 7 件［No. 134, 137, 142, 156, 157, 162, 168］、テスト・IT 6 件［No. 133, 139, 155, 159, 161, 167］）
- **原因分類内訳（Milestone `v0.4` 単体 36 件）**: `D`: 26 件（製品 19 / 支援 7） / `L`: 6 件（製品 2 / 支援 4） / `A`: 3 件（製品 1 / 支援 2） / `S`: 1 件（製品 1 / 支援 0） / `B`: 0 件（計 36 件、Phase 3 からの累計 168 件）
- **プロセス・スキル改善アクション（Kaizen）**:
  - **新規設定カラム・DB カラム追加時の全層伝播チェック（原因 `D` 再発防止）**: `docs/guidelines/testing.md` §2.2 および `.github/skills/c-ut-workflow/SKILL.md` §1・§2 に、DDL（`schema.ts` ＋ `ServiceProvider` 既存 DB バイナリ復元時マイグレーション）→ 型定義 → Repository → Hook / Container → Page → View → Storybook / UT / IT の全層伝播チェックを明文化。
  - **Android ネイティブプラグイン ＆ 幾何学的 UI タッチゾーン実装時の検証規律（原因 `D` / `L` 再発防止）**: `docs/guidelines/testing.md` §2.3 および `.github/skills/c-ut-workflow/SKILL.md` §2 に、`ActivityResultContracts.StartIntentSenderForResult` ＋ `saveCall`/`getSavedCall`/`freeSavedCall`、401 リトライ前の `clearToken` キャッシュ破棄、`ci.yml` の `android-compile` 検証、およびフルスクリーン UI 複数タッチゾーンの幾何学的排他配置（`left-[20%] right-[20%]`）と境界座標テストを明文化。
  - **React Hooks の非同期タスク直列化・Abort ガード・参照安定性（原因 `A` / `S` 再発防止）**: `docs/guidelines/testing.md` §2.3・§3 および `.github/skills/c-ut-workflow/SKILL.md` §2 に、先行 Promise 完了待機（`activePrefetchPromiseRef`）による直列化、`AbortSignal` の下位関数伝播と DB 保存直前 `if (signal?.aborted) return` ガード、ルーター同期時の重複初期化抑止（`lastGoToChapterIndexRef`）、および結合テストのリロード後 `isReady` 待機を明文化。

### Milestone `v0.5`: 縦書きリーダー組版・ページめくり抜本改善・カスタマイズUI・キャッシュ管理（対象 Issue: #168, #169, #170, #171、記録 No. 169〜180）

- **アーカイブ記録**: [docs/quality/archive/v0.5-reader-customization-and-cache-log.md](archive/v0.5-reader-customization-and-cache-log.md)
- **詳細分析レポート**: [docs/quality/reports/v0.5-reader-customization-and-cache.md](reports/v0.5-reader-customization-and-cache.md)
- **製品コード不備件数**: **8 件**（うち MK/PRレビュー検出: 0 件、結合テスト段階検出: 1 件［No. 172］、横断レビュー Round 1 検出: 5 件［No. 174, 175, 176, 177, 178］、実機確認検出: 2 件［No. 179: `R1-28`, No. 180: `R1-29`］、リリース後流出: 0 件 → **マイルストーン完了前 DRE: 100%（8/8）**）
- **支援成果物不備件数**: **4 件**（テスト・非同期待機 2 件［No. 169, 171］、設計同期・OKF 2 件［No. 170, 173］）
- **原因分類内訳（Milestone `v0.5` 単体 12 件）**: `D`: 6 件（製品 4 / 支援 2） / `L`: 3 件（製品 3 / 支援 0） / `S`: 1 件（製品 1 / 支援 0） / `B`: 1 件（製品 0 / 支援 1） / `A`: 1 件（製品 0 / 支援 1）（計 12 件、Phase 3 からの累計 180 件）
- **プロセス・スキル改善アクション（Kaizen）**:
  - **結合テストにおける `page.reload()` 後の決定論的 `isReady` 待機順序（`R1-24` 再発防止）**: `docs/guidelines/testing.md` §3 に、DOM アサーション前の `window.__yommyServices.isReady` 確定的待機配置を明文化。
  - **ローカルキャッシュ削除時の `novels.updated_at` 不変性テスト規約（`R1-01` 再発防止）**: `docs/guidelines/testing.md` §5 に、クラウド同期 LWW 整合性保護のためローカル本文キャッシュ削除が作品更新日時を変更しない単体テスト検証を義務化。
  - **モーダルダイアログのアクセシビリティ・例外保護規律（`R1-02`, `R1-08`, `R1-21` 再発防止）**: `.github/skills/c-ut-workflow/SKILL.md` に、処理中の Escape/背景クリック抑止、`try/finally`、および `isMountedRef` による非同期アンマウント保護を明文化。
  - **モバイル WebView における Pointer / Touch 参照分離規約（`R1-27` 再発防止）**: `.github/skills/c-ut-workflow/SKILL.md` に、連続スクロールの `touch-action: auto` 下でネイティブスクロール発生時の `pointercancel` による Touch 座標誤消去を防止する ref 分離原則を明文化。
  - **右綴じ縦書きリーダーの組版・アニメーション・スワイプラック規律（`R1-28`, `R1-29` 是正）**: `ReaderView` に各スロット内マルチカラム組版（文字切れ根絶）と静的 `translateY`（縦アニメーション排除）、および水平スワイプラック（`writing-mode: horizontal-tb`、左から右スワイプで次ページ）を確立。

### Milestone `v0.6`: リーダーページ送り水平スライドアニメーション・上下連動オーバーレイ＆シークバー・ハードウェア音量キー操作（対象 Issue: #201, #202, #203, #209, #204、記録 No. 181〜201）

- **アーカイブ記録**: [docs/quality/archive/v0.6-reader-animation-overlay-and-volume-key-log.md](archive/v0.6-reader-animation-overlay-and-volume-key-log.md)
- **詳細分析レポート**: [docs/quality/reports/v0.6-reader-animation-overlay-and-volume-key.md](reports/v0.6-reader-animation-overlay-and-volume-key.md)
- **製品コード不備件数**: **6 件**（うち MK/UT カバレッジ検証段階検出: 1 件［No. 185］、横断レビュー Round 1 検出: 4 件［No. 192, 193, 194, 195］、実機確認検出: 1 件［No. 201: `R1-26`］、リリース後流出: 0 件 → **マイルストーン完了前 DRE: 100%（6/6）**）
- **支援成果物不備件数**: **15 件**（TDD/CI/IT/テスト・スクリプト整備 11 件［No. 181, 182, 183, 184, 186, 188, 190, 191, 196, 197, 198］、設計同期・OKF・台帳管理 4 件［No. 187, 189, 199, 200］）
- **原因分類内訳（Milestone `v0.6` 単体 21 件）**: `A`: 6 件（製品 2 / 支援 4） / `D`: 6 件（製品 2 / 支援 4） / `S`: 5 件（製品 2 / 支援 3） / `L`: 3 件（製品 0 / 支援 3） / `B`: 1 件（製品 0 / 支援 1）（計 21 件、Phase 3 からの累計 201 件：製品 71 件 / 支援 130 件）
- **プロセス・スキル改善アクション（Kaizen）**:
  - **中間 PR の AI 自律マージ（Issue #209）の効果実証**: 全 8 本の中間 MK Sub-issue PR（`#211`, `#212`, `#219`, `#220`, `#221`, `#228`, `#229`, `#230`）を完了ゲート 1〜6 通過後にオーケストレーター AI が自律マージし、人間承認待ちタッチポイントを 14 回から 6 回（入口の設計 PR 3 本＋出口の最終 IT PR 3 本）へ **57.1% 削減** しつつ、完了前 DRE 100% を維持。
  - **テストにおける実時間依存（固定日付 Time-bomb）の排除規律（`R1-01` 再発防止）**: `docs/guidelines/testing.md` §3.4 および `.github/skills/c-ut-workflow/SKILL.md` §2 に、`Date.now()` と比較する保持期限（Tombstone GC・TTL 等）のテストでの固定過去日付ハードコード禁止と `Date.now()` 相対日時計算（または `vi.setSystemTime`）の使用を明文化。
  - **Capacitor ネイティブプラグインの `static` フラグ解放と契約テスト義務化（`R1-03`, `R1-04`, `R1-08`, `R1-12` 再発防止）**: `docs/guidelines/testing.md` §2.3 および `.github/skills/c-ut-workflow/SKILL.md` §2 に、ネイティブプラグイン `static` 状態の `load()` / `handleOnDestroy()` リセット、`scripts/android-build-config.test.ts` での契約検証、および Web 側での `add*Listener` 先行登録＋Promise `.catch()` 保護を明文化。
  - **アニメーションタイマーおよびスクロール境界 Ref の話数・モード切替時クリーンアップと操作開始時境界同期（`R1-18`, `R1-19` 再発防止）**: `.github/skills/c-ut-workflow/SKILL.md` §2 に、`chapterIndex` / `isPaged` 変化時の遅延タイマー・境界フラグ破棄および操作開始時の `syncScrollBoundaryState()`（実 DOM 座標・`maxScroll <= 0` 1画面短文判定）によるスクロール端到達判定同期を明文化。
  - **マルチパス DOM 計測時の初期ページ位置復元維持と中間ページ再遷移テスト（`R1-26` 再発防止）**: `docs/guidelines/testing.md` §3.4 および `.github/skills/c-ut-workflow/SKILL.md` §2 に、初回マウント・rAF・`document.fonts.ready` 等で複数回 `setTotalPages` が呼ばれる組版 UI で単発フラグにより初期復元を打ち切らず、ユーザー操作（`goToPage`）まで `initialScrollProgress` からのページ再復元を維持する規律および 3 ページ超の中間ページ再遷移テストを明文化。
  - **Container / Page 単体テストの親子分離（`vi.spyOn` / `vi.mock`）と `SCN-01`〜`SCN-06` 正本トレーサビリティ（`R1-05`, `R1-11`, `R1-23` 再発防止）**: `docs/guidelines/testing.md` §1・§3 および `.github/skills/c-ut-workflow/SKILL.md` §2 に、親テストでの直下の子 Props・コールバック検証徹底と新規 `SCN-xx` 追加時の `screen-transitions.md` / `features/*.md` 登録義務を明文化。
