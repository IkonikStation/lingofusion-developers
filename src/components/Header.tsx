import { ChevronDown, ExternalLink, Menu, Moon, Search, Sun, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { LanguageCode, TranslationKey } from "../data/i18n";
import { languages } from "../data/i18n";
import { navMenus } from "../data/pricing";

type HeaderProps = {
  activePage: string;
  isSubscriptionPage: boolean;
  theme: "light" | "dark";
  language: LanguageCode;
  mobileOpen: boolean;
  searchItems: string[];
  t: (key: TranslationKey) => string;
  tc: (text: string) => string;
  onNavigate: (page: string) => void;
  onLanguageChange: (language: LanguageCode) => void;
  onDashboard: () => void;
  onToggleTheme: () => void;
  onToggleMobile: () => void;
};

const topLevelItems = ["Home", "API", "Models", "Docs", "Resources"] as const;
const topLevelLabels = {
  Home: "home",
  API: "api",
  Models: "models",
  Docs: "docs",
  Resources: "resources",
} as const;

export function Header({
  activePage,
  isSubscriptionPage,
  theme,
  language,
  mobileOpen,
  searchItems,
  t,
  tc,
  onNavigate,
  onLanguageChange,
  onDashboard,
  onToggleTheme,
  onToggleMobile,
}: HeaderProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const filteredSearch = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return searchItems.slice(0, 7);
    }

    return searchItems
      .filter((item) => item.toLowerCase().includes(normalized))
      .slice(0, 8);
  }, [query, searchItems]);

  const navigate = (page: string) => {
    onNavigate(page === "Home" ? "Overview" : page);
    setOpenMenu(null);
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <header className="site-header sticky top-0 z-40 border-b border-neutral-200/80 bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#09090b]/80">
      <div className="flex h-14 items-center gap-2.5 px-3 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
        {!isSubscriptionPage && (
          <button
            type="button"
            aria-label={mobileOpen ? t("closeNavigation") : t("openNavigation")}
            onClick={onToggleMobile}
            className="pressable grid h-9 w-9 place-items-center rounded-xl border border-neutral-300/80 bg-white text-neutral-700 shadow-xs lg:hidden dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-300"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate("Overview")}
          className="pressable flex shrink-0 items-center gap-2.5 rounded-xl text-left"
        >
          <span className="brand-mark-motion block h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-[#070b26] p-0.5 shadow-xs sm:h-10 sm:w-10">
            <img
              src={`${import.meta.env.BASE_URL}assets/lingofusion-logo-square.png`}
              alt="LingoFusion logo"
              width="40"
              height="40"
              className="block h-full w-full rounded-[10px] object-cover"
            />
          </span>
          <span className="hidden text-sm font-bold tracking-tight text-neutral-950 dark:text-white sm:inline">
            LingoFusion <span className="font-medium text-neutral-500">Devs</span>
          </span>
        </button>

        {/* Primary nav pills */}
        <nav aria-label="Primary navigation" className="ml-3 hidden items-center rounded-xl border border-neutral-200/80 bg-neutral-100/70 p-1 dark:border-white/10 dark:bg-white/[0.05] md:flex">
          <button
            type="button"
            onClick={() => navigate("API Prices")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activePage === "Pricing"
                ? "bg-white text-neutral-950 shadow-xs dark:bg-neutral-800 dark:text-white"
                : "text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            API Prices
          </button>
          <button
            type="button"
            onClick={() => navigate("Models")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activePage === "Models"
                ? "bg-white text-neutral-950 shadow-xs dark:bg-neutral-800 dark:text-white"
                : "text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            Models
          </button>
          <button
            type="button"
            onClick={() => navigate("Subscription Prices")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              isSubscriptionPage
                ? "bg-white text-neutral-950 shadow-xs dark:bg-neutral-800 dark:text-white"
                : "text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            Subscriptions
          </button>
        </nav>

        {/* Extended desktop nav */}
        <nav className="ml-4 hidden items-center gap-1 2xl:flex">
          {topLevelItems.map((item) => {
            const menu = navMenus[item as keyof typeof navMenus];
            const active =
              item === "Home"
                ? activePage === "Overview"
                : menu?.some((option) => option === activePage || (option === "API Prices" && activePage === "Pricing")) ||
                  activePage === item;

            return (
              <div className="relative" key={item}>
                <button
                  type="button"
                  onClick={() => (menu ? setOpenMenu(openMenu === item ? null : item) : navigate(item))}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-neutral-200/80 text-neutral-950 dark:bg-white/10 dark:text-white"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                  }`}
                >
                  {t(topLevelLabels[item])}
                  {menu && <ChevronDown className="h-3 w-3 opacity-60" />}
                </button>

                {openMenu === item && menu && (
                  <div className="absolute left-0 top-9 w-64 rounded-xl border border-neutral-200/90 bg-white/95 p-1.5 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#141417]/95">
                    {menu.map((option) => (
                      <button
                        type="button"
                        key={option}
                        onClick={() => navigate(option)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
                      >
                        {tc(option)}
                        {(option === activePage || (option === "API Prices" && activePage === "Pricing")) && (
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right side controls */}
        <div className="ml-auto flex min-w-0 items-center justify-end gap-2.5">
          <div className="relative hidden w-64 xl:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && filteredSearch[0]) {
                  navigate(filteredSearch[0]);
                }
                if (event.key === "Escape") {
                  setSearchOpen(false);
                }
              }}
              placeholder={t("searchDocs")}
              className="h-9 w-full rounded-xl border border-neutral-300/80 bg-neutral-50/80 py-1.5 pl-8 pr-12 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:bg-white focus:ring-1 focus:ring-neutral-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-100 dark:focus:border-white/40"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-neutral-200 bg-white px-1 py-0.5 font-mono text-[9px] font-semibold text-neutral-400 dark:border-white/10 dark:bg-white/5 dark:text-neutral-500">
              ⌘K
            </span>
            {searchOpen && (
              <div className="absolute right-0 top-11 w-full rounded-xl border border-neutral-200/90 bg-white/95 p-1.5 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-[#141417]/95">
                {filteredSearch.length ? (
                  filteredSearch.map((item) => (
                    <button
                      type="button"
                      key={item}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => navigate(item)}
                      className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
                    >
                      {tc(item)}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-xs text-neutral-500">{t("noResults")}</p>
                )}
              </div>
            )}
          </div>

          <label className="hidden items-center gap-1 rounded-xl border border-neutral-300/80 bg-white px-2 text-xs font-medium text-neutral-600 shadow-xs dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-300 md:inline-flex">
            <span className="sr-only">{t("language")}</span>
            <select
              value={language}
              onChange={(event) => onLanguageChange(event.target.value as LanguageCode)}
              className="clean-select h-8 max-w-32 bg-transparent text-xs font-medium outline-none"
              aria-label={t("language")}
            >
              {languages.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          {/* Theme switcher */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="pressable inline-flex h-9 items-center rounded-xl border border-neutral-300/80 bg-neutral-100/60 p-0.5 text-xs text-neutral-600 shadow-xs dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-300"
            aria-label={`Switch to ${theme === "light" ? t("dark") : t("light")} mode`}
          >
            <span
              className={`inline-flex h-7 items-center gap-1 rounded-lg px-2 transition ${
                theme === "light"
                  ? "bg-white text-neutral-950 shadow-xs dark:bg-neutral-800 dark:text-white"
                  : "text-neutral-400"
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
            </span>
            <span
              className={`inline-flex h-7 items-center gap-1 rounded-lg px-2 transition ${
                theme === "dark"
                  ? "bg-white text-neutral-950 shadow-xs dark:bg-neutral-800 dark:text-white"
                  : "text-neutral-400"
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
            </span>
          </button>

          <button
            type="button"
            onClick={onDashboard}
            className="pressable inline-flex h-9 items-center gap-1.5 rounded-xl bg-neutral-950 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            {t("dashboard")}
            <ExternalLink className="h-3 w-3 opacity-70" />
          </button>
        </div>
      </div>
    </header>
  );
}
