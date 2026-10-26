import { useCallback, useEffect, useState } from "react";
import { useServices } from "../../../app/ServiceProvider";
import type { NovelSummary } from "../../../storage/types";
import type { NovelParser } from "../../../parsers/types";
import type { ParserRegistry } from "../../../parsers/parserRegistry";

export interface UseBookshelfResult {
  novels: NovelSummary[];
  isLoading: boolean;
  isDialogOpen: boolean;
  isSubmitting: boolean;
  dialogError: string | null;
  error: string | null;
  openDialog: () => void;
  closeDialog: () => void;
  addNovelByUrl: (url: string) => Promise<boolean>;
  reloadNovels: () => Promise<void>;
}

export const INVALID_URL_ERROR_MESSAGE =
  "対応していないURLです。カクヨムの作品URLを入力してください。";
export const DEFAULT_FETCH_ERROR_MESSAGE = "作品情報の取得に失敗しました";

/**
 * URL文字列を検証し、パーサーおよび正規化された作品トップURLを解決する。
 * 未対応または不正なURLの場合は null を返す。
 */
function resolveParserAndUrl(
  parserRegistry: ParserRegistry,
  rawUrl: string,
): { parser: NovelParser; normalizedUrl: string } | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parser = parserRegistry.requireParser(trimmed);
    const normalizedUrl = parser.normalizeWorkUrl(trimmed);
    return { parser, normalizedUrl };
  } catch {
    return null;
  }
}

/**
 * 例外オブジェクトからユーザー向けエラーメッセージを安全に抽出する
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return DEFAULT_FETCH_ERROR_MESSAGE;
}

/**
 * 本棚画面（SCR-01）の登録済み作品一覧・URL作品登録モーダル状態を管理するカスタムフック
 */
export function useBookshelf(): UseBookshelfResult {
  const { httpClient, parserRegistry, novelRepository, isReady } =
    useServices();

  const [novels, setNovels] = useState<NovelSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 初回ロード
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    novelRepository
      .listNovels()
      .then((list) => {
        if (!cancelled) {
          setNovels(list);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isReady, novelRepository]);

  const openDialog = useCallback(() => {
    setIsDialogOpen(true);
    setDialogError(null);
  }, []);

  const closeDialog = useCallback(() => {
    if (isSubmitting) return;
    setIsDialogOpen(false);
    setDialogError(null);
  }, [isSubmitting]);

  const reloadNovels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await novelRepository.listNovels();
      setNovels(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [novelRepository]);

  const addNovelByUrl = useCallback(
    async (url: string): Promise<boolean> => {
      if (isSubmitting) {
        return false;
      }

      const resolved = resolveParserAndUrl(parserRegistry, url);
      if (!resolved) {
        setDialogError(INVALID_URL_ERROR_MESSAGE);
        return false;
      }

      const { parser, normalizedUrl } = resolved;
      setIsSubmitting(true);
      setDialogError(null);

      let isSuccess = false;
      try {
        const response = await httpClient.getHtml({ url: normalizedUrl });
        const parsedIndex = parser.parseNovelIndex(
          response.html,
          normalizedUrl,
        );
        await novelRepository.upsertNovelWithToc(
          parsedIndex,
          new Date().toISOString(),
        );
        const updatedNovels = await novelRepository.listNovels();
        setNovels(updatedNovels);
        setIsDialogOpen(false);
        setDialogError(null);
        isSuccess = true;
      } catch (err: unknown) {
        setDialogError(extractErrorMessage(err));
        isSuccess = false;
      } finally {
        setIsSubmitting(false);
      }
      return isSuccess;
    },
    [isSubmitting, parserRegistry, httpClient, novelRepository],
  );

  return {
    novels,
    isLoading,
    isDialogOpen,
    isSubmitting,
    dialogError,
    error,
    openDialog,
    closeDialog,
    addNovelByUrl,
    reloadNovels,
  };
}
