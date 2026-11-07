---
type: spec-delta
title: "検索画面（SCR-06）の高度検索フィルタ機能（除外キーワード指定・複数ジャンル選択）の設計"
description: "Issue #264（HO-31）に対する差分仕様、カクヨム・小説家になろうの除外キーワードおよび複数ジャンル検索URL生成仕様、検索画面のインライン折りたたみ除外ワードUI・マルチセレクトジャンルピル設計、テスト計画、およびSub-issue分割計画。"
issue: "#264"
status: "Review (#264)"
updated: "2026-11-07"
tags:
  - delta
  - search
  - scr-06
  - parser
  - kakuyomu
  - narou
  - syosetu
  - filtering
  - exclude-keyword
  - multi-genre
  - ho-31
related_specs:
  - docs/specs/features/search.md
  - docs/specs/parsers/kakuyomu.md
  - docs/specs/parsers/narou.md
  - docs/specs/architecture.md
  - docs/specs/requirements.md
  - docs/specs/screen-transitions.md
  - docs/quality/bug-and-handover-log.md
related_tests:
  - src/parsers/kakuyomu/KakuyomuParser.test.ts
  - src/parsers/narou/NarouParser.test.ts
  - src/features/search/components/SearchInputBar.test.tsx
  - src/features/search/components/SearchFilterBar.test.tsx
  - src/features/search/components/SearchPage.test.tsx
  - src/features/search/components/SearchContainer.test.tsx
  - src/features/search/hooks/useNovelSearch.test.ts
  - test/it/scenarios/scn02-search-ranking-discovery.spec.ts
---

# 差分仕様書：検索画面（SCR-06）の高度検索フィルタ機能（除外キーワード指定・複数ジャンル選択）（Issue #264 / `HO-31`）

本ドキュメントは、Issue #264「`[v0.8] 検索画面（SCR-06）の高度検索フィルタ機能（除外キーワード指定・複数ジャンル等の詳細条件検索）の実装（HO-31）`」に対する差分仕様、影響する App 全体正本の一覧、UT/VRT/IT テスト計画、および実装 Sub-issue 分割計画を定義する設計書です。

---

## 1. 変更の背景・目的（Why）

- **申し送り事項 `HO-31`（高度検索フィルタ機能）の解消**:
  Milestone `v0.7`（Issue #240）において「カクヨム」と「小説家になろう」のマルチサイト検索基盤（`SiteSelector`・サイト別単一ジャンルピル）が完成したが、実際の作品探索においては以下の絞り込みニーズが存在する：
  1. **除外キーワード指定（`excludeKeyword`）**: 特定の苦手要素・タグ・キーワードを含む作品を検索結果から除外したい。
  2. **複数ジャンル（OR）選択（`genres`）**: カクヨムの「異世界ファンタジー ＋ 現代ファンタジー」や、小説家になろうの「ハイファンタジー（`201`）＋ ローファンタジー（`202`）」など、複数のジャンルを同時に選択して横断探索したい。
- **375px モバイル画面を圧迫しないコンパクトなフィルタ UX**:
  専用モーダルによる画面遷移感や常時展開によるヘッダー肥大化を避け、既存の横スクロールジャンルピルをマルチセレクト（複数トグル選択）へ拡張するとともに、`SearchInputBar` 内にワンタップでインライン開閉できる「除外語」入力欄（閉じていても適用中バッジを表示）を設けることで、直感的かつ省スペースな高度検索体験を実現する。

---

## 2. 仕様・設計の差分（What Changes）

Step 1 の `/grill-me` インタビューおよび実サイト（カクヨム Next.js 検索仕様・小説家になろう公式 API 仕様）の調査で合意した設計差分は以下の通りです。

### 2.1 Parser Layer（`NovelSearchOptions` / `KakuyomuParser` / `NarouParser`）の拡張

[docs/specs/architecture.md](../architecture.md)、[docs/specs/parsers/kakuyomu.md](../parsers/kakuyomu.md)、および [docs/specs/parsers/narou.md](../parsers/narou.md) の検索 URL 生成仕様を以下の通り拡張します。

1. **`NovelSearchOptions` 型契約の拡張（`src/parsers/types.ts`）**:
   ```typescript
   export interface NovelSearchOptions {
     order?: NovelSearchOrder;
     serialStatus?: NovelSerialStatus;
     /** 単一ジャンル指定（後方互換用。genres 未指定時のフォールバック） */
     genre?: string;
     /** 複数ジャンル（OR）指定（v0.8 Issue #264。指定時は genre より優先） */
     genres?: string[];
     /** 除外キーワード（スペース区切りで複数語指定可、v0.8 Issue #264） */
     excludeKeyword?: string;
     page?: number;
   }
   ```
2. **除外キーワード（`excludeKeyword`）の共通正規化ルール**:
   - `options?.excludeKeyword` が与えられた場合、空白文字（`/\s+/`）で分割し、各トークンから先頭のハイフン `-`（ユーザーが慣習的に `-ハーレム` と入力した場合の重複ハイフン）を `token.replace(/^-+/, "").trim()` で除去し、空文字を除いた配列 `excludeTokens` を得る。
3. **複数ジャンル（`genres` / `genre`）の共通解決ルール**:
   - `options?.genres` が配列として指定されている場合は、各要素を `trim()` し空文字を除いた重複なし配列を採用する。
   - `options?.genres` が未指定（`undefined`）かつ `options?.genre` が非空文字列の場合は、`[options.genre.trim()]` として扱う（既存呼び出しとの完全後方互換）。
4. **カクヨム検索 URL 生成（`KakuyomuParser.buildSearchUrl`）**:
   - **除外キーワード結合（`q` パラメータ）**:
     - 正規化された `excludeTokens` が 1 件以上存在する場合、各語に `-` を前置（`-${token}`）し、メインキーワード `query.trim()` の後ろに半角スペース区切りで結合して `q` パラメータに設定する（例: `query="異世界"`, `excludeKeyword="ハーレム -チート"` → `q="異世界 -ハーレム -チート"`。`query=""`, `excludeKeyword="ハーレム"` → `q="-ハーレム"`）。
     - カクヨム Next.js 検索サーバー（`GetSearchPage`）は `q` 内の `-語` トークンを `exclusionQuery` として展開することを実機レスポンスで確認済み。
   - **複数ジャンル指定（`genre_name` パラメータ）**:
     - 解決されたジャンル配列が 1 件以上存在する場合、各ジャンル識別子を小文字化してカンマ `,` で連結し `genre_name` に設定する（例: `genres: ["fantasy", "action"]` → `genre_name=fantasy,action`）。
5. **小説家になろう検索 URL 生成（`NarouParser.buildSearchUrl`）**:
   - **除外キーワード指定（`notword` パラメータ）**:
     - 正規化された `excludeTokens` が 1 件以上存在する場合、半角スペース `" "` で結合した文字列を公式 API の `notword` パラメータに設定する（例: `notword=ハーレム チート`）。空の場合は `notword` パラメータを省略する。
   - **複数ジャンル指定（`genre` パラメータ）**:
     - 解決されたジャンル配列が 1 件以上存在する場合、各小ジャンルコードをハイフン `-` で連結して公式 API の `genre` パラメータに設定する（例: `genres: ["201", "202"]` → `genre=201-202`）。空の場合は `genre` パラメータを省略する。

### 2.2 検索画面（`SCR-06`）の高度検索フィルタ UI 仕様

[docs/specs/features/search.md](../features/search.md) のコンポーネント契約を以下の通り拡張します。

1. **`SearchInputBar`（除外キーワードトグルボタン ＆ インライン展開入力欄）**:
   - **Props 拡張（`SearchInputBarProps`）**:
     ```typescript
     export interface SearchInputBarProps {
       keyword: string;
       onChangeKeyword: (keyword: string) => void;
       /** 除外キーワード文字列（省略時は ""、v0.8 Issue #264） */
       excludeKeyword?: string;
       /** 除外キーワード変更コールバック（v0.8 Issue #264） */
       onChangeExcludeKeyword?: (excludeKeyword: string) => void;
       onSubmitSearch: () => void;
       /** 検索通信中フラグ（true時は検索ボタン無効化、テキスト入力は可能維持） */
       isLoading?: boolean;
     }
     ```
   - **UI 構造と振る舞い**:
     - `<form role="search" onSubmit={handleSubmit}>` 内の 1 段目に、メイン検索キーワード入力欄（`data-testid="search-input"`）、**「除外語」トグルボタン（`data-testid="search-exclude-toggle-button"`）**、および「検索」実行ボタン（`data-testid="search-submit-button"`）を配置する。
     - 「除外語」トグルボタン（`aria-expanded={isExcludeOpen}`）をタップすると、フォームの 2 段目として **除外キーワード入力欄（`data-testid="search-exclude-input"`, `placeholder="除外ワード（スペース区切り）"`）** がインライン展開される（初期状態は折りたたみ。ただし初期描画時に `excludeKeyword` が非空で渡された場合は展開状態で初期化する）。
     - 除外キーワード入力欄に 1 文字以上入力されているときは、右端に **クリアボタン（`data-testid="search-exclude-clear-button"`, `aria-label="除外キーワードをクリア"`）** を表示し、押下時に `onChangeExcludeKeyword("")` を呼び出す。
     - 除外キーワードが実質非空（`excludeKeyword.trim().length > 0`）のときは、パネルを閉じていても「除外語」トグルボタンをアクティブ強調スタイル（バッジ／色変化）で描画し、除外フィルタが適用中であることを視覚的に明示する。
     - 同一 `<form>` 内に配置されるため、除外キーワード入力欄内で `Enter` キーを押下した場合もそのまま `onSubmitSearch()` が発火する（通信中 `isLoading === true` のときは submit 抑止、テキスト入力自体は可能維持）。
2. **`SearchFilterBar`（複数ジャンルピルのマルチセレクト化）**:
   - **Props 拡張（`SearchFilterBarProps`）**:
     ```typescript
     export interface SearchFilterBarProps {
       selectedSite?: NovelSiteType;
       selectedOrder: NovelSearchOrder;
       onSelectOrder: (order: NovelSearchOrder) => void;
       selectedSerialStatus: NovelSerialStatus;
       onSelectSerialStatus: (status: NovelSerialStatus) => void;
       /** 単一ジャンル指定（後方互換用。selectedGenres 未指定時に参照） */
       selectedGenre?: string;
       /** 複数選択中ジャンルID配列（空配列時は「すべて」選択状態、v0.8 Issue #264） */
       selectedGenres?: string[];
       /** ジャンルトグル選択コールバック（undefined 渡し時は「すべて」＝全解除） */
       onSelectGenre: (genre?: string) => void;
       disabled?: boolean;
     }
     ```
   - **UI 構造と振る舞い**:
     - 有効ジャンル配列 `activeGenres = selectedGenres ?? (selectedGenre ? [selectedGenre] : [])` を算出する。
     - 「すべて」ピル（`opt.id === undefined`, `data-testid="search-genre-all"`）は `activeGenres.length === 0` のときに `aria-pressed="true"`（選択中スタイル）、`activeGenres.length > 0` のときに `aria-pressed="false"` となる。
     - 各個別ジャンルピル（`opt.id !== undefined`, `data-testid="search-genre-${opt.id}"`）は `activeGenres.includes(opt.id)` のときに `aria-pressed="true"`（選択中スタイル）となる。これにより複数ジャンルの同時アクティブ表示が可能となる。
     - ピル押下時は従来通り `onSelectGenre(opt.id)` を呼び出す（「すべて」押下時は `onSelectGenre(undefined)`）。
3. **`SearchPage` / `SearchContainer`**:
   - `SearchPageProps` に `excludeKeyword?: string`, `onChangeExcludeKeyword?: (excludeKeyword: string) => void`, `selectedGenres?: string[]` を追加し、`SearchInputBar` と `SearchFilterBar` へ透過伝播する。
   - `SearchContainer` で `useNovelSearch()` の `excludeKeyword`, `setExcludeKeyword`, `genres`, `setGenre`（トグル動作）を `SearchPage` にバインドする。

### 2.3 `useNovelSearch` カスタムフックの状態・操作連動仕様

1. **インターフェース拡張（`UseNovelSearchResult`）**:
   - `excludeKeyword: string`（初期値 `""`）および `setExcludeKeyword: (excludeKeyword: string) => void` を追加する。
   - `genres: string[]`（初期値 `[]`）を追加する。後方互換の `genre: string | undefined` は `genres[0]`（未選択時は `undefined`）を返し、`setGenre(targetGenre: string | undefined)` は以下のマルチセレクトトグル動作を行う：
     - `targetGenre === undefined`（「すべて」押下時）: `genres` を `[]` にリセットする。
     - `targetGenre` が文字列の場合: 現在の `genres` に含まれていれば除去し、含まれていなければ末尾に追加した新配列 `nextGenres` に更新する（全ジャンルが解除された場合は自動的に `[]`＝「すべて」となる）。
     - 通信中（`isLoadingMore || isSearchingRef.current`）は無視し、`hasSearchedRef.current === true` の場合は更新後の `nextGenres` で直ちに 1 ページ目から `executeSearch({ genres: nextGenres })` を発火する。
2. **検索実行（`executeSearch`）と次ページ取得（`loadMore`）**:
   - `parser.buildSearchUrl(keyword, { order: targetOrder, serialStatus: targetSerial, genre: targetGenres[0], genres: targetGenres, excludeKeyword: targetExcludeKeyword, page })` を呼び出し、`excludeKeyword` と `genres` を 1 ページ目検索・リトライ・次ページ追加読み込み（`loadMore`）のすべてで一貫して引き継ぐ。
3. **サイト切替連動（`setSelectedSite`）**:
   - カクヨム ⇔ 小説家になろうを切り替えた際、サイト共通条件である **`keyword`・`excludeKeyword`・`order`・`serialStatus` は保持** し、サイト固有の **`genres` を `[]`（`genre` は `undefined`）にリセット** する。
   - `hasSearchedRef.current === true` の場合は `executeSearch({ site: newSite, genres: [] })` で直ちに新サイトを再検索する。

### 2.4 影響を受ける App 全体正本ファイル一覧

| 正本ファイルパス                       | 変更内容概要                                                                                                                                       |
| :------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/specs/features/search.md`        | `SearchInputBarProps`, `SearchFilterBarProps`, `SearchPageProps`, `UseNovelSearchResult` の除外キーワード・複数ジャンル契約拡張、`AC-SE-11` 追加。 |
| `docs/specs/parsers/kakuyomu.md`       | §5.1 `buildSearchUrl` の除外キーワード（`q` への `-語` 結合）および複数ジャンル（`genre_name` カンマ連結）仕様、`AC-08` 更新。                     |
| `docs/specs/parsers/narou.md`          | §5.1 `buildSearchUrl` の除外キーワード（`notword` パラメータ）および複数ジャンル（`genre` ハイフン連結）仕様、`AC-NR-11` 更新。                    |
| `docs/specs/architecture.md`           | §3.3 `NovelSearchOptions` 型定義に `genres?: string[]` および `excludeKeyword?: string` を追加。                                                   |
| `docs/specs/requirements.md`           | §3.6 `SYS-REQ-17` の除外キーワード・複数ジャンル対応追記、`AC-SE-11` トレーサビリティ反映、§4 ロードマップ更新。                                   |
| `docs/specs/screen-transitions.md`     | §1 `SCR-06` の除外キーワード・複数ジャンル説明更新、§4 `SCN-02` の受入条件トレーサビリティ（`AC-SE-01`〜`11`）更新。                               |
| `docs/quality/bug-and-handover-log.md` | `related_specs` に本差分仕様を追加し、`HO-31` の解決先（Issue #264 / Sub-issue #271, #272）および完了ゲートを更新。                                |
| `docs/index.md`                        | ディレクトリマップに `docs/specs/changes/issue-264-advanced-search-filter.md` を登録。                                                             |

---

## 3. テスト計画（UT / VRT / IT の検証観点）

### 3.1 単体テスト（Vitest TDD / C0・C1・Functions 100%）

1. **Parser Layer 単体テスト（`KakuyomuParser.test.ts`, `NarouParser.test.ts`）**:
   - `KakuyomuParser.buildSearchUrl`:
     - `excludeKeyword` 指定時（単一語、スペース区切り複数語、先頭 `-` 付き入力 `-ハーレム --チート` の正規化、前後空白・空文字無視）に `q` パラメータへ `-語` として結合されること。
     - メイン `query` が空文字で `excludeKeyword` のみ指定された場合に `q=-ハーレム` として構築されること。
     - `genres` 複数指定時（例: `["fantasy", "action"]`、大文字混在や重複・空要素含む）に `genre_name=fantasy,action` が構築されること、および `genres: []` 時は `genre_name` が省略され、`genres` 未指定時は既存の `genre` がフォールバック使用されること。
   - `NarouParser.buildSearchUrl`:
     - `excludeKeyword` 指定時（単一語、複数語、先頭 `-` 付き入力の正規化）に `notword` パラメータへスペース区切りで設定され、空文字・空白のみの場合は `notword` が省略されること。
     - `genres` 複数指定時（例: `["201", "202"]`）に `genre=201-202` が構築されること、および `genres: []` 時は `genre` が省略され、`genres` 未指定時は既存の `genre` がフォールバック使用されること。
2. **Viewer Layer / Hook 単体テスト（1対1 Story/UT・親子分離）**:
   - `SearchInputBar.test.tsx`:
     - 「除外語」トグルボタン（`search-exclude-toggle-button`）による除外キーワード入力欄（`search-exclude-input`）の開閉、入力変更時の `onChangeExcludeKeyword` 発火、クリアボタン（`search-exclude-clear-button`）押下時の空文字クリア、除外キーワード設定時のトグルボタン強調表示（パネル閉鎖時含む）、Enter 押下時の `onSubmitSearch` 発火、`isLoading=true` 時の送信抑止を検証。
   - `SearchFilterBar.test.tsx`:
     - `selectedGenres` に複数ジャンル（例: `["fantasy", "sf"]` や `["201", "202"]`）が渡された際、該当するすべてのピルが `aria-pressed="true"` となり、「すべて」ピルが `aria-pressed="false"` となることを検証。
   - `SearchPage.test.tsx` / `SearchContainer.test.tsx`:
     - 親子分離（`vi.spyOn`）に基づき、`excludeKeyword`, `onChangeExcludeKeyword`, `selectedGenres` が子コンポーネントへ正しく伝播・バインドされることを検証。
   - `useNovelSearch.test.ts`:
     - `setExcludeKeyword` 更新と `search()` / `loadMore()` 実行時の URL パラメータ反映。
     - `setGenre` による複数ジャンルの追加・トグル解除・全解除時の `[]` 復帰・「すべて（`undefined`）」指定時の全解除、および `hasSearched=true` 時の即時自動再検索。
     - `setSelectedSite` によるサイト切替時に `excludeKeyword` が保持され、`genres` が `[]` にリセットされること。

### 3.2 Storybook ＆ VRT（1280px / 375px）

- `SearchInputBar.stories.tsx`, `SearchFilterBar.stories.tsx`, `SearchPage.stories.tsx` に除外キーワード展開・適用中状態および複数ジャンル選択状態のストーリーを追加し、`npm run test:vrt:update` および `npm run test:vrt` で 1280px / 375px のスナップショット PASS を検証する。

### 3.3 結合テスト（Playwright IT / 全件 100% PASS）

- `test/it/scenarios/scn02-search-ranking-discovery.spec.ts`:
  - 検索画面（`SCR-06`）において「除外語」トグルを開いて除外キーワードを入力し、ジャンルピルを複数選択（カクヨムおよび小説家になろう双方）して検索を実行した際、対応するクエリパラメータで検索が行われ結果一覧が更新されることを E2E で検証する。

---

## 4. 実装 Sub-issue 分割計画

| Sub-issue  | Issue 番号 | 種別     | 作業範囲                                                                                                                                                                                                                             | 完了ゲート / マージ権限                      |
| :--------- | :--------- | :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------- |
| **MK1**    | **#271**   | 実装     | Parser Layer（`NovelSearchOptions` 拡張、`KakuyomuParser.buildSearchUrl`・`NarouParser.buildSearchUrl` の除外キーワード・複数ジャンル対応と単体テスト C0/C1 100%）                                                                   | Task Completion Gate 1〜6 → 🤖 AI 自律マージ |
| **MK2/IT** | **#272**   | 実装＋IT | 検索画面（`SCR-06`）の除外キーワード・複数ジャンル UI/Hook（`SearchInputBar`, `SearchFilterBar`, `SearchPage`, `SearchContainer`, `useNovelSearch`）実装・1対1 Story/UT・VRT・Playwright `SCN-02` 拡充・`HO-31` 精算・アーカイブ移動 | Task Completion Gate 1〜6 → 👤 人間マージ    |

---

## 5. 申し送り事項（Handover Items: `HO-xx`）・実機検証計画

- **Android 実機検証の実施タイミング判断**: **`B. Milestone 最終レビュー後に一括で実機検証を実施（完了ゲート: Milestone v0.8 完了前 / Issue #267）`**
  - **判断理由**:
    - 本 Issue は Parser の検索 URL クエリ組み立て拡張および検索画面ヘッダー内の React フォーム・ピル状態拡張であり、Android ネイティブプラグインの新設・変更や物理ジェスチャー追加を伴わない。
    - 375px モバイル幅でのレイアウト整合性は Storybook VRT（375px）および Playwright 実ブラウザ結合テスト（`SCN-02`）で自動検証し、Android 実機での最終確認は Milestone `v0.8` 完了承認 Issue #267（Step 2）にて他機能（#265, #266）と一筆書きで一括実施する。

| 申し送り ID | 起票元 Issue | 申し送り事項の内容                                                                                                     | 解決先（対象 Issue / 成果物）                                                | 完了ゲート                                                                       |  状態  |
| :---------: | :----------: | :--------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------- | :------------------------------------------------------------------------------- | :----: |
| **`HO-31`** |     #240     | 除外キーワード指定や複数ジャンル AND/OR モーダル等の高度な検索フィルタ機能の検討・実装（Issue #240 §3 対象外スコープ） | Issue #264（Sub-issue #271, #272） / Milestone `v0.8` 実機検証（Issue #267） | 親 Issue #264 完了前（コード・IT精算） / Milestone `v0.8` 完了前（実機一括検証） | `Open` |
