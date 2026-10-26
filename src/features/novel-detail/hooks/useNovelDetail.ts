import type { UseNovelDetailResult } from "../types";

export type { UseNovelDetailResult } from "../types";

export const DEFAULT_FETCH_ERROR_MESSAGE = "作品情報の取得に失敗しました";
export const DEFAULT_REFRESH_ERROR_MESSAGE = "目次の更新に失敗しました";
export const DEFAULT_DELETE_ERROR_MESSAGE = "作品の削除に失敗しました";

/**
 * 作品詳細・目次画面（SCR-02）の状態管理カスタムフック
 */
export function useNovelDetail(_novelId: string): UseNovelDetailResult {
  throw new Error("not implemented");
}
