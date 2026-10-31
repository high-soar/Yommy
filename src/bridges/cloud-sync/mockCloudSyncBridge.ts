import type { CloudSyncAuthState, CloudSyncBridge } from "./types";

export const MOCK_GDRIVE_FILE_STORAGE_KEY = "yommy_mock_gdrive_file";
export const MOCK_GDRIVE_AUTH_STORAGE_KEY = "yommy_mock_gdrive_auth";
export const MOCK_GDRIVE_401_STORAGE_KEY = "yommy_mock_gdrive_401";

export interface MockCloudSyncBridgeOptions {
  initialAuthState?: CloudSyncAuthState;
  initialFileContent?: string | null;
  defaultEmail?: string;
  storage?: Storage | null;
}

function isVitestEnv(): boolean {
  return typeof process !== "undefined" && Boolean(process.env?.VITEST);
}

/**
 * UT / Storybook / IT 用のインメモリ & Storage 永続化 CloudSyncBridge モック実装
 */
export class MockCloudSyncBridge implements CloudSyncBridge {
  private authState: CloudSyncAuthState = { status: "unlinked" };
  private fileContent: string | null = null;
  private simulate401 = false;
  private defaultEmail = "test-user@example.com";
  private storage: Storage | null = null;

  constructor(options?: MockCloudSyncBridgeOptions) {
    this.storage =
      options?.storage !== undefined
        ? options.storage
        : typeof window !== "undefined" && !isVitestEnv()
          ? window.localStorage
          : null;

    if (options?.defaultEmail) {
      this.defaultEmail = options.defaultEmail;
    }

    if (this.storage) {
      try {
        const storedAuth = this.storage.getItem(MOCK_GDRIVE_AUTH_STORAGE_KEY);
        if (storedAuth) {
          this.authState = JSON.parse(storedAuth) as CloudSyncAuthState;
        }
        const storedFile = this.storage.getItem(MOCK_GDRIVE_FILE_STORAGE_KEY);
        if (storedFile !== null) {
          this.fileContent = storedFile;
        }
        const stored401 = this.storage.getItem(MOCK_GDRIVE_401_STORAGE_KEY);
        if (stored401 !== null) {
          this.simulate401 = stored401 === "true";
        }
      } catch {
        // 復元失敗時は初期値を使用
      }
    }

    if (options?.initialAuthState) {
      this.authState = options.initialAuthState;
      this.saveAuthState(this.authState);
    }
    if (options?.initialFileContent !== undefined) {
      this.fileContent = options.initialFileContent;
      this.saveFileContent(this.fileContent);
    }
  }

  private saveAuthState(state: CloudSyncAuthState): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(MOCK_GDRIVE_AUTH_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }

  private saveFileContent(content: string | null): void {
    if (!this.storage) return;
    try {
      if (content === null) {
        this.storage.removeItem(MOCK_GDRIVE_FILE_STORAGE_KEY);
      } else {
        this.storage.setItem(MOCK_GDRIVE_FILE_STORAGE_KEY, content);
      }
    } catch {
      // ignore
    }
  }

  private saveSimulate401(simulate: boolean): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(MOCK_GDRIVE_401_STORAGE_KEY, String(simulate));
    } catch {
      // ignore
    }
  }

  private is401(): boolean {
    if (this.storage) {
      try {
        const stored401 = this.storage.getItem(MOCK_GDRIVE_401_STORAGE_KEY);
        if (stored401 !== null) {
          this.simulate401 = stored401 === "true";
        }
      } catch {
        // ignore
      }
    }
    return this.simulate401;
  }

  async getAuthState(): Promise<CloudSyncAuthState> {
    if (this.storage) {
      try {
        const stored = this.storage.getItem(MOCK_GDRIVE_AUTH_STORAGE_KEY);
        if (stored) {
          this.authState = JSON.parse(stored) as CloudSyncAuthState;
        }
      } catch {
        // ignore
      }
    }
    return this.authState;
  }

  async signIn(): Promise<CloudSyncAuthState> {
    this.authState = { status: "connected", email: this.defaultEmail };
    this.saveAuthState(this.authState);
    return this.authState;
  }

  async signOut(): Promise<void> {
    this.authState = { status: "unlinked" };
    this.saveAuthState(this.authState);
  }

  async pullFile(): Promise<string | null> {
    if (this.is401()) {
      const err = new Error("401 Unauthorized");
      (err as unknown as { status: number }).status = 401;
      throw err;
    }
    if (this.storage) {
      try {
        const storedFile = this.storage.getItem(MOCK_GDRIVE_FILE_STORAGE_KEY);
        if (storedFile !== null) {
          this.fileContent = storedFile;
        } else {
          this.fileContent = null;
        }
      } catch {
        // ignore
      }
    }
    return this.fileContent;
  }

  async pushFile(content: string): Promise<void> {
    if (this.is401()) {
      const err = new Error("401 Unauthorized");
      (err as unknown as { status: number }).status = 401;
      throw err;
    }
    this.fileContent = content;
    this.saveFileContent(content);
  }

  setAuthState(state: CloudSyncAuthState): void {
    this.authState = state;
    this.saveAuthState(state);
  }

  setFileContent(content: string | null): void {
    this.fileContent = content;
    this.saveFileContent(content);
  }

  getFileContent(): string | null {
    if (this.storage) {
      try {
        const storedFile = this.storage.getItem(MOCK_GDRIVE_FILE_STORAGE_KEY);
        if (storedFile !== null) {
          this.fileContent = storedFile;
        } else {
          this.fileContent = null;
        }
      } catch {
        // ignore
      }
    }
    return this.fileContent;
  }

  setSimulate401(simulate: boolean): void {
    this.simulate401 = simulate;
    this.saveSimulate401(simulate);
  }

  clearStorage(): void {
    this.authState = { status: "unlinked" };
    this.fileContent = null;
    this.simulate401 = false;
    if (!this.storage) return;
    try {
      this.storage.removeItem(MOCK_GDRIVE_AUTH_STORAGE_KEY);
      this.storage.removeItem(MOCK_GDRIVE_FILE_STORAGE_KEY);
      this.storage.removeItem(MOCK_GDRIVE_401_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
