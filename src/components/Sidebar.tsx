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
      <div className="mb-4 grid gap-2 border-b border-neutral-200/80 pb-4 dark:border-white/[0.08] lg:hidden">
        <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {t("language")}
          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value as LanguageCode)}
            className="clean-select mt-1 h-10 w-full rounded-xl border border-neutral-300/80 bg-white px-3 text-xs text-neutral-950 outline-none dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-100"
          >
            {languages.map((item) => (
              <option key={item.code} value={item.code}>{item.name}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onDashboard}
          className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950"
        >
          {t("dashboard")}
          <ExternalLink className="h-3.5 w-3.5" />
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
            <h2 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              {t("latestModels")}
            </h2>
          )}
          <ul className="space-y-0.5">
            {latestModels.map((item) => {
              const selected = activePage === item;
              return (
                <li key={item}>
                  <button
                    type="button"
                    title={collapsed ? item : undefined}
                    onClick={() => onNavigate(item)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                      selected
                        ? "bg-neutral-100 font-semibold text-neutral-950 dark:bg-white/[0.08] dark:text-white"
                        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/[0.04] dark:hover:text-white"
                    } ${collapsed ? "justify-center" : ""}`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected ? "bg-blue-600 dark:bg-blue-400" : "bg-neutral-300 dark:bg-neutral-600"}`} />
                    {!collapsed && item}
                  </button>
                </li>
              );
            })}
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
        className="mt-4 hidden w-full items-center gap-2 rounded-xl border border-neutral-200/80 bg-white px-3 py-2 text-xs font-medium text-neutral-600 shadow-xs transition hover:border-neutral-300 hover:text-neutral-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-400 dark:hover:border-white/20 dark:hover:text-white lg:flex"
      >
        {collapsed ? (
          <ArrowRightToLine className="h-3.5 w-3.5" />
        ) : (
          <ArrowLeftToLine className="h-3.5 w-3.5" />
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
          className="fixed inset-0 z-30 bg-neutral-950/40 backdrop-blur-xs dark:bg-black/70 lg:hidden"
        />
      )}

      <aside
        className={`fixed bottom-0 left-0 top-14 z-30 w-[min(20rem,calc(100vw-2rem))] border-r border-neutral-200/80 bg-white px-3 py-4 shadow-2xl transition-transform duration-300 ease-out dark:border-white/[0.08] dark:bg-[#09090b] sm:top-16 lg:sticky lg:top-16 lg:z-20 lg:block lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-[4.5rem]" : "lg:w-64"}`}
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
        <h2 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          {tc(title)}
        </h2>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => {
          const selected =
            item === activePage ||
            (item === "API Prices" && activePage === "Pricing") ||
            (item === "Models" && activePage === "Models");

          return (
            <li key={item}>
              <button
                type="button"
                title={collapsed ? item : undefined}
                onClick={() => onNavigate(item)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                  selected
                    ? "bg-neutral-100 font-semibold text-neutral-950 dark:bg-white/[0.08] dark:text-white"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/[0.04] dark:hover:text-white"
                } ${collapsed ? "justify-center" : ""}`}
              >
                {collapsed ? (
                  <Circle className={`h-2.5 w-2.5 ${selected ? "fill-blue-500 text-blue-500" : ""}`} />
                ) : (
                  <>
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        selected ? "bg-blue-600 dark:bg-blue-400" : "bg-neutral-300 dark:bg-neutral-600"
                      }`}
                    />
                    <span>{tc(item)}</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
