# Step 3 実装・単体テスト（C・UT）工程計画書

| 項目                | 内容                                                                                                                                                                                                                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 状態                | `Approved (Step 3)`                                                                                                                                                                                                                                                                                                               |
| 更新日              | `2026-10-24`                                                                                                                                                                                                                                                                                                                      |
| 関連する ED/ID 項目 | `docs/rd/step3.md#3-ut--it--pt-の切り分けとテスト規約の詳細`<br>`docs/ed/01-system-overview.md`<br>`docs/id/01-frontend-architecture.md`<br>`docs/id/state-management.md`<br>`docs/id/api-client.md`<br>`docs/id/test-design.md`<br>`docs/id/screens/`<br>`docs/c-ut/quality/step2.md`<br>`.github/skills/c-ut-workflow/SKILL.md` |

このドキュメントでは、承認された内部設計（ID）成果物および要件定義に基づき、Step 3 実装・単体テスト（C・UT）工程で実施すべき作業分解（WBS）、タスク一覧、各タスクと設計書のトレーサビリティ、品質基準、および依存関係を定義します。

---

## 1. 工程の目的と基本方針

### 1.1 目的

1. **ID 設計の忠実なコード化**: 人間レビュアーにより承認された内部設計（ID）成果物（`docs/id/`）に基づき、Next.js 15+ (App Router) 構成、別コンテナ Mock API サーバー、OpenAPI 型定義自動生成、および 3層 Dirty State ガードを TDD（テスト駆動開発）で忠実に実装する。
2. **新 UT テスト規約の完全遵守**:
   - `src/app/**/page.tsx`（薄いラッパー）、`layout.tsx`、`not-found.tsx` を含む **全 `.tsx` ファイルに対する `.stories.tsx` 1対1 作成**。
   - 同階層 `.test.tsx` での Portable Stories（`composeStories`）全件実行 ＋ 内部ロジック補完。
   - 親コンポーネントが子のバリエーションを兼ねることを禁止する **親子コンポーネント分離原則**。
3. **C0 / C1 100% カバレッジ充足**: [docs/id/test-design.md](../id/test-design.md) §5 に従い、全プロダクションコード（`src/` 配下および `server/mock-api.ts`）に対して命令（C0）・分岐（C1）・関数 100% カバレッジを達成する。
4. **VRT の UT（Storybook）への完全一本化**: 視覚的回帰テスト（VRT）は Storybook を対象として 1280px / 375px で実施し、結合テスト（IT）では VRT を行わない。
5. **Next.js 本番ビルド最適化とモック完全除外（DCE）の実証**: 初期ロード JavaScript バンドルサイズ 100.0 kB 未満（Gzip）の達成、およびクライアント本番チャンク内の MSW 混入 0 bytes（デッドコード除去）を単体テスト・解析スクリプトで実証する。
6. **作業内不備の記録と設計書即時同期**: AI 作業中に確認した不備をスリム化必須 6 項目で記録し、原因分類 `D`（設計・仕様不備）検出時はコードのみの修正を禁止し、ED/ID/OpenAPI 設計書の即時是正と双方のコミットを記録する（[docs/c-ut/evidence/ut-bug-record.md](evidence/ut-bug-record.md)）。

### 1.2 基本開発原則（Step 3 C・UT 標準）

- **TDD サイクルの徹底**: Red（テスト失敗確認） → Green（最小限の実装） → Refactor（品質改善）の順で進め、コミットログに証跡を記録する（[.github/skills/c-ut-workflow/SKILL.md](../../.github/skills/c-ut-workflow/SKILL.md) 準拠）。
- **例外なしの 1 対 1 対応（Co-location）**: 全 `*.tsx` ファイルと同階層に同名の `*.stories.tsx` および `*.test.tsx` を作成し、全 `*.ts` ファイルと同階層に同名の `*.test.ts` を作成する。
- **親子コンポーネント分離原則**: 親コンポーネントは親自身の状態管理・大枠レイアウト・子への Props 受け渡しのみを検証し、子コンポーネント固有のバリエーション・境界値・入力エラーは必ず子自身の Story / UT で網羅する。
- **C0 / C1 100% 原則**: 型定義専用ファイル（`**/*.d.ts`）および Storybook カタログ（`**/*.stories.tsx`）を除く全モジュールで C0/C1 100% を達成する。恣意的な `/* v8 ignore next */` の乱用は禁止する。
- **Storybook VRT 一本化**: UI コンポーネントおよび全画面の視覚差分検証は Storybook VRT に一本化し、IT での二重管理とフレーキーを排除する。
- **`parameters.nextNavigation` 統合モック活用**: Next.js App Router 固有のルーティングフック（`useRouter`, `usePathname`, `useSearchParams`, `notFound`）は方式 1-C に従い Storybook / Vitest で共通モック化する。
- **原因分類 `D` の設計書即時同期義務**: コードのみを修正して終わらせることは厳禁とし、ED/ID/OpenAPI 設計書を即座に修正して双方のコミットを記録する（[AGENTS.md](../../AGENTS.md) §4 準拠）。
- **日本語によるテスト・カタログ記述**: テスト名（`it` ブロック）および Storybook 表示名（`name` プロパティ）・JSDoc 説明文は自然な日本語で記述する。

---

## 2. 作業分解構成（WBS）とタスク一覧

Step 3 C・UT 工程の作業項目は、機能独立性・依存順序・レビュー性を考慮し、以下の 11 件の作業および工程承認タスクに分割して管理します。

| No. | 作業項目（Issue タイトル）                                                                                                                                                                      | 主な対象モジュール / 成果物                                                                                                      | 依存先              |
| :-: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- | :------------------ |
|  1  | [#229](https://github.com/high-soar/react-practice-notes/issues/229) [Step 3 - C・UT] C・UT 工程計画書の策定・作業標準スキル更新および単体テスト不備記録シートの準備                            | `docs/c-ut/README.md`<br>`.github/skills/c-ut-workflow/SKILL.md`<br>`docs/c-ut/evidence/ut-bug-record.md`                        | なし (ID承認後即時) |
|  2  | [#230](https://github.com/high-soar/react-practice-notes/issues/230) [Step 3 - C・UT] Next.js (App Router) ビルド・テスト・Storybook モック基盤への移行                                         | `package.json`, `next.config.mjs`, `src/app/globals.css`, `.storybook/preview.ts`, `src/test/setup.ts`, `vitest.config.ts`       | #229                |
|  3  | [#231](https://github.com/high-soar/react-practice-notes/issues/231) [Step 3 - C・UT] OpenAPI 型定義自動生成・共通 API クライアント改修・MSW ハンドラーおよび別コンテナ Mock API サーバーの実装 | `src/shared/api/openapi.generated.ts`, `src/shared/api/client.ts`, `src/app/MSWProvider.tsx`, `server/mock-api.ts`, `src/mocks/` | #230                |
|  4  | [#232](https://github.com/high-soar/react-practice-notes/issues/232) [Step 3 - C・UT] 共通レイアウト（AppLayout・Header・Sidebar）・共通 UI コンポーネントおよび 3層 Dirty State ガードの実装   | `src/shared/layout/`, `src/shared/ui/`, `src/shared/lib/`（DirtyGuardContext, useDirtyGuard, useAppRouter）                      | #230, #231          |
|  5  | [#233](https://github.com/high-soar/react-practice-notes/issues/233) [Step 3 - C・UT] ログイン画面（SCR-AUTH）・認証基盤および認可ガード（TR-16/17）の実装                                      | `src/features/auth/`, `src/app/(authenticated)/layout.tsx`, `src/app/login/page.tsx`                                             | #231, #232          |
|  6  | [#234](https://github.com/high-soar/react-practice-notes/issues/234) [Step 3 - C・UT] ロール別ダッシュボード画面（SCR-00）の実装                                                                | `src/features/dashboard/`, `src/app/(authenticated)/dashboard/page.tsx`                                                          | #231, #232, #233    |
|  7  | [#235](https://github.com/high-soar/react-practice-notes/issues/235) [Step 3 - C・UT] 問い合わせ一覧画面（SCR-01）の実装                                                                        | `src/features/tickets/components/`（一覧系）, `src/app/(authenticated)/tickets/page.tsx`                                         | #231, #232, #233    |
|  8  | [#236](https://github.com/high-soar/react-practice-notes/issues/236) [Step 3 - C・UT] 問い合わせ詳細画面（SCR-02）・新規起票画面（SCR-03）および共通 404 の実装                                 | `src/features/tickets/components/`（詳細・起票系）, `src/app/(authenticated)/tickets/[id]/page.tsx`, `src/app/not-found.tsx`     | #231, #232, #235    |
|  9  | [#237](https://github.com/high-soar/react-practice-notes/issues/237) [Step 3 - C・UT] ユーザー・プロジェクト管理画面（SCR-04）の実装                                                            | `src/features/admin/`, `src/app/(authenticated)/admin/management/page.tsx`                                                       | #231, #232, #233    |
| 10  | [#238](https://github.com/high-soar/react-practice-notes/issues/238) [Step 3 - C・UT] 全モジュール C0/C1 100% カバレッジ充足と Storybook VRT スナップショット整合性確保                         | 全プロダクションコード（Vitest C0/C1 100%）、全 Storybook VRT スナップショット、本番ビルド DCE 検証                              | #230〜#237 (全実装) |
| 11  | [#239](https://github.com/high-soar/react-practice-notes/issues/239) [Step 3 - C・UT] 実装・単体テスト成果物をレビュー・承認する                                                                | 全成果物の品質検証、`docs/c-ut/quality/step3.md`、`docs/c-ut/evidence/ut-bug-record.md` 集約、人間承認                           | #229〜#238 (全)     |

---

## 3. 各タスクの詳細仕様と設計書トレーサビリティ

### 3.1 No.1: C・UT 工程計画書の策定・作業標準スキル更新および単体テスト不備記録シートの準備

- **目的**: Step 3 C・UT 工程の全体計画書（`docs/c-ut/README.md`）を策定し、作業標準スキル（`.github/skills/c-ut-workflow/SKILL.md`）を Step 3 UT 規約へ刷新するとともに、単体テスト不備記録シート（`docs/c-ut/evidence/ut-bug-record.md`）を準備する。
- **参照設計**: [docs/rd/step3.md](../rd/step3.md) §4.2, [docs/id/test-design.md](../id/test-design.md) §1〜§6, §9.1

### 3.2 No.2: Next.js (App Router) ビルド・テスト・Storybook モック基盤への移行

- **目的**: Vite から Next.js 15+ (App Router) へのランタイム・設定移行、グローバル CSS 一元管理（`src/app/globals.css`）、方式 1-C（`parameters.nextNavigation`）による Storybook / Vitest 共通ナビゲーションモック基盤、および C0/C1 100% カバレッジ設定を整備する。
- **参照設計**: [docs/id/01-frontend-architecture.md](../id/01-frontend-architecture.md) §7.4, [docs/id/tech-verification.md](../id/tech-verification.md) §2, [docs/id/test-design.md](../id/test-design.md) §2.3, §5

### 3.3 No.3: OpenAPI 型定義自動生成・共通 API クライアント改修・MSW ハンドラーおよび別コンテナ Mock API サーバーの実装

- **目的**: `openapi-typescript` による型自動生成、共通 fetch ラッパー（`cache: "no-store"`、クエリ除外、エラー変換）、クライアント MSW 初期化プロバイダ（`MSWProvider.tsx`）、リセット API（`POST /api/test/reset`）、および別コンテナで稼働するスタンドアロン Mock API サーバー（`server/mock-api.ts`）を TDD で実装・単体テストする。
- **参照設計**: [docs/id/api-client.md](../id/api-client.md), [docs/id/01-frontend-architecture.md](../id/01-frontend-architecture.md) §8, [docs/id/test-design.md](../id/test-design.md) §3.1〜§3.3, §9.1.3

### 3.4 No.4: 共通レイアウト（AppLayout・Header・Sidebar）・共通 UI コンポーネントおよび 3層 Dirty State ガードの実装

- **目的**: 開閉式サイドバー（240px / 60px、`localStorage` 永続化、ロール別表示）、共有 UI コンポーネント群（Button, Input, Select, Badge, Spinner, Modal, Toast）、および 3層 Dirty State ガード（`DirtyGuardContext`, `useDirtyGuard`, `useAppRouter`, `DirtyGuardModal`）を全 `.tsx` Story 必須・親子分離に基づき TDD で実装・単体テストする。
- **参照設計**: [docs/id/01-frontend-architecture.md](../id/01-frontend-architecture.md) §5, §6, [docs/id/state-management.md](../id/state-management.md) §4, §5, [docs/id/test-design.md](../id/test-design.md) §3.4, §8.2(6)

### 3.5 No.5: ログイン画面（SCR-AUTH）・認証基盤および認可ガード（TR-16/17）の実装

- **目的**: 認証 API、`AuthContext`、`useAuth`、`useLogin`、ログイン画面コンポーネント群（`LoginPageContent`, `LoginForm`, `CredentialField` 等）、Thin Wrapper Page（`src/app/login/page.tsx`）、および認可保護レイアウト（`src/app/(authenticated)/layout.tsx`、TR-16/17 確定文言検証）を全 `.tsx` Story 必須・親子分離に基づき TDD で実装・単体テストする。
- **参照設計**: [docs/id/screens/login.md](../id/screens/login.md), [docs/id/01-frontend-architecture.md](../id/01-frontend-architecture.md) §4, [docs/id/test-design.md](../id/test-design.md) §3.1.2, §3.5, §8.2(2)

### 3.6 No.6: ロール別ダッシュボード画面（SCR-00）の実装

- **目的**: 一般ユーザービュー（`GeneralDashboardView`、自案件サマリー、自分宛てチケット最大5件）、管理者ユーザービュー（`AdminDashboardView`、全社集計、プロジェクト別稼働、未割当・滞留アラート）、Thin Wrapper Page（`src/app/(authenticated)/dashboard/page.tsx`）、および `useDashboardSummary` を全 `.tsx` Story 必須・親子分離に基づき TDD で実装・単体テストする。
- **参照設計**: [docs/id/screens/dashboard.md](../id/screens/dashboard.md), [docs/id/test-design.md](../id/test-design.md) §3.6, §8.2(3)

### 3.7 No.7: 問い合わせ一覧画面（SCR-01）の実装

- **目的**: 問い合わせ一覧画面コンテナ（`TicketListPage`）、検索フォーム（`TicketListFilterForm`、ロール別プロジェクト選択、日付逆転検証）、一覧テーブル（`TicketTable`、`SortableHeader`、`TicketRow`）、ページネーション（`TicketPagination`）、Thin Wrapper Page（`src/app/(authenticated)/tickets/page.tsx`）、および `useTicketList` / `useTicketQueryParams` を全 `.tsx` Story 必須・親子分離に基づき TDD で実装・単体テストする。
- **参照設計**: [docs/id/screens/ticket-list.md](../id/screens/ticket-list.md), [docs/id/state-management.md](../id/state-management.md) §2, §6.1, [docs/id/test-design.md](../id/test-design.md) §3.7, §8.2(4)

### 3.8 No.8: 問い合わせ詳細画面（SCR-02）・新規起票画面（SCR-03）および共通 404 の実装

- **目的**: 問い合わせ詳細画面コンテナ（`TicketDetailPage`、サマリー、更新セクション、コメント履歴、コメント投稿、管理者 Read-only 制御、SCR-02 内 404 表示）、新規起票画面（`TicketCreatePage`、`TicketCreateForm`、プロジェクト・担当者バインド、Dirty 連携）、Thin Wrapper Pages（`tickets/[id]/page.tsx`, `tickets/new/page.tsx`）、および共通 404（`src/app/not-found.tsx`）を全 `.tsx` Story 必須・親子分離に基づき TDD で実装・単体テストする。
- **参照設計**: [docs/id/screens/ticket-detail.md](../id/screens/ticket-detail.md), [docs/id/screens/ticket-create.md](../id/screens/ticket-create.md), [docs/id/test-design.md](../id/test-design.md) §3.8, §3.9, §3.1.3, §8.2(1)(4)

### 3.9 No.9: ユーザー・プロジェクト管理画面（SCR-04）の実装

- **目的**: 管理者専用管理画面コンテナ（`AdminManagementContent`、タブ切替、プロジェクト追加/削除モーダル、ユーザー追加/削除モーダル、所属チェックリスト、Dirty 連携、削除保護制約）、Thin Wrapper Page（`src/app/(authenticated)/admin/management/page.tsx`）、および `useAdminProjects` / `useAdminUsers` / `useAdminAffiliations` を全 `.tsx` Story 必須・親子分離に基づき TDD で実装・単体テストする。
- **参照設計**: [docs/id/screens/admin-management.md](../id/screens/admin-management.md), [docs/id/test-design.md](../id/test-design.md) §3.10, §8.2(5)

### 3.10 No.10: 全モジュール C0/C1 100% カバレッジ充足と Storybook VRT スナップショット整合性確保

- **目的**: Step 3 全プロダクションコード（`src/` 配下および `server/mock-api.ts`）に対して `npm run test:coverage` を実行し、C0 / C1 / Functions / Lines カバレッジ 100% を完全達成する。全 Story に対する VRT スナップショット（1280px / 375px）を更新・検証し、本番ビルド（`output: "standalone"`）での初期ロード JS < 100.0 kB およびモック除外 DCE（0 bytes）を実証する。
- **参照設計**: [docs/id/test-design.md](../id/test-design.md) §5, §8, [docs/vrt/operation-guide.md](../vrt/operation-guide.md)

### 3.11 No.11: 実装・単体テスト成果物をレビュー・承認する

- **目的**: 全個別作業タスク（#229〜#238）の完了確認、全単体テスト PASS、C0/C1 100% カバレッジ充足、Storybook VRT PASS、本番ビルド・DCE 検証、バグ記録シート（`docs/c-ut/evidence/ut-bug-record.md`）の集約、Step 3 C・UT 品質分析レポート（`docs/c-ut/quality/step3.md`）の作成・評価を行い、`phase-final-reviewer` による横断レビューを経て人間承認を受ける。
- **参照設計**: 本計画書, [docs/id/test-design.md](../id/test-design.md), [docs/c-ut/evidence/ut-bug-record.md](evidence/ut-bug-record.md), [docs/c-ut/quality/step3.md](quality/step3.md)

---

## 4. 完了判定基準と品質ゲート

### 4.1 個別作業タスクの完了基準（Task Completion Gate）

各個別作業タスク（#229〜#238）は、以下の **Task Completion Gate** をすべて満たした段階で完了とします。PR 作成のみで完了報告を行ってはなりません。

1. **静的検査と単体テスト PASS**:
   - `npm run typecheck`（型チェック）PASS
   - `npm run lint`（ESLint）PASS
   - `npm run format:check`（Prettier 書式チェック）PASS
   - `npm run test:unit`（単体テスト）全件 PASS
   - `node --test "test/**/*.js"`（リポジトリテスト）PASS
2. **新 UT 規約の充足**:
   - 変更・追加された全 `.tsx` ファイルと同階層に `.stories.tsx` および `.test.tsx` が 1 対 1 で作成されていること。
   - 親子コンポーネント分離原則が守られ、親の試験で子のバリエーションを兼ねていないこと。
   - Storybook ストーリーを追加・更新した場合は `npm run test:vrt:update` でスナップショットを更新し、`npm run test:vrt` が PASS すること。
3. **バグ記録と設計書即時同期**:
   - 作業中に確認された不備が [docs/c-ut/evidence/ut-bug-record.md](evidence/ut-bug-record.md) に記録されていること。
   - 原因分類 `D`（設計・仕様不備）が検出された場合は、対応する設計書（`docs/ed/`, `docs/id/`, `docs/ed/api/openapi.yaml`）が即座に是正され、コードと設計双方のコミットが記録されていること。
4. **Pull Request の構成**:
   - PR 本文に `Closes #N` を明記すること。
   - 成果物のドキュメント状態は `Review (Step 3)` とすること（決して `Approved` にしない）。
5. **CI / VRT ワークフローの PASS**:
   - GitHub Actions CI（`ci.yml`）および VRT（`vrt.yml`）が PASS すること。
6. **独立 PR レビューとスレッド解決**:
   - [PR reviewer agent](../../.github/agents/pr-reviewer.agent.md) による独立レビューを実施し、Actionable な指摘事項をすべて是正・再レビューを経て解決すること。
7. **人間承認とマージ**:
   - 人間レビュアーの承認およびマージをもってタスク完了（Issue クローズ連動）とする。

### 4.2 工程完了の承認基準

Step 3 C・UT 工程全体の完了承認（#239）基準は以下のとおりです。

1. **全作業 Issue の完了**: #229〜#238 の全個別作業 Issue が PR マージ連動でクローズしていること。
2. **全件テスト・全網羅カバレッジ**: 全単体テストが PASS し、`npm run test:coverage` において全対象ファイルの Statements / Branches / Functions / Lines カバレッジが **すべて 100%** を達成していること。
3. **VRT 整合性**: `npm run test:vrt` がエラー・差分なく全件 PASS すること。
4. **本番ビルド・DCE 検証**: `npm run build`（`output: "standalone"`）および `npm run analyze:bundle` が成功し、初期ロード JS < 100.0 kB およびモック除外 DCE（0 bytes）が確認されていること。
5. **不備記録の集約と設計同期確認**: `docs/c-ut/evidence/ut-bug-record.md` の記録が集約され、原因分類 `D` の全件について設計書同期コミットが記録されていること。
6. **品質分析レポート作成**: `docs/c-ut/quality/step3.md` が作成され、バグ密度（KLoC あたり / テストケースあたり）および後続 IT 工程への重点検証申し送り事項が整理されていること。
7. **工程横断レビュー**: [phase-final-reviewer agent](../../.github/agents/phase-final-reviewer.agent.md) による工程完了横断レビューが実施され、指摘がすべて解決されていること。
8. **人間承認**: 人間レビュアーによる工程承認を受け、対象成果物の状態を一括で `Approved (Step 3)` に昇格すること。

### 4.3 CI / VRT / IT ゲートの工程別運用

- **CI ワークフロー（`ci.yml`）**: Pull Request ごとに単体テスト（`npm run test:unit`）、リポジトリテスト、型検査、Lint、書式検査を必須ゲートとして実行します。
- **VRT ワークフロー（`vrt.yml`）**: UI ストーリーの追加・変更を含む PR において、Playwright による 1280px / 375px のスナップショット検査を必須ゲートとして実行します。
- **IT ワークフロー（`it.yml`）**: C・UT 工程中は手動実行（または保留）とし、IT 工程開始後に PR の必須チェックへ切り替えます。
- **`npm test` コマンド**: 単体テスト・IT・リポジトリテストをまとめて実行するため、全工程の統合確認に使用します。C・UT の個別課題では、IT 失敗を理由に単体テストや静的検査を非実施にしないでください。
