---
name: iterative-github-task-management
description: "Use when breaking down a Feature Request Issue into an iterative micro-waterfall pipeline (Design PR -> MK Sub-issues -> IT PR), managing Sub-issues and Handover items (HO-xx), or running Mini-Release Milestone reviews."
---

# イテレーティブ（Issue駆動マイクロWF）の GitHub タスク管理手順

このスキルは、Yommy における要望（親 Issue）の段階的詳細化、Sub-issue 分割、およびミニリリース Milestone の進行管理に関する **AI エージェントの実行・オーケストレーション手順** を定めます。

開発プロセス、成果物ステータス（`Draft` / `Review` / `Approved`）、および Task Completion Gate（7条件）の正本（SSOT）は [docs/guidelines/workflow.md](../../../docs/guidelines/workflow.md) です。ルール自体の定義は正本を参照し、本スキルでは AI の具体的なアクション手順に従ってください。

---

## 1. 親 Issue（要望）受領から完了までの 4 ステップ実行手順

人間が起票した親 Issue（または Phase 3 PoC の検証 Issue）に着手する際、メインエージェント（Orchestrator）はいきなり実装コードを書かず、以下の順序で進行します。

### Step 1: 既存仕様・コード調査と未確定事項（Open Questions）の確認

1. 軽量な読み取り専用サブエージェント（`research`）を起動し、関連する `docs/specs/`（`requirements.md`, `architecture.md`, `db-schema.md`, `screen-transitions.md`, `features/*.md`, `parsers/*.md`）および既存コード・テストを調査させる。
2. 要望に曖昧な点（異常系エラー表示、境界値、レートリミット挙動、キャッシュ削除時のしおり扱い等）があれば、推測で決め打ちせず、選択肢を添えて人間に質問する。
3. 親 Issue 本文のチェックリスト `Step 1: 要望分析・未確定事項（Open Questions）の確認完了` を更新する。

### Step 2: 設計更新 PR（「差分仕様の作成」＋「App 全体正本への反映」）と Sub-issue 分割

1. [docs/index.md](../../../docs/index.md#3-docsspecs-の-2-層管理ルールapp-全体正本--差分仕様) に従い、以下の **2種類の仕様書（OKF YAML フロントマター形式）を同一設計 PR 内でセットで作成・更新** する（いずれもフロントマター `status: Review (#親Issue番号)`）：
   - **① 差分仕様ファイルの新規作成（`docs/specs/changes/issue-XX-<slug>.md`）**:
     - 今回の要望の背景・目的、変更対象の App 全体正本ファイル一覧、追加・変更・削除する仕様（`AC-xx`, `TR-xx`, 契約, コンポーネント構成）の差分、UT/VRT/IT のテスト計画、実装 Sub-issue 分割リスト、および申し送り事項（`HO-xx`）を記載する。
   - **② App 全体正本の同時更新（`docs/specs/*.md`, `features/*.md`, `parsers/*.md`）**:
     - 差分仕様の内容を App 全体正本へ反映し、常に `docs/specs/` の正本群が最新のアプリ全体仕様を表す状態を維持する。
   - **③ 申し送り事項（`HO-xx`）の登録**:
     - 後続の MK や IT、実機検証で必ず確認すべき事項を [docs/quality/bug-and-handover-log.md](../../../docs/quality/bug-and-handover-log.md) および差分仕様書に記録する。
2. 実装（MK）および結合テスト（IT）の **Sub-issue 分割案** を策定する。
   - **推奨分割粒度（1 PR = 200〜400行目安）**:
     - Sub-issue ①: Parser Layer / Storage Layer / Bridge Layer のロジック実装 ＋ 単体テスト（Vitest TDD）
     - Sub-issue ②: 子 UI コンポーネント群の実装 ＋ Storybook（`*.stories.tsx`）＋ Portable Stories UT ＋ VRT（1280px/375px）
     - Sub-issue ③: Page 結合 ＋ ルーティング ＋ Playwright 実ブラウザ IT シナリオ（`SCN-xx`）更新
     - ※小規模な要望の場合は 1〜2 個の Sub-issue に統合してよい。
3. 設計更新 PR（`Refs #親Issue番号`）を作成し、Task Completion Gate を経て人間がマージした時点で、差分仕様および更新された App 全体正本は **`Approved`（局所的再承認）** となる。
4. 合意された Sub-issue を `gh issue create` で起票し、親 Issue のチェックリストにリンクする。

### Step 3: MK Sub-issue の直列委託と PR 統合

1. 各 MK Sub-issue について、汎用サブエージェント（`self`）に [c-ut-workflow スキル](../c-ut-workflow/SKILL.md) を指定して **直列（逐次）委託** する。
2. サブエージェント完了後、メインエージェントが PR（`Closes #Sub-issue番号`）を作成し、[git-workflow スキル](../git-workflow/SKILL.md) に従い **Task Completion Gate（7条件）** を完遂して人間のマージを待つ。
3. 実装中に原因分類 `D`（設計不備）が見つかった場合は、同一 PR 内で **差分仕様（`docs/specs/changes/issue-XX-*.md`）と App 全体正本の両方を同時修正（局所的再承認）** し、[docs/quality/bug-and-handover-log.md](../../../docs/quality/bug-and-handover-log.md) にコード修正と設計同期の双方のコミットを記録する。

### Step 4: IT（全体回帰テスト）・申し送り精算・差分仕様アーカイブ・親 Issue 完了

1. Playwright 実ブラウザ結合テスト（`test/it/` の `SCN-01`〜）を最新仕様に合わせて進化・追加し、過去機能を含め全シナリオ 100% PASS を確認する。
2. 親 Issue に関連する申し送り事項（`HO-xx`）がすべて解決（`Resolved`）されていることを確認する。
3. 最後の Sub-issue PR（または IT PR）において、完了した差分仕様ファイルの状態を `Completed (Archived)` に更新し、**`git mv docs/specs/changes/issue-XX-<slug>.md docs/specs/changes/archive/issue-XX-<slug>.md` でアーカイブディレクトリへ移動** する。
4. PR に `Closes #親Issue番号` を設定し、人間のレビュー・マージによって親 Issue を同期クローズする（**AI が `gh issue close` 等で直接 Issue を閉じることは厳禁**）。

---

## 2. Sub-issue 起票時のテンプレート

AI が Sub-issue を起票する際は以下の形式を使用します。

```markdown
## 目的・範囲

- 親 Issue: #親Issue番号
- 対象設計正本: `docs/specs/...`
- 作業範囲: （例: `NarouParser` の実装とフィクスチャ単体テスト）

## 完了条件（Task Completion Gate）

- [ ] `docs/guidelines/testing.md` に準拠した TDD（Red → Green → Refactor コミット）で実装されていること
- [ ] 全対象ファイルの単体テストおよび C0/C1/Functions 100% カバレッジを達成していること（UI 変更時は 1対1 Story/UT・親子分離・VRT 1280px/375px PASS）
- [ ] 検出された不備や申し送り事項が `docs/quality/bug-and-handover-log.md` に記録されていること（原因 `D` は設計書同時修正）
- [ ] CI / VRT / IT が PASS し、`pr-reviewer` による独立レビューと全スレッド Resolve を経て、人間マージ（`Closes #本Issue番号`）で完了すること
```

---

## 3. ミニリリース Milestone 完了時の 3 段階運用手順

ミニリリース Milestone（`v0.1`, `v0.2` 等、または Phase 3 PoC 完了節目）の完了承認 Issue では、[docs/guidelines/workflow.md](../../../docs/guidelines/workflow.md#5-ミニリリース-milestone-と品質改善kaizenループ) および [phase-final-review スキル](../phase-final-review/SKILL.md) に従い以下の 3 段階で進行します。

1. **Step 1（全体横断レビュー）**: Milestone 内の全要望 Issue 完了後、`phase-final-review` スキルで横断レビューを実施し、Milestone 承認 Issue に Round 1 結果をコメント投稿する（PR は作らない）。
2. **Step 2（指摘是正・品質分析レポート・Kaizen PR）**: Sub-issue を起票し、横断レビュー指摘の是正、`docs/quality/bug-and-handover-log.md` の集計、`docs/quality/reports/` への品質分析レポート（バグ密度・DRE・原因傾向）作成、および再発防止の `SKILL.md` / `docs/guidelines/` 改善を含む PR（`Closes #Sub-issue`）を作成・マージする。
3. **Step 3（Milestone 承認・一括 Approved 更新 ＆ 品質記録アーカイブ）**:
   - Round 2 指摘収束と人間の承認後、`docs/specs/` 配下の正本仕様書のフロントマター `status` を一括で `Approved` に揃える。
   - 同一 PR 内で、当該 Milestone で完了したバグ記録および解決済み（`Resolved`）申し送り事項を `docs/quality/archive/<milestone>-log.md`（OKF `type: quality-log`, `status: Completed (Archived)`）へ移動し、`docs/quality/bug-and-handover-log.md` を「次期マイルストーンのバグ記録」「未解決（`Open`）申し送り事項」のみが残るクリーンな状態に整理する。
   - PR（`Closes #Milestone承認Issue`）を作成・検証し、人間のマージをもって Milestone を完了する。
