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
} from "../storage/types";
import { SqlNovelRepository } from "../storage/repositories/novelRepository";
import { SqlChapterRepository } from "../storage/repositories/chapterRepository";
import { SqlSettingsRepository } from "../storage/repositories/settingsRepository";
import workIndexHtml from "../parsers/kakuyomu/__fixtures__/work_index.html?raw";
import episodeContentHtml from "../parsers/kakuyomu/__fixtures__/episode_content.html?raw";

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
  settingsRepository: SettingsRepository;
  appBridge: AppBridge;
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

export function createDefaultMockHttpClient(): MockHttpClient {
  const client = new MockHttpClient();
  client.setResponse(/^https:\/\/kakuyomu\.jp\/works\/\d+$/, (options) => ({
    status: 200,
    url: options.url,
    headers: {},
    html: workIndexHtml,
  }));
  client.setResponse(
    /^https:\/\/kakuyomu\.jp\/works\/\d+\/episodes\/\d+/,
    (options) => ({
      status: 200,
      url: options.url,
      headers: {},
      html: episodeContentHtml,
    }),
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
          }
        }

        const novelRepository =
          services?.novelRepository ??
          new SqlNovelRepository(databaseAdapter as DatabaseAdapter);
        const chapterRepository =
          services?.chapterRepository ??
          new SqlChapterRepository(databaseAdapter as DatabaseAdapter);
        const settingsRepository =
          services?.settingsRepository ??
          new SqlSettingsRepository(databaseAdapter as DatabaseAdapter);

        const appBridge =
          services?.appBridge ??
          (isNative ? new CapacitorAppBridge() : new MockAppBridge());

        const newContext: ServiceContextValue = {
          httpClient,
          parserRegistry,
          databaseAdapter,
          novelRepository,
          chapterRepository,
          settingsRepository,
          appBridge,
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
            settingsRepository: null as unknown as SettingsRepository,
            appBridge: services?.appBridge ?? new MockAppBridge(),
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
          settingsRepository:
            services?.settingsRepository as SettingsRepository,
          appBridge: services?.appBridge ?? new MockAppBridge(),
          isReady: false,
          error: null,
        }
      }
    >
      {children}
    </ServiceContext.Provider>
  );
};
