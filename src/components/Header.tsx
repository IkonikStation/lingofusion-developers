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
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0a0a]/95">
      <div className="flex h-14 items-center gap-2.5 px-3 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
        {!isSubscriptionPage && (
          <button
            type="button"
            aria-label={mobileOpen ? t("closeNavigation") : t("openNavigation")}
            onClick={onToggleMobile}
            className="pressable grid h-10 w-10 place-items-center rounded-md border border-neutral-300 bg-white text-neutral-700 lg:hidden dark:border-white/15 dark:bg-white/5 dark:text-neutral-300"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate("Overview")}
          className="pressable flex shrink-0 items-center gap-2.5 rounded-md text-left"
        >
          <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-[10px] bg-[#070b26] sm:h-11 sm:w-11 sm:rounded-[11px]">
            <img
              src={`${import.meta.env.BASE_URL}assets/lingofusion-logo-square.png`}
              alt="LingoFusion logo"
              width="44"
              height="44"
              className="block h-full w-full scale-[1.08] object-cover"
            />
          </span>
          <span className="hidden text-base font-semibold tracking-tight text-neutral-950 dark:text-neutral-50 sm:inline">
            LingoFusion Developers
          </span>
        </button>

        <nav aria-label="Pricing navigation" className="ml-2 hidden items-center rounded-md border border-neutral-200 bg-neutral-100/80 p-0.5 dark:border-white/10 dark:bg-white/[0.05] md:flex">
          <button
            type="button"
            onClick={() => navigate("API Prices")}
            className={`rounded px-2.5 py-1.5 text-xs font-semibold transition ${!isSubscriptionPage ? "bg-white text-neutral-950 shadow-sm dark:bg-white dark:text-neutral-950" : "text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"}`}
          >
            API Prices
          </button>
          <button
            type="button"
            onClick={() => navigate("Subscription Prices")}
            className={`rounded px-2.5 py-1.5 text-xs font-semibold transition ${isSubscriptionPage ? "bg-[#203b6d] text-white shadow-sm dark:bg-white dark:text-neutral-950" : "text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"}`}
          >
            Subscription Prices
          </button>
        </nav>

        <nav className="ml-4 hidden items-center gap-1 2xl:flex">
          {topLevelItems.map((item) => {
            const menu = navMenus[item as keyof typeof navMenus];
            const active =
              item === "Home"
                ? activePage === "Overview"
                : menu?.some((option) => option === activePage || (option === "API Prices" && activePage === "Pricing")) || activePage === item;

            return (
              <div className="relative" key={item}>
                <button
                  type="button"
                  onClick={() => (menu ? setOpenMenu(openMenu === item ? null : item) : navigate(item))}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm transition ${
                    active
                      ? "bg-neutral-200/70 text-neutral-950 dark:bg-white/10 dark:text-white"
                      : "text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/[0.08] dark:hover:text-neutral-50"
                  }`}
                >
                  {t(topLevelLabels[item])}
                  {menu && <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {openMenu === item && menu && (
                  <div className="absolute left-0 top-10 w-64 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#161616] dark:shadow-2xl">
                    {menu.map((option) => (
                      <button
                        type="button"
                        key={option}
                        onClick={() => navigate(option)}
                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
                      >
                        {tc(option)}
                        {(option === activePage || (option === "API Prices" && activePage === "Pricing")) && (
                          <span className="h-1.5 w-1.5 rounded-full bg-neutral-950 dark:bg-white" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="ml-auto flex min-w-0 items-center justify-end gap-2">
          <div className="relative hidden w-72 2xl:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
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
              className="h-9 w-full rounded-md border border-neutral-300 bg-white py-2 pl-9 pr-14 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500 dark:border-white/15 dark:bg-white/5 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 dark:border-white/10 dark:bg-white/5 dark:text-neutral-500">
              Cmd K
            </span>
            {searchOpen && (
              <div className="absolute right-0 top-11 w-full rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#161616] dark:shadow-2xl">
                {filteredSearch.length ? (
                  filteredSearch.map((item) => (
                    <button
                      type="button"
                      key={item}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => navigate(item)}
                      className="block w-full rounded-md px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
                    >
                      {tc(item)}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-500">{t("noResults")}</p>
                )}
              </div>
            )}
          </div>

          <label className="hidden items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-600 dark:border-white/15 dark:bg-white/5 dark:text-neutral-300 md:inline-flex">
            <span className="sr-only">{t("language")}</span>
            <select
              value={language}
              onChange={(event) => onLanguageChange(event.target.value as LanguageCode)}
              className="clean-select h-9 max-w-36 bg-transparent text-sm outline-none"
              aria-label={t("language")}
            >
              {languages.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onToggleTheme}
            className="pressable inline-flex h-10 items-center gap-1 rounded-md border border-neutral-300 bg-white p-1 text-sm text-neutral-600 dark:border-white/15 dark:bg-white/5 dark:text-neutral-300"
            aria-label={`Switch to ${theme === "light" ? t("dark") : t("light")} mode`}
          >
            <span
              className={`inline-flex h-7 items-center gap-1 rounded px-2 ${
                theme === "light"
                  ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                  : "text-neutral-500 dark:text-neutral-400"
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t("light")}</span>
            </span>
            <span
              className={`inline-flex h-7 items-center gap-1 rounded px-2 ${
                theme === "dark"
                  ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                  : "text-neutral-500 dark:text-neutral-400"
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">{t("dark")}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={onDashboard}
            className="hidden h-9 items-center gap-1.5 rounded-md bg-neutral-950 px-3 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 sm:inline-flex"
          >
            {t("dashboard")}
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
