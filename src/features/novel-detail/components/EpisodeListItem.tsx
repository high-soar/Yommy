import React from "react";
import type { ChapterSummary } from "../../../storage/types";

export interface EpisodeListItemProps {
  chapter: ChapterSummary;
  isBookmarked: boolean;
  onSelectEpisode: (chapterIndex: number) => void;
}

export const EpisodeListItem: React.FC<EpisodeListItemProps> = () => {
  return null;
};
