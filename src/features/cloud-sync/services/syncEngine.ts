import type { CloudSyncBridge } from "../../../bridges/cloud-sync/types";
import type { HttpClientBridge } from "../../../bridges/http/types";
import type { ParserRegistry } from "../../../parsers/parserRegistry";
import type {
  AppSettingsRepository,
  ChapterRepository,
  NovelRecord,
  NovelRepository,
} from "../../../storage/types";
import type { SyncNovelData, YommySyncState } from "../types";

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
 * オブジェクトおよび子孫のプロパティ名にプロトタイプ汚染の危険性がないか再帰的に検査する
 */
function assertNoPrototypePollution(obj: unknown, path = "root"): void {
  if (typeof obj !== "object" || obj === null) return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertNoPrototypePollution(obj[i], `${path}[${i}]`);
    }
    return;
  }
  const keys = Object.getOwnPropertyNames(obj);
  for (const key of keys) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error(
        `Prototype pollution detected at ${path}: disallowed key "${key}"`,
      );
    }
    assertNoPrototypePollution(
      (obj as Record<string, unknown>)[key],
      `${path}.${key}`,
    );
  }
}

/**
 * 受信した JSON 文字列またはオブジェクトのスキーマを厳格に検証する
 */
export function validateSyncState(jsonStringOrObj: unknown): YommySyncState {
  let parsed: unknown;
  if (typeof jsonStringOrObj === "string") {
    try {
      parsed = JSON.parse(jsonStringOrObj, (key, value) => {
        if (
          key === "__proto__" ||
          key === "constructor" ||
          key === "prototype"
        ) {
          throw new Error(
            `Prototype pollution detected: disallowed key "${key}"`,
          );
        }
        return value;
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes("Prototype pollution")) {
        throw err;
      }
      throw new Error(`Invalid JSON syntax: ${String(err)}`);
    }
  } else {
    parsed = jsonStringOrObj;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Invalid sync state: root must be a non-null object");
  }

  assertNoPrototypePollution(parsed);

  const raw = parsed as Record<string, unknown>;

  if (raw.version !== 1) {
    throw new Error(`Unsupported schema version: ${String(raw.version)}`);
  }

  if (
    typeof raw.lastSyncedAt !== "string" ||
    isNaN(Date.parse(raw.lastSyncedAt))
  ) {
    throw new Error("Invalid lastSyncedAt: must be a valid ISO 8601 string");
  }

  if (
    typeof raw.novels !== "object" ||
    raw.novels === null ||
    Array.isArray(raw.novels)
  ) {
    throw new Error("Invalid novels: must be an object");
  }

  const novels: Record<string, SyncNovelData> = {};
  for (const [novelId, novel] of Object.entries(raw.novels)) {
    if (typeof novel !== "object" || novel === null || Array.isArray(novel)) {
      throw new Error(`Invalid novel entry for key "${novelId}"`);
    }

    const n = novel as Record<string, unknown>;
    if (n.id !== novelId) {
      throw new Error(
        `ID mismatch for novel: expected "${novelId}", got "${String(n.id)}"`,
      );
    }

    if (
      n.siteType !== "kakuyomu" &&
      n.siteType !== "narou" &&
      n.siteType !== "generic"
    ) {
      throw new Error(`Invalid siteType: "${String(n.siteType)}"`);
    }

    if (typeof n.remoteWorkId !== "string" || !n.remoteWorkId) {
      throw new Error("Invalid remoteWorkId: must be a non-empty string");
    }

    if (n.id !== `${n.siteType}:${n.remoteWorkId}`) {
      throw new Error(
        `ID format mismatch for novel: expected "${n.siteType}:${n.remoteWorkId}", got "${String(n.id)}"`,
      );
    }

    if (typeof n.canonicalUrl !== "string" || !n.canonicalUrl) {
      throw new Error("Invalid canonicalUrl: must be a non-empty string");
    }

    if (
      typeof n.title !== "string" ||
      typeof n.author !== "string" ||
      typeof n.synopsis !== "string"
    ) {
      throw new Error("Invalid title, author, or synopsis: must be strings");
    }

    if (
      typeof n.totalChapters !== "number" ||
      !Number.isInteger(n.totalChapters) ||
      n.totalChapters < 0
    ) {
      throw new Error("Invalid totalChapters: must be a non-negative integer");
    }

    if (n.isFavorite !== 0 && n.isFavorite !== 1) {
      throw new Error("Invalid isFavorite: must be 0 or 1");
    }

    if (n.hasNewUpdate !== 0 && n.hasNewUpdate !== 1) {
      throw new Error("Invalid hasNewUpdate: must be 0 or 1");
    }

    if (
      n.latestEpisodePublishedAt !== null &&
      (typeof n.latestEpisodePublishedAt !== "string" ||
        isNaN(Date.parse(n.latestEpisodePublishedAt)))
    ) {
      throw new Error(
        "Invalid latestEpisodePublishedAt: must be null or valid ISO 8601 string",
      );
    }

    if (
      n.bookmarkChapterIndex !== null &&
      (typeof n.bookmarkChapterIndex !== "number" ||
        !Number.isInteger(n.bookmarkChapterIndex) ||
        n.bookmarkChapterIndex < 1)
    ) {
      throw new Error(
        "Invalid bookmarkChapterIndex: must be null or positive integer >= 1",
      );
    }

    if (
      n.lastReadAt !== null &&
      (typeof n.lastReadAt !== "string" || isNaN(Date.parse(n.lastReadAt)))
    ) {
      throw new Error(
        "Invalid lastReadAt: must be null or valid ISO 8601 string",
      );
    }

    if (
      !Array.isArray(n.readChapterIds) ||
      !n.readChapterIds.every((id) => typeof id === "string")
    ) {
      throw new Error(
        "Invalid readChapterIds: must be an array of string episode IDs",
      );
    }

    if (typeof n.createdAt !== "string" || isNaN(Date.parse(n.createdAt))) {
      throw new Error("Invalid createdAt: must be a valid ISO 8601 string");
    }

    if (typeof n.updatedAt !== "string" || isNaN(Date.parse(n.updatedAt))) {
      throw new Error("Invalid updatedAt: must be a valid ISO 8601 string");
    }

    novels[novelId] = n as unknown as SyncNovelData;
  }

  if (
    typeof raw.deletedNovels !== "object" ||
    raw.deletedNovels === null ||
    Array.isArray(raw.deletedNovels)
  ) {
    throw new Error("Invalid deletedNovels: must be an object");
  }

  const deletedNovels: Record<string, string> = {};
  for (const [novelId, deletedAt] of Object.entries(raw.deletedNovels)) {
    if (
      typeof novelId !== "string" ||
      !novelId.trim() ||
      typeof deletedAt !== "string" ||
      isNaN(Date.parse(deletedAt))
    ) {
      throw new Error(
        `Invalid deletedNovels entry for "${novelId}": key must be non-empty and deletedAt must be a valid ISO 8601 string`,
      );
    }
    // 本棚現存作品のキーが deletedNovels に重複している場合は安全に除外
    if (novels[novelId]) {
      continue;
    }
    deletedNovels[novelId] = deletedAt;
  }

  return {
    version: 1,
    lastSyncedAt: raw.lastSyncedAt as string,
    novels,
    deletedNovels,
  };
}

/**
 * 小説 URL のホワイトリスト検証（SSRF 防止）
 */
export function parseNovelUrl(url: string): ParsedNovelUrl | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return null;
    }
    if (
      parsed.hostname !== "kakuyomu.jp" &&
      parsed.hostname !== "www.kakuyomu.jp"
    ) {
      return null;
    }
    const match = parsed.pathname.match(/^\/works\/(\d+)\/?$/);
    if (!match) {
      return null;
    }
    return {
      siteType: "kakuyomu",
      workId: match[1],
      canonicalUrl: `https://kakuyomu.jp/works/${match[1]}`,
    };
  } catch {
    return null;
  }
}

/**
 * エラーが 401 Unauthorized に該当するか判定する
 */
export function isUnauthorizedError(err: unknown): boolean {
  if (!err) return false;
  if (
    typeof err === "object" &&
    "status" in err &&
    (err as { status: number }).status === 401
  ) {
    return true;
  }
  if (err instanceof Error) {
    return err.message.includes("401") || err.message.includes("Unauthorized");
  }
  return String(err).includes("401") || String(err).includes("Unauthorized");
}

/**
 * クラウド同期エンジン
 */
export class SyncEngine {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPromise: Promise<void> | null = null;
  private pendingResolve: (() => void) | null = null;
  private pendingReject: ((err: unknown) => void) | null = null;

  private activeOperations = 0;
  private syncLock: Promise<void> = Promise.resolve();
  private activeSync: Promise<{
    pulled: boolean;
    mergedNovels: number;
  }> | null = null;

  constructor(private readonly deps: SyncEngineDependencies) {}

  get isSyncing(): boolean {
    return this.activeOperations > 0;
  }

  private async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const previousLock = this.syncLock;
    let release: () => void;
    this.syncLock = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previousLock;

    this.activeOperations++;
    try {
      return await fn();
    } finally {
      this.activeOperations--;
      release!();
    }
  }

  private async handleUnauthorized(err: unknown): Promise<void> {
    if (isUnauthorizedError(err)) {
      await this.deps.bridge.signOut();
      await this.deps.appSettingsRepository.setCloudSyncAccountEmail?.(null);
    }
  }

  private extractPendingHandlers(): {
    resolve: (() => void) | null;
    reject: ((err: unknown) => void) | null;
  } {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    const resolve = this.pendingResolve;
    const reject = this.pendingReject;
    this.pendingPromise = null;
    this.pendingResolve = null;
    this.pendingReject = null;
    return { resolve, reject };
  }

  private async propagateTombstones(
    deletedNovels: Record<string, string>,
    remoteNovels?: Record<string, SyncNovelData>,
  ): Promise<void> {
    for (const [novelId, deletedAtStr] of Object.entries(deletedNovels)) {
      const remoteDeletedAt = Date.parse(deletedAtStr);
      if (remoteNovels && remoteNovels[novelId]) {
        const remoteNovelUpdatedAt = Date.parse(
          remoteNovels[novelId].updatedAt,
        );
        if (remoteNovelUpdatedAt >= remoteDeletedAt) {
          continue; // リモート再登録作品と判定してローカル削除伝播をスキップ
        }
      }
      const localNovel = await this.deps.novelRepository.getNovelById(novelId);
      if (localNovel) {
        const localCreated = Date.parse(localNovel.createdAt);
        const localUpdated = Date.parse(localNovel.updatedAt);
        if (remoteDeletedAt > Math.max(localCreated, localUpdated)) {
          await this.deps.novelRepository.deleteNovel(novelId);
        }
      }
    }
  }

  private async mergeNewNovel(
    novelId: string,
    remoteNovel: SyncNovelData,
  ): Promise<void> {
    // 新規作品の自動目次補完
    const parsedUrl = parseNovelUrl(remoteNovel.canonicalUrl);
    if (!parsedUrl) {
      return; // SSRF ガードによりスキップ
    }

    if (
      parsedUrl.workId !== remoteNovel.remoteWorkId ||
      parsedUrl.siteType !== remoteNovel.siteType
    ) {
      return; // canonicalUrl と remoteWorkId / siteType の不整合を遮断
    }

    const parser = this.deps.parserRegistry.getParser(parsedUrl.canonicalUrl);
    if (!parser) {
      return;
    }

    const res = await this.deps.httpClient.getHtml({
      url: parsedUrl.canonicalUrl,
    });
    const parsedIndex = parser.parseNovelIndex(
      res.html,
      parsedUrl.canonicalUrl,
    );
    await this.deps.novelRepository.upsertNovelWithToc(
      parsedIndex,
      new Date().toISOString(),
    );

    if (remoteNovel.bookmarkChapterIndex !== null) {
      await this.deps.novelRepository.updateBookmark(
        novelId,
        remoteNovel.bookmarkChapterIndex,
        0.0,
      );
    }

    if (remoteNovel.readChapterIds.length > 0) {
      const chapters =
        await this.deps.chapterRepository.listChaptersByNovelId(novelId);
      const readSet = new Set(remoteNovel.readChapterIds);
      for (const ch of chapters) {
        if (readSet.has(ch.remoteChapterId)) {
          await this.deps.chapterRepository.markChapterRead(
            novelId,
            ch.chapterIndex,
            true,
          );
        }
      }
    }
  }

  private async mergeExistingNovel(
    novelId: string,
    remoteNovel: SyncNovelData,
    localNovel: NovelRecord,
  ): Promise<void> {
    // 既存作品のしおりマージ
    const remoteLastRead = remoteNovel.lastReadAt
      ? Date.parse(remoteNovel.lastReadAt)
      : 0;
    const localLastRead = localNovel.lastReadAt
      ? Date.parse(localNovel.lastReadAt)
      : 0;

    if (remoteLastRead > localLastRead) {
      if (
        remoteNovel.bookmarkChapterIndex !== null &&
        remoteNovel.bookmarkChapterIndex !== localNovel.bookmarkChapterIndex
      ) {
        await this.deps.novelRepository.updateBookmark(
          novelId,
          remoteNovel.bookmarkChapterIndex,
          0.0,
        );
      }
    }

    // 既読エピソードの和集合マージ
    const chapters =
      await this.deps.chapterRepository.listChaptersByNovelId(novelId);
    const remoteReadSet = new Set(remoteNovel.readChapterIds);
    for (const ch of chapters) {
      if (!ch.isRead && remoteReadSet.has(ch.remoteChapterId)) {
        await this.deps.chapterRepository.markChapterRead(
          novelId,
          ch.chapterIndex,
          true,
        );
      }
    }
  }

  private async mergeNovels(
    novels: Record<string, SyncNovelData>,
  ): Promise<void> {
    const localTombstones =
      (await this.deps.novelRepository.getDeletedNovels?.()) ?? [];
    const localTombstoneMap = new Map(
      localTombstones.map((t) => [t.id, t.deletedAt]),
    );

    for (const [novelId, remoteNovel] of Object.entries(novels)) {
      // ローカルの削除がリモートの更新より新しい場合は復元しない
      const localDeletedAt = localTombstoneMap.get(novelId);
      if (
        localDeletedAt !== undefined &&
        localDeletedAt > Date.parse(remoteNovel.updatedAt)
      ) {
        continue;
      }

      const localNovel = await this.deps.novelRepository.getNovelById(novelId);
      if (!localNovel) {
        await this.mergeNewNovel(novelId, remoteNovel);
      } else {
        await this.mergeExistingNovel(novelId, remoteNovel, localNovel);
      }
    }
  }

  private async doPullAndMerge(): Promise<{
    pulled: boolean;
    mergedNovels: number;
  }> {
    let rawContent: string | null;
    try {
      rawContent = await this.deps.bridge.pullFile();
    } catch (err) {
      await this.handleUnauthorized(err);
      throw err;
    }

    if (rawContent === null) {
      return { pulled: false, mergedNovels: 0 };
    }

    const remoteState = validateSyncState(rawContent);

    // 1. Tombstone 削除伝播（Remote -> Local）
    await this.propagateTombstones(
      remoteState.deletedNovels,
      remoteState.novels,
    );

    // 2. 作品マージ
    await this.mergeNovels(remoteState.novels);

    // 3. 現存作品の古いローカル Tombstone を清掃
    const localNovels = await this.deps.novelRepository.listNovels();
    if (localNovels.length > 0) {
      await this.deps.novelRepository.purgeDeletedNovels?.(
        localNovels.map((n) => n.id),
      );
    }

    const now = Date.now();
    await this.deps.appSettingsRepository.setCloudSyncLastSyncedAt?.(now);

    return {
      pulled: true,
      mergedNovels: Object.keys(remoteState.novels).length,
    };
  }

  async pullAndMerge(): Promise<{ pulled: boolean; mergedNovels: number }> {
    return this.runExclusive(() => this.doPullAndMerge());
  }

  private async buildSyncNovels(): Promise<Record<string, SyncNovelData>> {
    const novels = await this.deps.novelRepository.listNovels();
    const syncNovels: Record<string, SyncNovelData> = {};

    for (const n of novels) {
      const full = await this.deps.novelRepository.getNovelById(n.id);
      if (!full) continue;

      const chapters = await this.deps.chapterRepository.listChaptersByNovelId(
        n.id,
      );
      const readChapterIds = chapters
        .filter((c) => c.isRead)
        .map((c) => c.remoteChapterId);

      syncNovels[n.id] = {
        id: full.id,
        siteType: full.siteType,
        remoteWorkId: full.remoteWorkId,
        canonicalUrl: full.canonicalUrl,
        title: full.title,
        author: full.author,
        synopsis: full.synopsis,
        totalChapters: full.totalChapters,
        isFavorite: full.isFavorite ? 1 : 0,
        hasNewUpdate: full.hasNewUpdate ? 1 : 0,
        latestEpisodePublishedAt: full.latestEpisodePublishedAt ?? null,
        bookmarkChapterIndex: full.bookmarkChapterIndex,
        lastReadAt: full.lastReadAt,
        readChapterIds,
        createdAt: full.createdAt,
        updatedAt: full.updatedAt,
      };
    }
    return syncNovels;
  }

  private async buildMergedTombstones(
    syncNovels: Record<string, SyncNovelData>,
  ): Promise<Record<string, string>> {
    const localTombstones =
      (await this.deps.novelRepository.getDeletedNovels?.()) ?? [];
    const mergedDeletedNovels: Record<string, string> = {};
    for (const t of localTombstones) {
      mergedDeletedNovels[t.id] = new Date(t.deletedAt).toISOString();
    }

    // リモートの既存 Tombstone と和集合をとる
    try {
      const remoteRaw = await this.deps.bridge.pullFile();
      if (remoteRaw) {
        const parsed = validateSyncState(remoteRaw);
        for (const [id, dateStr] of Object.entries(parsed.deletedNovels)) {
          if (
            !mergedDeletedNovels[id] ||
            Date.parse(dateStr) > Date.parse(mergedDeletedNovels[id])
          ) {
            mergedDeletedNovels[id] = dateStr;
          }
        }
      }
    } catch (err) {
      await this.handleUnauthorized(err);
      throw err;
    }

    // 本棚に現存する作品は Tombstone から除外
    for (const id of Object.keys(syncNovels)) {
      delete mergedDeletedNovels[id];
    }

    return mergedDeletedNovels;
  }

  private async doPushCurrentState(): Promise<void> {
    try {
      const syncNovels = await this.buildSyncNovels();
      const existingNovelIds = Object.keys(syncNovels);
      if (existingNovelIds.length > 0) {
        await this.deps.novelRepository.purgeDeletedNovels?.(existingNovelIds);
      }
      const mergedDeletedNovels = await this.buildMergedTombstones(syncNovels);

      const state: YommySyncState = {
        version: 1,
        lastSyncedAt: new Date().toISOString(),
        novels: syncNovels,
        deletedNovels: mergedDeletedNovels,
      };

      await this.deps.bridge.pushFile(JSON.stringify(state));

      const now = Date.now();
      await this.deps.appSettingsRepository.setCloudSyncLastSyncedAt?.(now);
    } catch (err) {
      await this.handleUnauthorized(err);
      throw err;
    }
  }

  async pushCurrentState(): Promise<void> {
    return this.runExclusive(() => this.doPushCurrentState());
  }

  async sync(): Promise<{ pulled: boolean; mergedNovels: number }> {
    if (this.activeSync) {
      return this.activeSync;
    }
    this.activeSync = (async () => {
      this.activeOperations++;
      try {
        const pullResult = await this.pullAndMerge();
        await this.pushCurrentState();
        return pullResult;
      } finally {
        this.activeOperations--;
        this.activeSync = null;
      }
    })();
    return this.activeSync;
  }

  scheduleDebouncedPush(delayMs = 2500): Promise<void> {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (!this.pendingPromise) {
      this.pendingPromise = new Promise<void>((resolve, reject) => {
        this.pendingResolve = resolve;
        this.pendingReject = reject;
      });
      // 外部が未監視の場合でも unhandledRejection が漏洩しないよう内部で catch ハンドラを登録
      this.pendingPromise.catch(() => {});
    }

    this.debounceTimer = setTimeout(async () => {
      const { resolve, reject } = this.extractPendingHandlers();

      try {
        await this.pushCurrentState();
        if (resolve) resolve();
      } catch (err) {
        if (reject) reject(err);
      }
    }, delayMs);

    return this.pendingPromise;
  }

  cancelDebouncedPush(): void {
    this.extractPendingHandlers();
  }

  async flushDebouncedPush(): Promise<void> {
    if (this.debounceTimer !== null) {
      const { resolve, reject } = this.extractPendingHandlers();

      try {
        await this.pushCurrentState();
        if (resolve) resolve();
      } catch (err) {
        if (reject) reject(err);
        throw err;
      }
    }
  }

  notifyChanged(delayMs = 2500): Promise<void> {
    return this.scheduleDebouncedPush(delayMs);
  }
}
