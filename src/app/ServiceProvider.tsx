/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from "react";
import type { HttpClientBridge } from "../bridges/http/types";
import { MockHttpClient } from "../bridges/http/mockHttpClient";
import type { ParserRegistry } from "../parsers/parserRegistry";
import { createDefaultParserRegistry } from "../parsers/parserRegistry";
import type { DatabaseAdapter } from "../storage/adapter/types";
import {
  createInMemoryDb,
  InMemoryDatabaseAdapter,
} from "../storage/adapter/inMemoryDb";
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
  isReady: boolean;
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
  services?: Partial<Omit<ServiceContextValue, "isReady">>;
  fallback?: React.ReactNode;
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
): void {
  const targetStorage = storage !== undefined ? storage : window?.localStorage;
  if (!targetStorage) {
    return;
  }
  try {
    let binaryStr = "";
    for (let i = 0; i < binary.byteLength; i++) {
      binaryStr += String.fromCharCode(binary[i]);
    }
    targetStorage.setItem(STORAGE_KEY, btoa(binaryStr));
  } catch {
    // ignore quota errors
  }
}

export function createDefaultMockHttpClient(): MockHttpClient {
  const client = new MockHttpClient();
  client.setResponse("https://kakuyomu.jp/works/1177354054881162325", {
    status: 200,
    url: "https://kakuyomu.jp/works/1177354054881162325",
    html: workIndexHtml,
  });
  client.setResponse(
    /^https:\/\/kakuyomu\.jp\/works\/1177354054881162325\/episodes\/\d+/,
    (options) => ({
      status: 200,
      url: options.url,
      html: episodeContentHtml,
    }),
  );
  return client;
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
      const httpClient = services?.httpClient ?? createDefaultMockHttpClient();
      const parserRegistry =
        services?.parserRegistry ?? createDefaultParserRegistry();

      let databaseAdapter = services?.databaseAdapter;
      if (!databaseAdapter) {
        const storedBinary = getStoredDatabaseBinary();
        const onUpdate = () => {
          if (databaseAdapter instanceof InMemoryDatabaseAdapter) {
            persistDatabaseBinary(databaseAdapter.exportBinary());
          }
        };

        databaseAdapter = await createInMemoryDb(storedBinary, onUpdate);
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

      if (isMounted) {
        setContextValue({
          httpClient,
          parserRegistry,
          databaseAdapter,
          novelRepository,
          chapterRepository,
          settingsRepository,
          isReady: true,
        });
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [services]);

  if (!contextValue || !contextValue.isReady) {
    if (fallback) {
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
          isReady: false,
        }
      }
    >
      {children}
    </ServiceContext.Provider>
  );
};
