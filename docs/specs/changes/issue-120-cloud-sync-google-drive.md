---
type: spec-delta
title: "Google Drive（appDataFolder）による本棚・しおり・既読状態のクラウド同期機能の設計"
description: "Issue #120 に対する差分仕様、影響する全体正本、テスト計画、および実装Sub-issue分割計画。"
issue: "#120"
status: "Review (#120)"
updated: "2026-10-31"
tags:
  - delta
  - cloud-sync
  - google-drive
  - appdata
  - sync-engine
  - settings
  - security
  - oauth
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/settings.md
  - docs/specs/features/bookshelf.md
  - docs/specs/features/reader-view.md
related_tests:
  - src/storage/schema.test.ts
  - src/storage/repositories/novelRepository.test.ts
  - src/features/settings/hooks/useSettings.test.tsx
  - src/features/settings/components/SettingsPage.test.tsx
  - src/features/settings/components/SettingsContainer.test.tsx
  - test/it/smoke.spec.ts
  - test/it/scenarios/scn01-poc-vertical-reader.spec.ts
---

# 差分仕様書：Google Drive（appDataFolder）による本棚・しおり・既読状態のクラウド同期機能（Issue #120）

本ドキュメントは、Issue #120「`[v0.4] Google Drive（appDataFolder）による本棚・しおり・既読状態のクラウド同期機能の実装`」に対する差分仕様、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、および実装 Sub-issue 分割計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

- **現状の課題**:
  - スマートフォンやタブレットなど複数端末で Yommy を利用する際、および機種変更時に、本棚に登録した作品やしおり位置・既読状態が端末内に閉じており、別端末へ引き継ぐ手段が存在しない。
  - 要件 `SYS-REQ-06` では手動での JSON エクスポート／インポートが想定されていたが、ファイルの手動退避・転送・インポートはユーザーにとって操作負荷が高く、リアルタイムな読書状態の引き継ぎが困難である。
- **改善目的**:
  - **ランニングコスト完全 0 円 ＆ プライバシー保護**:
    - 開発者側で独自サーバーや有料データベース（Firebase, Supabase 等）を維持・運用することなく、ユーザー自身の Google Drive アプリ専用領域（`appDataFolder`）に単一同期 JSON（`yommy-sync-state.json`）を保存することで、プライバシーを完全に保護しながら完全無料のクラウド同期を実現する。
  - **手動操作不要のシームレスな自動同期**:
    - アプリ起動時およびバックグラウンド復帰時の自動 Pull、本棚操作や読書進行時の自動 Push（デバウンス付き）により、ユーザーが意識することなく複数端末間で最新の読書状態が同期される。
  - **強固なセキュリティとゼロトラスト設計**:
    - Android ネイティブ標準の Google Identity Services（`AuthorizationClient`）を活用し、`client_secret` や長寿命リフレッシュトークンを WebView 内に一切保持しないセキュアな構成とする。
    - 受信データに対して厳格なスキーマ検証および小説 URL ホワイトリスト検証を実施し、SSRF やインジェクションを完全に防ぐ。

---

## 2. 要求仕様と設計合意事項（What）

### 2.1 同期データ構造（`yommy-sync-state.json`）

Google Drive の `appDataFolder`（ユーザーの一般 Drive 画面には露出しない隠し領域）に保存・取得する単一同期 JSON の TypeScript インターフェース契約を以下の通り定義する。

```ts
/**
 * yommy-sync-state.json のルートデータ構造
 */
export interface YommySyncState {
  /** スキーマバージョン（初期値: 1） */
  version: 1;
  /** 最終同期日時（ISO 8601 UTC 文字列） */
  lastSyncedAt: string;
  /** 作品基本情報・しおり・既読マップ（キー: novelId） */
  novels: Record<string, SyncNovelData>;
  /** 削除済み作品の Tombstone マップ（キー: novelId, 値: 削除日時 ISO 8601） */
  deletedNovels: Record<string, string>;
}

/**
 * 同期対象の個別作品データ構造
 */
export interface SyncNovelData {
  id: string; // "{site_type}:{remote_work_id}"
  siteType: "kakuyomu" | "narou" | "generic";
  remoteWorkId: string;
  canonicalUrl: string; // 作品トップURL
  title: string;
  author: string;
  synopsis: string;
  totalChapters: number;
  isFavorite: number; // 0 | 1
  hasNewUpdate: number; // 0 | 1
  latestEpisodePublishedAt: string | null;
  bookmarkChapterIndex: number | null; // しおり話数（1始まり）
  lastReadAt: string | null; // 最終閲覧日時（ISO 8601）
  readChapterIds: string[]; // 既読エピソードID（remote_chapter_id）の配列
  createdAt: string; // 初回登録日時（ISO 8601）
  updatedAt: string; // レコード更新日時（ISO 8601）
}
```

> [!NOTE]
> **同期対象外データ**:
>
> - リーダー組版・テーマ設定（`reader_settings`）：端末ごとの画面サイズに合わせて個別設定するためローカル保存のまま同期対象外とする。
> - 話数内のスクロール進捗率（`bookmarkScrollProgress`）：過度な同期通信を抑制し、話数レベルのしおり共有で十分なため同期対象外とする。
> - 本文 HTML キャッシュ（`body_html`）およびダウンロードキュー：各端末でオンデマンド・先読み取得するため同期対象外とする。

---

### 2.2 マージ・競合解決ルール（Conflict Resolution）

Pull 時にリモートデータ（`remote`）とローカル DB（`local`）の間で競合が発生した場合、以下のアルゴリズムに従って決定論的にマージする。

1. **新規作品の自動目次補完**:
   - リモートに存在し、ローカル DB に未登録の作品がある場合、その作品の `canonicalUrl` を対象パーサー（`KakuyomuParser` 等）で即座に自動取得（`novelRepository.upsertNovelWithToc`）し、ローカル DB に目次とともに保存する。
   - 保存完了後、リモートの `bookmarkChapterIndex`, `lastReadAt`, および `readChapterIds` を即座に反映する。
2. **作品削除の伝播（Tombstone）**:
   - リモートの `deletedNovels` に含まれる作品 ID について、削除日時（`deletedAt`）がローカル作品の `createdAt` および `updatedAt` より新しい場合、ローカル DB からカスケード削除する。
   - 逆にローカルで作品を削除した際は、ローカルの `deleted_novels` テーブルに削除日時を記録し、次回 Push 時のリモート `deletedNovels` に結合する（和集合）。
3. **しおり話数のマージ**:
   - 同一作品が双方に存在する場合、`lastReadAt`（最終閲覧日時）が新しい方の `bookmarkChapterIndex` を採用する。
   - しおり話数が更新された場合、ローカルのスクロール進捗率（`bookmark_scroll_progress`）は `0.0` にリセットする（同一話数の場合はローカルのスクロール進捗率をそのまま維持する）。
4. **既読状態のマージ**:
   - 両端末の既読エピソード ID（`readChapterIds`）の **和集合（Union）** を採用する（一度でも読んだエピソードはどの端末でも既読とする）。

---

### 2.3 自動 Pull / 自動 Push のタイミングと制御

1. **自動 Pull**:
   - **アプリ起動時**: `ServiceProvider` 初期化完了時に自動実行。
   - **バックグラウンド復帰時**: アプリがバックグラウンドから復帰した際、直前の休止から **5分以上経過** していれば自動実行（`AppBridge.addListener('appStateChange')` または `document.addEventListener('visibilitychange')` で検知）。
   - Pull 完了後、未送信のローカル変更が存在する場合はマージ結果をそのままリモートへ Push する。
2. **自動 Push**:
   - **トリガー**:
     - 本棚への作品追加・作品削除完了時
     - リーダーでの話数切り替え（`goToChapter`）および既読フラグ更新時
   - **デバウンス制御**: 読書中の連続ページめくりによる過剰な API リクエストを防ぐため、**2〜3秒（2500ms 推奨）のデバウンス** を設けて非同期実行する。
3. **オフライン・エラー透過性**:
   - ネットワーク未接続時や Drive API エラー時は、リーダーや本棚のローカル操作を一切ブロックせず、エラーログを保持して次回復帰時に再試行する。

---

### 2.4 設定画面（`SCR-05`）の UI 統合

設定画面（`SCR-05`: `/settings`）に新セクション **「クラウド同期（Google Drive）」**（`data-testid="cloud-sync-section"`）を新設する。

```text
┌────────────────────────────────────────────────────────┐
│ クラウド同期 (Google Drive)                            │
│                                                        │
│ Google Drive の専用領域に本棚・しおりを自動保存します。│
│                                                        │
│ 状態: 連携中 (example@gmail.com)                       │
│ 最終同期: 2026/10/31 12:00:00                          │
│                                                        │
│ [ 今すぐ同期 ]              [ 連携解除 ]               │
└────────────────────────────────────────────────────────┘
```

1. **未連携時**:
   - 状態表示: 「未連携（ローカル保存のみ）」
   - ボタン: `data-testid="cloud-sync-auth-button"`「Google アカウントと連携」
2. **連携中**:
   - 状態表示: `data-testid="cloud-sync-status"`「連携中（`user@gmail.com` 等）」
   - 最終同期日時: `data-testid="cloud-sync-last-synced-at"`「最終同期: YYYY/MM/DD HH:mm:ss」
   - ボタン:
     - `data-testid="cloud-sync-now-button"`「今すぐ同期」: 手動で Pull → Merge → Push を即時実行（実行中はスピナーまたは「同期中...」表示）。
     - `data-testid="cloud-sync-disconnect-button"`「連携解除」: 確認ダイアログ（`data-testid="cloud-sync-disconnect-dialog"`）を表示し、承認時にローカル連携解除＋OS トークン破棄＋Google サーバーへの即時 Revoke を実行（ローカル DB の本棚データは安全に保持）。
3. **エラー表示**:
   - 同期失敗時はセクション内に `role="alert"`（`data-testid="cloud-sync-error-alert"`）でエラーメッセージを表示する。

---

### 2.5 セキュリティ・認証・秘密情報管理（5層防御設計）

1. **クライアント設定の非公開化（Git コミット禁止）**:
   - Google OAuth 2.0 Web クライアント ID 等はコード内にハードコードせず、CI ビルド時は GitHub Secrets（`VITE_GOOGLE_CLIENT_ID`）、ローカル開発時は `.env.local` から注入する。未設定時はクラウド同期 UI を非活性またはモックモードとする。
2. **OAuth 用 APK 署名鍵（Keystore）の秘密管理と SHA-1 なりすまし防止**:
   - 公開 `android/debug.keystore` の SHA-1 は GCP に登録しない（第三者による偽造 APK の OAuth なりすまし防止）。
   - GitHub Secrets（`ANDROID_KEYSTORE_BASE64` 等）に保管した非公開 Keystore の SHA-1 とパッケージ名（`com.yommy.app`）のみを GCP に登録し、CI APK ビルド時に署名する。
3. **Android 標準 `AuthorizationClient`（Google Identity Services）によるネイティブ認証**:
   - サードパーティ製プラグインに依存せず、`android/app/src/main/java/com/yommy/app/` 内の社内 Capacitor プラグイン（`CloudSyncPlugin`）から Android 公式の `Identity.getAuthorizationClient` を呼び出す。
   - `client_secret` を一切使用せず、また WebView の `localStorage` や SQLite に長寿命リフレッシュトークンを一切保存しない（OS 側で短寿命アクセストークンを都度取得）。
4. **最小権限スコープ（`drive.appdata` 限定）とトークン即時失効（Revoke）・遠隔遮断対応**:
   - スコープは `https://www.googleapis.com/auth/drive.appdata` のみに限定。
   - 連携解除時は OS トークンキャッシュ破棄（`clearToken`）および Google サーバーへの即時 Revoke リクエスト（`https://oauth2.googleapis.com/revoke`）を実行する。
   - ユーザーが Google アカウント設定から遠隔でアクセス権を取り消した場合、次回通信時の `401 Unauthorized` を検知して自動的に安全な未連携状態へフォールバックする。
5. **Pull 時同期データのゼロトラスト検証（SSRF / インジェクション防止）**:
   - 受信した JSON に対し、通信前に厳格なランタイムスキーマ検証（型・構造・負数チェック・プロトタイプ汚染防止）を実施する。
   - 未登録作品の自動目次取得（`upsertNovelWithToc`）前に、`canonicalUrl` を既存の `parseNovelUrl`（`https://kakuyomu.jp/works/<id>` ホワイトリスト検証）にかけ、不正な URL や未知ドメインへのリクエスト（SSRF）を遮断する。

---

### 2.6 ローカル開発・Git Worktree 運用時の環境変数管理ルール

1. **ゼロコンフィグでのテスト・ビルド PASS 保証**:
   - 新規 Worktree やフォーク環境など `.env.local` が存在しない状態でも、`npm run typecheck` / `lint` / `test:unit` / `test:coverage` / `test:vrt` / `test:it` / `build` が 100% エラーなく PASS する設計（`ServiceProvider` による DI モック分離）を徹底する。
2. **`.env.example` 配備とメイン Worktree からの自動引き継ぎ**:
   - リポジトリルートに `.env.example` をコミットする。
   - `package.json` の `prepare` スクリプト等において、メイン Worktree（`/workspaces/Yommy/.env.local`）が存在する場合にカレント Worktree へ自動コピーする仕組みを導入する。
3. **AI スキル・ガイドラインへの明文化**:
   - `.github/skills/git-workflow/SKILL.md`、`.github/skills/c-ut-workflow/SKILL.md`、および `docs/guidelines/testing.md` に Worktree 運用規律を明記する。

---

## 3. 全体正本への影響一覧（Where）

| 正本仕様書                           | 種別         | 影響内容                                                                                                                                                                                                |
| :----------------------------------- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/specs/requirements.md`         | App全体正本  | 要件 `SYS-REQ-06` を「Google Drive（`appDataFolder`）によるクラウド同期・マージ機能」へ刷新・統合。                                                                                                     |
| `docs/specs/architecture.md`         | App全体正本  | Bridge 層に `CloudSyncBridge`（`src/bridges/cloud-sync/`）を追加。`CloudSyncService` / `SyncEngine` の同期エンジン構成、5層セキュリティ認証アーキテクチャ、および Worktree 環境変数 DI 分離規律を追記。 |
| `docs/specs/db-schema.md`            | App全体正本  | 削除伝播用 `deleted_novels` テーブル（`id`, `deleted_at`）の DDL 定義、および `app_settings` のクラウド同期関連キー（`cloud_sync_last_synced_at`, `cloud_sync_account_email`）を定義。                  |
| `docs/specs/screen-transitions.md`   | App全体正本  | 設定画面（`SCR-05`）の役割概要に Google Drive クラウド同期機能（連携・解除、即時同期）を追記。                                                                                                          |
| `docs/specs/features/settings.md`    | 機能仕様正本 | スコープから JSON バックアップ除外の記述を削除し、`SYS-REQ-06` クラウド同期セクション（`CloudSyncSection`）、`useCloudSync` フック契約、および受入条件（`AC-ST-08`〜`AC-ST-12`）を追加。                |
| `docs/specs/features/bookshelf.md`   | 機能仕様正本 | 本棚表示時の自動 Pull（起動時・5分以上復帰時）、作品追加・削除時の自動 Push、および作品削除時の `deleted_novels` への Tombstone 記録連携を追記。                                                        |
| `docs/specs/features/reader-view.md` | 機能仕様正本 | リーダーでの話数切り替え・既読更新時の自動 Push（2〜3秒デバウンス非同期実行）連携を追記。                                                                                                               |
| `docs/guidelines/testing.md`         | 開発規約正本 | §2.4 に Worktree 運用における環境変数依存排除と DI モック分離規律を追記。                                                                                                                               |

---

## 4. テスト計画（How to test）

### 4.1 単体テスト（UT / C0・C1 100%）

- **Storage Layer**:
  - `src/storage/schema.test.ts`: `deleted_novels` テーブル作成およびマイグレーションの検証。
  - `src/storage/repositories/novelRepository.test.ts`: 作品削除時の `deleted_novels` への Tombstone 記録、および `deleted_novels` 取得・パージの検証。
- **Bridge & Sync Engine**:
  - `src/bridges/cloud-sync/mockCloudSyncBridge.test.ts`: 認可・連携解除・Revoke・ファイル取得・保存・401エラーのモック動作検証。
  - `src/features/cloud-sync/services/syncEngine.test.ts`:
    - 受信 JSON スキーマ検証（不正型・プロトタイプ汚染・負数・破損データの拒絶）。
    - URL ホワイトリスト検証（`parseNovelUrl` を通過しない不正 URL の目次取得拒絶・SSRF 防止）。
    - 競合マージ検証（新規作品の自動目次取得、Tombstone 削除伝播、`lastReadAt` に基づくしおり話数マージ、既読エピソード ID の和集合マージ）。
    - デバウンス制御および自動 Pull/Push のタイマー検証。
- **UI & Hooks**:
  - `src/features/settings/hooks/useCloudSync.test.ts`: 連携状態管理、同期実行、エラー通知、ロールバックの検証。
  - `src/features/settings/components/CloudSyncSection.test.tsx`: 1対1 Story/UT、未連携・連携中・同期中・エラー・解除確認ダイアログの Portable Stories 全件実行および境界値検証。
  - `src/features/settings/components/SettingsPage.test.tsx` / `SettingsContainer.test.tsx`: クラウド同期セクション統合の検証。

### 4.2 視覚的回帰テスト（Storybook VRT）

- `CloudSyncSection.stories.tsx`:
  - 未連携状態（`Unlinked`）
  - 連携中状態（`Connected`）
  - 同期中状態（`Syncing`）
  - 同期エラー状態（`SyncError`）
  - 解除確認ダイアログ表示状態（`DisconnectConfirmDialog`）
  - 1280px / 375px の双方で VRT スナップショットを取得し組版崩れを検証。

### 4.3 統合テスト（Playwright IT / `SCN-05`）

- **`test/it/scenarios/scn05-cloud-sync.spec.ts`**:
  - 設定画面（`SCR-05`）で Google アカウント連携を実行し、モック Drive に接続。
  - 端末 A で本棚に作品を登録し、リーダーで第 2 話を閲覧してしおりを進行。
  - 自動 Push が実行され、リモート JSON が更新されることを確認。
  - 端末 B（DB リセット状態）で起動時自動 Pull を実行し、作品が自動取得され、第 2 話にしおりが設定されていることを確認。
  - 端末 B で作品を削除し、端末 A への Tombstone 削除伝播を確認。

---

## 5. 実装 Sub-issue 分割計画

| #   | プレフィックス / タイトル                                                                                                | スコープ                                                                                                                                                                                                      | 完了条件                                                            |
| :-- | :----------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------ |
| 1   | `[MK] クラウド同期用Storage層（Tombstoneテーブル・同期設定キー）およびWorktree環境変数基盤の実装（Refs #120）`           | `deleted_novels` テーブル追加、`novelRepository.deleteNovel` での Tombstone 記録、`app_settings` 同期キー対応、`.env.example` 配備、`package.json` prepare フック改善、およびテスト・スキル規約整備           | C0/C1 100%、全単体テスト PASS、`.env.local` なしでの全チェック PASS |
| 2   | `[MK] CloudSyncBridge抽象層とSyncEngine（スキーマ検証・SSRFガード・自動マージ・デバウンス）の実装（Refs #120）`          | `CloudSyncBridge` インターフェース定義、`MockCloudSyncBridge` 実装、`SyncEngine`（スキーマ検証、URL ホワイトリスト、自動目次補完、Tombstone 伝播、しおり/既読マージ、2.5秒デバウンス）の実装と TDD 単体テスト | C0/C1 100%、全単体テスト PASS                                       |
| 3   | `[MK] AndroidネイティブGoogle Identity Services認証プラグインとCI署名鍵設定の実装（Refs #120）`                          | `android/app/src/main/java/com/yommy/app/` の社内 Capacitor プラグイン（`Identity.getAuthorizationClient`）、スコープ限定、Revoke 連携、および `build.gradle` / GitHub Secrets 非公開 Keystore 設定           | ネイティブビルド PASS、プラグイン単体テスト・疎通確認 PASS          |
| 4   | `[MK] 設定画面クラウド同期UIセクション・useCloudSyncフックおよび本棚・リーダー自動同期連携の実装（Refs #120）`           | `CloudSyncSection`、`useCloudSync` フック、本棚・リーダーの自動 Pull/Push 連携、Storybook ストーリー作成、1対1 Portable Stories UT、1280px/375px VRT スナップショット更新                                     | C0/C1 100%、全単体テスト PASS、VRT スナップショット PASS            |
| 5   | `[IT] クラウド同期・端末間引き継ぎPlaywright結合シナリオ（SCN-05）検証・全体回帰および差分仕様アーカイブ（Closes #120）` | `test/it/scenarios/scn05-cloud-sync.spec.ts` 新設、全 IT シナリオ回帰 PASS、申し送り事項（`HO-22`）精算確認、差分仕様アーカイブ移動                                                                           | E2E 全件 PASS、差分仕様書アーカイブ完了、親 Issue #120 クローズ     |

---

## 6. 申し送り事項（Handover Items）

- **`HO-22`**:
  - **内容**: Android 実機 / Google Play 開発者サービス環境における Google Drive `appDataFolder` への初回 OAuth 認可ポップアップ表示、トークン取得、および実機バックグラウンド同期の動作確認。
  - **解決先**: Milestone `v0.4` Step 3 人間確認タスク（実機確認）
  - **完了ゲート**: 実機 APK インストール・動作確認時
