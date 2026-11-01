---
type: spec-delta
title: "キャッシュデータ容量の可視化（作品別・全体）と既読/本文キャッシュ削除機能の設計"
description: "Issue #170 に対する差分仕様、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、および実装 Sub-issue 分割計画。"
issue: "#170"
status: "Review (#170)"
updated: "2026-11-01"
tags:
  - delta
  - cache
  - storage
  - settings
  - novel-detail
  - ho-24
related_specs:
  - docs/specs/requirements.md
  - docs/specs/architecture.md
  - docs/specs/db-schema.md
  - docs/specs/screen-transitions.md
  - docs/specs/features/novel-detail.md
  - docs/specs/features/settings.md
related_tests:
  - src/storage/repositories/chapterRepository.test.ts
  - src/features/novel-detail/components/NovelDetailHeader.test.tsx
  - src/features/novel-detail/components/NovelDetailPage.test.tsx
  - src/features/novel-detail/components/NovelDetailContainer.test.tsx
  - src/features/novel-detail/hooks/useNovelDetail.test.ts
  - src/features/settings/components/SettingsPage.test.tsx
  - src/features/settings/components/SettingsContainer.test.tsx
  - src/features/settings/hooks/useSettings.test.tsx
  - test/it/scenarios/scn04-prefetch-and-cache.spec.ts
---

# 差分仕様書：キャッシュデータ容量の可視化（作品別・全体）と既読/本文キャッシュ削除機能の設計（Issue #170）

本ドキュメントは、Issue #170「`[v0.5] キャッシュデータ容量の可視化（作品別・全体）と既読/本文キャッシュ削除機能の実装（SYS-REQ-05拡張）`」に対する差分仕様、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、および実装 Sub-issue 分割計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

- **背景**:
  - `docs/specs/requirements.md`（**SYS-REQ-05**: ストレージ容量・作品削除管理）および `docs/specs/db-schema.md` では、`novels.total_byte_size` / `chapters.byte_size` によるキャッシュ容量管理、および作品単位での「作品全体の削除」と「本文キャッシュのみの削除（目次・既読状態・しおりは残す）」が定義されており、ストレージ層（`ChapterRepository.deleteCachedBodies(novelId, options?: { onlyRead?: boolean })` 等）は既に実装されている。
  - しかし、UI 上でのキャッシュ容量可視化および本文キャッシュ削除導線は `v0.5` のスコープとして残されていた。
- **目的**:
  - 長編小説を多数ダウンロードした際に端末のストレージを圧迫しないよう、作品詳細画面（`SCR-02`）および設定画面（`SCR-05`）でキャッシュ容量を可視化し、安全に本文キャッシュ（既読話のみ／全話）を削除できる UI を実装する。
  - 目次構造、各エピソードの既読状態（`is_read`）、および読書進捗（しおり位置 `bookmark_chapter_index` / `bookmark_scroll_progress`）は完全保持し、再読時に必要に応じてオンデマンドで本文を再取得できるようにすることで、ユーザー体験とストレージ節約を両立する。

---

## 2. 要求仕様と設計合意事項（What）

### 2.1 キャッシュデータ容量の表示箇所とフォーマット規約

1. **表示箇所（2箇所に集約、本棚一覧カード `SCR-01` はシンプルさを保つため現状維持）**:
   - **作品詳細画面（`SCR-02`: `NovelDetailHeader` の `data-testid="novel-detail-stats"`）**:
     - `全 {novel.totalChapters} 話（取得済み {novel.cachedChapters} 話 / {formatByteSize(novel.totalByteSize)}）` の形式で表示する。
   - **設定画面（`SCR-05`: `SettingsPage` 内の「ストレージ・キャッシュ管理」セクション `data-testid="storage-cache-section"`）**:
     - 全登録作品の合計キャッシュ済み話数および合計キャッシュ容量（`data-testid="storage-cache-summary"`: 例 `キャッシュ済み: 全 {totalCachedChapters} 話（合計 {formatByteSize(totalByteSize)}）`）を表示する。

2. **バイト容量フォーマット共通規約（`formatByteSize(bytes: number): string`）**:
   - 共通ユーティリティ（`src/shared/utils/formatByteSize.ts`）として実装し、以下の規則で文字列化する：
     - `bytes <= 0`: `"0 B"`
     - `bytes < 1024`: `"${bytes} B"`
     - `bytes < 1024 * 1024`: `"${(bytes / 1024).toFixed(1)} KB"`（例: `12.5 KB`）
     - `bytes >= 1024 * 1024`: `"${(bytes / (1024 * 1024)).toFixed(1)} MB"`（例: `1.4 MB`）

### 2.2 作品詳細画面（`SCR-02`: `NovelDetailHeader` / `ClearCacheConfirmDialog` / `useNovelDetail`）での本文キャッシュ削除

1. **起動ボタン（`data-testid="open-clear-cache-dialog-button"`）**:
   - `NovelDetailHeader` の管理アクション領域（「未取得話を一括キャッシュ」「目次を更新」「作品を削除」の並び）に「本文キャッシュ整理」ボタンを配置する。
   - `novel.cachedChapters === 0`、`isBatchCaching === true`、または `isRefreshing === true` のときは `disabled`（非活性）とする。

2. **確認ダイアログ（`ClearCacheConfirmDialog`, `data-testid="clear-cache-confirm-dialog"`）での 2 段階選択**:
   - 目次・既読状態・しおり位置は保持され、再度読む際は再取得可能である旨を明記した上で、以下の選択肢を提供する：
     - **`data-testid="confirm-clear-read-cache-button"`**: `既読話の本文キャッシュのみ削除`（`chapterRepository.deleteCachedBodies(novelId, { onlyRead: true })` を実行）
     - **`data-testid="confirm-clear-all-cache-button"`**: `すべての本文キャッシュを削除`（`chapterRepository.deleteCachedBodies(novelId, { onlyRead: false })` を実行）
     - **`data-testid="cancel-clear-cache-button"`**: `キャンセル`

3. **削除後の即時反映**:
   - 削除完了後、作品レコード（`cachedChapters`, `totalByteSize`）および各話一覧（`EpisodeListItem` の `取得済み` → `未取得` バッジ）を再取得・即時更新し、`novel-detail-notice` に完了通知（例: `本文キャッシュを削除しました（{deletedCount}話）`）を表示する。

### 2.3 設定画面（`SCR-05`: `StorageCacheSection` / `useStorageCache`）での全体キャッシュ可視化と一括削除

1. **「ストレージ・キャッシュ管理」セクション（`data-testid="storage-cache-section"`）**:
   - 全登録作品の合計キャッシュ済み話数・合計サイズ（`data-testid="storage-cache-summary"`）を表示する。
   - 一括削除起動ボタン（`data-testid="open-global-clear-cache-dialog-button"`, ラベル: `本文キャッシュを一括整理`、合計キャッシュ話数が `0` または処理中は `disabled`）を配置する。

2. **一括削除確認ダイアログ（`data-testid="global-clear-cache-dialog"`）**:
   - 作品詳細画面と同様、以下の選択肢を提供する：
     - **`data-testid="confirm-global-clear-read-cache-button"`**: `既読話の本文キャッシュのみ削除`（全作品に対し既読話の本文キャッシュを削除）
     - **`data-testid="confirm-global-clear-all-cache-button"`**: `すべての本文キャッシュを削除`（全作品に対し全話の本文キャッシュを削除、作品登録・目次・既読・しおりは保持）
     - **`data-testid="cancel-global-clear-cache-button"`**: `キャンセル`
   - 実行完了後、合計キャッシュ話数・合計容量表示を即時再計算して更新し、完了フィードバック（`data-testid="storage-cache-notice"`）を表示する。

### 2.4 ストレージ層拡張（`ChapterRepository`）

1. **全体キャッシュ集計 API**:
   - `ChapterRepository.getStorageCacheSummary(): Promise<{ totalCachedChapters: number; totalByteSize: number }>`
   - `chapters` テーブルから `body_html IS NOT NULL` であるレコードの件数および `byte_size` 合計を高速取得。
2. **全体一括キャッシュ削除 API**:
   - `ChapterRepository.deleteAllCachedBodies(options?: { onlyRead?: boolean }): Promise<number>`
   - 全作品を対象に、条件（`onlyRead ? body_html IS NOT NULL AND is_read = 1 : body_html IS NOT NULL`）に合致する `chapters` の `body_html = NULL`, `byte_size = 0`, `downloaded_at = NULL` を更新し、影響を受けた全作品の `novels.cached_chapters`, `novels.total_byte_size`, `novels.updated_at` を単一トランザクション内で再集計・更新する。

---

## 3. 影響する App 全体正本一覧

| 対象正本ドキュメント                   | 主な反映内容                                                                                                                                                                                                                      |
| :------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/specs/requirements.md`           | `SYS-REQ-05` に作品詳細画面（`SCR-02`）および設定画面（`SCR-05`）におけるキャッシュ容量可視化、作品単位・全体一括の本文キャッシュ削除（既読のみ／全話）を反映。受入条件 `AC-ND-20〜22`, `AC-ST-14〜16` を追記。ロードマップ更新。 |
| `docs/specs/architecture.md`           | `ChapterRepository` 契約に `getStorageCacheSummary` および `deleteAllCachedBodies` を追記。プレゼンテーション層に `ClearCacheConfirmDialog`、`StorageCacheSection`、`useStorageCache`、`formatByteSize` を追記。                  |
| `docs/specs/db-schema.md`              | §3.2 `chapters` および §3.1 `novels` における本文キャッシュ削除時の整合性保持（単一トランザクション内での `cached_chapters` / `total_byte_size` 再計算）の仕様を明文化。                                                          |
| `docs/specs/screen-transitions.md`     | `SCR-02` および `SCR-05` の役割概要を更新。`TR-19`（作品詳細ヘッダーでの本文キャッシュ整理）および `TR-20`（設定画面での本文キャッシュ一括整理）を新設し、Mermaid 遷移図へ追加。                                                  |
| `docs/specs/features/novel-detail.md`  | §1 スコープに `SYS-REQ-05` / `TR-19` を追記。§2・§3 に `ClearCacheConfirmDialog` コンポーネントおよび `useNovelDetail` 拡張仕様を追記。受入条件 `AC-ND-20`, `AC-ND-21`, `AC-ND-22` を新設。                                       |
| `docs/specs/features/settings.md`      | §1 スコープに `SYS-REQ-05` / `TR-20` を追記。§2・§3 に `StorageCacheSection`、`useStorageCache`、および一括削除ダイアログ仕様を追記。受入条件 `AC-ST-14`, `AC-ST-15`, `AC-ST-16` を新設。                                         |
| `docs/index.md`                        | 差分仕様マップに `issue-170-cache-management-and-capacity-visualization.md` を追記。                                                                                                                                              |
| `docs/quality/bug-and-handover-log.md` | 申し送り事項 **`HO-24`**（Android 実機での本文キャッシュ削除および容量・バッジ即時反映の検証）を登録。                                                                                                                            |

---

## 4. テスト計画（UT / VRT / IT）

### 4.1 単体テスト（UT: Vitest / TDD）

1. **`src/shared/utils/formatByteSize.test.ts`**:
   - `0` 以下の境界値（`0 B`, 負数 `0 B`）、1024 未満のバイト値（`100 B`, `1023 B`）
   - KB 境界（`1024 B` → `1.0 KB`, `12800 B` → `12.5 KB`, `1048575 B` → `1024.0 KB`）
   - MB 境界（`1048576 B` → `1.0 MB`, `1572864 B` → `1.5 MB`）
2. **`src/storage/repositories/chapterRepository.test.ts`**:
   - `getStorageCacheSummary`: 空 DB での `0 話 / 0 B`、複数作品・キャッシュ混在時の正確な集計
   - `deleteAllCachedBodies`: `onlyRead: true` 時の既読話のみ削除と未読話保持、`onlyRead: false` 時の全話本文削除、親作品レコードの `cached_chapters` / `total_byte_size` が即時整合すること
3. **`src/features/novel-detail/components/NovelDetailHeader.test.tsx` / `ClearCacheConfirmDialog.test.tsx`**:
   - 統計欄フォーマット表示（`formatByteSize` 連携）
   - 「本文キャッシュ整理」ボタン活性/非活性条件（`cachedChapters === 0`, `isBatchCaching`, `isRefreshing`）
   - ダイアログでの「既読話のみ削除」「すべての本文キャッシュを削除」「キャンセル」の発火とキーボード（Escape）制御
4. **`src/features/novel-detail/hooks/useNovelDetail.test.ts`**:
   - キャッシュ削除後の作品情報・各話一覧再取得とバッジ更新（取得済み→未取得）
   - 削除完了メッセージ（`novel-detail-notice`）の表示
5. **`src/features/settings/components/StorageCacheSection.test.tsx` / `hooks/useStorageCache.test.ts`**:
   - ストレージサマリー表示、ボタン非活性制御
   - 一括削除ダイアログでの削除実行と再計算・通知表示（`storage-cache-notice`）
   - `SettingsPage` / `SettingsContainer` との統合検証

### 4.2 UI / VRT（Storybook Playwright 1280px / 375px）

- `NovelDetailHeader`: キャッシュ容量表示状態、キャッシュ整理ボタン活性/非活性状態
- `ClearCacheConfirmDialog`: モーダル表示状態（1280px / 375px）
- `NovelDetailPage`: キャッシュ削除完了通知インライン表示状態
- `StorageCacheSection`: キャッシュ有状態（話数・容量表示）、キャッシュ 0 件状態、一括削除ダイアログ表示状態
- `SettingsPage`: ストレージ・キャッシュ管理セクション統合状態

### 4.3 結合テスト（IT: Playwright）

- `test/it/scenarios/scn04-prefetch-and-cache.spec.ts` を拡張：
  - 作品ダウンロード後、作品詳細画面でキャッシュ容量が表示されていること
  - 既読話の本文キャッシュ削除を実行し、既読話のみ未取得に戻り容量が減ること
  - 全話本文キャッシュ削除を実行し、全話未取得に戻り容量が 0 B になること
  - 設定画面でアプリ全体の合計キャッシュ話数・容量が反映され、一括削除が正常に動作すること

---

## 5. 実装 Sub-issue 分割計画（推奨 1 PR = 200〜400 行）

本 Issue の実装およびテストは、以下の 4 つの Sub-issue に分割して直列進行する。

### Sub-issue ① (MK): 容量フォーマット共通ユーティリティおよびストレージ層一括キャッシュ削除・集計 API の実装

- **対象正本**: `docs/specs/architecture.md`, `docs/specs/db-schema.md`
- **作業範囲**:
  - `src/shared/utils/formatByteSize.ts` および単体テスト（Vitest TDD）
  - `src/storage/types.ts` 契約拡張（`getStorageCacheSummary`, `deleteAllCachedBodies`）
  - `src/storage/repositories/chapterRepository.ts` への集計・一括削除実装と単体テスト（C0/C1/Functions 100%）
- **完了条件**:
  - TDD Red-Green-Refactor コミットの作成
  - 静的検査・単体テスト 100% カバレッジ PASS
  - 独立 AI レビューおよびマージ

### Sub-issue ② (MK): 作品詳細画面（SCR-02）における作品別キャッシュ容量表示と本文キャッシュ削除 UI・フック実装

- **対象正本**: `docs/specs/features/novel-detail.md`, `docs/specs/screen-transitions.md`
- **作業範囲**:
  - `NovelDetailHeader` への容量表示フォーマット反映および「本文キャッシュ整理」ボタン追加
  - `ClearCacheConfirmDialog.tsx` の新規作成（1対1 Story / Portable Stories UT / VRT）
  - `useNovelDetail` フックへの本文キャッシュ削除（既読のみ／全話）処理および完了通知追加
  - `NovelDetailPage` / `NovelDetailContainer` 統合、Storybook VRT（1280px / 375px）更新
- **完了条件**:
  - 1対1 Story/UT 原則、親子分離、C0/C1 100% カバレッジ PASS
  - VRT スナップショット更新・検証 PASS
  - 独立 AI レビューおよびマージ

### Sub-issue ③ (MK): 設定画面（SCR-05）におけるアプリ全体キャッシュ容量可視化と一括本文キャッシュ削除 UI・フック実装

- **対象正本**: `docs/specs/features/settings.md`, `docs/specs/screen-transitions.md`
- **作業範囲**:
  - `StorageCacheSection.tsx` の新規作成（1対1 Story / Portable Stories UT / VRT）
  - `useStorageCache.ts` フックの実装（全体集計取得、一括削除、通知表示）
  - `SettingsPage` / `SettingsContainer` への統合、Storybook VRT（1280px / 375px）更新
- **完了条件**:
  - 1対1 Story/UT 原則、親子分離、C0/C1 100% カバレッジ PASS
  - VRT スナップショット更新・検証 PASS
  - 独立 AI レビューおよびマージ

### Sub-issue ④ (IT): キャッシュ容量可視化・本文キャッシュ削除の Playwright 結合テスト検証・全体回帰および差分仕様アーカイブ

- **対象正本**: `docs/specs/changes/issue-170-*.md`
- **作業範囲**:
  - `test/it/scenarios/scn04-prefetch-and-cache.spec.ts` のシナリオ拡張（SCR-02 容量表示/削除、SCR-05 全体容量表示/一括削除）
  - 既存全結合シナリオ（`SCN-01`〜`SCN-05`）の 100% PASS 確認
  - 申し送り事項 **`HO-24`** の精算確認
  - 差分仕様ファイルを `docs/specs/changes/archive/issue-170-cache-management-and-capacity-visualization.md` へ移動
  - 正本仕様書のステータスを `Approved` に更新
- **完了条件**:
  - Playwright IT 全件 PASS
  - 差分仕様アーカイブ完了
  - PR に `Closes #170` を記載し、人間マージにより親 Issue をクローズ

---

## 6. 次タスク・後続 PR への申し送り事項（Handover Items: `HO-xx`）

|   ID    | 起票元 Issue / PR | 申し送り事項の内容                                                                                                                 | 解決先（対象 Issue / 成果物）          | 完了ゲート | 状態 (`Open` / `Resolved`) |
| :-----: | :---------------: | :--------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------- | :--------- | :------------------------: |
| `HO-24` |       #170        | Android 実機での本文キャッシュ削除（既読のみ／全話）および作品詳細・設定画面でのキャッシュ容量・各話バッジ即時反映の動作確認・検証 | Issue #170（Sub-issue ④ / 実機確認時） | 実機確認時 |           `Open`           |
