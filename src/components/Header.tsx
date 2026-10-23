import { ExternalLink, Menu, Moon, PlusCircle, Search, Sun, Wallet, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { LanguageCode, TranslationKey } from "../data/i18n";
import { languages } from "../data/i18n";
import { formatUsd } from "../lib/utils";

type HeaderProps = {
  activePage: string;
  isSubscriptionPage: boolean;
  theme: "light" | "dark";
  language: LanguageCode;
  mobileOpen: boolean;
  searchItems: string[];
  balanceUsd?: number;
  t: (key: TranslationKey) => string;
  tc: (text: string) => string;
  onNavigate: (page: string) => void;
  onLanguageChange: (language: LanguageCode) => void;
  onDashboard: () => void;
  onToggleTheme: () => void;
  onToggleMobile: () => void;
};

const navItems = [
  { label: "Overview", page: "Overview" },
  { label: "Models", page: "Models" },
  { label: "Pricing", page: "Pricing" },
  { label: "Subscriptions", page: "Subscription Prices" },
  { label: "Playground", page: "Playground" },
  { label: "Docs", page: "Quickstart" },
] as const;

export function Header({
  activePage,
  isSubscriptionPage,
  theme,
  language,
  mobileOpen,
  searchItems,
  balanceUsd = 0,
  t,
  tc,
  onNavigate,
  onLanguageChange,
  onDashboard,
  onToggleTheme,
  onToggleMobile,
}: HeaderProps) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const filteredSearch = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return searchItems.slice(0, 6);
    return searchItems
      .filter((item) => item.toLowerCase().includes(normalized))
      .slice(0, 8);
  }, [query, searchItems]);

  const navigate = (page: string) => {
    onNavigate(page);
    setSearchOpen(false);
    setQuery("");
  };

  const isCurrent = (page: string) => {
    if (page === "Pricing") return activePage === "Pricing" || activePage === "API Prices";
    if (page === "Subscription Prices") return isSubscriptionPage;
    if (page === "Models") return activePage === "Models";
    if (page === "Playground") return activePage === "Playground";
    if (page === "Quickstart") return activePage === "Quickstart" || activePage === "Overview";
    return activePage === page;
  };

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/95 backdrop-blur-md dark:border-neutral-800/80 dark:bg-[#0d0d0d]/95">
      <div className="flex h-14 w-full items-center justify-between px-3 sm:px-4 lg:px-6">
        {/* Left: Mobile hamburger + Brand logo */}
        <div className="flex items-center gap-3 sm:gap-6">
          {!isSubscriptionPage && (
            <button
              type="button"
              aria-label={mobileOpen ? t("closeNavigation") : t("openNavigation")}
              onClick={onToggleMobile}
              className="grid h-8 w-8 place-items-center rounded-md text-neutral-600 hover:text-neutral-900 lg:hidden dark:text-neutral-400 dark:hover:text-white"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate("Overview")}
            className="group flex items-center gap-2.5 text-left transition"
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/lingofusion-logo-square.png`}
              alt="LingoFusion"
              width="32"
              height="32"
              className="h-8 w-8 shrink-0 object-contain drop-shadow-sm transition group-hover:scale-105"
            />
            <div className="flex flex-col leading-none">
              <span className="text-[13.5px] font-bold tracking-tight text-neutral-900 dark:text-white">
                LingoFusion
              </span>
              <span className="mt-0.5 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
                API
              </span>
            </div>
          </button>

          {/* Center/Left Nav links */}
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const active = isCurrent(item.page);
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.page)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-neutral-100 text-neutral-950 font-semibold dark:bg-neutral-800/80 dark:text-white"
                      : "text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Live Balance, Search, Language, Theme, Dashboard */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Balance Indicator */}
          <button
            type="button"
            onClick={() => navigate("Playground")}
            title="Live Prepaid Balance (Click to open Playground & Deposit)"
            data-testid="header-live-balance"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50/90 px-3 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
          >
            <Wallet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden text-[11px] font-medium text-emerald-700/80 xl:inline dark:text-emerald-300/80">Balance:</span>
            <span className="font-sans tabular-nums tracking-tight" data-testid="header-balance-amount">
              ${formatUsd(Number(balanceUsd) || 0)}
            </span>
            <PlusCircle className="h-3 w-3 text-emerald-600/80 dark:text-emerald-400/80" />
          </button>

          {/* Minimal Search bar */}
          <div className="relative hidden w-44 sm:block lg:w-52">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredSearch[0]) navigate(filteredSearch[0]);
                if (e.key === "Escape") setSearchOpen(false);
              }}
              placeholder="Search API reference..."
              className="h-8 w-full rounded-md border border-neutral-200 bg-neutral-50/80 pl-8 pr-10 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-600"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-neutral-200 bg-white px-1 py-0.2 font-mono text-[9px] text-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-500">
              ⌘K
            </span>

            {searchOpen && (
              <div className="absolute right-0 top-10 w-full rounded-md border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-[#141414]">
                {filteredSearch.length ? (
                  filteredSearch.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => navigate(item)}
                      className="block w-full rounded px-2.5 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    >
                      {tc(item)}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-xs text-neutral-500">No results found</p>
                )}
              </div>
            )}
          </div>

          {/* Language selector */}
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
            className="hidden h-8 rounded-md border border-neutral-200 bg-transparent px-2 text-xs text-neutral-600 outline-none dark:border-neutral-800 dark:text-neutral-400 sm:block"
            aria-label="Language"
          >
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code.toUpperCase()}
              </option>
            ))}
          </select>

          {/* Theme switcher */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:text-white"
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </button>

          {/* Dashboard Button */}
          <button
            type="button"
            onClick={onDashboard}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-neutral-950 px-3.5 text-xs font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            <span>Dashboard</span>
            <ExternalLink className="h-3 w-3 opacity-70" />
          </button>
        </div>
      </div>
    </header>
  );
}
