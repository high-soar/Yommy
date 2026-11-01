import React from "react";
import type { StorageCacheSummary } from "../hooks/useStorageCache";

export interface StorageCacheSectionProps {
  summary: StorageCacheSummary;
  isLoading?: boolean;
  isClearing?: boolean;
  notice?: string | null;
  error?: string | null;
  initialShowDialog?: boolean;
  onClearCache?: (options: { onlyRead: boolean }) => void | Promise<number>;
  className?: string;
}

export const StorageCacheSection: React.FC<StorageCacheSectionProps> = () => {
  return null;
};
