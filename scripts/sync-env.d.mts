export interface SyncEnvOptions {
  currentDir?: string;
  mainCandidates?: string[];
}

export function syncEnv(options?: SyncEnvOptions): void;
