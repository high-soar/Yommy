import type { CloudSyncAuthState, CloudSyncBridge } from "./types";

/**
 * UT / Storybook / IT 用のインメモリ CloudSyncBridge モック実装
 */
export class MockCloudSyncBridge implements CloudSyncBridge {
  private authState: CloudSyncAuthState = { status: "unlinked" };
  private fileContent: string | null = null;
  private simulate401 = false;
  private defaultEmail = "test-user@example.com";

  constructor(options?: {
    initialAuthState?: CloudSyncAuthState;
    initialFileContent?: string | null;
    defaultEmail?: string;
  }) {
    if (options?.initialAuthState) {
      this.authState = options.initialAuthState;
    }
    if (options?.initialFileContent !== undefined) {
      this.fileContent = options.initialFileContent;
    }
    if (options?.defaultEmail) {
      this.defaultEmail = options.defaultEmail;
    }
  }

  async getAuthState(): Promise<CloudSyncAuthState> {
    return this.authState;
  }

  async signIn(): Promise<CloudSyncAuthState> {
    this.authState = { status: "connected", email: this.defaultEmail };
    return this.authState;
  }

  async signOut(): Promise<void> {
    this.authState = { status: "unlinked" };
  }

  async pullFile(): Promise<string | null> {
    if (this.simulate401) {
      const err = new Error("401 Unauthorized");
      (err as unknown as { status: number }).status = 401;
      throw err;
    }
    return this.fileContent;
  }

  async pushFile(content: string): Promise<void> {
    if (this.simulate401) {
      const err = new Error("401 Unauthorized");
      (err as unknown as { status: number }).status = 401;
      throw err;
    }
    this.fileContent = content;
  }

  setAuthState(state: CloudSyncAuthState): void {
    this.authState = state;
  }

  setFileContent(content: string | null): void {
    this.fileContent = content;
  }

  getFileContent(): string | null {
    return this.fileContent;
  }

  setSimulate401(simulate: boolean): void {
    this.simulate401 = simulate;
  }
}
