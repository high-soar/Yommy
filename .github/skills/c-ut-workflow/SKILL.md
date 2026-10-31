---
name: c-ut-workflow
description: "Use when implementing production code and unit/VRT tests in MK tasks, orchestrating worker subagents (self) sequentially, and enforcing the 3-layer testing rules in docs/guidelines/testing.md."
---

# MK（C・UT / VRT）実行・サブエージェント委託手順

このスキルは、MK（実装・単体テスト・Storybook VRT）フェーズにおける **AI エージェントの実行手順およびサブエージェント（`self`）への直列委託（オーケストレーション）手順** を定めます。

3層アーキテクチャの責務境界、TDD コミット規約、1対1 Story/UT 原則、親子コンポーネント分離原則、カバレッジ基準（C0/C1/Functions 100%）、縦書き/ルビ VRT、およびバグ記録・原因 `D` 設計同期ルールの正本（SSOT）は **[docs/guidelines/testing.md](../../../docs/guidelines/testing.md)** です。作業前に必ず正本を読了してください。

---

## 1. オーケストレーター（親）とワーカー（`self`）の役割分担

MK 作業はファイル編集数やテスト・VRT 実行ログが多く、メインセッションのコンテキスト枯渇（Compaction による手順抜け）を招きやすいため、以下の役割分担を徹底します。

- **メインエージェント（Orchestrator）**:
  1. 対象 Issue の完了条件と `docs/specs/` の承認済み設計書を確認する。
  2. 作業単位（①Parser/Storage/Bridge ロジック層、②UI 子コンポーネント層、③Page 結合層など）ごとに汎用サブエージェント（`self`）を **直列（1つずつ順番）** に起動して TDD 実装を委託する（※テスト干渉・Git ロック競合・VRT ポート競合を防ぐため並列起動しない）。
  3. ワーカー完了後、ブランチを push して PR を作成し、[git-workflow スキル](../git-workflow/SKILL.md) に従って GitHub Actions 確認と `pr-reviewer` による独立レビュー・スレッド収束を管理する。
- **ワーカーサブエージェント（`self`）**:
  1. [docs/guidelines/testing.md](../../../docs/guidelines/testing.md) と対象設計書（`docs/specs/`）を読む。
  2. 担当範囲について TDD（Red → Green → Refactor）を実行し、各ステップで個別にコミットを刻む。
  3. 品質チェック一式を実行し、検出した不備や申し送り事項を記録して親エージェントに完了報告（コミット SHA 一覧・テスト/カバレッジ結果・不備記録有無）を返す。

### ワーカーサブエージェント（`self`）起動時の指示プロンプトひな形

```text
対象 Issue #XX のうち、[担当モジュール/コンポーネント名] の TDD 実装および単体テスト・VRT 作成を行ってください。

1. 必読正本:
   - `docs/guidelines/testing.md`（TDDコミット規約、3層責務境界、1対1 Story/UT、親子分離、C0/C1 100%、VRT、原因D設計同期、Worktree環境変数・DIモック分離規律）
   - `docs/specs/...`（対象の設計正本・受け入れ条件 AC-xx）
2. 作業手順:
   - Red（失敗確認） → Green（最小実装） → Refactor の各ステップで個別にコミット（英語 type + 日本語要約）を刻むこと。
   - `.tsx` を作成・変更する場合は、同階層に `.stories.tsx` と `.test.tsx`（`composeStories` 全件実行＋分岐補完）を 1対1 で作成し、親のテストで子のバリエーションを相乗りしないこと。
   - Green 以降や検証中に不備を見つけた場合は `docs/quality/bug-and-handover-log.md` に記録し、原因分類 `D`（設計不備）の場合は必ず `docs/specs/` も同時修正すること。
3. 完了前検証:
   - `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:coverage`（C0/C1/Functions 100%）を実行し PASS を確認すること。
   - `.env.local` の有無に関わらずテスト・ビルドが 100% 決定論的に PASS することを確認すること（モック DI 徹底）。
   - UI/Story 変更時は `npm run test:vrt:update` および `npm run test:vrt`（1280px / 375px）を実行し PASS を確認すること。
4. 報告内容:
   - 作成したコミット SHA 一覧、カバレッジ・VRT 検証結果、記録した不備（L/S/D/B/A）と申し送り（HO-xx）を報告してください（※push や PR 作成は親が行います）。
```

---

## 2. ワーカー実行時の TDD・3層チェックリスト

ワーカー（または小規模変更を直接行うエージェント）は、[docs/guidelines/testing.md](../../../docs/guidelines/testing.md) の各規律を以下の手順で実行します。

### Step 1: Red（テスト・Story 先行作成と失敗確認）

- **Parser Layer**: `__fixtures__/*.html` にテスト用 HTML を用意し（現行サイトの初期表示 DOM 件数制限やトグル非表示章、`__NEXT_DATA__` 等の埋め込み JSON データ構造を事前調査し、7話超・複数章構成を含むフィクスチャを用意すること）、`*.test.ts` で抽出期待値（タイトル、目次、`<ruby>`・傍点保持、サニタイズ、異常系）を日本語の `it("... (AC-xx)")` で記述する。
- **Storage Layer**: `resetTestDb()` で初期化するインメモリ DB を用い、Repository の CRUD・境界値テストを `*.test.ts` に記述する。
- **Viewer & Bridge Layer**:
  - `*.stories.tsx` に表示バリエーション（縦書き `vertical-rl`、横書き、ルビ・傍点、各カラーテーマ、Loading/Error/Empty、操作 `play` 関数）を定義する。
  - スクロール・Overflow を伴う表示コンポーネント（特に親 `horizontal-tb` 内で `writing-mode: vertical-rl` となる直交フロー要素）では、`w-full max-w-full` 等の幅制約を明示するとともに、画面外にはみ出す長文データを含めた Story（1280px / 375px 双方で Overflow するケース）を必須とし、VRT と実ブラウザ IT（負の `scrollLeft` 検証）の双方でスクロール可能性を保証する。
  - 非同期永続化を伴う設定やフォームでは、保存失敗時の状態ロールバックおよびエラー通知（`role="alert"`）の Story / UT を必須とする。
  - ルーティング・ナビゲーション機能では、同一ルート再タップ時の重複履歴ガード（no-op 制御）を考慮する。
  - `*.test.tsx` で `composeStories` による全 Story 実行＋内部ロジック補完テストを記述する。
- **失敗確認とコミット**: `npx vitest run <対象テスト>` を実行し、未実装により期待通り失敗することを確認して `test(<scope>): ...（Red）` をコミットする。

### Step 2: Green（最小実装）

- テストをパスさせる最小限の実装コードを作成する（YAGNI 原則、[ponytail スキル](../ponytail/SKILL.md) 参照）。
- 対象テストを実行して全件 PASS を確認し、`feat(<scope>): ...（Green）`（または `fix`）をコミットする。

### Step 3: Refactor（構造・型安全性の改善）

- テストが Green の状態を維持したまま、重複排除・型定義の厳密化・可読性向上を行い、再度テスト PASS を確認して `refactor(<scope>): ...（Refactor）` をコミットする。
- ※Green / Refactor 中にテストケース漏れや期待値誤りに気づいた場合は、プロダクションコードとテストを同時に書き換えず、一度テストを追加・修正して Red を確認してから実装を直すこと。

### Step 4: 局所検証・カバレッジ・VRT・不備記録

1. `npm run test:coverage` を実行し、変更・追加した全ファイルの **C0 / C1 / Functions カバレッジが 100%** であることを確認する（不正な `v8 ignore` は使用禁止）。
2. `npm run typecheck`, `npm run lint`, `npm run format:check` を実行し PASS を確認する。
3. Story を追加・変更した場合は `npm run test:vrt:update` → `npm run test:vrt` を実行し、1280px / 375px のスナップショットが正しく生成・検証されることを確認する（Story を削除・置換した場合は旧スナップショット PNG を削除し、孤児スナップショット検知ガードテストを通過させること）。
4. 作業中に検出した不備や後続への申し送り（`HO-xx`）を [docs/quality/bug-and-handover-log.md](../../../docs/quality/bug-and-handover-log.md) に記録する（原因 `D` は設計書も同時修正）。

---

## 3. 標準コマンド一覧（Phase 3 で `package.json` 整備後に有効化）

| コマンド                                       | 用途                                                        |
| :--------------------------------------------- | :---------------------------------------------------------- |
| `npm run typecheck`                            | TypeScript 型検査                                           |
| `npm run lint`                                 | ESLint 静的解析                                             |
| `npm run format:check` / `npm run format`      | Prettier 書式検査 / 自動整形                                |
| `npm run test:unit`                            | Vitest 単体テスト実行                                       |
| `npm run test:coverage`                        | Vitest カバレッジ計測（C0/C1/Functions 100% 検証）          |
| `npm run test:vrt` / `npm run test:vrt:update` | Storybook VRT 実行 / スナップショット更新（1280px / 375px） |
| `npm run test:it`                              | Playwright 実ブラウザ結合テスト（`SCN-01`〜）実行           |
| `npm run build && npx cap sync android`        | Web 本番ビルド ＆ Capacitor Android プロジェクトへの同期    |
