import type { BottomTab } from "../../shared/ui/BottomTabBar";
import type { HttpClientBridge } from "../../bridges/http/types";
import type { WebViewDomBridge } from "../../bridges/webview/types";
import type { NovelRepository, ChapterRepository } from "../../storage/types";
import type { ParserRegistry } from "../../parsers/parserRegistry";
import type { SyncEngine } from "../cloud-sync/services/syncEngine";
import type { fetchFullNovelIndex } from "../../parsers/fetchFullNovelIndex";

/**
 * DOM インポート成功結果（Issue #269 / AC-WV-05, AC-WV-06 / TR-11）
 */
export type ImportSuccessResult =
  | { type: "novel"; novelId: string }
  | { type: "chapter"; novelId: string; chapterIndex: number };

/**
 * useWebViewImport フックのオプション
 */
export interface UseWebViewImportOptions {
  initialUrl?: string;
  initialNovelId?: string;
  initialChapterIndex?: number;
  webViewDomBridge: WebViewDomBridge;
  novelRepository: NovelRepository;
  chapterRepository: ChapterRepository;
  parserRegistry: ParserRegistry;
  httpClient?: HttpClientBridge;
  syncEngine?: SyncEngine | null;
  fetchFullNovelIndex?: typeof fetchFullNovelIndex;
  onImportComplete?: (result: ImportSuccessResult) => void;
  onNavigateBack?: () => void;
}

/**
 * useWebViewImport フックの返却値インターフェース
 */
export interface UseWebViewImportReturn {
  url: string;
  setUrl: (url: string) => void;
  pageTitle: string;
  currentCapturedUrl: string;
  canImport: boolean;
  isLoading: boolean;
  isImporting: boolean;
  notice: string | null;
  error: string | null;
  loadUrl: (targetUrl?: string) => Promise<boolean>;
  openNativeBrowser: () => Promise<void>;
  importCurrentDom: () => Promise<ImportSuccessResult | null>;
  goBack: () => void;
}

/**
 * 内蔵ブラウザ・DOMインポート画面 Presentational コンポーネント（WebViewImportPage）Props
 */
export interface WebViewImportPageProps {
  url: string;
  pageTitle: string;
  currentCapturedUrl: string;
  canImport: boolean;
  isLoading: boolean;
  isImporting: boolean;
  notice: string | null;
  error: string | null;
  activeTab?: BottomTab;
  onUrlChange: (url: string) => void;
  onNavigateUrl: () => void | Promise<void>;
  onOpenNativeBrowser: () => void | Promise<void>;
  onImportCurrentDom: () => void | Promise<void>;
  onBack: () => void;
  onSelectBookshelf?: () => void;
  onSelectSearch?: () => void;
  onSelectRanking?: () => void;
  onSelectSettings?: () => void;
}

/**
 * 内蔵ブラウザ・DOMインポート画面 Container コンポーネント（WebViewImportContainer）Props
 */
export interface WebViewImportContainerProps {
  initialUrl?: string;
  novelId?: string;
  chapterIndex?: number;
  activeTab?: BottomTab;
  onBack?: () => void;
  onImportSuccess?: (result: ImportSuccessResult) => void;
}
