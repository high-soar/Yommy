/* eslint-disable react-refresh/only-export-components */
import React, { createContext } from "react";

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

export function safeDecodeURIComponent(str: string): string {
  return str;
}

export function matchRoute(path: string): AppRoute {
  void path;
  return { name: "bookshelf", path: "/" };
}

export const RouterContext = createContext<RouterContextValue | null>(null);

export function useRouter(): RouterContextValue {
  throw new Error("not implemented");
}

export const RouterProvider: React.FC<RouterProviderProps> = ({ children }) => {
  return <>{children}</>;
};
