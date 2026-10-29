import React from "react";
import type { NovelSiteType } from "../../../parsers/types";
import { RANKING_SITES } from "../types";

export interface SiteSelectorProps {
  selectedSite: NovelSiteType;
  onSelectSite: (site: NovelSiteType) => void;
}

/**
 * ランキング対象サイト切替ピル（カクヨム / 将来のなろう）
 */
export const SiteSelector: React.FC<SiteSelectorProps> = ({
  selectedSite,
  onSelectSite,
}) => {
  return (
    <div
      role="group"
      aria-label="ランキング対象サイト"
      className="inline-flex rounded-lg p-0.5 bg-slate-200 dark:bg-slate-800"
    >
      {RANKING_SITES.map((site) => {
        const isSelected = selectedSite === site.siteType;
        const isDisabled = !site.isAvailable;

        return (
          <button
            key={site.siteType}
            type="button"
            data-testid={`site-selector-${site.siteType}`}
            disabled={isDisabled}
            aria-pressed={isSelected}
            onClick={() => {
              if (!isDisabled) {
                onSelectSite(site.siteType);
              }
            }}
            className={`px-3 py-1 text-xs sm:text-sm font-medium rounded-md transition-all duration-150 ${
              isSelected
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs"
                : isDisabled
                  ? "text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {site.label}
            {isDisabled ? " (準備中)" : ""}
          </button>
        );
      })}
    </div>
  );
};
