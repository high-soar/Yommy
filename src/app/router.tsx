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
  | { name: "ranking"; path: "/ranking" }
  | {
      name: "browser";
      path: string;
      url: string;
      novelId?: string;
      chapterIndex?: number;
      originPath?: string;
    };

export interface NavigateToReaderOptions {
  replace?: boolean;
  fromBookshelfResume?: boolean;
}

export interface NavigateToBrowserOptions {
  novelId?: string;
  chapterIndex?: number;
  originPath?: string;
  replace?: boolean;
}

export interface RouterContextValue {
  currentPath: string;
  previousPath?: string;
  novelOrigin: string | null;
  settingsOrigin: string | null;
  browserOrigin: string | null;
  route: AppRoute;
  navigate: (path: string) => void;
  navigateToBookshelf: () => void;
  navigateToSearch: () => void;
  navigateToRanking: () => void;
  navigateToNovelDetail: (novelId: string, origin?: string) => void;
  navigateToReader: (
    novelId: string,
    chapterIndex: number,
    options?: NavigateToReaderOptions,
  ) => void;
  navigateToSettings: () => void;
  navigateToBrowser: (url: string, options?: NavigateToBrowserOptions) => void;
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

  // クエリパラメータを分離してパス名を照合
  const [pathnameRaw, searchRaw] = normalized.split("?");
  const pathname =
    pathnameRaw.length > 1 && pathnameRaw.endsWith("/")
      ? pathnameRaw.slice(0, -1)
      : pathnameRaw;

  // SCR-04: 内蔵ブラウザ画面 (/browser)
  if (pathname === "/browser") {
    const params = new URLSearchParams(searchRaw ?? "");
    const url = params.get("url") ?? "";
    const rawNovelId = params.get("novelId");
    const novelId = rawNovelId
      ? safeDecodeURIComponent(rawNovelId).trim()
      : undefined;
    const rawChapter = params.get("chapterIndex");
    const parsedChapter = rawChapter ? parseInt(rawChapter, 10) : undefined;
    const chapterIndex =
      parsedChapter !== undefined &&
      Number.isFinite(parsedChapter) &&
      parsedChapter > 0
        ? parsedChapter
        : undefined;
    const rawOrigin = params.get("originPath");
    const originPath = rawOrigin
      ? safeDecodeURIComponent(rawOrigin).trim()
      : undefined;

    return {
      name: "browser",
      path: normalized,
      url,
      ...(novelId && novelId.length > 0 ? { novelId } : {}),
      ...(chapterIndex !== undefined ? { chapterIndex } : {}),
      ...(originPath && originPath.length > 0 ? { originPath } : {}),
    };
  }

  // SCR-05: 設定画面 (/settings)
  if (pathname === "/settings") {
    return { name: "settings", path: "/settings" };
  }

  // SCR-06: 検索画面 (/search)
  if (pathname === "/search") {
    return { name: "search", path: "/search" };
  }

  // SCR-07: ランキング画面 (/ranking)
  if (pathname === "/ranking") {
    return { name: "ranking", path: "/ranking" };
  }

  // SCR-03: リーダー画面 (/novels/:novelId/chapters/:chapterIndex)
  const readerMatch = pathname.match(READER_ROUTE_REGEX);
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
  const detailMatch = pathname.match(NOVEL_DETAIL_ROUTE_REGEX);
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
    resolveInitialPath(
      initialPath,
      `${window.location.pathname}${window.location.search}`,
    ),
  );
  const currentPathRef = useRef<string>(currentPath);
  const [previousPath, setPreviousPath] = useState<string | undefined>(
    undefined,
  );
  const previousPathRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    previousPathRef.current = previousPath;
  }, [previousPath]);
  const [novelOrigin, setNovelOrigin] = useState<string | null>(null);
  const novelOriginRef = useRef<string | null>(null);
  const [settingsOrigin, setSettingsOrigin] = useState<string | null>(null);
  const settingsOriginRef = useRef<string | null>(null);
  const [browserOrigin, setBrowserOrigin] = useState<string | null>(null);
  const browserOriginRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialPath !== undefined) {
      currentPathRef.current = initialPath;
      if (!initialPath.startsWith("/novels/")) {
        novelOriginRef.current = null;
        setNovelOrigin(null);
      }
      settingsOriginRef.current = null;
      setSettingsOrigin(null);
      if (!initialPath.startsWith("/browser")) {
        browserOriginRef.current = null;
        setBrowserOrigin(null);
      }
      setCurrentPath(initialPath);
    }
  }, [initialPath]);

  useEffect(() => {
    const handlePopState = () => {
      const nextPath = `${window.location.pathname}${window.location.search}`;
      currentPathRef.current = nextPath;
      if (!nextPath.startsWith("/novels/")) {
        novelOriginRef.current = null;
        setNovelOrigin(null);
      }
      if (nextPath !== "/settings") {
        settingsOriginRef.current = null;
        setSettingsOrigin(null);
      }
      if (!nextPath.startsWith("/browser")) {
        browserOriginRef.current = null;
        setBrowserOrigin(null);
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

  const navigate = useCallback(
    (to: string, options?: { replace?: boolean }) => {
      if (currentPathRef.current === to) {
        return;
      }
      const current = currentPathRef.current;

      // settingsOrigin 管理: /settings への遷移時、直前が /novels/ (SCR-02 or SCR-03) であれば保持
      if (to === "/settings") {
        if (current.startsWith("/novels/")) {
          settingsOriginRef.current = current;
          setSettingsOrigin(current);
        } else {
          settingsOriginRef.current = null;
          setSettingsOrigin(null);
        }
      } else {
        settingsOriginRef.current = null;
        setSettingsOrigin(null);
      }

      // browserOrigin (TR-12 復帰元) 管理:
      // to が /browser の場合: originPath クエリがあればそれを優先、なければ直前パス（/browser 以外）を保持
      if (to.startsWith("/browser")) {
        const searchStr = to.split("?")[1] ?? "";
        const originParam = new URLSearchParams(searchStr).get("originPath");
        const explicitOrigin = originParam
          ? safeDecodeURIComponent(originParam).trim()
          : undefined;
        if (explicitOrigin) {
          browserOriginRef.current = explicitOrigin;
          setBrowserOrigin(explicitOrigin);
        } else if (!current.startsWith("/browser")) {
          browserOriginRef.current = current;
          setBrowserOrigin(current);
        }
      } else if (to !== "/settings") {
        browserOriginRef.current = null;
        setBrowserOrigin(null);
      }

      // novelOrigin (TR-07 探索元) 管理:
      // to が /novels/ の場合: 直前が /search または /ranking であれば探索元としてセット
      // ※ただし、/settings から /novels/ への復帰時や明示的に origin が設定済みの場合は上書きしない
      // R1-48: /browser からの遷移時も探索元として誤セットしない
      if (to.startsWith("/novels/")) {
        if (
          !novelOriginRef.current &&
          !current.startsWith("/novels/") &&
          current !== "/settings" &&
          !current.startsWith("/browser")
        ) {
          novelOriginRef.current = current;
          setNovelOrigin(current);
        }
      } else if (to !== "/settings" && !to.startsWith("/browser")) {
        // /settings や /browser への一時退避以外で /novels/ から離脱した場合は探索元をクリア
        novelOriginRef.current = null;
        setNovelOrigin(null);
      }

      if (options?.replace) {
        window.history.replaceState(null, "", to);
      } else {
        window.history.pushState(null, "", to);
      }
      currentPathRef.current = to;
      previousPathRef.current = current;
      setCurrentPath((prev) => {
        setPreviousPath(prev);
        return to;
      });
    },
    [],
  );

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
    (novelId: string, origin?: string) => {
      if (origin) {
        novelOriginRef.current = origin;
        setNovelOrigin(origin);
      }
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
        settingsOriginRef.current = null;
        setSettingsOrigin(null);
        setCurrentPath(targetPath);
      } else if (options?.replace) {
        window.history.replaceState(null, "", targetPath);
        currentPathRef.current = targetPath;
        settingsOriginRef.current = null;
        setSettingsOrigin(null);
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

  const navigateToBrowser = useCallback(
    (url: string, options?: NavigateToBrowserOptions) => {
      const params = new URLSearchParams();
      params.set("url", url);
      if (options?.novelId) {
        params.set("novelId", options.novelId);
      }
      if (options?.chapterIndex !== undefined) {
        params.set("chapterIndex", String(options.chapterIndex));
      }
      if (options?.originPath) {
        params.set("originPath", options.originPath);
      }
      const targetPath = `/browser?${params.toString()}`;

      if (options?.replace) {
        if (options?.originPath) {
          browserOriginRef.current = options.originPath;
          setBrowserOrigin(options.originPath);
        } else if (!currentPathRef.current.startsWith("/browser")) {
          browserOriginRef.current = currentPathRef.current;
          setBrowserOrigin(currentPathRef.current);
        }
        window.history.replaceState(null, "", targetPath);
        currentPathRef.current = targetPath;
        setCurrentPath((prev) => {
          setPreviousPath(prev);
          return targetPath;
        });
      } else {
        navigate(targetPath);
      }
    },
    [navigate],
  );

  const route = useMemo(() => matchRoute(currentPath), [currentPath]);

  const back = useCallback(() => {
    let target: string | null = null;

    // 論理階層遷移制御
    // 1. 各話View (SCR-03: reader) -> 目次画面 (SCR-02: novel-detail)
    if (route.name === "reader") {
      target = `/novels/${encodeURIComponent(route.novelId)}`;
    } else if (route.name === "novel-detail") {
      // 2. 目次画面 (SCR-02: novel-detail) -> 直前探索元 (TR-07: /search または /ranking、デフォルトは "/")
      const origin =
        novelOriginRef.current === "/search" ||
        novelOriginRef.current === "/ranking"
          ? novelOriginRef.current
          : "/";
      novelOriginRef.current = null;
      setNovelOrigin(null);
      target = origin;
    } else if (route.name === "settings") {
      // 3. 設定画面 (SCR-05) -> 直前画面（リーダー SCR-03、作品詳細 SCR-02）またはホーム本棚画面 "/" (TR-12)
      if (
        settingsOriginRef.current &&
        settingsOriginRef.current.startsWith("/novels/")
      ) {
        const origin = settingsOriginRef.current;
        settingsOriginRef.current = null;
        setSettingsOrigin(null);
        target = origin;
      } else {
        settingsOriginRef.current = null;
        setSettingsOrigin(null);
        target = "/";
      }
    } else if (route.name === "search" || route.name === "ranking") {
      // 4. 検索画面 (SCR-06) / ランキング画面 (SCR-07) -> ホーム本棚画面 "/" (TR-12)
      target = "/";
    } else if (route.name === "browser") {
      // 5. 内蔵ブラウザ画面 (SCR-04: browser) -> 直前画面（originPath / browserOrigin / 作品詳細 SCR-02 / ホーム本棚 SCR-01）(TR-12)
      target =
        route.originPath ??
        browserOriginRef.current ??
        (route.novelId ? `/novels/${encodeURIComponent(route.novelId)}` : "/");
      browserOriginRef.current = null;
      setBrowserOrigin(null);
    }
    // 6. 本棚画面 (SCR-01: bookshelf) -> ルート（何もしない、TR-13）

    if (target) {
      // R1-25: 戻り先が直前の履歴エントリと一致する場合は replaceState で戻し、履歴の無限増殖を防止
      const shouldReplace = target === previousPathRef.current;
      navigate(target, { replace: shouldReplace });
    }
  }, [route, navigate]);

  const contextValue = useMemo<RouterContextValue>(
    () => ({
      currentPath,
      previousPath,
      novelOrigin,
      settingsOrigin,
      browserOrigin,
      route,
      navigate,
      navigateToBookshelf,
      navigateToSearch,
      navigateToRanking,
      navigateToNovelDetail,
      navigateToReader,
      navigateToSettings,
      navigateToBrowser,
      back,
    }),
    [
      currentPath,
      previousPath,
      novelOrigin,
      settingsOrigin,
      browserOrigin,
      route,
      navigate,
      navigateToBookshelf,
      navigateToSearch,
      navigateToRanking,
      navigateToNovelDetail,
      navigateToReader,
      navigateToSettings,
      navigateToBrowser,
      back,
    ],
  );

  return (
    <RouterContext.Provider value={contextValue}>
      {children}
    </RouterContext.Provider>
  );
};
