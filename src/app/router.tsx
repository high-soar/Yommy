import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type AppRoute =
  | { name: "bookshelf"; path: "/" }
  | { name: "novel-detail"; path: string; novelId: string }
  | { name: "reader"; path: string; novelId: string; chapterIndex: number }
  | { name: "settings"; path: "/settings" }
  | { name: "search"; path: "/search" }
  | { name: "ranking"; path: "/ranking" };

export interface NavigateToReaderOptions {
  replace?: boolean;
  fromBookshelfResume?: boolean;
}

export interface RouterContextValue {
  currentPath: string;
  previousPath?: string;
  novelOrigin: string | null;
  route: AppRoute;
  navigate: (path: string) => void;
  navigateToBookshelf: () => void;
  navigateToSearch: () => void;
  navigateToRanking: () => void;
  navigateToNovelDetail: (novelId: string) => void;
  navigateToReader: (
    novelId: string,
    chapterIndex: number,
    options?: NavigateToReaderOptions,
  ) => void;
  navigateToSettings: () => void;
  back: () => void;
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

  // SCR-05: 設定画面 (/settings)
  if (normalized === "/settings") {
    return { name: "settings", path: "/settings" };
  }

  // SCR-06: 検索画面 (/search)
  if (normalized === "/search") {
    return { name: "search", path: "/search" };
  }

  // SCR-07: ランキング画面 (/ranking)
  if (normalized === "/ranking") {
    return { name: "ranking", path: "/ranking" };
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
  const currentPathRef = useRef<string>(currentPath);
  const [previousPath, setPreviousPath] = useState<string | undefined>(
    undefined,
  );
  const [novelOrigin, setNovelOrigin] = useState<string | null>(null);
  const novelOriginRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialPath !== undefined) {
      currentPathRef.current = initialPath;
      if (!initialPath.startsWith("/novels/")) {
        novelOriginRef.current = null;
        setNovelOrigin(null);
      }
      setCurrentPath(initialPath);
    }
  }, [initialPath]);

  useEffect(() => {
    const handlePopState = () => {
      const nextPath = window.location.pathname;
      currentPathRef.current = nextPath;
      if (!nextPath.startsWith("/novels/")) {
        novelOriginRef.current = null;
        setNovelOrigin(null);
      }
      setCurrentPath((prev) => {
        setPreviousPath(prev);
        return nextPath;
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const navigate = useCallback((to: string) => {
    if (currentPathRef.current === to) {
      return;
    }
    const current = currentPathRef.current;
    if (to.startsWith("/novels/")) {
      if (!current.startsWith("/novels/")) {
        novelOriginRef.current = current;
        setNovelOrigin(current);
      }
    } else {
      novelOriginRef.current = null;
      setNovelOrigin(null);
    }

    window.history.pushState(null, "", to);
    currentPathRef.current = to;
    setCurrentPath((prev) => {
      setPreviousPath(prev);
      return to;
    });
  }, []);

  const navigateToBookshelf = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const navigateToSearch = useCallback(() => {
    navigate("/search");
  }, [navigate]);

  const navigateToRanking = useCallback(() => {
    navigate("/ranking");
  }, [navigate]);

  const navigateToNovelDetail = useCallback(
    (novelId: string) => {
      navigate(`/novels/${encodeURIComponent(novelId)}`);
    },
    [navigate],
  );

  const navigateToReader = useCallback(
    (
      novelId: string,
      chapterIndex: number,
      options?: NavigateToReaderOptions,
    ) => {
      const targetPath = `/novels/${encodeURIComponent(novelId)}/chapters/${chapterIndex}`;

      if (options?.fromBookshelfResume) {
        const detailPath = `/novels/${encodeURIComponent(novelId)}`;
        window.history.pushState(null, "", detailPath);
        window.history.pushState(null, "", targetPath);
        currentPathRef.current = targetPath;
        setPreviousPath(detailPath);
        novelOriginRef.current = "/";
        setNovelOrigin("/");
        setCurrentPath(targetPath);
      } else if (options?.replace) {
        window.history.replaceState(null, "", targetPath);
        currentPathRef.current = targetPath;
        setCurrentPath(targetPath);
      } else {
        navigate(targetPath);
      }
    },
    [navigate],
  );

  const navigateToSettings = useCallback(() => {
    navigate("/settings");
  }, [navigate]);

  const route = useMemo(() => matchRoute(currentPath), [currentPath]);

  const back = useCallback(() => {
    // 論理階層遷移制御
    // 1. 各話View (SCR-03: reader) -> 目次画面 (SCR-02: novel-detail)
    if (route.name === "reader") {
      const detailPath = `/novels/${encodeURIComponent(route.novelId)}`;
      navigate(detailPath);
      return;
    }

    // 2. 目次画面 (SCR-02: novel-detail) -> 直前探索元 (TR-07: /search または /ranking、デフォルトは "/")
    if (route.name === "novel-detail") {
      const origin =
        novelOriginRef.current === "/search" ||
        novelOriginRef.current === "/ranking"
          ? novelOriginRef.current
          : "/";
      novelOriginRef.current = null;
      setNovelOrigin(null);
      navigate(origin);
      return;
    }

    // 3. 下部タブ（設定 SCR-05, 検索 SCR-06, ランキング SCR-07） -> ホーム本棚画面 "/" (TR-12)
    if (
      route.name === "settings" ||
      route.name === "search" ||
      route.name === "ranking"
    ) {
      navigate("/");
      return;
    }

    // 4. 本棚画面 (SCR-01: bookshelf) -> ルート（何もしない、TR-13）
  }, [route, navigate]);

  const contextValue = useMemo<RouterContextValue>(
    () => ({
      currentPath,
      previousPath,
      novelOrigin,
      route,
      navigate,
      navigateToBookshelf,
      navigateToSearch,
      navigateToRanking,
      navigateToNovelDetail,
      navigateToReader,
      navigateToSettings,
      back,
    }),
    [
      currentPath,
      previousPath,
      novelOrigin,
      route,
      navigate,
      navigateToBookshelf,
      navigateToSearch,
      navigateToRanking,
      navigateToNovelDetail,
      navigateToReader,
      navigateToSettings,
      back,
    ],
  );

  return (
    <RouterContext.Provider value={contextValue}>
      {children}
    </RouterContext.Provider>
  );
};
