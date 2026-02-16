# Review Report

*   **Target File**: /home/devuser/repos/Yommy/docs/01_要求仕様書/REQUIREMENTS.md
*   **Review Date**: 2026-02-16 22:20:00
*   **Commit ID**: Uncommitted

## Comments

### 1. スクレイピングロジックのハードコーディング
*   **Category**: Fatal Defect (致命的な欠陥)
*   **Location**: Section 1 (Project Overview), Section 5 (UC2)
*   **Critique**:
    「総話数」や本文取得のロジックが、対象サイト（カクヨム）のHTML構造に全面的に依存しています。もしカクヨム側がサイトリニューアルを行いDOM構造を変更した場合、アプリは即座に動作不能になります。Androidアプリの場合、修正版の配布とユーザーによるアップデートには時間がかかります。パースロジックを動的に更新する仕組み（リモートからのルール取得やスクリプト実行など）についての言及が一切ありません。
    *Worst Case*: カクヨムがフロントエンドフレームワークを更新してクラス名が変わった瞬間、ユーザーはアプリを一切使えなくなります。開発者が修正し、ビルドし、再配布するまでの数日間、アプリはただのゴミと化します。
*   **Status**: Resolved

### 2. 起動時の更新チェックのスケーラビリティ
*   **Category**: Fatal Defect (致命的な欠陥)
*   **Location**: Section 3 (A.2), Section 5 (UC2)
*   **Critique**:
    「更新チェック（起動時）」という要件は、起動するたびに「登録済み全作品」に対して順次アクセスを行うことを意味します。もしユーザーが50作品以上登録していた場合、起動直後に50回以上のHTTPリクエストが短時間に発生します。これは対象サイトに対するDoS攻撃に近い挙動であり、高確率でIP BAN（アクセス制限）を受けます。アプリの起動も極端に遅くなり、ユーザー体験を著しく損ないます。
    *Worst Case*: ユーザーがアプリを起動しただけで、カクヨムから「不審なトラフィック」としてIP BANされ、ブラウザから普通に小説を読むことさえできなくなります。
*   **Status**: Resolved

### 3. Y座標に基づくスクロール位置保存
*   **Category**: Logical Contradiction (論理的矛盾)
*   **Location**: Section 3 (B.5), Section 4 (Novels Table)
*   **Critique**:
    `last_scroll_y` という「ピクセル単位のY座標」を保存する仕様は、レスポンシブなテキストビューアとして論理的に破綻しています。端末の回転、フォントサイズの変更、あるいは端末そのものの変更によって、Y座標が指し示す文章の位置は全く変わってしまいます。
    *Worst Case*: ユーザーが文字サイズを大きくして読み直そうとした瞬間、全く関係のないページ中盤や空白部分に飛ばされ、どこまで読んだか完全に見失います。
*   **Status**: Resolved

### 4. 「サーバー負荷の考慮」の曖昧さ
*   **Category**: Lack of Concreteness (具体性の欠如)
*   **Location**: Section 2 (Non-functional Requirements)
*   **Critique**:
    「サーバー負荷を考慮」「過度なアクセスの抑制」という表現は曖昧すぎて機能要件として成立していません。具体的なリクエスト間隔（例: 3秒に1回）や、同時接続数の制限などが定義されていません。このままでは実装者のさじ加減で、攻撃的なスクレイピングツールになりかねません。
    *Worst Case*: 実装者が「100msウェイトなら安全だろう」と判断して実装した結果、カクヨムのセキュリティシステムに検知され、アプリ利用者全員がアクセス禁止になります。
*   **Status**: Resolved

### 5. データベース主キーの脆弱性（URLをPKとするリスク）
*   **Category**: Risk Management (Risk of Regression)
*   **Location**: Section 4 (Episodes Table)
*   **Critique**:
    `Episodes` テーブルの主キーを `url` にするのは極めて危険です。サイト側が `http` から `https` に変更したり、URLパラメータやスラッグの形式を変更した場合、これまでの読書履歴データとの紐付けが一切不能になります。`novel_id` と `index_order` (話数) の複合キーなど、より堅牢な設計が必要です。
    *Worst Case*: カクヨムがURLの末尾にパラメータを追加する仕様変更を行っただけで、ユーザーの「既読」情報が全てリセットされ、未読管理ができなくなります。
*   **Status**: Resolved
