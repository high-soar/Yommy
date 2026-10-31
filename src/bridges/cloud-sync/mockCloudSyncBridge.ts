import type { CloudSyncAuthState, CloudSyncBridge } from "./types";

/**
 * UT / Storybook / IT 用のインメモリ CloudSyncBridge モック実装（Red スタブ）
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
    void this.authState;
    void this.defaultEmail;
    throw new Error("getAuthState is not implemented yet");
  }

  async signIn(): Promise<CloudSyncAuthState> {
    throw new Error("signIn is not implemented yet");
  }

  async signOut(): Promise<void> {
    throw new Error("signOut is not implemented yet");
  }

  async pullFile(): Promise<string | null> {
    void this.simulate401;
    throw new Error("pullFile is not implemented yet");
  }

  async pushFile(_content: string): Promise<void> {
    void this.simulate401;
    throw new Error("pushFile is not implemented yet");
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
