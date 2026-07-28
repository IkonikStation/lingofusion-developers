import { ArrowLeftToLine, ArrowRightToLine, Circle, ExternalLink } from "lucide-react";
import type { LanguageCode, TranslationKey } from "../data/i18n";
import { languages } from "../data/i18n";
import { latestModels, sidebarSections } from "../data/pricing";

type SidebarProps = {
  activePage: string;
  collapsed: boolean;
  mobileOpen: boolean;
  language: LanguageCode;
  t: (key: TranslationKey) => string;
  tc: (text: string) => string;
  onNavigate: (page: string) => void;
  onLanguageChange: (language: LanguageCode) => void;
  onDashboard: () => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
};

export function Sidebar({
  activePage,
  collapsed,
  mobileOpen,
  language,
  t,
  tc,
  onNavigate,
  onLanguageChange,
  onDashboard,
  onToggleCollapse,
  onCloseMobile,
}: SidebarProps) {
  const content = (
    <div className="sticky top-20 flex h-[calc(100vh-6rem)] flex-col">
      <div className="mb-5 grid gap-2 border-b border-neutral-200 pb-5 dark:border-white/10 lg:hidden">
        <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t("language")}
          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value as LanguageCode)}
            className="clean-select mt-1.5 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-neutral-950 outline-none dark:border-white/15 dark:bg-white/5 dark:text-neutral-100"
          >
            {languages.map((item) => (
              <option key={item.code} value={item.code}>{item.name}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onDashboard}
          className="pressable inline-flex h-11 items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-medium text-white dark:bg-white dark:text-neutral-950"
        >
          {t("dashboard")}
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>

      <nav className="sidebar-scroll space-y-6 overflow-y-auto pr-2">
        {sidebarSections.slice(0, 2).map((section) => (
          <Section
            key={section.title}
            title={section.title}
            items={section.items}
            activePage={activePage}
            collapsed={collapsed}
            onNavigate={onNavigate}
            tc={tc}
          />
        ))}

        <div>
          {!collapsed && (
              <h2 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-500">
              {t("latestModels")}
            </h2>
          )}
          <ul className="space-y-0.5">
            {latestModels.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  title={collapsed ? item : undefined}
                  onClick={() => onNavigate(item)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                    activePage === item
                      ? "bg-neutral-200/75 font-medium text-neutral-950 dark:bg-white/10 dark:text-neutral-50"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/[0.08] dark:hover:text-neutral-100"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                  {!collapsed && item}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {sidebarSections.slice(2).map((section) => (
          <Section
            key={section.title}
            title={section.title}
            items={section.items}
            activePage={activePage}
            collapsed={collapsed}
            onNavigate={onNavigate}
            tc={tc}
          />
        ))}
      </nav>

      <button
        type="button"
        onClick={onToggleCollapse}
        className="mt-5 hidden w-full items-center gap-2 rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-600 hover:border-neutral-300 hover:text-neutral-950 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400 dark:hover:border-white/20 dark:hover:text-neutral-100 lg:flex"
      >
        {collapsed ? (
          <ArrowRightToLine className="h-4 w-4" />
        ) : (
          <ArrowLeftToLine className="h-4 w-4" />
        )}
        {!collapsed && t("collapse")}
      </button>
    </div>
  );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-neutral-950/35 dark:bg-black/60 lg:hidden"
        />
      )}

      <aside
        className={`fixed bottom-0 left-0 top-14 z-30 w-[min(20rem,calc(100vw-2rem))] border-r border-neutral-200 bg-white px-4 py-5 shadow-2xl transition-transform duration-300 ease-out dark:border-white/10 dark:bg-[#0a0a0a] sm:top-16 lg:sticky lg:top-16 lg:z-20 lg:block lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-[4.75rem]" : "lg:w-72"}`}
      >
        {content}
      </aside>
    </>
  );
}

function Section({
  title,
  items,
  activePage,
  collapsed,
  onNavigate,
  tc,
}: {
  title: string;
  items: string[];
  activePage: string;
  collapsed: boolean;
  onNavigate: (page: string) => void;
  tc: (text: string) => string;
}) {
  return (
    <div>
      {!collapsed && (
        <h2 className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-500">
          {tc(title)}
        </h2>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => {
          const selected = item === activePage || (item === "API Prices" && activePage === "Pricing");

          return (
            <li key={item}>
              <button
                type="button"
                title={collapsed ? item : undefined}
                onClick={() => onNavigate(item)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                  selected
                    ? "bg-neutral-200/75 font-medium text-neutral-950 dark:bg-white/10 dark:text-neutral-50"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/[0.08] dark:hover:text-neutral-100"
                } ${collapsed ? "justify-center" : ""}`}
              >
                {collapsed && <Circle className="h-3.5 w-3.5" />}
                {!collapsed && tc(item)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
