import { useState } from "react";
import type {
  UseWebViewImportOptions,
  UseWebViewImportReturn,
  ImportSuccessResult,
} from "../types";

export function useWebViewImport(
  options: UseWebViewImportOptions,
): UseWebViewImportReturn {
  const [url, setUrl] = useState(options.initialUrl ?? "");
  const [pageTitle] = useState("");
  const [currentCapturedUrl] = useState("");
  const [canImport] = useState(false);
  const [isLoading] = useState(false);
  const [isImporting] = useState(false);
  const [notice] = useState<string | null>(null);
  const [error] = useState<string | null>(null);

  const loadUrl = async () => false;
  const openNativeBrowser = async () => {};
  const importCurrentDom = async (): Promise<ImportSuccessResult | null> =>
    null;
  const goBack = () => {};

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
