import React, { createContext, useContext } from "react";
import type { HttpClientBridge } from "../bridges/http/types";
import type { ParserRegistry } from "../parsers/parserRegistry";
import type { DatabaseAdapter } from "../storage/adapter/types";
import type {
  NovelRepository,
  ChapterRepository,
  SettingsRepository,
} from "../storage/types";

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

export const ServiceProvider: React.FC<ServiceProviderProps> = () => {
  return null;
};
