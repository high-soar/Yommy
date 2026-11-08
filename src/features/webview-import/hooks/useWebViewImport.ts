import { useState, useCallback, useEffect, useRef } from "react";
import type {
  UseWebViewImportOptions,
  UseWebViewImportReturn,
  ImportSuccessResult,
} from "../types";
import type { NovelRecord } from "../../../storage/types";

/**
 * 対象 URL が各話エピソード（本文）ページか判定する
 */
export function isChapterUrl(url: string, siteType: string): boolean {
  if (siteType === "kakuyomu") {
    return /\/works\/[^/]+\/episodes\/[0-9]+/.test(url);
  }
  if (siteType === "narou") {
    return /\/n\d+[a-z0-9]*\/\d+(?:\/|$)/i.test(url);
  }
  return false;
}

/**
 * 内蔵ブラウザ画面の状態管理、URL 検証、DOM キャプチャ・インポート保存フック
 */
export function useWebViewImport({
  initialUrl,
  initialNovelId,
  initialChapterIndex,
  webViewDomBridge,
  novelRepository,
  chapterRepository,
  parserRegistry,
  httpClient,
  syncEngine,
  fetchFullNovelIndex,
  onImportComplete,
  onNavigateBack,
}: UseWebViewImportOptions): UseWebViewImportReturn {
  const [url, setUrl] = useState<string>(initialUrl ?? "");
  const [pageTitle, setPageTitle] = useState<string>("");
  const [currentCapturedUrl, setCurrentCapturedUrl] = useState<string>(
    initialUrl ?? "",
  );
  const [canImport, setCanImport] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initialUrlLoadedRef = useRef(false);

  const loadUrl = useCallback(
    async (targetUrl?: string): Promise<boolean> => {
      const toLoad = (targetUrl !== undefined ? targetUrl : url).trim();
      if (!toLoad) {
        return false;
      }

      // 危険スキーム遮断（http: / https: 以外を拒否）
      if (!webViewDomBridge.canHandle(toLoad)) {
        setError("安全でない URL スキームは開けません");
        setCanImport(false);
        return false;
      }

      setError(null);
      setNotice(null);

      const parser = parserRegistry.getParser(toLoad);
      const isSupported = Boolean(parser && parser.canParse(toLoad));

      setUrl(toLoad);
      setCurrentCapturedUrl(toLoad);
      setCanImport(isSupported);

      return true;
    },
    [url, webViewDomBridge, parserRegistry],
  );

  useEffect(() => {
    if (!initialUrlLoadedRef.current && initialUrl) {
      initialUrlLoadedRef.current = true;
      void loadUrl(initialUrl);
    }
  }, [initialUrl, loadUrl]);

  const openNativeBrowser = useCallback(async (): Promise<void> => {
    const target = url.trim();
    if (!webViewDomBridge.canHandle(target)) {
      setError("安全でない URL スキームは開けません");
      return;
    }

    try {
      setError(null);
      await webViewDomBridge.open({
        url: target,
        title: pageTitle || undefined,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "ブラウザの起動に失敗しました",
      );
    }
  }, [url, pageTitle, webViewDomBridge]);

  const importCurrentDom =
    useCallback(async (): Promise<ImportSuccessResult | null> => {
      setIsImporting(true);
      setIsLoading(true);
      setError(null);
      setNotice(null);

      let result: ImportSuccessResult | null = null;

      try {
        const captured = await webViewDomBridge.captureDom();
        setPageTitle(captured.title);
        setCurrentCapturedUrl(captured.url);

        const parser = parserRegistry.getParser(captured.url);
        if (!parser || !parser.canParse(captured.url)) {
          setError("対応外のページです");
        } else {
          const isChapter = isChapterUrl(captured.url, parser.siteType);

          if (!isChapter) {
            // 1. 作品トップ（目次）インポート
            const novelIndex = parser.parseNovelIndex(
              captured.html,
              captured.url,
            );
            const now = new Date().toISOString();
            const savedNovel = await novelRepository.upsertNovelWithToc(
              novelIndex,
              now,
            );

            // なろう短編（1話完結で同一ページに本文が含まれる場合）の本文同時保存
            const isShortStory =
              novelIndex.siteType === "narou" &&
              novelIndex.chapters.length === 1 &&
              (novelIndex.chapters[0].url === novelIndex.canonicalUrl ||
                captured.html.includes('id="novel_honbun"') ||
                captured.html.includes("p-novel__body"));

            if (isShortStory) {
              const parsedChapter = parser.parseChapterContent(
                captured.html,
                captured.url,
              );
              await chapterRepository.saveChapterBody(
                savedNovel.id,
                1,
                parsedChapter,
                now,
              );
            }

            if (syncEngine) {
              await syncEngine.notifyChanged();
            }

            result = {
              type: "novel",
              novelId: savedNovel.id,
            };
            setNotice("作品目次を取り込みました");
            if (onImportComplete) {
              onImportComplete(result);
            }
          } else {
            // 2. 各話エピソード（本文）インポート
            const parsedChapter = parser.parseChapterContent(
              captured.html,
              captured.url,
            );
            const canonicalUrl = parser.normalizeWorkUrl(captured.url);

            let targetNovel: NovelRecord | null = null;
            if (initialNovelId) {
              targetNovel = await novelRepository.getNovelById(initialNovelId);
            }

            if (!targetNovel) {
              const list = await novelRepository.listNovels();
              const found = list.find((n) => n.canonicalUrl === canonicalUrl);
              if (found) {
                targetNovel = await novelRepository.getNovelById(found.id);
              }
            }

            // 未登録作品の場合は目次自動補完を試行
            if (!targetNovel) {
              if (fetchFullNovelIndex) {
                try {
                  const fullIndex = await fetchFullNovelIndex(
                    httpClient!,
                    parser,
                    canonicalUrl,
                  );
                  const now = new Date().toISOString();
                  targetNovel = await novelRepository.upsertNovelWithToc(
                    fullIndex,
                    now,
                  );
                } catch {
                  targetNovel = null;
                }
              }

              if (!targetNovel) {
                setError("先に作品トップ（目次）ページを取り込んでください");
              }
            }

            if (targetNovel) {
              // chapterIndex の特定
              const chapters = await chapterRepository.listChaptersByNovelId(
                targetNovel.id,
              );
              const matched = chapters.find(
                (c) => c.remoteChapterId === parsedChapter.remoteChapterId,
              );
              const chapterIndex = matched
                ? matched.chapterIndex
                : (initialChapterIndex ?? 1);

              const now = new Date().toISOString();
              await chapterRepository.saveChapterBody(
                targetNovel.id,
                chapterIndex,
                parsedChapter,
                now,
              );

              if (syncEngine) {
                await syncEngine.notifyChanged();
              }

              result = {
                type: "chapter",
                novelId: targetNovel.id,
                chapterIndex,
              };
              setNotice("本文を取り込みました");
              if (onImportComplete) {
                onImportComplete(result);
              }
            }
          }
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "インポートに失敗しました",
        );
        result = null;
      } finally {
        setIsImporting(false);
        setIsLoading(false);
      }

      return result;
    }, [
      webViewDomBridge,
      parserRegistry,
      novelRepository,
      chapterRepository,
      syncEngine,
      initialNovelId,
      initialChapterIndex,
      fetchFullNovelIndex,
      httpClient,
      onImportComplete,
    ]);

  const goBack = useCallback(() => {
    onNavigateBack?.();
  }, [onNavigateBack]);

  return {
    url,
    setUrl,
    pageTitle,
    currentCapturedUrl,
    canImport,
    isLoading,
    isImporting,
    notice,
    error,
    loadUrl,
    openNativeBrowser,
    importCurrentDom,
    goBack,
  };
}
