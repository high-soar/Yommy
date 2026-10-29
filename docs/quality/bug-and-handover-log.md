---
type: quality-log
title: 品質記録・バグ記録票 ＆ 申し送り管理シート（Bug & Handover Log）
description: 製品コードと支援成果物を分離したバグ記録（原因5分類 L/S/D/B/A）および後続タスクへの申し送り事項（HO-xx）を追跡する正本シート。
status: Approved
updated: "2026-10-29"
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
> - **Milestone `v0.2`（UI/UX 刷新 ＆ 開発基盤整備、No. 71〜99）**: [docs/quality/archive/v0.2-ui-ux-log.md](archive/v0.2-ui-ux-log.md)
>
> 次期作業中の **Milestone `v0.3`（検索/ランキング・先読みキャッシュ・更新チェック）** で検出されたバグ記録は、本表へ No. 100 より連番で記入します。

| No. |  Issue / PR  | 検出フェーズ・手段           | 成果物区分 (`製品コード` / `支援成果物`) | 対象箇所                                                                                                                               | 原因 (`L`/`S`/`D`/`B`/`A`) | 不備の概要と是正内容（原因 `D` は設計書同期コミット併記）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| :-: | :----------: | :--------------------------- | :--------------------------------------: | :------------------------------------------------------------------------------------------------------------------------------------- | :------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 100 | #82 / PR #83 | 独立 AI PR レビュー (`[P2]`) |                支援成果物                | `docs/specs/screen-transitions.md`, `docs/specs/features/novel-detail.md`, `reader-view.md`, `settings.md`                             |            `D`             | `requirements.md` で `SYS-REQ-03` の関連画面から `SCR-05 / TR-08` を除外し `SCR-02, SCR-03` に変更した際、`screen-transitions.md`（`SCR-02`・`SCR-03`・`SCR-05`・`TR-08`）、`novel-detail.md`、`reader-view.md`、`settings.md` 側の双方向参照および `TR-08` 廃止記述の同期が漏れていた不備。対象正本仕様書を一括更新して双方向トレーサビリティを整合。                                                                                                                                                                                                                 |
| 101 | #82 / PR #83 | 独立 AI PR レビュー (`[P2]`) |                支援成果物                | `docs/specs/features/settings.md`, `reader-view.md`, `screen-transitions.md`, `architecture.md`, `db-schema.md`                        |            `D`             | `requirements.md` で `v0.4` へ移行した機能（`NarouParser`、`SYS-REQ-09` フォント種別・余白、`SYS-REQ-11` 1画面タップ/音量キー送り、`WebViewDomBridge`）および `v0.3` 対象の `download_queue` について、他の App 全体正本仕様書に旧マイルストーン番号（`v0.2` / `v0.3`）が残存していた不備。各正本仕様書のマイルストーン表記と OKF `status: "Review (#82)"` を一括同期して是正。                                                                                                                                                                                        |
| 102 | #90 / PR #91 | 開発者指摘・エディタ構文解析 |                支援成果物                | `docs/specs/features/`, `.github/skills/sdd/scripts/validate-okf.mjs`, `docs/index.md`, `.github/skills/sdd/SKILL.md`                  |            `D`             | フロントマターの `title` / `description` にコロン＋空白（`: `）を含む画面ID併記を行った際、クォート保護が規約化されておらず、`validate-okf.mjs` も簡易正規表現で通過させていたため YAML 構文エラー（`mapping values are not allowed here`）となっていた不備。`docs/index.md` §4 および `sdd/SKILL.md` にコロン・記号含有時のダブルクォート必須化を明文化し、`validate-okf.mjs` に非クォートスカラー内の `: ` 検知ガードレールを追加。既存 4 仕様書（`bookshelf.md`, `novel-detail.md`, `reader-view.md`, `settings.md`）の該当箇所をダブルクォートで保護して同期是正。 |
| 103 | #79 / PR #92 | 独立 AI PR レビュー (`[P2]`) |                支援成果物                | `docs/specs/features/bookshelf.md`                                                                                                     |            `D`             | 本棚空状態（`BookshelfEmptyState`）からの検索・ランキング誘導における画面遷移 ID が、正本 `screen-transitions.md` の `TR-15` ではなく `TR-14` と誤記されていた不備。`bookshelf.md` の記述・Props・受入条件（`AC-BS-01`）の遷移 ID を `TR-15` に修正して整合。                                                                                                                                                                                                                                                                                                          |
| 104 | #79 / PR #92 | 独立 AI PR レビュー (`[P2]`) |                支援成果物                | `docs/specs/changes/issue-79-four-tabs-search-ranking.md`                                                                              |            `D`             | 差分仕様書 §3.4 において、パーサー拡張メソッド `searchNovels` / `getRanking` のシグネチャが純粋関数 `(html: string, pageUrl: string)` ではなく `(query, options)` と記載され、`architecture.md` および `kakuyomu.md` と齟齬があった不備。正本に合わせて `buildSearchUrl` / `searchNovels(html, pageUrl)` 等の純粋関数シグネチャへ同期是正。                                                                                                                                                                                                                            |
| 105 | #79 / PR #92 | 独立 AI PR レビュー (`[P2]`) |                支援成果物                | `docs/specs/requirements.md`                                                                                                           |            `D`             | `SYS-REQ-17`（検索）および `SYS-REQ-18`（ランキング）の受入条件 ID 欄に、`parsers/kakuyomu.md` で新設されたパーサー受入条件 `AC-08`〜`AC-11` が記載されておらず双方向トレーサビリティが欠落していた不備。受入条件 ID 欄に `AC-08, 09` および `AC-10, 11` を追記して整合。                                                                                                                                                                                                                                                                                              |
| 106 | #79 / PR #92 | 独立 AI PR レビュー (`[P2]`) |                支援成果物                | `docs/specs/features/reader-view.md`, `docs/specs/features/novel-detail.md`                                                            |            `D`             | 下部 4 タブ化および目次画面（`SCR-02`）からの直前探索元復帰（`TR-07`）拡張に伴い、機能正本仕様書 `reader-view.md`（4タブオーバーレイProps/タブ一覧）および `novel-detail.md`（`TR-07` 探索元復帰・4タブ連携）の同期が漏れていた不備。両仕様書の記述・型契約・受入条件および `related_specs` を一括更新して整合。                                                                                                                                                                                                                                                       |
| 107 | #80 / PR #99 | 独立 AI PR レビュー (`[P2]`) |                支援成果物                | `docs/specs/screen-transitions.md`, `novel-detail.md`, `reader-view.md`, `db-schema.md`, `issue-80-bookshelf-update-check-and-sort.md` |            `D`             | `TR-16`, `TR-17` 新設に伴う `screen-transitions.md` の見出し・description 範囲不整合（TR-01〜TR-15 残存）、作品詳細（`SCR-02`）・リーダー（`SCR-03`）表示時の本棚「NEW」バッジ自動解除連携の詳細契約および受入条件（`AC-ND-10`, `AC-RD-11`）未反映、`novels.latest_episode_published_at` 導出規則（`index.chapters` 内の有効な `publishedAt` の最大値）の未定義、ならびに `db-schema.md` frontmatter description での `app_settings` 記載漏れの不備。各正本仕様書および差分仕様書を同期修正して整合。                                                                  |

---

## 3. 申し送り事項追跡一覧（Handover Items: `HO-xx`）

設計時や PR 作業中に「現在の PR スコープ外だが、後続の Sub-issue や IT、実機確認で必ず検証・対応すべき事項」が発生した場合は、以下に `HO-xx` として登録し、解決ゲート（親 Issue クローズ前、または Milestone 完了前）までに確実に消化します。

> [!NOTE]
> **解決済み申し送り事項（`HO-01`〜`HO-13`）のアーカイブ**:
>
> - Phase 3 で解決済みの申し送り（`HO-01`〜`HO-03`）: [docs/quality/archive/phase3-poc-log.md](archive/phase3-poc-log.md)
> - Milestone `v0.1` で解決済みの申し送り（`HO-04`〜`HO-09`）: [docs/quality/archive/v0.1-mvp-log.md](archive/v0.1-mvp-log.md)
> - Milestone `v0.2` で解決済みの申し送り（`HO-10`〜`HO-13`）: [docs/quality/archive/v0.2-ui-ux-log.md](archive/v0.2-ui-ux-log.md)

|   ID    | 起票元 Issue / PR | 申し送り事項の内容                                                                                                                                                                                                                                                                              | 解決先（対象 Issue / 成果物）                   | 完了ゲート             | 状態 (`Open` / `Resolved`) |
| :-----: | :---------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------- | :--------------------- | :------------------------: |
| `HO-14` |        #53        | Android OS システム戻るボタン（ジェスチャー / ソフトナビゲーション）操作時にアプリが終了せず論理階層順（各話View → 目次 → 本棚、設定 → 直前画面）で戻るよう、`@capacitor/app` プラグイン導入・App Bridge 抽象層の整備・本棚画面での終了 UX（2秒以内連続2回押下で終了・1回目トースト表示）の実装 | Milestone `v0.3` 実機基盤改善 (#78, #86, #87)   | Issue #78 PR マージ    |         `Resolved`         |
| `HO-15` |        #78        | Android 実機での APK 上書きインストール実証（GitHub Actions 生成 APK を実機へアンインストールなしで上書きアップデートできることの検証）                                                                                                                                                         | Issue #78（Sub-issue 1 マージ後の実機動作確認） | 実機インストール確認時 |           `Open`           |
| `HO-16` |        #79        | カクヨム検索・ランキングからの作品カード「＋ 本棚に追加」押下による目次取得およびDB登録（`upsertNovelWithToc`）と即時「✓ 登録済み」切り替え、および登録済みカードタップによる作品詳細（`SCR-02`）遷移の一連導線に関する Playwright 実ブラウザ IT シナリオ（`SCN-02`）での全体回帰検証           | Issue #79 Sub-issue ⑤ (IT PR)                   | Issue #79 PR マージ    |           `Open`           |
| `HO-17` |        #79        | 下部4タブ（本棚・検索・ランキング・設定）およびリーダー下部オーバーレイ4タブ、ならびにOSバックキー論理階層遷移（SCR-02戻り元復帰、4タブ本棚復帰）の Playwright IT（`SCN-01`/`SCN-02`）および実機での検証                                                                                        | Issue #79 Sub-issue ⑤ (IT PR)                   | Issue #79 PR マージ    |           `Open`           |
| `HO-18` |        #80        | 本棚表示時の自動更新チェック（1時間経過判定・ウェイト間隔順次実行）および「NEW（更新あり）」バッジ表示・作品閲覧（SCR-02/SCR-03）による解除の一連導線に関する Playwright 実ブラウザ IT シナリオ検証                                                                                             | Issue #80 Sub-issue ④ (IT PR)                   | Issue #80 PR マージ    |           `Open`           |
| `HO-19` |        #80        | 本棚ヘッダーでの 5 種類ソート順切り替え（更新あり優先・最近読んだ順・作品更新日順・登録日順・タイトル順）およびアプリ再表示時のソート順永続化・復元に関する Playwright 実ブラウザ IT シナリオ検証                                                                                               | Issue #80 Sub-issue ④ (IT PR)                   | Issue #80 PR マージ    |           `Open`           |
| `HO-20` |        #81        | 読書中の 5 話自動先読み（1.5秒レートリミット、SQLite 直列キャッシュ、話数移動/離脱時の AbortController キャンセル）に関する Playwright 実ブラウザ IT シナリオ検証                                                                                                                               | Issue #81 Sub-issue ③ (IT PR)                   | Issue #81 PR マージ    |           `Open`           |
| `HO-21` |        #81        | 作品詳細での未取得話一括キャッシュ（1.5秒レートリミット・進捗表示・手動中断）およびキャッシュ TTL 7日間/短タイムアウトフォールバックに関する Playwright 実ブラウザ IT シナリオ検証                                                                                                              | Issue #81 Sub-issue ③ (IT PR)                   | Issue #81 PR マージ    |           `Open`           |

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
