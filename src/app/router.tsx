/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AppRoute =
  | { name: "bookshelf"; path: "/" }
  | { name: "novel-detail"; path: string; novelId: string }
  | { name: "reader"; path: string; novelId: string; chapterIndex: number };

export interface RouterContextValue {
  currentPath: string;
  route: AppRoute;
  navigate: (path: string) => void;
  navigateToBookshelf: () => void;
  navigateToNovelDetail: (novelId: string) => void;
  navigateToReader: (novelId: string, chapterIndex: number) => void;
}

export interface RouterProviderProps {
  children?: React.ReactNode;
  initialPath?: string;
}

/**
 * URI コンポーネントを安全にデコードする。不正なパーセントエンコーディング時も例外を送出せず元の文字列を返す。
 */
export function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

/**
 * ルートパターン照合用正規表現
 */
const READER_ROUTE_REGEX = /^\/novels\/([^/]+)\/chapters\/(\d+)$/;
const NOVEL_DETAIL_ROUTE_REGEX = /^\/novels\/([^/]+)$/;

/**
 * パス文字列の前後の空白をトリムし、余分な末尾スラッシュを除去して正規化する
 */
function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length > 1 && trimmed.endsWith("/")) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}

/**
 * 指定されたパス文字列から AppRoute を解決する（未知のパスは本棚ルートへフォールバック）
 */
export function matchRoute(path: string): AppRoute {
  const normalized = normalizePath(path);

  if (normalized === "" || normalized === "/") {
    return { name: "bookshelf", path: "/" };
  }

  // SCR-03: リーダー画面 (/novels/:novelId/chapters/:chapterIndex)
  const readerMatch = normalized.match(READER_ROUTE_REGEX);
  if (readerMatch) {
    const chapterIndex = parseInt(readerMatch[2], 10);
    const novelId = safeDecodeURIComponent(readerMatch[1]).trim();
    if (novelId.length > 0 && chapterIndex > 0) {
      return {
        name: "reader",
        path: normalized,
        novelId,
        chapterIndex,
      };
    }
  }

  // SCR-02: 作品詳細画面 (/novels/:novelId)
  const detailMatch = normalized.match(NOVEL_DETAIL_ROUTE_REGEX);
  if (detailMatch) {
    const novelId = safeDecodeURIComponent(detailMatch[1]).trim();
    if (novelId.length > 0) {
      return {
        name: "novel-detail",
        path: normalized,
        novelId,
      };
    }
  }

  // 未知パスフォールバック
  return { name: "bookshelf", path: "/" };
}

/**
 * 初期パスを解決する。優先順位: initialPath > fallbackPath > "/"
 */
export function resolveInitialPath(
  initialPath?: string,
  fallbackPath?: string,
): string {
  if (initialPath !== undefined) {
    return initialPath;
  }
  if (fallbackPath) {
    return fallbackPath;
  }
  return "/";
}

export const RouterContext = createContext<RouterContextValue | null>(null);

/**
 * RouterContext から現在のルーティング状態および画面遷移アクションを取得する
 *
 * @throws RouterProvider 外で呼び出された場合のエラー
 */
export function useRouter(): RouterContextValue {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useRouter must be used within a RouterProvider");
  }
  return context;
}

export const RouterProvider: React.FC<RouterProviderProps> = ({
  children,
  initialPath,
}) => {
  const [currentPath, setCurrentPath] = useState<string>(() =>
    resolveInitialPath(initialPath, window.location.pathname),
  );

  useEffect(() => {
    if (initialPath !== undefined) {
      setCurrentPath(initialPath);
    }
  }, [initialPath]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const navigate = useCallback((to: string) => {
    window.history.pushState(null, "", to);
    setCurrentPath(to);
  }, []);

  const navigateToBookshelf = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const navigateToNovelDetail = useCallback(
    (novelId: string) => {
      navigate(`/novels/${encodeURIComponent(novelId)}`);
    },
    [navigate],
  );

  const navigateToReader = useCallback(
    (novelId: string, chapterIndex: number) => {
      navigate(
        `/novels/${encodeURIComponent(novelId)}/chapters/${chapterIndex}`,
      );
    },
    [navigate],
  );

  const route = useMemo(() => matchRoute(currentPath), [currentPath]);

  const contextValue = useMemo<RouterContextValue>(
    () => ({
      currentPath,
      route,
      navigate,
      navigateToBookshelf,
      navigateToNovelDetail,
      navigateToReader,
    }),
    [
      currentPath,
      route,
      navigate,
      navigateToBookshelf,
      navigateToNovelDetail,
      navigateToReader,
    ],
  );

  return (
    <RouterContext.Provider value={contextValue}>
      {children}
    </RouterContext.Provider>
  );
};
