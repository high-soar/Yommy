import React from "react";
import type { NovelSiteType } from "../../../parsers/types";

export interface SiteSelectorProps {
  selectedSite: NovelSiteType;
  onSelectSite: (site: NovelSiteType) => void;
}

export const SiteSelector: React.FC<SiteSelectorProps> = () => {
  return null;
};
