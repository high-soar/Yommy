import React from "react";
import type { ChapterSummary } from "../../../storage/types";

export interface EpisodeListProps {
  chapters: ChapterSummary[];
  bookmarkChapterIndex: number | null;
  onSelectEpisode: (chapterIndex: number) => void;
}

export const EpisodeList: React.FC<EpisodeListProps> = () => {
  return null;
};
