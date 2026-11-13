---
type: quality-log
title: 品質記録・バグ記録票 ＆ 申し送り管理シート（Bug & Handover Log）
description: 製品コードと支援成果物を分離したバグ記録（原因5分類 L/S/D/B/A）および後続タスクへの申し送り事項（HO-xx）を追跡する正本シート。
status: "Approved"
updated: "2026-11-14"
tags: [quality, bug-log, handover, dre, kaizen, ho-37, ho-38]
related_specs:
  - docs/specs/changes/archive/issue-342-cloud-sync-bookmark-protection.md
  - docs/specs/changes/archive/issue-343-novel-detail-header-menu.md
  - docs/quality/archive/v1.0-release-audit-log.md
  - docs/quality/reports/v1.0-full-system-quality-audit.md
  - docs/specs/changes/archive/issue-304-v1-release-readiness.md
  - docs/quality/archive/v0.9-persistent-queue-and-webview-fallback-log.md
  - docs/quality/reports/v0.9-persistent-queue-and-webview-fallback.md
  - docs/specs/changes/archive/issue-269-webview-fallback-and-dom-import.md
  - docs/specs/features/webview-import.md
  - docs/specs/changes/archive/issue-268-persistent-download-queue.md
  - docs/quality/archive/v0.8-discovery-filter-and-bookshelf-favorite-ux-log.md
  - docs/quality/reports/v0.8-discovery-filter-and-bookshelf-favorite-ux.md
  - docs/specs/changes/archive/issue-266-bookshelf-favorite-and-sync.md
  - docs/specs/changes/archive/issue-265-work-variation-filter.md
  - docs/specs/changes/archive/issue-264-advanced-search-filter.md
  - docs/quality/archive/v0.7-narou-site-support-and-loading-ux-log.md
  - docs/quality/reports/v0.7-narou-site-support-and-loading-ux.md
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
> - **Milestone `v0.7`（小説家になろう［narou］対応 ＆ Web アクセス時ローディング UX 改善、No. 202〜233）**: [docs/quality/archive/v0.7-narou-site-support-and-loading-ux-log.md](archive/v0.7-narou-site-support-and-loading-ux-log.md)
> - **Milestone `v0.8`（探索フィルタ高度化 ＆ 本棚お気に入り管理、No. 234〜279）**: [docs/quality/archive/v0.8-discovery-filter-and-bookshelf-favorite-ux-log.md](archive/v0.8-discovery-filter-and-bookshelf-favorite-ux-log.md)
> - **Milestone `v0.9`（永続ダウンロードキュー ＆ 内蔵WebViewインポート、No. 280〜306）**: [docs/quality/archive/v0.9-persistent-queue-and-webview-fallback-log.md](archive/v0.9-persistent-queue-and-webview-fallback-log.md)
> - **Milestone `v1.0`（リリース準備 ＆ システム全体横断品質監査、No. 307〜388）**: [docs/quality/archive/v1.0-release-audit-log.md](archive/v1.0-release-audit-log.md)

現在作業中の **Milestone `v1.1`（クラウド同期しおり保護 ＆ 作品詳細ヘッダーUX改善、対象 Issue: #342, #343, #345）** で検出されたバグ記録は、本表へ No. 389 より連番で記入します。

| No. |   Issue / PR   | 検出フェーズ・手段                       | 成果物区分 (`製品コード` / `支援成果物`) | 対象箇所                                                                                                                                                         | 原因 (`L`/`S`/`D`/`B`/`A`) | 不備の概要と是正内容（原因 `D` は設計書同期コミット併記）                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :-: | :------------: | :--------------------------------------- | :--------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 389 | #348 / PR #351 | 独立 AI レビュー (`pr-reviewer` Round 1) |               `製品コード`               | `src/features/bookshelf/hooks/useBookshelf.ts`<br>`docs/specs/features/bookshelf.md`<br>`docs/specs/changes/archive/issue-342-cloud-sync-bookmark-protection.md` |            `D`             | `[P2]` `subscribePullCompleted` 経由のリロードで `reloadNovels()` が毎回 `setIsLoading(true)` を実行し、`BookshelfPage` の一覧 DOM アンマウントによるスピナーチラつき・スクロール位置喪失および初回同期との重複再取得が発生。`reloadNovels({ silent: true })` によるサイレント更新と `pullHandledBySubscriptionRef` / `pullResult?.pulled !== false` による重複抑止へ是正し、`bookshelf.md`・`issue-342` 差分仕様書を同期更新（コード是正コミット：`726f760`、設計同期コミット：`1776944`） |
| 390 | #348 / PR #351 | 独立 AI レビュー (`pr-reviewer` Round 1) |               `支援成果物`               | `src/App.test.tsx`                                                                                                                                               |            `B`             | `[P3]` テスト名に `SCR-02` / `SCR-03` 双方と記載していたが実検証ケースが `SCR-03` のみだったため、`it.each` により `SCR-02`（`/novels/:novelId`）表示中の自動 Pull 検証ケースを追加是正（是正コミット：`726f760`）                                                                                                                                                                                                                                                                          |
| 391 | #349 / PR #352 | 独立 AI レビュー (`pr-reviewer` Round 1) |               `支援成果物`               | `src/features/reader/components/ReaderPage.stories.tsx`                                                                                                          |            `L`             | `[P2]` 差分仕様 `issue-342-cloud-sync-bookmark-protection.md` §3.2 で計画されていた `ReaderPage.stories.tsx` の `BookmarkConflict` ストーリーおよび 1280px / 375px VRT スナップショットが未追加だったため、ストーリー追加・`composeStories` 検証・VRT スナップショット更新で解消（正本仕様側 §3.2 は既に定義済みのため設計書修正なし、是正コミット：`52459a3`）                                                                                                                             |
| 392 | #349 / PR #352 | 独立 AI レビュー (`pr-reviewer` Round 1) |               `支援成果物`               | `src/features/reader/components/ReaderPage.test.tsx`                                                                                                             |            `L`             | `[P2]` `ReaderPage` 単体テストが直下の子 `BookmarkConflictDialog` の内部 DOM を直接クリックしていたため、`testing.md` §1-6 / §3.8-3 に準拠し `vi.spyOn(BookmarkConflictDialogModule, "BookmarkConflictDialog")` による Props・コールバック伝播検証へ是正（是正コミット：`52459a3`）                                                                                                                                                                                                         |
| 393 | #349 / PR #352 | 独立 AI レビュー (`pr-reviewer` Round 1) |               `支援成果物`               | `src/features/reader/components/ReaderContainer.test.tsx`                                                                                                        |            `L`             | `[P2]` `ReaderContainer` 単体テストが孫コンポーネント（`BookmarkConflictDialog` / `ReaderView`）の内部 DOM を直接参照していた箇所を、`pageSpy` による直下子 `ReaderPage` への Props（`isLoading`, `bookmarkConflict` 等）検証へ統一是正（是正コミット：`52459a3`）                                                                                                                                                                                                                          |
| 394 | #349 / PR #352 | 独立 AI レビュー (`pr-reviewer` Round 1) |               `製品コード`               | `src/features/reader/components/ReaderContainer.tsx`                                                                                                             |            `S`             | `[P3]` `useEffect` の依存配列に `router` オブジェクト全体を含めていたためルート変化ごとにアンマウント用クリーンアップ（`flushBookmark`）が再実行されていた問題を、`blockBackNavigation` / `isBackNavigationBlocked` の個別分割代入により安定参照依存へ是正（是正コミット：`52459a3`）                                                                                                                                                                                                       |
| 395 | #350 / PR #355 | CI IT (`SCN-01`)                         |               `支援成果物`               | `test/it/scenarios/scn01-poc-vertical-reader.spec.ts`                                                                                                            |            `A`             | CI 上の `SCN-01` で章切替直後に合成 `scroll` イベントを発火した際、#349 で導入した `ReaderView` の 1 フレーム復元ガード（`isRestoringScrollRef`）の `requestAnimationFrame` 解除前に発火して進捗更新がスキップされる競合が発生したため、章切替後の合成スクロール発火前に 2 フレーム `rAF` 待機を追加して解消（是正コミット：`4b492ad`）                                                                                                                                                     |
| 396 | #353 / PR #356 | 独立 AI レビュー (`pr-reviewer` Round 1) |               `支援成果物`               | `src/features/novel-detail/components/NovelDetailPage.test.tsx`                                                                                                  |            `L`             | `[P2]` `Refreshing` テストで `headerSpy` 検証と子コンポーネント `NovelDetailHeader` 内部 DOM（`refresh-toc-button`）直接検証が混在していたため、`testing.md` §1-6 / §3.8-3 に準拠し `headerSpy` による Props 伝播検証のみへ統一是正（是正コミット：`81a7507`）                                                                                                                                                                                                                              |
| 397 | #353 / PR #356 | 独立 AI レビュー (`pr-reviewer` Round 1) |               `支援成果物`               | `src/features/novel-detail/components/NovelDetailPage.test.tsx`, `src/features/novel-detail/components/NovelDetailContainer.test.tsx`                            |            `S`             | `[P2]` 新設・更新した `vi.spyOn` 計 6 箇所（`headerSpy` 4 箇所・`pageSpy` 2 箇所）に `.mockRestore()` クリーンアップが漏れていたため、各テスト末尾への `mockRestore()` 追加によりスパイ状態リークを是正（是正コミット：`81a7507`）                                                                                                                                                                                                                                                          |
| 398 | #353 / PR #356 | 独立 AI レビュー (`pr-reviewer` Round 1) |               `支援成果物`               | `src/features/novel-detail/components/NovelDetailHeader.test.tsx`                                                                                                |            `L`             | `[P3]` 3 点メニュー関連テスト名 5 箇所に Issue #342 割当済みの `AC-ND-28` を誤記していたため、正本仕様 `novel-detail.md` §5 定義に沿った `AC-ND-27` へ修正是正（是正コミット：`81a7507`）                                                                                                                                                                                                                                                                                                   |
| 399 | #343 / PR #346 | 独立 AI レビュー (`pr-reviewer` Round 1) |               `支援成果物`               | `PR #346 本文`                                                                                                                                                   |            `D`             | `[P1]` PR 本文の概要が差分仕様 `issue-343`（タイトル 1 段上の右寄せ 1 行アイコンバー `[★/☆]` / `[🔄]` / `[⋮]`、3 点メニュー内 4 項目）と矛盾していたため、`gh pr edit 346` により仕様整合内容へ是正（設計同期コミット：`18ccfd4` / `3a6ce11`）                                                                                                                                                                                                                                              |
| 400 | #343 / PR #346 | 独立 AI レビュー (`pr-reviewer` Round 1) |               `支援成果物`               | `Issue #343 本文`                                                                                                                                                |            `D`             | `[P2]` 親 Issue #343 本文の「実機検証タイミング（Step 2 で記入）」欄が空欄だったため、`workflow.md` §2.1 3 箇所同期規律に従い `gh issue edit 343` にて `判定 B: Milestone v1.1 完了前（Issue #345 / HO-37）` を同期記録（設計同期コミット：`18ccfd4` / `3a6ce11`）                                                                                                                                                                                                                          |
| 401 | #343 / PR #346 | 独立 AI レビュー (`pr-reviewer` Round 1) |               `支援成果物`               | `docs/specs/requirements.md`<br>`docs/specs/screen-transitions.md`                                                                                               |            `D`             | `[P2]` `requirements.md` §3.5（`SYS-REQ-16` 行）および `screen-transitions.md` §4（`SCN-03`, `SCN-04`, `SCN-05`, `SCN-07` 行）への `AC-ND-27` 双方向リンク漏れを補完是正（設計同期コミット：`18ccfd4` / マージ：`3a6ce11`）                                                                                                                                                                                                                                                                 |
| 402 | #342 / PR #347 | 独立 AI レビュー (`pr-reviewer` Round 1) |               `支援成果物`               | `docs/specs/features/novel-detail.md`<br>`docs/specs/requirements.md`<br>`docs/specs/screen-transitions.md`                                                      |            `D`             | `[P1]` PR #346 で採番済みの `AC-ND-27` と受入条件 ID が重複衝突していたため、Issue #342 側の作品詳細自動更新要件を `AC-ND-28` へ採番変更し関連正本を同期是正（設計同期コミット：`a0797d9`）                                                                                                                                                                                                                                                                                                 |
| 403 | #342 / PR #347 | 独立 AI レビュー (`pr-reviewer` Round 1) |               `支援成果物`               | `docs/specs/requirements.md`                                                                                                                                     |            `D`             | `[P2]` `requirements.md` §3.5 `SYS-REQ-16` 行における `AC-RD-32`（競合モーダル表示中の誤操作防止ガード）の双方向リンクおよび変更概要の記載漏れを同期是正（設計同期コミット：`a0797d9`）                                                                                                                                                                                                                                                                                                     |
| 404 | #342 / PR #347 | 独立 AI レビュー (`pr-reviewer` Round 1) |               `支援成果物`               | `docs/specs/changes/archive/issue-342-cloud-sync-bookmark-protection.md`<br>`docs/specs/features/novel-detail.md`                                                |            `D`             | `[P2]` 自動 Pull 完了時の `reloadDetail()` 再実行で一覧 DOM 破棄によりスクロール位置が失われる設計不備に対し、`reloadDetail({ silent: true })` によるサイレント更新設計および `scrolledNovelIdRef` 実名表記へ修正是正（設計同期コミット：`a0797d9`）                                                                                                                                                                                                                                        |
| 405 | #342 / PR #347 | 独立 AI レビュー (`pr-reviewer` Round 1) |               `支援成果物`               | `docs/specs/changes/archive/issue-342-cloud-sync-bookmark-protection.md`<br>`docs/specs/features/reader-view.md`                                                 |            `D`             | `[P2]` `UseReaderResult.resolveBookmarkConflict` の戻り値型が `Promise<void>` となっており `ReaderContainer` の URL 同期成否分岐と不整合だったため、`Promise<boolean>` 戻り値契約および `ReaderContainer` URL 同期契約を明記是正（設計同期コミット：`a0797d9`）                                                                                                                                                                                                                             |

---

## 3. 申し送り事項追跡一覧（Handover Items: `HO-xx`）

設計時や PR 作業中に「現在の PR スコープ外だが、後続の Sub-issue や IT、実機確認で必ず検証・対応すべき事項」が発生した場合は、以下に `HO-xx` として登録し、解決ゲート（親 Issue クローズ前、または Milestone 完了前）までに確実に消化します。

> [!NOTE]
> **解決済み申し送り事項（`HO-01`〜`HO-36`）のアーカイブ**:
>
> - Phase 3 で解決済みの申し送り（`HO-01`〜`HO-03`）: [docs/quality/archive/phase3-poc-log.md](archive/phase3-poc-log.md)
> - Milestone `v0.1` で解決済みの申し送り（`HO-04`〜`HO-09`）: [docs/quality/archive/v0.1-mvp-log.md](archive/v0.1-mvp-log.md)
> - Milestone `v0.2` で解決済みの申し送り（`HO-10`〜`HO-13`）: [docs/quality/archive/v0.2-ui-ux-log.md](archive/v0.2-ui-ux-log.md)
> - Milestone `v0.3` で解決済みの申し送り（`HO-14`, `HO-16`〜`HO-21`）: [docs/quality/archive/v0.3-search-prefetch-log.md](archive/v0.3-search-prefetch-log.md)
> - Milestone `v0.5` で解決済みの申し送り（`HO-15`, `HO-22`, `HO-23`, `HO-24`, `HO-25`）: [docs/quality/archive/v0.5-reader-customization-and-cache-log.md](archive/v0.5-reader-customization-and-cache-log.md)
> - Milestone `v0.6` で解決済みの申し送り（`HO-26`〜`HO-28`）: [docs/quality/archive/v0.6-reader-animation-overlay-and-volume-key-log.md](archive/v0.6-reader-animation-overlay-and-volume-key-log.md)
> - Milestone `v0.7` で解決済みの申し送り（`HO-29`, `HO-30`）: [docs/quality/archive/v0.7-narou-site-support-and-loading-ux-log.md](archive/v0.7-narou-site-support-and-loading-ux-log.md)
> - Milestone `v0.8` で解決済みの申し送り（`HO-31`〜`HO-33`）: [docs/quality/archive/v0.8-discovery-filter-and-bookshelf-favorite-ux-log.md](archive/v0.8-discovery-filter-and-bookshelf-favorite-ux-log.md)
> - Milestone `v0.9` で解決済みの申し送り（`HO-34`, `HO-35`）: [docs/quality/archive/v0.9-persistent-queue-and-webview-fallback-log.md](archive/v0.9-persistent-queue-and-webview-fallback-log.md)
> - Milestone `v1.0` で解決済みの申し送り（`HO-36`）: [docs/quality/archive/v1.0-release-audit-log.md](archive/v1.0-release-audit-log.md)

現在、未解決（`Open`）の申し送り事項は **2 件**（`HO-37`, `HO-38`）です。

|     ID      | 起票元 Issue / PR | 申し送り事項の内容                                                                                                                                                                                                        | 解決先（対象 Issue / 成果物）                                                                                |       完了ゲート        | 状態 (`Open` / `Resolved`) |
| :---------: | :---------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------- | :---------------------: | :------------------------: |
| **`HO-37`** |    Issue #343     | Android 実機（狭幅画面含む）における作品詳細ヘッダー（`SCR-02`）1行アイコンバー（`☆` / `🔄` / `⋮`）視認性および3点メニュー開閉・4アクション・外周タップ閉鎖確認                                                           | Milestone `v1.1` Step 2 実機検証（Issue #345）                                                               | Milestone `v1.1` 完了前 |           `Open`           |
| **`HO-38`** |    Issue #342     | Android 実機（WebView）におけるリーダー・作品詳細表示のまま画面ロック（5分以上経過後復帰）時のクラウド同期自動 Pull、しおり競合確認モーダル表示中のハードウェア戻るボタン抑止、および未操作離脱時しおり保持のスモーク確認 | 親 Issue #342 の Step 2 判定（カテゴリ B）に基づき Milestone `v1.1` 最終レビュー（Issue #345）で実機検証予定 | Milestone `v1.1` 完了前 |           `Open`           |

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

### Milestone `v0.7`: 小説家になろう対応 ＆ WebアクセスローディングUX改善（対象 Issue: #238, #239, #240, #241, #259, #261、記録 No. 202〜233）

- **アーカイブ記録**: [docs/quality/archive/v0.7-narou-site-support-and-loading-ux-log.md](archive/v0.7-narou-site-support-and-loading-ux-log.md)
- **詳細分析レポート**: [docs/quality/reports/v0.7-narou-site-support-and-loading-ux.md](reports/v0.7-narou-site-support-and-loading-ux.md)
- **製品コード不備件数**: **5 件**（うち MK/PRレビュー検出: 0 件、横断レビュー Round 1 検出: 4 件［No. 209, 212, 226, 227］、CI/是正段階検出: 1 件［No. 233］、リリース後流出: 0 件 → **マイルストーン完了前 DRE: 100%（5/5）**）
- **支援成果物不備件数**: **27 件**（設計同期・OKF 15 件、テストコード・契約是正 12 件）
- **原因分類内訳（Milestone `v0.7` 単体 32 件）**: `D`: 15 件（製品 0 / 支援 15） / `S`: 11 件（製品 0 / 支援 11） / `L`: 4 件（製品 4 / 支援 0） / `A`: 2 件（製品 1 / 支援 1） / `B`: 0 件（計 32 件、Phase 3 からの累計 233 件：製品 76 件 / 支援 157 件）
- **プロセス・スキル改善アクション（Kaizen）**:
  - **`useReader` における非同期参照・同期反映規律（No. 233, `R1-18`, `R1-19` 再発防止）**: `loadInitialData` / `fetchNovelFromUrl` での `novelRef.current` インライン同期設定、`novelRef.current ?? novel` フォールバック、`isMountedRef` による画面離脱時 DB 更新遮断、および `fetchFullNovelIndex` への取得 API 統一。
  - **非同期探索・ページネーションにおけるリクエスト世代ガードと UI 相互排他（No. 209: `R1-01` 再発防止）**: 各探索 Hook への `requestIdRef`（世代カウンタ）導入による旧リクエスト結果の上書き防止、および通信中のセレクター・ピル非活性化（`isInteractingDisabled`）。
  - **結合テスト（IT）における実体アサーション徹底（No. 206, 207, 210, 216, 232 再発防止）**: 条件分岐スキップの禁止、`toHaveAttribute` / `toHaveValue` による選択状態反映検証、およびルビ・傍点・区切り線等の実体検証。
  - **正本仕様書・OKF フロントマターの 3 点双方向トレーサビリティ同期（No. 202, 204, 211, 217, 218 等再発防止）**: 要件定義・画面遷移・機能仕様書の 3 点セット同時更新規律の確立。

### Milestone `v0.8`: 探索フィルタ高度化 ＆ 本棚お気に入り管理（対象 Issue: #264, #265, #266, #267, #288, #290、記録 No. 234〜279）

- **アーカイブ記録**: [docs/quality/archive/v0.8-discovery-filter-and-bookshelf-favorite-ux-log.md](archive/v0.8-discovery-filter-and-bookshelf-favorite-ux-log.md)
- **詳細分析レポート**: [docs/quality/reports/v0.8-discovery-filter-and-bookshelf-favorite-ux.md](reports/v0.8-discovery-filter-and-bookshelf-favorite-ux.md)
- **製品コード不備件数**: **16 件**（うち MK/PRレビュー検出: 0 件、横断レビュー Round 1 検出: 7 件［No. 236, 242, 243, 244, 245, 253, 254］、横断レビュー Round 2 検出: 6 件［No. 260, 266, 267, 268, 274, 275］、Android 実機検証検出: 3 件［No. 276: `R2-18`, No. 277: `R2-19`, No. 278: `R2-20`］、リリース後流出: 0 件 → **自動テスト・横断レビュー段階 DRE: $13/16 \approx 81.25\%$、マイルストーン完了前 DRE: 100%（16/16）**）
- **支援成果物不備件数**: **30 件**（設計同期・OKF・コメント整合 14 件［No. 234, 235, 240, 247, 250, 252, 257, 258, 259, 262, 270, 272, 273, 279］、テスト・IT 10 件［No. 238, 239, 241, 249, 251, 255, 256, 263, 264, 269］、台帳・コードコメント整合 6 件［No. 237, 246, 248, 261, 265, 271］）
- **原因分類内訳（Milestone `v0.8` 単体 46 件）**: `D`: 21 件（製品 7 / 支援 14） / `L`: 17 件（製品 3 / 支援 14） / `A`: 6 件（製品 4 / 支援 2） / `S`: 2 件（製品 2 / 支援 0） / `B`: 0 件（計 46 件、Phase 3 からの累計 279 件：製品 92 件 / 支援 187 件）
- **プロセス・スキル改善アクション（Kaizen）**:
  - **クラウド同期 LWW タイムスタンプ保護と Pull 初回復元・IT 時系列検証規律（No. 236, 254, 260, 263, 274 再発防止）**: `novels.updated_at` をユーザー設定変更時のみ更新して定常処理（目次更新・しおり・本文キャッシュ・再集計・`useNovelDetail.startBatchCache`）での汚染を禁止し、`mergeNewNovel` で `createdAt` / `updatedAt` をともに復元、さらに結合テストを `T1 < T2 < now` タイムラインで検証する規律を確立。
  - **外部小説サイト検索パラメータ複合条件の事前調査と確定クエリスナップショット・IT URL 検証（No. 238, 242, 268, 269, 276 再発防止）**: カクヨム短編検索での `serial_status=completed&total_character_count_range=-20000` 複合指定、`useNovelSearch` の `committedQueryRef` による次ページ条件固定、および `SCN-02` での `expect.poll` URL クエリ実体検証を確立。
  - **モバイル狭幅（375px）ヘッダーの省スペース設計とトグルボタンの寸法不変性・排他ロック・動的 `aria-controls` 規律（No. 244, 245, 266, 267, 277, 278 再発防止）**: 本棚ヘッダーお気に入りフィルタの `★`/`☆` アイコン化（`R2-20`）、作品詳細トグルの常時 1px `border` ＋固定文字数ラベル（`R2-19`）、`useId()` ＋展開時のみ `aria-controls` 出力、および作品 ID 単位/操作単位の非同期連打排他ロック（`togglingFavoriteIdsRef` 等）を確立。
  - **Markdown 表のパイプ記号（`|`）禁止と原因 `D` 厳格分類・設計同期 SHA 明記（No. 234, 246, 261, 265 再発防止）**: GFM 表セル内での `|` 使用禁止と、原因 `D` 項目への設計書同期コミット SHA 必須記載を徹底。

### Milestone `v0.9`: 永続ダウンロードキュー ＆ 内蔵WebViewインポート（対象 Issue: #268, #269, #270, #309, #311、記録 No. 280〜306）

- **アーカイブ記録**: [docs/quality/archive/v0.9-persistent-queue-and-webview-fallback-log.md](archive/v0.9-persistent-queue-and-webview-fallback-log.md)
- **詳細分析レポート**: [docs/quality/reports/v0.9-persistent-queue-and-webview-fallback.md](reports/v0.9-persistent-queue-and-webview-fallback.md)
- **製品コード不備件数**: **12 件**（うち結合テスト実装検出: 1 件［No. 283］、横断レビュー Round 1 検出: 10 件［No. 284, 285, 287, 293, 294, 295, 297, 301, 302, 303］、Android 実機検証検出: 1 件［No. 306］、リリース後流出: 0 件 → **自動テスト・コードレビュー段階 DRE: $11/12 \approx 91.7\%$、Milestone 完了前 DRE: 100%（12/12）**）
- **支援成果物不備件数**: **15 件**（設計同期・OKF 8 件［No. 280, 282, 288, 289, 298, 299, 300, 304］、テストコード・CI 7 件［No. 281, 286, 290, 291, 292, 296, 305］）
- **原因分類内訳（Milestone `v0.9` 単体 27 件）**: `L`: 16 件（製品 5 / 支援 11） / `D`: 6 件（製品 2 / 支援 4） / `S`: 5 件（製品 5 / 支援 0） / `A`: 0 件 / `B`: 0 件（計 27 件、Phase 3 からの累計 306 件：製品 104 件 / 支援 202 件）
- **プロセス・スキル改善アクション（Kaizen）**:
  - **WebView DOM インポートにおける作品 URL 照合・エピソード一致検証と画面離脱保護（No. 284, 294, 295: `R1-01`, `R1-11`, `R1-12` 再発防止）**: `useWebViewImport` において、`canonicalUrl` の作品 URL 完全一致検証と話数解決の安全ガード（見つからない場合の安全エラー）、アンマウント時フラグ `isMountedRef` による画面離脱時の非同期 State 更新遮断および Bridge クリーンアップ（`close()`）呼び出し、`httpClient` 未渡下時の non-null アサーション排除と防御的フォールバックを規定。
  - **Android ネイティブプラグインのセキュリティ強化とライフサイクル連動破棄（No. 293, 303: `R1-10`, `R1-20` 再発防止）**: `WebViewDomPlugin.java` において、ローカルファイルおよび Content URI への不正アクセスを遮断する `setAllowFileAccess(false)`, `setAllowContentAccess(false)` の明示的設定、URL スキームの大文字小文字非依存判定、および Dialog 閉鎖時・破棄時の WebView インスタンス解放（`destroy()`）と JavaScript リスナー（`domCaptured`）の確実なバインド・クリーンアップを規定。
  - **一括キャッシュ進行中の失敗件数リアルタイム表示と前回の失敗状態クリア（No. 287, 306: `R1-04` 再発防止）**: 一括キャッシュ実行中に通信エラー等で各話取得失敗が発生した場合、ヘッダーの進捗表示に `[失敗 N話]` を警告色（アンバー）で即座にリアルタイム反映し、裏で失敗しているにもかかわらず正常進行しているように見える UX 誤認を防止。さらに `startBatchCache` 実行開始時に前回の失敗状態（`failedCacheCount`, `failedChapterIndexes`）を確実にリセットし、再試行時に誤った失敗数が残存しない状態管理規律を確立。
  - **結合テスト（IT）における固定待機排除と状態駆動（`expect.poll`）アサーション（No. 292: `R1-09` 再発防止）**: 非同期永続化（SQLite 一括キャッシュ、再試行、ダウンロードキュー更新）を検証する E2E 結合テストにおいて、固定ミリ秒待機（`page.waitForTimeout` 等）による flake を排除し、`expect.poll` による決定論的状態収束待ち（キュー空、ステータス変更）を義務化。
  - **UI コンポーネント単体テストにおける親子分離の徹底（No. 297: `R1-14` 再発防止）**: 複数画面共通の下部タブバー（`BottomTabBar`）等の子コンポーネントを配置する親コンポーネントのテストにおいて、不要な隠し要素（`browser-go-button` 等）による裏技的テストを排除し、親は「子コンポーネントへの Props 配線（`currentTab="browser"` 等）」のみを検証する親子分離規約を徹底。

### Milestone `v1.0`: リリース準備 ＆ システム全体横断品質監査（対象 Issue: #304, #305, #329, #338、記録 No. 307〜388）

- **アーカイブ記録**: [docs/quality/archive/v1.0-release-audit-log.md](archive/v1.0-release-audit-log.md)
- **詳細分析レポート**: [docs/quality/reports/v1.0-full-system-quality-audit.md](reports/v1.0-full-system-quality-audit.md)
- **製品コード不備件数**: **50 件**（うち MK/PRレビュー検出: 1 件［No. 331］、横断レビュー Round 1 検出: 35 件［No. 308〜328, 330, 332〜344, 347］、横断レビュー Round 2 検出: 11 件［No. 359〜366, 368, 370, 371］、横断レビュー Round 3 検出: 2 件［No. 381, 382］、実機確認・本番流出: 0 件 → **横断監査・コードレビュー段階 DRE: 100%（50/50）、Milestone 完了前 DRE: 100%（50/50）**）
- **支援成果物不備件数**: **33 件**（設計同期・OKF 16 件［No. 307, 329, 345, 346, 350, 351, 353, 357, 367, 369, 376, 377, 378, 379, 380, 384］、テストコード・CI 12 件［No. 347, 348, 349, 355, 356, 372, 374, 375, 386, 388］、台帳・フォーマット管理 5 件［No. 352, 354, 358, 373, 383, 385, 387、うち No.347 は製品と重複］）
- **原因分類内訳（Milestone `v1.0` 単体 82 件）**: `D`: 34 件（製品 18 / 支援 16） / `L`: 28 件（製品 16 / 支援 12） / `S`: 10 件（製品 7 / 支援 3） / `B`: 7 件（製品 6 / 支援 1） / `A`: 3 件（製品 3 / 支援 0）（計 82 件、Phase 3 からの累計 388 件：製品 154 件 / 支援 234 件）
- **プロセス・スキル改善アクション（Kaizen）**:
  - **Android ネイティブ REST メソッドオーバーライド規律（`R3-01` 再発防止）**: `HttpURLConnection` は `PATCH` メソッドをネイティブサポートしないため、Google Drive REST API 等で PATCH 送信を行う際は `POST` ＋ `X-HTTP-Method-Override: PATCH` ヘッダーを用いることを義務化し、`scripts/android-build-config.test.ts` で契約検証を実施。
  - **Database Adapter 並行実行排他制御・トランザクション分離の同等性保証（`R3-02` 再発防止）**: `InMemoryDatabaseAdapter` においても実機 `CapacitorSqliteAdapter` と同等の Promise チェーン排他 mutex（`opMutex`）を導入し、並行クエリ割り込みを遮断。トランザクションコールバックには分離された `txAdapter` を提供しネストトランザクションを明示的エラー遮断。
  - **親コンポーネント単体テストにおける直下の子コンポーネント分離規律（`R3-06` 再発防止）**: Container / Page レベルの単体テストにおいて、子・孫コンポーネントの内部 DOM を直接探索・クリックすることをリポジトリ全域で排除し、直下の子モジュールに対する `vi.spyOn` 経由での Props / コールバック配線検証に統一。
  - **GitHub Actions CI における外部ネットワーク・APT ミラー耐性設計（No. 388 再発防止）**: CI ランナー環境におけるパッケージ取得の不安定性を解消するため、外部ミラー置換を廃止し、Azure ネイティブミラー維持、タイムアウト緩和（60秒）、再試行回数増加（5回）、`--fix-missing` オプションを追加してビルドを安定化。
  - **正本仕様書・単体テスト双方向トレーサビリティおよび品質記録台帳の原因分類適正化（`R3-03`, `R3-04`, `R3-07` 再発防止）**: 新規テスト追加時の正本フロントマター `related_tests` への即時登録、バグ記録における原因 `D` と設計書同期コミット SHA の 1 対 1 紐付けを徹底。
