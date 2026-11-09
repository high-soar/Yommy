<div align="center">

<img src="assets/icon.png" width="96" alt="Yommy Icon" />

# Yommy

**Web小説を、本物の読書体験へ。**  
日本語縦書き・ルビ組版に特化した、Web小説（カクヨム・小説家になろう）対応のオープンソース Android リーダーアプリ

[![CI](https://github.com/high-soar/Yommy/actions/workflows/ci.yml/badge.svg)](https://github.com/high-soar/Yommy/actions)
![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## 概要（About Yommy）

**Yommy** は、Web小説（「カクヨム」「小説家になろう」）をスマートフォン上で快適に閲覧するために開発された、オープンソースの Android Web 小説リーダーです。

ブラウザでの縦スクロール読書とは一線を画し、**美しい日本語縦書き組版（`vertical-rl`）**、**ルビ（振り仮名）や傍点（圏点）の完全描画**、**Kindle 様式の滑らかな水平スライドページめくり**、および **オフライン一括保存** を実現。ネットワーク環境に左右されず、本物の電子書籍のような没入感のある読書体験を提供します。

---

## 主要機能一覧（Key Features）

### 1. 全 7 画面の包括的ナビゲーション

- **本棚（Bookshelf / `SCR-01`）**: 保存済み作品の一覧表示、お気に入り（★）絞り込み、最終閲覧順／更新日時順の並び替え、更新チェック機能。
- **作品詳細・目次（Novel Detail / `SCR-02`）**: 作品あらすじ・タグ情報、章・話別目次一覧、複数ページ目次のシームレス取得、一括キャッシュ保存および失敗話の再試行。
- **小説リーダー（Reader / `SCR-03`）**: 縦書き／横書き切り替え、ページめくり／連続スクロール、テーマ（白・セピア・ダーク・純黒）、双方向シークバー、しおり位置の自動記録・復元。
- **内蔵ブラウザ・DOMインポート（WebView Import / `SCR-04`）**: Bot 対策や HTML 構造変更時にも、内蔵 WebView で作品を直接開き、表示中 DOM からワンタップで安全に取り込む手動フォールバック。
- **設定（Settings / `SCR-05`）**: フォント選択（BIZ UD明朝／ゴシック、Noto CJK、Klee 等）、文字サイズ、画面余白、ハードウェア音量キー操作、ストレージ容量可視化・キャッシュ削除、アプリバージョン表示。
- **検索（Search / `SCR-06`）**: カクヨム・なろう横断検索、作品種別（すべて／短編／連載中／完結済）フィルタ、除外キーワード・複数ジャンルピルによる高度検索。
- **ランキング（Ranking / `SCR-07`）**: 各サイトの期間別（日間・週間・月間・累計）人気ランキング閲覧およびジャンル・作品種別絞り込み。

### 2. マルチサイト対応（カクヨム ＆ 小説家になろう）

- カクヨム（`kakuyomu.jp`）および小説家になろう（`ncode.syosetu.com`）の作品探索・詳細・エピソード本文に対応。
- 短編作品の直接リーダー閲覧、複数ページにまたがる長編目次の全件自動収集、ルビ・傍点表記の統一正規化。

### 3. 日本語縦書き組版 ＆ 快適な読書 UX

- CSS `writing-mode: vertical-rl` による本格的な縦書き組版。
- HTML `<ruby>` / `<rb>` / `<rt>` および傍点（圏点）の忠実なレイアウト再現。
- 読書中のタップ操作（左右 20% タップ送り、中央 60% メニュー展開）およびハードウェア音量キーによる片手ページめくり。

### 4. オフライン読書 ＆ 永続ダウンロードキュー

- SQLite（`@capacitor-community/sqlite`）によるローカル永続化。ネットワーク切断時でも快適な読書を継続可能。
- 読書中エピソードのバックグラウンド自動先読み（Prefetch）。
- 永続ダウンロードキュー（`download_queue`）による一括保存の中断再開、失敗話のスキップ継続、およびワンタップ再試行。

### 5. Google Drive クラウド同期

- Google Drive の専用領域（`appDataFolder`）を利用したプライベートバックアップ ＆ 双方向同期。
- Last-Write-Wins（LWW）調停と論理削除（Tombstone）伝播により、複数端末間で本棚、しおり進捗、お気に入り状態を安全に統合。

### 6. 内蔵 WebView 手動 DOM インポート（フォールバック）

- 外部サイトのアクセス制限や仕様変更によって通常取得が阻害された場合でも、内蔵 WebView で直接アクセスして DOM を抽出・インポート可能。

---

## 技術スタック（Tech Stack）

| レイヤー / 領域            | 採用技術                                                                             |
| :------------------------- | :----------------------------------------------------------------------------------- |
| **フロントエンド / UI**    | React 19, TypeScript 5, Tailwind CSS, Lucide Icons                                   |
| **ネイティブブリッジ**     | Capacitor 8 (`@capacitor/core`, `@capacitor/android`), `@capacitor-community/sqlite` |
| **ビルド / 開発環境**      | Vite, Node.js 24, VS Code DevContainer (Ubuntu-based)                                |
| **単体テスト**             | Vitest（3層責務境界, C0/C1/Functions 100% 網羅）                                     |
| **コンポーネントカタログ** | Storybook 8, Portable Stories (`composeStories`)                                     |
| **視覚的回帰テスト (VRT)** | Playwright（Storybook 1280px / 375px スナップショット検証）                          |
| **E2E 結合テスト (IT)**    | Playwright Test（Chromium 実ブラウザによるシナリオ検証 `SCN-01`〜`SCN-07`）          |

---

## 開発環境・クイックスタート（Getting Started）

### 前提条件

- **VS Code Dev Containers** または **Docker**: リポジトリに含まれる `.devcontainer` により、Node.js 24、日本語フォント（BIZ UD明朝, Noto CJK, IPAex 等）、各種ツールチェーンが完全に整備された環境で開発を開始できます。

### 1. セットアップ

```bash
# 依存パッケージのインストール
npm install

# 開発サーバーの起動（ローカルブラウザ確認）
npm run dev
```

### 2. 静的検査 ＆ コードスタイル

```bash
# TypeScript 型検査
npm run typecheck

# ESLint 静的解析
npm run lint

# Prettier フォーマット検証
npm run format:check

# OKF ドキュメント構文検証
npm run lint:okf
```

### 3. テストの実行

```bash
# 単体テスト実行（Vitest）
npm run test:unit

# カバレッジ測定（C0/C1/Functions 100% 必須）
npm run test:coverage

# 視覚的回帰テスト（VRT: 1280px / 375px）
npm run test:vrt

# 結合テスト実行（Playwright E2E: SCN-01〜07）
npm run test:it
```

### 4. Android アプリビルド手順

```bash
# Web アセットのビルド ＆ Capacitor 同期
npm run build
npx cap sync android

# Android Studio を起動（Host OS 側）
npx cap open android
```

> [!NOTE]
> Android APK のコンパイルおよび実機・エミュレータ実行は Host OS 側の Android Studio または `./gradlew assembleDebug` で行います。

---

## ドキュメント体系（Documentation / OKF）

Yommy は **OKF（Open Knowledge Format）** に準拠した 2-Layer Living Documentation を採用し、人間と AI エージェントの双方が共通して参照できるドキュメント体系を維持しています。

すべての仕様・規約・品質ログの目次は [`docs/index.md`](docs/index.md) を参照してください。

- **開発規律・ガイドライン（SSOT）**:
  - [開発プロセス標準（`workflow.md`）](docs/guidelines/workflow.md): マイクロウォーターフォール、Task Completion Gate 7条件、Milestone 運用
  - [テスト・実装規律（`testing.md`）](docs/guidelines/testing.md): 3層責務境界、TDD、1対1 Story/UT、縦書き VRT、C0/C1 100%
  - [レビュー記述規約（`review-comment-format.md`）](docs/guidelines/review-comment-format.md): [P0]〜[P3] 分類と横断レビューフォーマット
- **製品正本仕様書**:
  - [全体要件定義・機能一覧（`requirements.md`）](docs/specs/requirements.md)
  - [システムアーキテクチャ（`architecture.md`）](docs/specs/architecture.md)
  - [データベーススキーマ（`db-schema.md`）](docs/specs/db-schema.md)
  - [画面一覧・画面遷移（`screen-transitions.md`）](docs/specs/screen-transitions.md)
  - [機能別詳細仕様（`features/`）](docs/specs/features/)（本棚, 作品詳細, リーダー, 内蔵ブラウザ, 設定, 検索, ランキング）
  - [パーサー仕様（`parsers/`）](docs/specs/parsers/)（カクヨム, 小説家になろう）
- **品質管理・申し送りログ**:
  - [不備・申し送り管理簿（`bug-and-handover-log.md`）](docs/quality/bug-and-handover-log.md)
  - [Milestone 品質分析レポート（`reports/`）](docs/quality/reports/)

---

## ライセンス（License）

本プロジェクトは [MIT License](LICENSE) のもとで公開されています。
