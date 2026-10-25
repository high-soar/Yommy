# 第6部：他プロジェクト導入用スターターテンプレート＆チェックリスト集

> [← 第5部：他プロジェクトへの適応手引き](./05-iterative-adaptation-guide.md) | [00-index.md（全体目次）へ戻る](./00-index.md)

本ドキュメントでは、第1部〜第5部で解説した仕組みを新規または既存の他プロジェクトへ導入する際、**そのままコピー＆ペーストして使える実践テンプレート一式** を提供します。

---

## 1. 人間が起票する「要望 Issue（Feature Request）」テンプレート

`.github/ISSUE_TEMPLATE/feature_request.md` として配置するテンプレートです。人間は細かい設計を書く必要はなく、「背景・やりたいこと・気になっている点」だけを書き、残りの細分化は AI に任せます。

```markdown
---
name: "✨ 要望・機能追加 (Feature Request)"
about: "人が要望を記載し、AIが外部設計→詳細設計→MK→テストへ細分化する親Issue"
labels: ["feature", "needs-refinement"]
---

## 1. 背景・目的（Why）
<!-- なぜこの機能や改修が必要なのか、解決したいユーザーの課題を記載 -->
- 

## 2. 実現したいこと・要望の概要（What）
<!-- 人間がイメージしている挙動を箇条書きで記載（粗い粒度でOK） -->
- 
- 

## 3. 対象外スコープ（今回やらないこと）
- 

## 4. 気になっている点・制約事項（任意）
<!-- 既存機能への影響や、仕様を迷っている箇所があれば記載 -->
- 

---

## 🤖 AI 細分化・進行管理チェックリスト（AI が自動更新）
- [ ] **Phase 1: 要望分析・未確定事項（Open Questions）の確認完了**
- [ ] **Phase 2: 外部設計（ED：AC・OpenAPI）＋ 詳細設計（ID：構成・テスト観点）PR の合意・マージ**
- [ ] **Phase 3: 実装・単体テスト（MK / C・UT）Sub-issue の完了**
  - Sub-issues: <!-- AIが起票したSub-issue番号をリンク -->
- [ ] **Phase 4: 結合テスト（IT：全体回帰シナリオ `SCN-xx` 更新・100% PASS）完了**
- [ ] **Phase 5: バグ記録および後続への申し送り事項（Handover Items）の精算完了**
```

---

## 2. 要望 Issue を AI に細分化させる「キックオフ・プロンプト」

人間が要望 Issue（例：`#10`）を立てた後、メインエージェント（Orchestrator）に最初に投げる定型プロンプトです。

```markdown
Issue #10 の要望について、段階的詳細化（外部設計 → 詳細設計 → MK計画 → テスト計画）を開始してください。
いきなりプロダクションコードの実装（MK）には着手せず、以下の手順で進めてください。

1. **既存仕様とコードの調査**:
   軽量モデル（`flash`）の `research` サブエージェントを起動し、関連する既存の設計書（`docs/specs/`、`openapi.yaml`）および既存コンポーネント・テストの構成を調査させてください。
2. **未確定仕様（Open Questions）の洗い出し**:
   権限境界、異常系・エラー表示、境界値、画面遷移・状態保持などで、人間の判断が必要な未確定事項があれば推測で決め打ちせず、選択肢付きで質問してください。
3. **設計更新（ED+ID）とタスク分割案の提示**:
   仕様が固まったら、以下を含む「設計更新 PR」を作成し、実装（MK）および結合テスト（IT）の Sub-issue 分割案を提示してください。
   - 外部設計：受け入れ条件（`AC-xx`）、画面遷移（`TR-xx`）、`openapi.yaml` の更新
   - 詳細設計：変更・追加するコンポーネント/Hook構成、UT（Storybook/Vitest）およびIT（Playwright `SCN-xx`）のテスト観点
   - 申し送り事項：実装・テストフェーズで検証すべき引き継ぎ事項（`HO-xx`）
```

---

## 3. 軽量「機能設計書（Feature Spec：ED＋ID 統合版）」テンプレート

`docs/specs/features/<feature-name>.md` に配置する、外部設計（ED）と内部設計（ID）を1ファイルに凝縮した Living Documentation テンプレートです。イテレーティブ開発でも重くならず、かつ AI が迷わない必要十分な情報量を持ちます。

```markdown
# 機能設計書：[画面・機能名]（SCR-XX）

| 項目 | 内容 |
| :--- | :--- |
| **状態** | `Review (#10)` / `Approved (#10)` |
| **最終更新日** | `YYYY-MM-DD` |
| **関連 API 正本** | `docs/specs/api/openapi.yaml` (`GET /api/...`, `POST /api/...`) |
| **関連 IT シナリオ** | `test/it/scenarios/scnXX-*.spec.ts` (`SCN-XX`) |

---

## 1. 外部設計（ED）：利用者視点の仕様と受け入れ条件

### 1.1 画面概要・アクセス権限
- **URL パス**: `/xxx`
- **許可ロール**: `admin`, `user`（未認証時は `/login` へリダイレクト、権限不足時は 403 表示）

### 1.2 受け入れ条件（Acceptance Criteria）
| AC ID | カテゴリ | 条件・期待される振る舞い | 対応 API / 遷移 ID |
| :---: | :--- | :--- | :--- |
| **SCR-XX AC-01** | 初期表示 | 初期表示時に一覧データを取得し、テーブルに描画する。0件時は空状態メッセージを表示する。 | `GET /api/xxx` |
| **SCR-XX AC-02** | 入力検証 | タイトル未入力または100文字超過時は送信をブロックし、フィールド直下にエラーを表示する。 | - |
| **SCR-XX AC-03** | 正常送信 | 保存成功時はトーストを表示し、詳細画面へ遷移する。 | `POST /api/xxx`, `TR-XX` |
| **SCR-XX AC-04** | 離脱ガード | 入力変更あり（Dirty）状態で別画面へ遷移しようとした場合、確認モーダルを表示する。 | `TR-YY` |

---

## 2. 詳細設計（ID）：コンポーネント構成とテスト責務

### 2.1 コンポーネント・Hook 構成と親子責務分離
| 対象パス | 区分 | 責務（何をするか・何をしないか） |
| :--- | :--- | :--- |
| `src/features/xxx/components/XxxPage.tsx` | 親 (Page) | Hook 呼び出し、Loading/Error/Ready の切り替え、子への Props 渡しのみ。 |
| `src/features/xxx/components/XxxForm.tsx` | 子 (UI) | フォーム描画、文字数カウント、エラー表示。API 通信は直接行わない。 |
| `src/features/xxx/hooks/useXxxSubmit.ts` | Hook | バリデーション、API 呼び出し、二重送信防止（`isSubmitting`）、Abort 制御。 |

### 2.2 テスト設計（UT / VRT / IT の責務割り当て）
| 検証対象 | UT（Storybook + Vitest: C0/C1 100%） | VRT（1280px/375px） | IT（Playwright 実ブラウザ `SCN-XX`） |
| :--- | :--- | :--- | :--- |
| `XxxForm.tsx` | `Default`, `WithErrors`, `Submitting`, `Interactive (play)` | 全 Story 対象 | -（単体バリエーションは UT で完結） |
| `useXxxSubmit.ts` | 正常送信、400/500異常系、二重送信ガード | - | - |
| 画面結合・遷移 | - | - | `SCN-XX-01`: 起票〜詳細遷移通し確認<br>`SCN-XX-02`: Dirty離脱ガード確認 |

---

## 3. 次工程（MK / IT）への申し送り事項（Handover Items）
| ID | 申し送り事項 | 解決先 Issue / 成果物 | 完了ゲート | 状態 |
| :-: | :--- | :--- | :--- | :---: |
| **HO-01** | 実ブラウザでの URL クエリ復元（ブラウザバック時）の検証 | `test/it/scenarios/scnXX.spec.ts` | 親 Issue #10 完了前 | Open / Resolved |
```

---

## 4. バグ記録票 ＆ 定期品質分析テンプレート

`docs/quality/bug-and-handover-log.md` としてリポジトリに1つ置いておき、MK（実装）や IT（テスト）、AI レビューの過程で見つかった不備を追記していくシートです。

```markdown
# 品質記録・バグ記録票（Bug & Handover Log）

> **記入ルール**:
> 1. **成果物区分の分離**: 本番コードの不備は `製品コード`、テスト・モック・Storybook・設定の不備は `支援成果物` と記載する。
> 2. **原因分類（5分類）**: `L` (Logic), `S` (State), `D` (Design: 仕様・設計誤認), `B` (Boundary: 境界値), `A` (Async: 非同期制御)
> 3. **【重要】原因 `D` の設計同期義務**: 原因が `D` の場合、コードのみの修正は厳禁。必ず設計書（`docs/specs/` または `openapi.yaml`）も同時修正し、両方のコミット/PR を記録すること。

## 1. バグ記録一覧
| No. | Issue/PR | 検出フェーズ・手段 | 成果物区分 | 対象箇所 | 原因 | 不備の概要と是正内容（原因Dは設計書同期コミット併記） |
| :-: | :---: | :--- | :--- | :--- | :-: | :--- |
| 1 | #12 | MK / `pr-reviewer` | 製品コード | `XxxForm.tsx` | D | 仕様書 `AC-02` の上限文字数（100文字）に対し実装が 200 文字になっていた不備。実装を 100 文字に是正 (`a1b2c3d`)。 |
| 2 | #14 | IT / `Playwright` | 支援成果物 | `handlers/xxx.ts`<br>`openapi.yaml` | D | 権限エラー時に 403 ではなく 401 を返していた。`openapi.yaml` のエラー定義と MSW ハンドラーを同期修正 (`d4e5f6g`)。 |

---

## 2. スプリント／マイルストーン品質振り返りサマリー（定期追記）

### [YYYY-MM Sprint N]（対象 Issue: #10 〜 #20）
- **製品コード不備件数**: X 件（うち MK/UT 検出: X 件、IT 流出: Y 件 → **DRE: XX.X%**）
- **原因分類トップ**: `D`（設計誤認: XX%）、`B`（境界値: XX%）
- **今回のプロセス改善アクション（Kaizen）**:
  - [ ] `.github/skills/c-ut-workflow/SKILL.md` に〇〇のチェック観点を追記（PR #XX）
```

---

## 5. 他プロジェクトへ移植する `AGENTS.md` の最小コア骨格

新しいプロジェクトを始める際、ルート直下の `AGENTS.md` に最低限入れておくべき「黄金ルール」の抜粋です。

```markdown
# Project Agent Guidelines

## 1. 開発フローと段階的詳細化（Issue駆動マイクロ・ウォーターフォール）
- 要望 Issue に対して、いきなりプロダクションコードを実装してはならない。
- 必ず **①外部設計・詳細設計の合意（`docs/specs/` および `openapi.yaml` の更新） → ②MK（TDD実装・単体テスト・VRT） → ③IT（実ブラウザ結合回帰テスト）** の順で段階的に進めること。
- 未確定の仕様や契約は勝手に推測せず、人間に質問（Open Questions）して合意を得ること。

## 2. オーケストレーションとコンテキスト保護
- メインエージェントは司令塔（タスク分解、サブエージェント委託、PR作成、ゲート検証）に専念し、重い実装・TDDサイクル・テスト実行は汎用サブエージェント（`self`）に該当スキル（`c-ut-workflow` 等）を指定して**直列（逐次）委託**すること。
- 単純なコードベースやドキュメントの調査は、軽量モデル（`flash`）の `research` サブエージェントを活用してメインコンテキストを節約すること。

## 3. 実装・テスト規律（MK / IT）
- **TDD**: Red（失敗確認） → Green（最小実装） → Refactor の順でコミットを刻むこと。
- **1対1 対応と親子分離**: 全 UI コンポーネント（`*.tsx`）に Storybook（`*.stories.tsx`）と単体テスト（`*.test.tsx` / Portable Stories）を同階層で 1対1 作成し、親のテストで子のバリエーションを相乗りテストしないこと。
- **システム全体回帰保証**: 結合テスト（IT）は過去機能のシナリオを放置・スキップせず、最新仕様に合わせて進化させ、常に全シナリオ 100% PASS を維持すること。

## 4. 品質記録と設計書即時同期（Design Sync）
- 検出された不備は `docs/quality/bug-and-handover-log.md` に記録する（製品コードと支援成果物を分離）。
- 原因が `D`（設計・仕様不備）の場合、**コードのみを修正して設計書を放置することは厳禁**。必ず `docs/specs/` や `openapi.yaml` を同時に更新すること。

## 5. Task Completion Gate（7つの完了条件）
PR を作成しただけで作業完了と報告してはならない。以下の全ゲートをクリアすること：
1. 静的検査（`typecheck`, `lint`, `format:check`）および自動テスト（UT / カバレッジ基準）PASS
2. UI 変更時は Storybook VRT スナップショット更新・検証 PASS
3. PR に `Closes #N` を設定（AI による直接の Issue クローズや PR マージは厳禁）
4. GitHub Actions（CI / VRT / IT）PASS
5. 独立レビューエージェント（`pr-reviewer`）によるレビュー実施（`docs/review-comment-format.md` 準拠）
6. 全指摘スレッドの修正・再検証・Resolve 収束
7. 人間による最終承認・マージ待機
```

---

## 6. 新規プロジェクトへの導入ステップ・チェックリスト

別プロジェクトへこの仕組みを導入する際は、以下の順序で段階的にセットアップするとスムーズです。

- [ ] **Step 1: AI 設定とレビュー基準の移植**
  - [ ] `AGENTS.md`（上記コア骨格）と `.github/copilot-instructions.md` を配置する。
  - [ ] `docs/review-comment-format.md`（`[P0]`〜`[P3]` ＋ 4要素フォーマット）を配置する。
  - [ ] `.github/agents/pr-reviewer.agent.md`（独立レビュアー定義）を配置する。
- [ ] **Step 2: スキル（`.github/skills/`）の移植**
  - [ ] `c-ut-workflow/SKILL.md`（TDD、1対1 Story/UT、親子分離、MSW、カバレッジ基準）をプロジェクトの技術スタックに合わせて配置する。
  - [ ] `git-workflow/SKILL.md` と `retrospective/SKILL.md` を配置する。
- [ ] **Step 3: テスト＆VRT 基盤の構築**
  - [ ] Vitest ＋ Storybook（Portable Stories `composeStories`）＋ カバレッジ閾値設定を導入する。
  - [ ] OpenAPI からの型自動生成と、テスト用シードリセット機構（`resetMockDb` / `POST /api/test/reset`）を用意する。
  - [ ] DevContainer（`fonts-dejavu-core` 等）と GitHub Actions でフォント環境を揃えた VRT 基盤を用意する。
- [ ] **Step 4: Living Documentation と品質ログの初期化**
  - [ ] `docs/specs/`（機能別正本ディレクトリ）と `docs/quality/bug-and-handover-log.md` を作成する。
  - [ ] `.github/ISSUE_TEMPLATE/feature_request.md` を配置し、最初の要望 Issue から「AI 細分化 → 設計 PR → MK → IT → 品質記録」のサイクルを回す。
