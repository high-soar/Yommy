import React from "react";
import type { NovelSiteType } from "../../../parsers/types";

export interface SiteSelectorProps {
  selectedSite: NovelSiteType;
  onSelectSite: (site: NovelSiteType) => void;
}

/**
 * ランキング対象サイト切替ピル（カクヨム / 将来のなろう）
 */
export const SiteSelector: React.FC<SiteSelectorProps> = () => {
  return <div data-testid="site-selector-stub">SiteSelector Stub</div>;
};
