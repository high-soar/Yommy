import type { CloudSyncBridge } from "../../../bridges/cloud-sync/types";
import type { HttpClientBridge } from "../../../bridges/http/types";
import type { ParserRegistry } from "../../../parsers/parserRegistry";
import type {
  AppSettingsRepository,
  ChapterRepository,
  NovelRepository,
} from "../../../storage/types";
import type { YommySyncState } from "../types";

export interface SyncEngineDependencies {
  bridge: CloudSyncBridge;
  novelRepository: NovelRepository;
  chapterRepository: ChapterRepository;
  appSettingsRepository: AppSettingsRepository;
  parserRegistry: ParserRegistry;
  httpClient: HttpClientBridge;
}

export interface ParsedNovelUrl {
  siteType: "kakuyomu";
  workId: string;
  canonicalUrl: string;
}

/**
 * 受信した JSON 文字列またはオブジェクトのスキーマを厳格に検証する（Red スタブ）
 */
export function validateSyncState(_jsonStringOrObj: unknown): YommySyncState {
  throw new Error("validateSyncState is not implemented yet");
}

/**
 * 小説 URL のホワイトリスト検証（SSRF 防止）（Red スタブ）
 */
export function parseNovelUrl(_url: string): ParsedNovelUrl | null {
  throw new Error("parseNovelUrl is not implemented yet");
}

/**
 * クラウド同期エンジン（Red スタブ）
 */
export class SyncEngine {
  constructor(private readonly _deps: SyncEngineDependencies) {
    void this._deps;
  }

  async pullAndMerge(): Promise<{ pulled: boolean; mergedNovels: number }> {
    throw new Error("pullAndMerge is not implemented yet");
  }

  async pushCurrentState(): Promise<void> {
    throw new Error("pushCurrentState is not implemented yet");
  }

  async sync(): Promise<{ pulled: boolean; mergedNovels: number }> {
    throw new Error("sync is not implemented yet");
  }

  scheduleDebouncedPush(_delayMs = 2500): Promise<void> {
    throw new Error("scheduleDebouncedPush is not implemented yet");
  }

  cancelDebouncedPush(): void {
    throw new Error("cancelDebouncedPush is not implemented yet");
  }

  async flushDebouncedPush(): Promise<void> {
    throw new Error("flushDebouncedPush is not implemented yet");
  }

  notifyChanged(delayMs = 2500): Promise<void> {
    return this.scheduleDebouncedPush(delayMs);
  }
}
