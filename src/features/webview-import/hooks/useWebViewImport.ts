import { useState, useCallback, useEffect, useRef } from "react";
import type {
  UseWebViewImportOptions,
  UseWebViewImportReturn,
  ImportSuccessResult,
} from "../types";
import type { NovelRecord } from "../../../storage/types";
import type { CapturedDomResult } from "../../../bridges/webview/types";
import { fetchFullNovelIndex as defaultFetchFullNovelIndex } from "../../../parsers/fetchFullNovelIndex";

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
  initialChapterIndex: _initialChapterIndex,
  webViewDomBridge,
  novelRepository,
  chapterRepository,
  queueRepository,
  parserRegistry,
  httpClient,
  syncEngine,
  cacheScheduler,
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
  const isMountedRef = useRef(true);

  const syncSavedChapterWithScheduler = useCallback(
    async (targetNovelId: string, savedChapterIndex: number): Promise<void> => {
      if (queueRepository) {
        await queueRepository.deleteByNovelAndChapters(targetNovelId, [
          savedChapterIndex,
        ]);
      }
      if (cacheScheduler) {
        await cacheScheduler.syncNovelProgress(targetNovelId);
      }
    },
    [queueRepository, cacheScheduler],
  );

  // 画面マウント・アンマウント管理および Bridge クリーンアップ（R1-11）
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      void Promise.resolve(webViewDomBridge.close()).catch(() => {});
    };
  }, [webViewDomBridge]);

  const loadUrl = useCallback(
    async (targetUrl?: string): Promise<boolean> => {
      const toLoad = (targetUrl !== undefined ? targetUrl : url).trim();
      if (!toLoad) {
        return false;
      }

      // 危険スキーム遮断（https: 以外を拒否） (R2-08)
      if (!webViewDomBridge.canHandle(toLoad)) {
        if (isMountedRef.current) {
          setError("安全でない URL スキームは開けません");
          setCanImport(false);
        }
        return false;
      }

      const parser = parserRegistry.getParser(toLoad);
      const isSupported = Boolean(parser && parser.canParse(toLoad));

      if (isMountedRef.current) {
        setError(null);
        setNotice(null);
        setUrl(toLoad);
        setCurrentCapturedUrl(toLoad);
        setCanImport(isSupported);
      }

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
      if (isMountedRef.current) {
        setError("安全でない URL スキームは開けません");
      }
      return;
    }

    try {
      if (isMountedRef.current) {
        setError(null);
      }
      await webViewDomBridge.open({
        url: target,
        title: pageTitle || undefined,
      });
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(
          err instanceof Error ? err.message : "ブラウザの起動に失敗しました",
        );
      }
    }
  }, [url, pageTitle, webViewDomBridge]);

  const importCapturedDomInternal = useCallback(
    async (
      captured: CapturedDomResult,
    ): Promise<ImportSuccessResult | null> => {
      if (!isMountedRef.current) return null;

      setIsImporting(true);
      setIsLoading(true);
      setError(null);
      setNotice(null);

      let result: ImportSuccessResult | null = null;

      try {
        if (isMountedRef.current) {
          setPageTitle(captured.title);
          setCurrentCapturedUrl(captured.url);
        }

        const fetchFn = fetchFullNovelIndex ?? defaultFetchFullNovelIndex;

        const parser = parserRegistry.getParser(captured.url);
        if (!parser || !parser.canParse(captured.url)) {
          if (isMountedRef.current) {
            setError("対応外のページです");
            setCanImport(false);
          }
        } else {
          if (isMountedRef.current) {
            setCanImport(true);
          }
          const isChapter = isChapterUrl(captured.url, parser.siteType);

          if (!isChapter) {
            // 1. 作品トップ（目次）インポート
            let novelIndex = parser.parseNovelIndex(
              captured.html,
              captured.url,
            );

            // 複数ページ目次判定（nextTocPageUrl !== null または URL にページ指定がある場合） (R1-01)
            const hasMultiplePages = Boolean(
              novelIndex.nextTocPageUrl !== null ||
              /[?&]p=\d+/i.test(captured.url),
            );

            if (hasMultiplePages) {
              if (!httpClient) {
                if (isMountedRef.current) {
                  setError(
                    "複数ページ目次の取得にはネットワーク接続が必要です",
                  );
                }
                return null;
              }
              try {
                novelIndex = await fetchFn(
                  httpClient,
                  parser,
                  novelIndex.canonicalUrl,
                );
              } catch {
                if (isMountedRef.current) {
                  setError("複数ページ目次の取得に失敗しました");
                }
                return null;
              }
            }

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
              await syncSavedChapterWithScheduler(savedNovel.id, 1);
            }

            if (syncEngine) {
              await syncEngine.notifyChanged();
            }

            result = {
              type: "novel",
              novelId: savedNovel.id,
            };
            if (isMountedRef.current) {
              setNotice("作品目次を取り込みました");
              onImportComplete?.(result);
            }
          } else {
            // 2. 各話エピソード（本文）インポート
            const parsedChapter = parser.parseChapterContent(
              captured.html,
              captured.url,
            );
            const canonicalUrl = parser.normalizeWorkUrl(captured.url);

            let targetNovel: NovelRecord | null = null;
            // R1-01: initialNovelId が指定されていても canonicalUrl が一致する場合のみ対象とする
            if (initialNovelId) {
              const novel = await novelRepository.getNovelById(initialNovelId);
              if (novel && novel.canonicalUrl === canonicalUrl) {
                targetNovel = novel;
              }
            }

            if (!targetNovel) {
              const list = await novelRepository.listNovels();
              const found = list.find((n) => n.canonicalUrl === canonicalUrl);
              if (found) {
                targetNovel = await novelRepository.getNovelById(found.id);
              }
            }

            // 未登録作品の場合は目次自動補完を試行（R1-12: httpClient の安全な存在チェック, R2-21: fetchFn フォールバック統一）
            if (!targetNovel) {
              if (httpClient) {
                try {
                  const fullIndex = await fetchFn(
                    httpClient,
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
                if (isMountedRef.current) {
                  setError("先に作品トップ（目次）ページを取り込んでください");
                }
                return null;
              }
            }

            // chapterIndex の特定（R1-01: 話数不一致時の安全な処理）
            let chapters = await chapterRepository.listChaptersByNovelId(
              targetNovel.id,
            );
            let matched = chapters.find(
              (c) => c.remoteChapterId === parsedChapter.remoteChapterId,
            );

            // 目次にない場合、目次自動更新を試行 (R2-21: fetchFn フォールバック統一)
            if (!matched && httpClient) {
              try {
                const fullIndex = await fetchFn(
                  httpClient,
                  parser,
                  canonicalUrl,
                );
                const now = new Date().toISOString();
                await novelRepository.upsertNovelWithToc(fullIndex, now);
                chapters = await chapterRepository.listChaptersByNovelId(
                  targetNovel.id,
                );
                matched = chapters.find(
                  (c) => c.remoteChapterId === parsedChapter.remoteChapterId,
                );
              } catch {
                // 自動更新失敗時はそのまま
              }
            }

            let chapterIndex: number;
            if (matched) {
              chapterIndex = matched.chapterIndex;
            } else {
              if (isMountedRef.current) {
                setError(
                  "該当エピソードが作品目次に見つかりません。先に作品トップ（目次）を取り込んでください",
                );
              }
              return null;
            }

            const now = new Date().toISOString();
            await chapterRepository.saveChapterBody(
              targetNovel.id,
              chapterIndex,
              parsedChapter,
              now,
            );
            await syncSavedChapterWithScheduler(targetNovel.id, chapterIndex);

            if (syncEngine) {
              await syncEngine.notifyChanged();
            }

            result = {
              type: "chapter",
              novelId: targetNovel.id,
              chapterIndex,
            };
            if (isMountedRef.current) {
              setNotice("本文を取り込みました");
              onImportComplete?.(result);
            }
          }
        }
      } catch (err: unknown) {
        if (isMountedRef.current) {
          setError(
            err instanceof Error ? err.message : "インポートに失敗しました",
          );
        }
        result = null;
      } finally {
        if (isMountedRef.current) {
          setIsImporting(false);
          setIsLoading(false);
        }
      }

      return result;
    },
    [
      parserRegistry,
      novelRepository,
      chapterRepository,
      syncEngine,
      syncSavedChapterWithScheduler,
      initialNovelId,
      fetchFullNovelIndex,
      httpClient,
      onImportComplete,
    ],
  );

  // ネイティブ内蔵ブラウザからの DOM キャプチャ通知連携（R1-10）
  useEffect(() => {
    if (!webViewDomBridge.addDomCapturedListener) {
      return;
    }
    const unsubscribe = webViewDomBridge.addDomCapturedListener((captured) => {
      if (!isMountedRef.current) return;
      setUrl(captured.url);
      setCurrentCapturedUrl(captured.url);
      setPageTitle(captured.title);
      void importCapturedDomInternal(captured);
    });
    return () => {
      unsubscribe();
    };
  }, [webViewDomBridge, importCapturedDomInternal]);

  const importCurrentDom =
    useCallback(async (): Promise<ImportSuccessResult | null> => {
      if (!isMountedRef.current) return null;
      try {
        const captured = await webViewDomBridge.captureDom();
        return await importCapturedDomInternal(captured);
      } catch (err: unknown) {
        if (isMountedRef.current) {
          setError(
            err instanceof Error ? err.message : "インポートに失敗しました",
          );
        }
        return null;
      }
    }, [webViewDomBridge, importCapturedDomInternal]);

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
