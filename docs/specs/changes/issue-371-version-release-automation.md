---
type: spec-delta
title: "バージョン管理の package.json SSOT 化と Milestone 連動 Git Tag / GitHub Release 自動化ルールの整備"
description: "Issue #371 に対する差分仕様：Milestone（vX.Y）と SemVer（X.Y.Z）の使い分け規律、package.json へのバージョン正本一本化、品質レポート連動テスト、および GitHub Release 自動発行ワークフロー（案A）の設計。"
issue: "#371"
status: "Review (#371)"
updated: "2026-11-15"
tags:
  [
    delta,
    versioning,
    semver,
    release,
    github-actions,
    settings,
    gradle,
    workflow,
    ho-40,
  ]
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/features/settings.md
  - docs/guidelines/workflow.md
  - docs/quality/bug-and-handover-log.md
  - docs/specs/changes/archive/issue-304-v1-release-readiness.md
related_tests:
  - src/shared/constants/app.test.ts
  - scripts/android-build-config.test.ts
  - src/features/settings/components/SettingsPage.test.tsx
  - src/features/settings/components/SettingsContainer.test.tsx
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 差分仕様書：バージョン管理の `package.json` SSOT 化と Milestone 連動 Git Tag / GitHub Release 自動化ルールの整備（Issue #371）

## 1. 変更の背景・目的（Why）

- **背景**:
  - `Milestone v1.0`（[#304](archive/issue-304-v1-release-readiness.md)）にてアプリバージョン表記が `1.0.0` に統一され、設定画面（`SCR-05`）フッターおよび GitHub Release `v1.0.0` の基盤が整備されたが、以降の `Milestone v1.1` / `v1.2` 完了時にバージョン番号を更新する運用規定および Git Tag / GitHub Release 発行手順が `docs/guidelines/workflow.md` に存在せず、アプリバージョンが `"1.0.0"` のまま据え置かれていた。
  - また、`src/shared/constants/app.ts`、`android/app/build.gradle`、各単体テスト、および Playwright IT（`scn01-poc-vertical-reader.spec.ts`）に `"1.0.0"` のハードコードが残存しているため、バージョンを更新するたびに複数箇所の手動修正とテスト変更が必要になり、形骸化や更新漏れを招きやすい構造となっていた。
- **目的**:
  - **2桁の Milestone（`vX.Y`）** と **3桁の SemVer リリースバージョン（`X.Y.Z` / Tag `vX.Y.Z`）** の役割・使い分けを明確化する。
  - バージョン表記の正本（SSOT）を `package.json` の `"version"` 1箇所に集約し、Web 表示・Android ビルド・テストが自動追従する構成にして管理負荷を極小化する（**以降バンプ時は原則 `package.json` 1行のみ変更**）。
  - 「品質レポート連動の単体テスト検証」「`main` マージ連動の Git Tag / GitHub Release 自動発行ワークフロー（案A：リリースノートのみ）」「Milestone Step 3 ワークフロー規律統合」の 3 重ガードレールを導入し、ルールの形骸化・タグ打ち漏れを防止する。

### スコープ境界（In Scope / Out of Scope）

- **対象スコープ（In Scope）**:
  1. **バージョン採番・使い分け規律の正本化**: `docs/guidelines/workflow.md`（§4.1, §5, §5.1）および `docs/specs/architecture.md`（§5.4）に Milestone（`vX.Y`）と SemVer（`X.Y.Z`）の対応規則・`v` プレフィックス有無・適用開始ルールを定義。
  2. **`1.2.0` への基準引き上げ（`v1.1` 非遡及）**: 直近完了済みの `Milestone v1.2` に合わせて `package.json` の `"version"` を `"1.2.0"` に設定し、過去の `Milestone v1.1` については遡及変更・遡及タグ作成を行わない。
  3. **`package.json` への SSOT 一本化**:
     - Web 定数 `src/shared/constants/app.ts` が `package.json` の `version` を直接参照。
     - Android Gradle `android/app/build.gradle` が `groovy.json.JsonSlurper` を用いて `../../package.json` の `version` を既定 `versionName` として動的解決。
     - 単体テスト・Playwright IT・仕様書の `"1.0.0"` ハードコードを排し、SSOT 連動検証へ移行（Storybook VRT は `args` 固定・フッタービューポート外のため再生成不要）。
  4. **バンプ忘れ防止テスト**: `src/shared/constants/app.test.ts` に `docs/quality/reports/` 内の最新完了マイルストーン番号（`vX.Y-*.md`）と `package.json` の `MAJOR.MINOR` 一致検証を追加。
  5. **Git Tag / GitHub Release 自動発行ワークフロー（案A）**: `.github/workflows/release.yml` を新設し、`main` への `package.json` 更新マージ時に未作成タグ `vX.Y.Z` とリリースノートのみの GitHub Release を自動作成する。
- **対象外スコープ（Out of Scope）**:
  - `Milestone v1.1` への遡及バージョン更新および `v1.1.0` タグ・Release の遡及作成。
  - GitHub Release アセットへの Android APK 自動ビルドおよびバイナリ添付（案B は個人利用・仕組みの簡略化を優先し本 Issue では採用しない）。

---

## 2. 仕様・設計・ガバナンスの差分（What Changes）

### 2.1 変更対象ファイル一覧

| 区分                | ファイルパス                                                                                                          | 変更概要                                                                                                                                  |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| **正本仕様**        | `docs/specs/architecture.md`                                                                                          | §5.2 動的 `versionName` 解決を `package.json` 参照へ更新、§5.4 バージョン採番＆Release自動化新設、§6.3 `AC-APK-02` 更新・`AC-APK-04` 新設 |
| **正本仕様**        | `docs/specs/requirements.md`                                                                                          | §3.5 `SYS-REQ-16` の `AC-APK-01〜04` 更新および `AC-APK-02` / `AC-APK-04` の 1対1 同期                                                    |
| **正本仕様**        | `docs/specs/features/settings.md`                                                                                     | §3.2 `appVersion` 説明・§5 `AC-ST-20`・§6 `SCN-01` の `"1.0.0"` 固定記述を `package.json` 連動表記へ更新                                  |
| **目次・品質台帳**  | `docs/index.md` / `docs/quality/bug-and-handover-log.md`                                                              | 進行中差分仕様の登録および実機スモーク検証申し送り事項 `HO-40` の登録                                                                     |
| **ガイドライン**    | `docs/guidelines/workflow.md`                                                                                         | §4.1 `package.json` version 変更の人間マージ義務化、§5 Step 3 へのバージョン更新組み込み、§5.1 バージョン＆Release 規律新設               |
| **AI 構成・スキル** | `.github/skills/iterative-github-task-management/SKILL.md`, `.github/skills/phase-final-review/SKILL.md`, `AGENTS.md` | Milestone Step 3 実施項目へ `package.json` バージョン更新を同期追記（詳細規律は `workflow.md` §5.1 を参照）                               |
| **実装（次PR）**    | `package.json`, `src/shared/constants/app.ts`, `android/app/build.gradle`, `.github/workflows/release.yml`, 各テスト  | Step 2 設計 PR 承認後、統合実装 PR にて適用（Step 2 時点では未変更）                                                                      |

---

### 2.2 Milestone（`vX.Y`）とリリースバージョン（`X.Y.Z`）の使い分け規律

2 桁の Milestone 呼称と 3 桁の SemVer（セマンティックバージョニング）の役割を明確に分離し、1 対 1 の同期規則を定めます。

| 区分                 | 表記形式              | 役割・更新タイミング                                                                                                                 | 具体例                                                         |
| :------------------- | :-------------------- | :----------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| **Milestone**        | `vMAJOR.MINOR`（2桁） | 要望 Issue 3〜5 件を束ねる**開発・品質監査の計画単位**（GitHub Milestone / ロードマップ / 品質レポート `vX.Y-*.md`）。パッチ桁なし。 | `Milestone v1.2` / `Milestone v1.3`                            |
| **`MAJOR`（第1桁）** | `X.0.0`               | 大規模アーキテクチャ刷新や破壊的データ変更など、プロダクトの大きな節目のみ更新。通常の Milestone では変更しない。                    | `1.0.0`（正式版到達）                                          |
| **`MINOR`（第2桁）** | `1.Y.0`               | **Milestone（`v1.Y`）完了と 1対1 で連動**。途中の個別機能 PR では上げず、**Milestone Step 3（最終承認 PR）で `1.Y.0` に更新**。      | `Milestone v1.2` → `1.2.0`<br>`Milestone v1.3` → `1.3.0`       |
| **`PATCH`（第3桁）** | `1.Y.Z`               | **Milestone 間の緊急修正（Hotfix）専用**。次期 Milestone 完了を待たずに単発修正を配布する場合のみ `+1`。通常サイクルは `.0`。        | `1.2.0` 後の緊急修正 → `1.2.1`<br>その後 `v1.3` 完了 → `1.3.0` |

- **`v` プレフィックスの使い分け**:
  - メタデータ値（`package.json` の `version`、`APP_VERSION`、Android `versionName`）: **`v` なし**（例: `"1.2.0"`）
  - 画面表示（`Yommy v1.2.0`）、Git Tag、GitHub Release 名: **`v` あり**（例: `v1.2.0`）
- **適用開始と非遡及原則**:
  - 本ルールは **`1.2.0`（Tag: `v1.2.0`）から適用** し、完了済みの `Milestone v1.1` については遡及バージョン変更およびタグ発行を行わない。

---

### 2.3 `package.json` へのバージョン SSOT 一本化設計

1. **`package.json`（唯一の正本）**:
   - `"version"` を唯一の編集点とし、本実装適用時に `"1.2.0"` へ引き上げる。
2. **フロントエンド定数（`src/shared/constants/app.ts`）**:
   - `"1.0.0"` の文字列リテラル直書きを廃止し、Vite / TypeScript の名前付き JSON インポートを用いて `package.json` から `version` のみを取得する（本番バンドルへ `dependencies` 等の余分なメタデータを含めない設計）：
     ```ts
     import { version as PACKAGE_VERSION } from "../../../package.json";

     export const APP_NAME = "Yommy";
     export const APP_VERSION: string = PACKAGE_VERSION;
     ```
3. **Android ネイティブビルド設定（`android/app/build.gradle`）**:
   - Groovy 標準ライブラリ `groovy.json.JsonSlurper` をインポートし、リポジトリルートの `package.json`（`file("../../package.json")`）から `version` を読み出す。
   - `defaultConfig` 内の `appVersionName` 解決フォールバック値を固定文字列 `"1.0.0"` から `packageJson.version` に置き換える（`BUILD_NAME` 環境変数および `-PversionName` Gradle プロパティによる明示上書き優先順位は維持）：
     ```groovy
     import groovy.json.JsonSlurper
     // android { ... } 冒頭:
     def packageJson = new JsonSlurper().parse(file('../../package.json'))
     def appVersionCode = Integer.parseInt(System.getenv("BUILD_NUMBER") ?: (project.findProperty("versionCode") ?: "1"))
     def appVersionName = System.getenv("BUILD_NAME") ?: (project.findProperty("versionName") ?: packageJson.version)
     ```
   - `android/app/build.gradle` は `android/` サブプロジェクト直下の `app/` ディレクトリに配置されているため、`file('../../package.json')` が常にリポジトリルートの `package.json` を指す（`scripts/android-build-config.test.ts` でも実パス解決と整合性を検証する）。

---

### 2.4 形骸化を防ぐ 3 重ガードレール設計

#### ガードレール①：品質レポート連動の単体テスト検証（`src/shared/constants/app.test.ts`）

- 従来の固定値アサーション `expect(APP_VERSION).toBe("1.0.0")` を撤廃し、以下を機械検証する：
  1. `APP_NAME === "Yommy"` かつ `APP_VERSION === packageJson.version`。
  2. `APP_VERSION` が `MAJOR.MINOR.PATCH`（`/^\d+\.\d+\.\d+$/`）の 3 桁形式であること。
  3. **Milestone 完了連動検証**: `node:fs` / `node:path` を用いて `docs/quality/reports/` 配下のファイルのうち `^v(\d+)\.(\d+)-.*\.md$` に一致する全レポートを抽出し、1 件以上存在すること（0 件空振り防止）を確認した上で、数値比較 `(a.major - b.major) || (a.minor - b.minor)` により最新完了マイルストーン番号 `${maxMajor}.${maxMinor}` を特定する。この値と `packageJson.version` の先頭 2 セグメント（`${pkgMajor}.${pkgMinor}`）が完全一致することを検証する。
     - **効果**: Milestone Step 3 PR で `docs/quality/reports/v1.3-*.md` を追加した際に `package.json` の `"version"` を `"1.3.0"` へ上げ忘れると、`npm run test:unit` / `test:coverage` および CI が即座に FAIL する。一方、次期 Milestone 途中の Hotfix で `"1.2.1"` に上げた場合でも `MAJOR.MINOR` は `"1.2"` のままであるため PASS を維持する。

#### ガードレール②：Git Tag / GitHub Release 自動発行ワークフロー（`.github/workflows/release.yml`）

- **採用方式**: **案A（リリースノートのみ、APK ビルド・アセット添付なし）**
- **トリガー**:
  - `push`: `branches: [main]`、`paths: ['package.json']`（`main` へマージされた PR に `package.json` の変更が含まれる場合のみ発火し、通常の開発 PR マージの CI コスト・通知ノイズを増やさない）
  - `workflow_dispatch`: 障害発生時の手動再実行・復旧用
- **権限**: `permissions: contents: write`
- **処理ステップ**:
  1. `actions/checkout@v4`（最新 `main` コミットを取得）
  2. Node.js 24 で `package.json` から `version` を読み取り、`/^\d+\.\d+\.\d+$/` を検証して `tag=v${version}`, `major_minor=${major}.${minor}`, `patch=${patch}` を出力。
  3. 既存タグ／リリース重複ガード: `git ls-remote --tags origin "refs/tags/${tag}"`（および `gh release view "${tag}"`）を確認し、既にタグまたは Release が存在する場合は「依存パッケージ変更のみの `package.json` 更新」等とみなして正常終了（スキップ）する。
  4. 未存在時のみ `docs/quality/reports/v${major_minor}-*.md` の有無を確認し、以下を実行する：
     - `patch === "0"` かつ該当品質レポートファイルが存在する場合: `--notes` に「Milestone `v${major_minor}` 完了リリースおよび品質分析レポートへのリンク」を記述し、`--generate-notes` と併用してリリースノート先頭へ自動結合する。
     - それ以外（Hotfix パッチリリース `patch !== "0"` 等）: `--notes` に Hotfix リリースの見出しを付与し、`--generate-notes` を併用する。
     - いずれも `gh release create "${tag}" --target "${{ github.sha }}" --title "${tag}" --notes ... --generate-notes` により、**マージコミット SHA を指す Git Tag `vX.Y.Z` の作成と GitHub Release の公開を 1 ステップで自動完結** させる（アセット添付は行わない）。

#### ガードレール③：開発プロセス・スキルガバナンスへの統合

- **`docs/guidelines/workflow.md`**:
  - `§4.1`（AI 自律マージ停止・人間エスカレーション条件）に「`package.json` の `version` フィールド変更（`main` マージに伴い Git Tag / GitHub Release が自動発行されるリリース変更）」を追加し、AI が単独でバージョン更新や Hotfix リリースを発行しないよう保護する。
  - `§5 Step 3` の一括実施項目に `package.json` の `version` を `X.Y.0` へ更新する項目を追加する。
  - `§5.1 バージョン採番（SemVer）と Git Tag / GitHub Release 自動化ルール` を新設し、上記使い分け・SSOT・案A 自動化を正本規定として明文化する。
- **スキル・AI 憲法（`.github/skills/iterative-github-task-management/SKILL.md`, `.github/skills/phase-final-review/SKILL.md`, `AGENTS.md`）**:
  - SSOT 原則（`.github/skills/repo-config-management/SKILL.md`）に従い、詳細仕様は `docs/guidelines/workflow.md §5 / §5.1` を参照しつつ、Milestone Step 3 の手順に `package.json` バージョン更新を明記する。

### 2.5 受入条件の変更・追加

- **`AC-APK-02`（更新）**: `package.json` の `version`（SemVer 3 桁、`X.Y.0` は最新完了 Milestone レポート `vX.Y-*.md` と `MAJOR.MINOR` 一致）を唯一の正本（SSOT）として `APP_VERSION` および `android/app/build.gradle` の既定 `versionName`（`JsonSlurper` による `../../package.json` 動的読込）が解決され、GitHub Actions ビルド時に `github.run_number`（または `BUILD_NUMBER`）により `versionCode` が単調増加すること。
- **`AC-APK-04`（新設）**: `.github/workflows/release.yml` が構成され、`main` ブランチで `package.json` の `version` が未作成タグのバージョンに更新された際に `vX.Y.Z` Git Tag およびリリースノートのみの GitHub Release（案A：APK 添付なし）が自動発行され、既存タグと同一バージョンの場合は安全にスキップされること。
- **`AC-ST-20`（更新）**: 設定画面（`SCR-05: /settings`）の最下部フッター（`data-testid="settings-version-footer"`）に、`package.json` の `version`（`APP_VERSION`）と同期したアプリ名・バージョン表記（`Yommy v{APP_VERSION}`、例: `Yommy v1.2.0`）が表示されること。

---

## 3. テスト計画（UT / VRT / IT の検証観点）

1. **単体テスト（Vitest TDD）**:
   - `src/shared/constants/app.test.ts`:
     - `APP_NAME === "Yommy"`、`APP_VERSION === packageJson.version`、`/^\d+\.\d+\.\d+$/` 形式検証。
     - `docs/quality/reports/` 内の `^v(\d+)\.(\d+)-.*\.md$` 最新 `MAJOR.MINOR` と `packageJson.version` の `MAJOR.MINOR` が一致することの検証（数値ソート＋1件以上存在ガード）。
   - `scripts/android-build-config.test.ts`:
     - `android/app/build.gradle` が `JsonSlurper` で `../../package.json` を読み込み、`BUILD_NAME` / Gradle `versionName` プロパティ優先＋フォールバック `packageJson.version` で解決していることの検証（`AC-APK-02`）。
     - `.github/workflows/release.yml` が `push`（`branches: [main]`, `paths: package.json`）および `workflow_dispatch` トリガー、`contents: write` 権限、既存タグチェックによる重複スキップガード、`gh release create --target` / `--generate-notes` を備え、かつ APK ビルドやアセットアップロード処理を含まない（案A）ことの構造検証（`AC-APK-04`）。
   - `src/features/settings/components/SettingsPage.test.tsx`:
     - デフォルト表示テストをハードコード `"Yommy v1.0.0"` から `APP_VERSION` 連動（`${APP_NAME} v${APP_VERSION}` かつ `/^Yommy v\d+\.\d+\.\d+$/`）の検証へ変更する（Storybook `Default` ストーリーの固定 `args: { appVersion: "1.0.0" }` 描画テスト、および `appName="CustomReader"`, `appVersion="2.5.0"` の任意 Props テストはそのまま維持）。
   - `src/features/settings/components/SettingsContainer.test.tsx`:
     - `SettingsPage` スパイへ渡される `appVersion` の期待値を `"1.0.0"` 固定から `APP_VERSION` 参照へ変更する。
2. **Storybook ＆ VRT（1280px / 375px）**:
   - `SettingsPage.stories.tsx` は `meta.args` で `appVersion: "1.0.0"` を明示指定しており、`SettingsPage.tsx` 自体のマークアップ・スタイル変更は行わない。また `SettingsContainer.stories.tsx` については `1280x800` / `375x667` ビューポートにおいてフッターがスクロール外の領域に位置するため描画ピクセルに影響しない。よって **VRT スナップショットの再生成は不要（既存の `test/vrt/snapshots/` と差分ゼロで `npm run test:vrt` が 100% PASS することを確認）**。
3. **システム結合テスト（Playwright IT）**:
   - `test/it/scenarios/scn01-poc-vertical-reader.spec.ts`:
     - ハードコードされていた `"Yommy v1.0.0"` の期待値を撤廃し、Node の `fs.readFileSync("package.json")` で取得した `version` を用いて `await expect(versionFooter).toHaveText(\`Yommy v${packageVersion}\`)` かつ SemVer 形式一致をアサートする構成へ更新する。
     - `npm run test:it`（全シナリオ `SCN-01`〜`SCN-07`）が 100% PASS することを確認する。

---

## 4. 実装 Sub-issue 分割計画

本要望はバージョン定数連動・Gradle 読込変更・テスト非ハードコード化・`.github/workflows/release.yml` 追加からなる小規模かつ密接に関連した変更であり、かつ `docs/guidelines/workflow.md §4.1` の人間エスカレーション条件（`CI 定義の変更` および `package.json version 変更`）と親 Issue 出口ゲートに該当するため、**Step 2 設計更新 PR 承認後に 1 本の統合 Sub-issue PR（`Closes #<Sub-issue>, Closes #371`）** として TDD 実装・VRT 確認・Playwright IT・差分仕様アーカイブを実施します。

- **Sub-issue（MK / IT 統合）**: `[v1.3][#371-MK/IT] package.json 1.2.0 SSOT 化・整合性 UT/E2E・GitHub Release 自動発行ワークフロー実装`
  - 作業内容:
    1. `package.json` を `"1.2.0"` へ更新。
    2. `src/shared/constants/app.ts`, `android/app/build.gradle`, `.github/workflows/release.yml` の実装。
    3. `app.test.ts`, `scripts/android-build-config.test.ts`, `SettingsPage.test.tsx`, `SettingsContainer.test.tsx`, `scn01-poc-vertical-reader.spec.ts` の TDD 更新と C0/C1/Functions 100% カバレッジ確認。
    4. `npm run test:vrt` / `npm run test:it` 全件 PASS 確認、および `./gradlew compileDebugJavaWithJavac` / Gradle 設定パース検証（CI `android-compile` 含む）確認。
    5. 本差分仕様書を `status: "Completed (Archived)"` として `docs/specs/changes/archive/issue-371-version-release-automation.md` へ移動（`git mv`）し、あわせて `docs/index.md` の参照パス更新および正本仕様書 3 冊（`docs/specs/architecture.md`・`docs/specs/requirements.md`・`docs/specs/features/settings.md`）の `related_specs`（`changes/` → `changes/archive/`）と `status: "Approved"` 復帰を同期実施する（`npm run lint:okf` PASS 確認）。人間レビュー・マージ（`Closes #372, Closes #371`）後に `release.yml` によって `v1.2.0` Git Tag / GitHub Release が自動発行されることを確認する。

---

## 5. 申し送り事項（Handover Items: `HO-xx`）・実機検証計画

### Android 実機検証の実施タイミング判断

- **判定**: **`B. Milestone 最終レビュー後に一括で実機検証を実施（完了ゲート: Milestone v1.3 完了前）`**
- **理由**:
  1. Android ネイティブ Java コード（Plugin / Activity）の新設・変更およびタッチ操作・ハードウェア操作の変更を伴わず、設定画面フッター UI 変更もないため、Unit テスト・`android-compile` / Gradle 構成検証・VRT・Playwright IT により決定論的に品質を担保できる。
  2. 実機でインストール済み APK の `versionName`（`1.2.0` 等）および設定画面フッター（`Yommy v1.2.0`）の表示が同期している最終スモーク確認は、`Milestone v1.3` 完了時の Android 実機一括検証に統合して実施する方が効率的である。

### 申し送り一覧

|     ID      | 起票元 Issue | 申し送り事項の内容                                                                                                                     | 解決先（対象 Issue / 成果物） |       完了ゲート        |  状態  |
| :---------: | :----------: | :------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------- | :---------------------: | :----: |
| **`HO-40`** |  Issue #371  | Android 実機ビルド APK における `package.json` 連動 `versionName`（`v1.2.0` 以降）および設定画面（`SCR-05`）フッター表示のスモーク確認 | Milestone `v1.3` 実機一括検証 | Milestone `v1.3` 完了前 | `Open` |
