"use client";

import { CATEGORY_TABS, getCategoryTab, itemTypeLabel } from "@/lib/wiki/taxonomy";

export interface CategoryTabsProps {
  activeGroupId: string;
  activeTypeKey: string | null;
  /** Item count per top-level tab id. */
  groupCounts: Record<string, number>;
  /** Item count per raw type key, within the active tab. */
  typeCounts: Record<string, number>;
  onSelectGroup: (groupId: string) => void;
  onSelectType: (typeKey: string | null) => void;
}

interface SubTabProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

/**
 * Second-level tab. Same underline treatment as the top level, but smaller and
 * with an emerald indicator, so the two rows read as a hierarchy rather than as
 * two competing strips.
 */
function SubTab({ label, count, active, onClick }: SubTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`-mb-px whitespace-nowrap border-b-2 px-2 pb-1 pt-1.5 text-[11px] font-semibold transition ${
        active
          ? "border-emerald-300 text-emerald-200"
          : "border-transparent text-stone-500 hover:text-stone-300"
      }`}
    >
      {label}
      <span
        className={`ml-1 font-mono text-[9px] font-normal ${
          active ? "text-emerald-300/60" : "text-stone-600"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/**
 * The rail's category control: five tabs, each with its own ordered sub-tabs.
 *
 * Sub-tabs come from `CATEGORY_TABS`, not from the items present, so the strip
 * keeps the same shape as the dataset grows (and a type with no items yet, like
 * `special`, still gets its tab). "All" deliberately has no sub-tabs.
 */
export function CategoryTabs({
  activeGroupId,
  activeTypeKey,
  groupCounts,
  typeCounts,
  onSelectGroup,
  onSelectType,
}: CategoryTabsProps) {
  const activeTab = getCategoryTab(activeGroupId);

  return (
    <div>
      <div className="flex flex-wrap border-b border-white/[0.08]">
        {CATEGORY_TABS.map((tab) => {
          const active = tab.id === activeTab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectGroup(tab.id)}
              aria-pressed={active}
              className={`-mb-px whitespace-nowrap border-b-2 px-2 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wider transition ${
                active
                  ? "border-amber-300 text-amber-200"
                  : "border-transparent text-stone-500 hover:text-stone-300"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1 font-mono text-[9px] font-normal ${
                  active ? "text-amber-300/60" : "text-stone-600"
                }`}
              >
                {groupCounts[tab.id] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {activeTab.types.length > 0 && (
        <div className="flex flex-wrap border-b border-white/[0.06] pl-0.5">
          <SubTab
            label="All"
            count={groupCounts[activeTab.id] ?? 0}
            active={activeTypeKey === null}
            onClick={() => onSelectType(null)}
          />
          {activeTab.types.map((typeKey) => {
            const active = activeTypeKey === typeKey;
            return (
              <SubTab
                key={typeKey}
                label={itemTypeLabel(typeKey)}
                count={typeCounts[typeKey] ?? 0}
                active={active}
                onClick={() => onSelectType(active ? null : typeKey)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
