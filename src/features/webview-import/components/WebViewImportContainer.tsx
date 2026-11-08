import React from "react";
import type { WebViewImportContainerProps } from "../types";
import { WebViewImportPage } from "./WebViewImportPage";

export const WebViewImportContainer: React.FC<
  WebViewImportContainerProps
> = () => {
  return (
    <WebViewImportPage
      url=""
      pageTitle=""
      currentCapturedUrl=""
      canImport={false}
      isLoading={false}
      isImporting={false}
      notice={null}
      error={null}
      onUrlChange={() => {}}
      onNavigateUrl={() => {}}
      onOpenNativeBrowser={() => {}}
      onImportCurrentDom={() => {}}
      onBack={() => {}}
    />
  );
};
