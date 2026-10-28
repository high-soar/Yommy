import type { AppBridge, BackButtonListener } from "./types";

export class MockAppBridge implements AppBridge {
  exitAppCalled = false;

  addBackButtonListener(_listener: BackButtonListener): () => void {
    throw new Error("Not implemented");
  }

  async exitApp(): Promise<void> {
    throw new Error("Not implemented");
  }

  async triggerBackButton(_canGoBack = false): Promise<void> {
    throw new Error("Not implemented");
  }

  reset(): void {
    throw new Error("Not implemented");
  }
}
