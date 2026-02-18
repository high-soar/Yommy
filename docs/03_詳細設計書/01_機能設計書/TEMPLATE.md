# 詳細設計書（機能名）

| 項目 | 内容 |
| :--- | :--- |
| **ID** | FD-XXX (例: FD-001) |
| **対象画面** | SC-XXX (例: SC-001-001) |
| **作成者** | |
| **更新日** | YYYY/MM/DD |
| **ステータス** | Draft / Review / Approved |

> [!IMPORTANT] 設計時の注意点
> - **実装可能なレベル**まで詳細化すること。
> - 変数名や関数名は、実際の実装と一致させること（キャメルケース等）。
> - 複雑なロジックは箇条書きやフローチャート（Mermaid）で記述すること。

---

## 1. 概要
本機能の目的と、ユーザーに提供する価値を簡潔に記述する。

> [!NOTE] 記載例
> **目的**: ユーザーが登録した小説を一覧表示し、読みたい作品に素早くアクセス可能にする。
> **主要機能**: 作品一覧の表示、更新チェック、作品の削除。

---

## 2. クラス・ファイル構成

実装するクラスやファイルを定義する。MVVMアーキテクチャを基本とする。

| 分類 | クラス名/ファイル名 | 役割・責務 |
| :--- | :--- | :--- |
| **View (Compose)** | `BookshelfScreen.kt` | UI描画。ViewModelの状態を監視し、イベントを通知する。 |
| **ViewModel** | `BookshelfViewModel.kt` | UI状態の管理、ビジネスロジックの実行、Repositoryの呼び出し。 |
| **State** | `BookshelfUiState.kt` | 画面のUI状態を定義するデータクラス。 |
| **Repository** | `NovelRepository.kt` | データアクセスの抽象化（今回は既存クラスを使用）。 |

> [!TIP] ベストプラクティス
> - ViewModelは、Viewからのイベントを受け取り、UI状態（State）を更新する単一方向データフロー（Unidirectional Data Flow）を意識する。
> - Repositoryは直接データベースやAPIを操作せず、DataSource（DAO/API Service）を利用する。

---

## 3. UI状態 (UI State)

画面ごとのUI状態を定義する。`sealed interface` や `data class` を使用する。

### 定義 (`BookshelfUiState`)

```kotlin
data class BookshelfUiState(
    val isLoading: Boolean = false,
    val novels: List<Novel> = emptyList(),
    val errorMessage: String? = null,
    val isRefreshing: Boolean = false, // SwipeRefresh用
    // ...
)
```

> [!NOTE] 記載例
> - **isLoading**: 初回読み込み中のインジケータ表示判定。
> - **novels**: 表示する作品リスト。空の場合はエンプティステートを表示。
> - **errorMessage**: エラー発生時のスナックバー表示用メッセージ。

---

## 4. イベント・関数詳細

ViewModelや主要なクラスのメソッドを詳細に記述する。

### 4.1. ViewModel: `BookshelfViewModel`

| 関数名 | 引数 | 戻り値 | 処理概要 |
| :--- | :--- | :--- | :--- |
| `loadNovels` | なし | `Unit` | DBから作品一覧を取得し、`uiState`を更新する。 |
| `refreshAll` | なし | `Unit` | 全作品の更新チェックを行う（SwipeRefresh）。 |
| `deleteNovel` | `user_uuid: String` | `Unit` | 指定された作品を削除する。 |

#### 詳細ロジック

**`loadNovels()`**
1. `_uiState.update { it.copy(isLoading = true) }`
2. `viewModelScope.launch` で実行。
3. `novelRepository.getAllNovels()` を呼び出す（Flow収集）。
4. 収集したリストで `_uiState` を更新する:
   ```kotlin
   _uiState.update { 
       it.copy(isLoading = false, novels = fetchedList) 
   }
   ```
5. エラー時は `catch` ブロックで `errorMessage` を更新。

**`refreshAll()`**
1. `_uiState.update { it.copy(isRefreshing = true) }`
2. `WorkManager` を使用してバックグラウンド更新ジョブをキックする、またはRepository経由で更新処理を実行。
3. ...

> [!WARNING] 注意
> - `viewModelScope` の使用を忘れないこと。
> - 長時間の処理は `Dispatchers.IO` で実行すること。

---

## 5. データベース・API アクセス

本機能で使用するクエリやAPIエンドポイントを特定する。

### データベース (Room DAO)
- `NovelDao.getAll()`: 作品一覧取得。
- `NovelDao.delete(id)`: 削除。

### API
- `KakuyomuApiService.getEpisodeList(url)`: 更新チェック時に使用。

---

## 6. エラーハンドリング・境界値

| ケース | 挙動 | ユーザーへのフィードバック |
| :--- | :--- | :--- |
| **通信エラー** | 既存データを表示し続行。更新処理は中断。 | スナックバーで「通信エラーが発生しました」と表示。 |
| **データなし** | エンプティステートを表示。 | 画面中央に「作品が登録されていません」と表示。 |
| **解析エラー** | 対象作品のみ「更新失敗」とマーク。 | 該当リストアイテムにエラーアイコンを表示。 |

> [!TIP] 設計のポイント
> - ユーザーの操作をブロックしないことを最優先する（非ブロッキングUI）。
> - エラー発生時でも、アプリがクラッシュしないように `try-catch` を適切に配置する。
