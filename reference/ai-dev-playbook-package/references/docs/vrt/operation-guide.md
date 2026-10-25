# VRT（視覚的回帰テスト）運用手順書

| 項目                | 内容                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 状態                | `Approved (Step 2)`                                                                                                                               |
| 更新日              | `2026-10-10`                                                                                                                                      |
| 関連する ED/ID 項目 | `docs/vrt/tech-verification.md#1-検証の背景と目的`<br>`.github/skills/c-ut-workflow/SKILL.md#6-storybook-と-portable-stories`<br>`docs/README.md` |

このドキュメントは、Playwright と Storybook を用いた VRT（Visual Regression Testing: 視覚的回帰テスト）の日常的な実行方法、意図したデザイン変更時のスナップショット更新手順、PR レビューでの承認運用フロー、およびトラブルシューティングを定めます。

---

## 1. 概要と構成

本プロジェクトの VRT は、Storybook の静的ビルド（`storybook-static/`）に含まれる各 Story を Playwright（Chromium ヘッドレス）で走査し、基準画像（スナップショット）とのピクセル差分を自動比較します。

```text
Storybook ビルド (npm run build-storybook)
  │
  ├── storybook-static/index.json (全 Story を自動抽出)
  └── storybook-static/iframe.html (各 Story の単体表示)
        │
        ▼
Playwright テストランナー (npm run test:vrt)
  │
  ├── test/vrt/vrt.spec.ts (フォント待機・アニメーション停止を適用)
  └── test/vrt/snapshots/*.png (基準画像と比較)
        │
        ├── 差分なし: PASS
        └── 差分あり: FAIL ──> test-results/ (Diff 画像) & playwright-report/ (HTML レポート)
```

---

## 2. 実行環境とコマンド

### 2.1 実行環境の前提（重要）

1. **Linux (Ubuntu) 環境での実行およびフォント構成**:
   フォントのアンチエイリアスやラスタライズ処理は OS によって微妙に異なります。
   基準スナップショット画像は **GitHub Actions CI ランナー（Ubuntu `ubuntu-latest`）環境の Chromium** で作成されています。
   CI ランナーでは標準で `DejaVu Sans`（`fonts-dejavu-core`）が `sans-serif` のフォールバックとして解決されるため、DevContainer 側でも同一の描画結果を得る前提として `.devcontainer/Dockerfile` に `fonts-dejavu-core` が導入されています（`fc-match sans-serif` が `DejaVu Sans` を返す構成）。
   そのため、VRT の実行およびスナップショット更新は、ホスト OS 直接ではなく **VS Code DevContainer 内** で行うことを必須とします。

2. **サーバーポートの分離（6006 / 6007）と動的変更（`VRT_PORT`）**:
   開発用 Storybook サーバー（`npm run storybook`）はポート **6006** を使用します。
   一方、VRT のテストランナー（Playwright）は静的ビルド成果物（`storybook-static/`）を専用プレビューサーバーとして既定でポート **6007** で配信します。
   ポートが分離されているため、ローカルで Storybook 開発サーバーを起動したままでも、誤って開発中の一時的なコードがテストに混入することなく安全に VRT を実行できます。
   また、複数 worktree や並行作業環境でのポート競合を回避するために、環境変数 `VRT_PORT` でプレビューサーバーのポート番号を動的に変更できます（例: `VRT_PORT=6008 npm run test:vrt`）。

3. **Playwright Chromium ブラウザバイナリの事前導入**:
   Playwright は npm パッケージインストール時にブラウザバイナリを自動ダウンロードしません。
   そのため、初回実行前に Chromium バイナリおよび Linux OS 依存パッケージの導入が必要です。
   DevContainer の新規作成時には `postCreateCommand` によって自動セットアップされますが、手動でセットアップする場合は `npm run test:vrt:setup`（または `npx playwright install --with-deps chromium`）を実行してください。

### 2.2 初回セットアップ（Chromium の導入）

DevContainer の初回起動後、または手動で環境を再構築した場合は、以下のコマンドで Playwright Chromium および OS 依存パッケージを導入します。

```bash
npm run test:vrt:setup
# または
npx playwright install --with-deps chromium
```

### 2.3 日常コマンド一覧

| コマンド                     | 説明                                                      | 主な用途                                     |
| :--------------------------- | :-------------------------------------------------------- | :------------------------------------------- |
| `npm run test:vrt:setup`     | Playwright Chromium および OS 依存関係のインストール      | 初回環境構築時、ブラウザバイナリ未導入時     |
| `npm run test:vrt`           | Storybook をビルドし、全 Story の VRT を実行              | ローカルでのデグレ確認、コミット前確認       |
| `npm run test:vrt:update`    | 全 Story のスナップショット画像を最新状態で再生成・上書き | 意図したデザイン変更・新コンポーネント追加時 |
| `npx playwright show-report` | 直近のテスト実行結果（HTML レポート）をブラウザで開く     | 差分箇所の確認、デバッグ                     |

---

## 3. 意図したデザイン変更時のスナップショット更新・承認運用フロー

UI コンポーネントのデザイン変更や新規コンポーネント・Story を追加した場合は、以下の手順でスナップショットを更新して PR を作成します。

### ステップ 1: コード修正とローカル確認

1. コンポーネントや CSS、Story を修正・追加します。
2. まず単体テストを実行して機能・ロジックに問題がないことを確認します。
   ```bash
   npm run test:unit
   ```

### ステップ 2: VRT スナップショットの更新

1. DevContainer のターミナルで更新コマンドを実行します。
   ```bash
   npm run test:vrt:update
   ```
2. `test/vrt/snapshots/` 配下の PNG ファイルが新規作成または更新されます。

### ステップ 3: 変更内容の視覚的セルフレビュー

1. `git status` および `git diff` で意図した Story の画像のみが更新されていることを確認します。
2. VS Code の画像ビューアや Git 差分ビューで、変更前後の画像を比較し、意図した通りの見た目の変化であることを確認します。
3. 意図しないコンポーネントの画像が変更されている場合は、CSS の影響範囲（セレクタのスコープ漏れ等）を見直します。

### ステップ 4: コミットと PR 作成

1. 更新されたコードおよびスナップショット画像を Git にステージングします。
2. Conventional Commits 形式で、変更理由を明記してコミットします。
   ```bash
   git add src/ test/vrt/snapshots/
   git commit -m "feat(ui): ボタンのホバー配色を改善

   ボタンのアクセシビリティ向上に伴い、ホバー時の背景色コントラスト比を高めました。
   関連する VRT スナップショットを更新。"
   ```
3. ブランチを push し、GitHub 上で Pull Request を作成します。

### ステップ 5: CI での検証と PR レビュー承認

1. GitHub Actions の `Visual Regression Testing` ワークフローが自動実行され、`Storybook VRT` が PASS することを確認します。
2. レビュアーは GitHub PR の「Files changed」タブで、PNG 画像のリッチ Diff 機能（Swipe / Onion Skin 等）を用いてデザイン変更を確認・承認します。

---

## 4. CI で VRT が失敗した場合の対処手順

PR 作成時や更新時に GitHub Actions の `Storybook VRT` ジョブが失敗（FAIL）した場合は、以下の手順で原因を調査します。

1. **GitHub Actions の実行ログを確認**:
   - どの Story（コンポーネント）で差分が発生したかログ（`Error: expect(locator).toHaveScreenshot failed`）を確認します。
2. **Playwright レポート（Artifact）のダウンロード**:
   - ワークフロー実行詳細画面の下部「Artifacts」から `playwright-vrt-report` をダウンロード・解凍します。
   - 解凍したフォルダ内の `index.html` をブラウザで開きます。
3. **差分画像の確認**:
   - レポート上で、**Expected（期待値）**、**Actual（実際値）**、**Diff（差分ピクセルが赤くハイライトされた画像）** を並列で視覚的に比較できます。
4. **意図しない変更（デグレ）の場合**:
   - CSS や HTML 構造の不要な変更を修正し、`npm run test:vrt` が PASS するまでローカルで再検証して push します。
5. **意図した変更の場合**:
   - 上記「第 3 章」のフローに従い、ローカルで `npm run test:vrt:update` を実行してスナップショットをコミットし、PR を更新します。

---

## 5. フレイキー（Flaky）テスト防止のための開発ガイドライン

新しい UI コンポーネントや Story を作成する際は、VRT の安定性を保つために以下のルールを遵守してください。

1. **動的な日付・時刻やランダム値の排除**:
   - Story 内で `new Date()` や `Math.random()` などの動的値を直接表示させず、固定値（モックデータ）を渡してください。
2. **ローディング・アニメーションコンポーネントの扱い**:
   - アニメーションは VRT テスト実行時に CSS レベルで自動停止されますが、無限ループ処理や `setInterval` 等のタイマー駆動による DOM 更新は避けてください。
3. **適切な Story 命名と ID の安定性**:
   - Story のファイル名や Export 名を変更すると Story ID が変わり、新しいスナップショットが生成されると同時に古いスナップショットが不要になります。リネーム時は古い PNG 画像を削除してください。
4. **VRT 除外（オプトアウト）タグ**:
   - 将来的にアニメーション専用や動的タイマー駆動などで静止画 VRT に適さない Story を作成する場合は、Story の `tags` 配列に `"skip-vrt"` を指定することで VRT 走査対象から除外できます（例: `tags: ["skip-vrt"]`）。

---

## 6. トラブルシューティング

### Q1. `Executable doesn't exist at ...` というエラーでテストが失敗する

- **原因**: Playwright の Chromium ブラウザバイナリがローカル環境にインストールされていません。
- **対処法**: 以下のセットアップコマンドを実行してブラウザバイナリを導入してください。
  ```bash
  npm run test:vrt:setup
  ```

### Q2. ローカルでは PASS するが、スナップショット更新時に差分が大きすぎる / 微妙なフォントブレが発生する

- **原因**: ホスト OS（macOS / Windows）上で直接テストを実行した場合、フォントレンダリングやアンチエイリアス処理が Linux（CI 環境）と異なり、意図しないピクセル差分が発生します。また、DevContainer 内であっても `fonts-dejavu-core` が未導入の場合、英数フォントのメトリクス差（DejaVu Sans と WenQuanYi Zen Hei の字幅差）によりテーブル等の列幅ズレが生じます。
- **対処法**: VRT の実行およびスナップショットの更新は、必ず `fonts-dejavu-core` が導入された **VS Code DevContainer（Ubuntu Linux 環境）内** のターミナルで実行してください（`.devcontainer/Dockerfile` に定義済み）。もしコンテナ再構築前で未導入の場合は、`sudo apt-get update && sudo apt-get install -y fonts-dejavu-core` を実行してください。
