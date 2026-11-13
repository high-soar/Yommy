import { useEffect, useRef } from "react";
import { useServices } from "../../../app/ServiceProvider";

/** バックグラウンド休止後の自動 Pull を発動する最小経過時間（5分 = 300,000ms） */
export const BACKGROUND_SYNC_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * 全画面共通のバックグラウンド（画面ロック）復帰時自動 Pull フック。
 * AppContent ルートに常時マウントされ、5分以上の休止後にフォアグラウンド復帰した際、
 * 連携済み（connected）であれば syncEngine.pullAndMerge() を実行する。
 */
export function useBackgroundAutoPull(): void {
  const { syncEngine, cloudSyncBridge } = useServices();
  const lastHiddenAtRef = useRef<number | null>(null);
  const isPullingRef = useRef<boolean>(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        lastHiddenAtRef.current = Date.now();
        return;
      }

      if (document.visibilityState !== "visible") {
        return;
      }

      const lastHiddenAt = lastHiddenAtRef.current;
      lastHiddenAtRef.current = null;
      if (
        lastHiddenAt === null ||
        Date.now() - lastHiddenAt < BACKGROUND_SYNC_THRESHOLD_MS ||
        !syncEngine ||
        isPullingRef.current
      ) {
        return;
      }

      isPullingRef.current = true;
      void (async () => {
        try {
          if (cloudSyncBridge?.getAuthState) {
            const authState = await cloudSyncBridge.getAuthState();
            if (authState.status !== "connected") {
              return;
            }
          }
          await syncEngine.pullAndMerge();
        } catch {
          // 自動 Pull 失敗時は既存表示を維持しアプリをクラッシュさせない
        } finally {
          isPullingRef.current = false;
        }
      })();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [cloudSyncBridge, syncEngine]);
}
