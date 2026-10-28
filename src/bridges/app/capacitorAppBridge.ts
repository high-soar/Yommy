import type { AppBridge, BackButtonListener } from "./types";

export class CapacitorAppBridge implements AppBridge {
  addBackButtonListener(_listener: BackButtonListener): () => void {
    throw new Error("Not implemented");
  }

  async exitApp(): Promise<void> {
    throw new Error("Not implemented");
  }
}
