import React, { createContext, useContext, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";
import type { HttpClientBridge } from "../bridges/http/types";
import { MockHttpClient } from "../bridges/http/mockHttpClient";
import { CapacitorHttpClient } from "../bridges/http/capacitorHttpClient";
import type { AppBridge } from "../bridges/app/types";
import { MockAppBridge } from "../bridges/app/mockAppBridge";
import { CapacitorAppBridge } from "../bridges/app/capacitorAppBridge";
import type { ParserRegistry } from "../parsers/parserRegistry";
import { createDefaultParserRegistry } from "../parsers/parserRegistry";
import type { DatabaseAdapter } from "../storage/adapter/types";
import {
  createInMemoryDb,
  InMemoryDatabaseAdapter,
} from "../storage/adapter/inMemoryDb";
import { CapacitorSqliteAdapter } from "../storage/adapter/capacitorSqlite";
import { initializeDatabaseSchema } from "../storage/schema";
import type {
  NovelRepository,
  ChapterRepository,
  SettingsRepository,
  AppSettingsRepository,
  QueueRepository,
} from "../storage/types";
import { SqlNovelRepository } from "../storage/repositories/novelRepository";
import { SqlChapterRepository } from "../storage/repositories/chapterRepository";
import { SqlQueueRepository } from "../storage/repositories/queueRepository";
import { SqlSettingsRepository } from "../storage/repositories/settingsRepository";
import { SqlAppSettingsRepository } from "../storage/repositories/appSettingsRepository";
import type { CloudSyncBridge } from "../bridges/cloud-sync/types";
import { MockCloudSyncBridge } from "../bridges/cloud-sync/mockCloudSyncBridge";
import { CapacitorCloudSyncBridge } from "../bridges/cloud-sync/capacitorCloudSyncBridge";
import type { VolumeKeyBridge } from "../bridges/volume-key/types";
import { MockVolumeKeyBridge } from "../bridges/volume-key/mockVolumeKeyBridge";
import { CapacitorVolumeKeyBridge } from "../bridges/volume-key/capacitorVolumeKeyBridge";
import type { WebViewDomBridge } from "../bridges/webview/types";
import { MockWebViewDomBridge } from "../bridges/webview/mockWebViewDomBridge";
import { CapacitorWebViewDomBridge } from "../bridges/webview/capacitorWebViewDomBridge";
import { SyncEngine } from "../features/cloud-sync/services/syncEngine";
import { fetchFullNovelIndex } from "../parsers/fetchFullNovelIndex";
import workIndexHtml from "../parsers/kakuyomu/__fixtures__/work_index.html?raw";
import episodeContentHtml from "../parsers/kakuyomu/__fixtures__/episode_content.html?raw";
import searchApolloHtml from "../parsers/kakuyomu/__fixtures__/search_results_apollo.html?raw";
import rankingApolloHtml from "../parsers/kakuyomu/__fixtures__/ranking_results_apollo.html?raw";
import narouIndexSerializedHtml from "../parsers/narou/__fixtures__/work_index_serialized.html?raw";
import narouIndexPage2Html from "../parsers/narou/__fixtures__/work_index_page2.html?raw";
import narouEpisodeContentHtml from "../parsers/narou/__fixtures__/episode_content.html?raw";
import narouSearchResultsJson from "../parsers/narou/__fixtures__/search_results.json?raw";
import narouRankingResultsJson from "../parsers/narou/__fixtures__/ranking_results.json?raw";

const STORAGE_KEY = "yommy_sqlite_db_backup";

/**
 * アプリケーション共通のサービス（HTTP Bridge, Parser, Storage Repositories）の提供コンテキスト値
 */
export interface ServiceContextValue {
  httpClient: HttpClientBridge;
  parserRegistry: ParserRegistry;
  databaseAdapter: DatabaseAdapter;
  novelRepository: NovelRepository;
  chapterRepository: ChapterRepository;
  queueRepository: QueueRepository;
  settingsRepository: SettingsRepository;
  appSettingsRepository: AppSettingsRepository;
  appBridge: AppBridge;
  cloudSyncBridge: CloudSyncBridge;
  volumeKeyBridge: VolumeKeyBridge;
  webViewDomBridge: WebViewDomBridge;
  syncEngine?: SyncEngine;
  fetchFullNovelIndex?: typeof fetchFullNovelIndex;
  isReady: boolean;
  error: Error | null;
}

declare global {
  interface Window {
    __yommyServices?: ServiceContextValue;
  }
}

export const ServiceContext = createContext<ServiceContextValue | null>(null);

/**
 * ServiceContext から初期化済みの共通サービス群を取得するカスタムフック
 *
 * @throws ServiceProvider の配下外で呼び出された場合のエラー
 */
export function useServices(): ServiceContextValue {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error("useServices must be used within a ServiceProvider");
  }
  return context;
}

export interface ServiceProviderProps {
  children?: React.ReactNode;
  services?: Partial<Omit<ServiceContextValue, "isReady" | "error">>;
  fallback?: React.ReactNode | ((error: Error | null) => React.ReactNode);
}

export function getStoredDatabaseBinary(
  storage?: Storage | null,
): Uint8Array | undefined {
  const targetStorage = storage !== undefined ? storage : window?.localStorage;
  if (!targetStorage) {
    return undefined;
  }
  try {
    const raw = targetStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return undefined;
  }
}

export function persistDatabaseBinary(
  binary: Uint8Array,
  storage?: Storage | null,
): boolean {
  const targetStorage = storage !== undefined ? storage : window?.localStorage;
  if (!targetStorage) {
    return false;
  }
  try {
    let binaryStr = "";
    for (let i = 0; i < binary.byteLength; i++) {
      binaryStr += String.fromCharCode(binary[i]);
    }
    targetStorage.setItem(STORAGE_KEY, btoa(binaryStr));
    return true;
  } catch (err) {
    console.warn(
      "Failed to persist database binary to localStorage (possible QuotaExceededError):",
      err,
    );
    return false;
  }
}

const NAROU_RANKING_ONLY_ORDERS = new Set(["dailypoint", "monthlypoint"]);
const NAROU_SEARCH_ONLY_ORDERS = new Set(["new", "generalfirstup"]);
const NAROU_SEARCH_TYPES = new Set(["r", "er", "t", "ter"]);

export function createDefaultMockHttpClient(): MockHttpClient {
  const client = new MockHttpClient();
  client.setResponse(/^https:\/\/kakuyomu\.jp\/search/, (options) => ({
    status: 200,
    url: options.url,
    headers: {},
    html: searchApolloHtml,
  }));
  client.setResponse(/^https:\/\/kakuyomu\.jp\/rankings\//, (options) => ({
    status: 200,
    url: options.url,
    headers: {},
    html: rankingApolloHtml,
  }));
  client.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, (options) => {
    let html = workIndexHtml;
    if (options.url.includes("16817330658027210001")) {
      html = html
        .replaceAll("境界迷宮と異界の魔術師", "転生令嬢の異世界冒険譚")
        .replaceAll("小野崎", "カクヨム太郎");
    } else if (options.url.includes("16817330658027210101")) {
      html = html
        .replaceAll("境界迷宮と異界の魔術師", "ランキング1位作品：最強の剣士")
        .replaceAll("小野崎", "ランキング1位作家");
    } else if (options.url.includes("16817330658027210002")) {
      html = html
        .replaceAll("境界迷宮と異界の魔術師", "あいうえおの冒険")
        .replaceAll("小野崎", "作者A");
    }
    return {
      status: 200,
      url: options.url,
      headers: {},
      html,
    };
  });
  client.setResponse(
    /^https:\/\/kakuyomu\.jp\/works\/\d+\/episodes\/\d+/,
    (options) => ({
      status: 200,
      url: options.url,
      headers: {},
      html: episodeContentHtml,
    }),
  );
  client.setResponse(
    /^https:\/\/ncode\.syosetu\.com\/n\d+[a-z0-9]*\/?(\?.*)?$/i,
    (options) => {
      let html = options.url.includes("p=2")
        ? narouIndexPage2Html
        : narouIndexSerializedHtml;
      if (options.url.toLowerCase().includes("n1001aa")) {
        html = html
          .replaceAll("無職転生 - 異世界行ったら本気だす", "デイリー1位作品")
          .replaceAll("理不尽な孫の手", "ランキング作家A")
          .replaceAll("n9669bk", "n1001aa");
      }
      return {
        status: 200,
        url: options.url,
        headers: {},
        html,
      };
    },
  );
  client.setResponse(
    /^https:\/\/ncode\.syosetu\.com\/n\d+[a-z0-9]*\/\d+\/?/i,
    (options) => ({
      status: 200,
      url: options.url,
      headers: {},
      html: narouEpisodeContentHtml,
    }),
  );
  client.setResponse(
    /^https:\/\/api\.syosetu\.com\/novelapi\/api\//,
    (options) => {
      const urlObj = new URL(options.url);
      const order = urlObj.searchParams.get("order") ?? "";
      const type = urlObj.searchParams.get("type") ?? "";
      const isRankingRequest =
        window.location.pathname.startsWith("/ranking") ||
        NAROU_RANKING_ONLY_ORDERS.has(order);
      const hasSearchKeywords =
        urlObj.searchParams.has("word") || urlObj.searchParams.has("notword");
      const hasSearchOnlyParams =
        NAROU_SEARCH_ONLY_ORDERS.has(order) ||
        NAROU_SEARCH_TYPES.has(type) ||
        (urlObj.searchParams.get("genre") ?? "").includes("-");

      const isSearch =
        !isRankingRequest && (hasSearchKeywords || hasSearchOnlyParams);

      return {
        status: 200,
        url: options.url,
        headers: {},
        html: isSearch ? narouSearchResultsJson : narouRankingResultsJson,
      };
    },
  );
  return client;
}

/**
 * Android/iOS ネイティブ実行時の Capacitor SQLite アダプターを生成・初期化する
 */
export async function createDefaultNativeSqliteAdapter(): Promise<CapacitorSqliteAdapter> {
  const sqliteConnection = new SQLiteConnection(CapacitorSQLite);
  const conn = await sqliteConnection.createConnection(
    "yommy_poc.db",
    false,
    "no-encryption",
    1,
    false,
  );
  await conn.open();
  const adapter = new CapacitorSqliteAdapter(conn);
  await initializeDatabaseSchema(adapter);
  return adapter;
}

export const ServiceProvider: React.FC<ServiceProviderProps> = ({
  children,
  services,
  fallback,
}) => {
  const [contextValue, setContextValue] = useState<ServiceContextValue | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const isNative = Capacitor.isNativePlatform();

        const httpClient =
          services?.httpClient ??
          (isNative
            ? new CapacitorHttpClient()
            : createDefaultMockHttpClient());

        const parserRegistry =
          services?.parserRegistry ?? createDefaultParserRegistry();

        let databaseAdapter = services?.databaseAdapter;
        if (!databaseAdapter) {
          if (isNative) {
            databaseAdapter = await createDefaultNativeSqliteAdapter();
          } else {
            const storedBinary = getStoredDatabaseBinary();
            const onUpdate = () => {
              if (databaseAdapter instanceof InMemoryDatabaseAdapter) {
                persistDatabaseBinary(databaseAdapter.exportBinary());
              }
            };
            databaseAdapter = await createInMemoryDb(storedBinary, onUpdate);
            await initializeDatabaseSchema(databaseAdapter);
          }
        }

        const novelRepository =
          services?.novelRepository ??
          new SqlNovelRepository(databaseAdapter as DatabaseAdapter);
        const chapterRepository =
          services?.chapterRepository ??
          new SqlChapterRepository(databaseAdapter as DatabaseAdapter);
        const queueRepository =
          services?.queueRepository ??
          new SqlQueueRepository(databaseAdapter as DatabaseAdapter);
        const settingsRepository =
          services?.settingsRepository ??
          new SqlSettingsRepository(databaseAdapter as DatabaseAdapter);
        const appSettingsRepository =
          services?.appSettingsRepository ??
          new SqlAppSettingsRepository(databaseAdapter as DatabaseAdapter);

        const appBridge =
          services?.appBridge ??
          (isNative ? new CapacitorAppBridge() : new MockAppBridge());

        const cloudSyncBridge =
          services?.cloudSyncBridge ??
          (isNative
            ? new CapacitorCloudSyncBridge()
            : new MockCloudSyncBridge());

        const volumeKeyBridge =
          services?.volumeKeyBridge ??
          (isNative
            ? new CapacitorVolumeKeyBridge()
            : new MockVolumeKeyBridge());

        const webViewDomBridge =
          services?.webViewDomBridge ??
          (isNative
            ? new CapacitorWebViewDomBridge()
            : new MockWebViewDomBridge());

        const syncEngine =
          services?.syncEngine ??
          new SyncEngine({
            bridge: cloudSyncBridge,
            novelRepository,
            chapterRepository,
            appSettingsRepository,
            parserRegistry,
            httpClient,
          });

        const newContext: ServiceContextValue = {
          httpClient,
          parserRegistry,
          databaseAdapter,
          novelRepository,
          chapterRepository,
          queueRepository,
          settingsRepository,
          appSettingsRepository,
          appBridge,
          cloudSyncBridge,
          volumeKeyBridge,
          webViewDomBridge,
          syncEngine,
          fetchFullNovelIndex:
            services?.fetchFullNovelIndex ?? fetchFullNovelIndex,
          isReady: true,
          error: null,
        };

        if (typeof window !== "undefined") {
          window.__yommyServices = newContext;
        }

        if (isMounted) {
          setContextValue(newContext);
        }
      } catch (err) {
        if (isMounted) {
          const error = err instanceof Error ? err : new Error(String(err));
          const errorContext: ServiceContextValue = {
            httpClient: createDefaultMockHttpClient(),
            parserRegistry: createDefaultParserRegistry(),
            databaseAdapter: null as unknown as DatabaseAdapter,
            novelRepository: null as unknown as NovelRepository,
            chapterRepository: null as unknown as ChapterRepository,
            queueRepository: null as unknown as QueueRepository,
            settingsRepository: null as unknown as SettingsRepository,
            appSettingsRepository:
              services?.appSettingsRepository as AppSettingsRepository,
            appBridge: services?.appBridge ?? new MockAppBridge(),
            cloudSyncBridge:
              services?.cloudSyncBridge ?? new MockCloudSyncBridge(),
            volumeKeyBridge:
              services?.volumeKeyBridge ?? new MockVolumeKeyBridge(),
            webViewDomBridge:
              services?.webViewDomBridge ?? new MockWebViewDomBridge(),
            syncEngine: undefined,
            fetchFullNovelIndex:
              services?.fetchFullNovelIndex ?? fetchFullNovelIndex,
            isReady: false,
            error,
          };
          if (typeof window !== "undefined") {
            window.__yommyServices = errorContext;
          }
          setContextValue(errorContext);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [services]);

  if (!contextValue || !contextValue.isReady) {
    if (fallback) {
      if (typeof fallback === "function") {
        return <>{fallback(contextValue?.error ?? null)}</>;
      }
      return <>{fallback}</>;
    }
  }

  return (
    <ServiceContext.Provider
      value={
        contextValue ?? {
          httpClient: services?.httpClient ?? createDefaultMockHttpClient(),
          parserRegistry:
            services?.parserRegistry ?? createDefaultParserRegistry(),
          databaseAdapter: services?.databaseAdapter as DatabaseAdapter,
          novelRepository: services?.novelRepository as NovelRepository,
          chapterRepository: services?.chapterRepository as ChapterRepository,
          queueRepository: services?.queueRepository as QueueRepository,
          settingsRepository:
            services?.settingsRepository as SettingsRepository,
          appSettingsRepository:
            services?.appSettingsRepository as AppSettingsRepository,
          appBridge: services?.appBridge ?? new MockAppBridge(),
          cloudSyncBridge:
            services?.cloudSyncBridge ?? new MockCloudSyncBridge(),
          volumeKeyBridge:
            services?.volumeKeyBridge ?? new MockVolumeKeyBridge(),
          webViewDomBridge:
            services?.webViewDomBridge ?? new MockWebViewDomBridge(),
          syncEngine: services?.syncEngine,
          fetchFullNovelIndex:
            services?.fetchFullNovelIndex ?? fetchFullNovelIndex,
          isReady: false,
          error: null,
        }
      }
    >
      {children}
    </ServiceContext.Provider>
  );
};
