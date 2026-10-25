import React from "react";
import type { NovelSummary } from "../../../storage/types";

export interface NovelCardProps {
  novel: NovelSummary;
  onSelect: (novelId: string) => void;
  onResume: (novelId: string, chapterIndex: number) => void;
}

export const NovelCard: React.FC<NovelCardProps> = () => {
  return null;
};
