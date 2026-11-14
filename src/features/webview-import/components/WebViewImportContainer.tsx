import React, { useCallback } from "react";
import type {
  WebViewImportContainerProps,
  ImportSuccessResult,
} from "../types";
import { useServices } from "../../../app/ServiceProvider";
import { useRouter } from "../../../app/router";
import { useWebViewImport } from "../hooks/useWebViewImport";
import { WebViewImportPage } from "./WebViewImportPage";

export const WebViewImportContainer: React.FC<WebViewImportContainerProps> = ({
  initialUrl,
  novelId,
  chapterIndex,
  activeTab = "bookshelf",
  onBack,
  onImportSuccess,
}) => {
  const router = useRouter();
  const {
    webViewDomBridge,
    novelRepository,
    chapterRepository,
    queueRepository,
    parserRegistry,
    httpClient,
    syncEngine,
    cacheScheduler,
    fetchFullNovelIndex,
  } = useServices();

  const handleImportComplete = useCallback(
    (result: ImportSuccessResult) => {
      if (onImportSuccess) {
        onImportSuccess(result);
      } else {
        if (result.type === "novel") {
          router.navigateToNovelDetail(result.novelId);
        } else {
          router.navigateToReader(result.novelId, result.chapterIndex);
        }
      }
    },
    [onImportSuccess, router],
  );

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  }, [onBack, router]);

  const {
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
  } = useWebViewImport({
    initialUrl,
    initialNovelId: novelId,
    initialChapterIndex: chapterIndex,
    webViewDomBridge,
    novelRepository,
    chapterRepository,
    queueRepository,
    parserRegistry,
    httpClient,
    syncEngine,
    cacheScheduler,
    fetchFullNovelIndex,
    onImportComplete: handleImportComplete,
    onNavigateBack: handleBack,
  });

  return (
    <WebViewImportPage
      url={url}
      pageTitle={pageTitle}
      currentCapturedUrl={currentCapturedUrl}
      canImport={canImport}
      isLoading={isLoading}
      isImporting={isImporting}
      notice={notice}
      error={error}
      activeTab={activeTab}
      onUrlChange={setUrl}
      onNavigateUrl={() => void loadUrl()}
      onOpenNativeBrowser={openNativeBrowser}
      onImportCurrentDom={() => void importCurrentDom()}
      onBack={goBack}
      onSelectBookshelf={router.navigateToBookshelf}
      onSelectSearch={router.navigateToSearch}
      onSelectRanking={router.navigateToRanking}
      onSelectSettings={router.navigateToSettings}
    />
  );
};
