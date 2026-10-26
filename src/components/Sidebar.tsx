import {
  Activity,
  AudioWaveform,
  BadgeDollarSign,
  BookOpen,
  ChevronsUpDown,
  Cpu,
  FileText,
  Home,
  Image as ImageIcon,
  KeyRound,
  Languages,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sparkles,
  Terminal,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AuthUser } from "../data/auth";
import type { LanguageCode, TranslationKey } from "../data/i18n";

type SidebarProps = {
  activePage: string;
  collapsed: boolean;
  mobileOpen: boolean;
  language: LanguageCode;
  currentUser?: AuthUser;
  onOpenAuth?: () => void;
  t: (key: TranslationKey) => string;
  tc: (text: string) => string;
  onNavigate: (page: string) => void;
  onLanguageChange: (language: LanguageCode) => void;
  onDashboard: () => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
};

type NavEntry = {
  id: string;
  label: string;
  icon: typeof Home;
  targetPage: string;
  badge?: string;
  action?: "dashboard";
};

export function Sidebar({
  activePage,
  collapsed,
  mobileOpen,
  currentUser,
  onOpenAuth,
  onNavigate,
  onDashboard,
  onToggleCollapse,
  onCloseMobile,
}: SidebarProps) {
  const navigationRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const navigation = navigationRef.current;
    const focusable = () => Array.from(navigation?.querySelectorAll<HTMLElement>('button, input, select, a[href]') ?? [])
      .filter((element) => element.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    navigation?.addEventListener("keydown", trapFocus);
    return () => {
      cancelAnimationFrame(frame);
      navigation?.removeEventListener("keydown", trapFocus);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [mobileOpen]);
  const compact = collapsed && !mobileOpen;
  const [search, setSearch] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState("Default project");

  const navEntries: NavEntry[] = useMemo(
    () => [
      { id: "home", label: "Home", icon: Home, targetPage: "Overview" },
      { id: "models", label: "Models", icon: Cpu, targetPage: "Models", badge: "New" },
      { id: "pricing", label: "API Pricing", icon: BadgeDollarSign, targetPage: "Pricing" },
      { id: "subscriptions", label: "Subscriptions", icon: Sparkles, targetPage: "Subscription Prices", badge: "New" },
      { id: "playground", label: "Playground", icon: Terminal, targetPage: "Playground" },
      { id: "chat", label: "Text & Translation", icon: Languages, targetPage: "Text generation" },
      { id: "audio", label: "Audio & Speech", icon: AudioWaveform, targetPage: "Speech generation" },
      { id: "dubbing", label: "Dubbing", icon: Video, targetPage: "Dubbing" },
      { id: "images", label: "Images", icon: ImageIcon, targetPage: "Image translation" },
      { id: "pdf", label: "PDF Extraction", icon: FileText, targetPage: "PDF text extraction" },
      { id: "keys", label: "API Keys", icon: KeyRound, targetPage: "Dashboard", action: "dashboard" },
      { id: "usage", label: "Usage", icon: Activity, targetPage: "Dashboard", action: "dashboard" },
      { id: "batches", label: "Batches", icon: Layers, targetPage: "API Prices" },
      { id: "docs", label: "Docs", icon: BookOpen, targetPage: "Quickstart" },
      { id: "settings", label: "Settings", icon: Settings, targetPage: "Dashboard", action: "dashboard" },
    ],
    [],
  );

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return navEntries;
    return navEntries.filter((item) => item.label.toLowerCase().includes(q));
  }, [navEntries, search]);

  const isSelected = (entry: NavEntry) => {
    if (entry.id === "home") return activePage === "Overview" || activePage === "Home";
    if (entry.id === "models") return activePage === "Models";
    if (entry.id === "pricing") return activePage === "Pricing" || activePage === "API Prices";
    if (entry.id === "subscriptions") return activePage === "Subscription Prices" || activePage === "Ultra Builder";
    if (entry.id === "playground") return activePage === "Playground";
    if (entry.id === "docs") return activePage === "Quickstart";
    return activePage === entry.targetPage;
  };

  const handleClick = (entry: NavEntry) => {
    if (entry.action === "dashboard") {
      onDashboard();
    } else {
      onNavigate(entry.targetPage);
    }
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex min-h-0 h-full flex-col justify-between">
      {/* Top Section: Project selector + Search + Nav list */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Project Selector Header */}
        <div className="flex items-center justify-between border-b border-neutral-200/80 px-3 py-3 dark:border-neutral-800/80">
          {!compact ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setProjectOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900 transition hover:text-neutral-600 dark:text-neutral-100 dark:hover:text-white"
              >
                <span>{selectedProject}</span>
                <ChevronsUpDown className="h-3 w-3 text-neutral-400" />
              </button>

              {projectOpen && (
                <div className="absolute left-0 top-7 z-50 w-44 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-[#181818]">
                  {["Default project", "Production", "Staging"].map((proj) => (
                    <button
                      key={proj}
                      type="button"
                      onClick={() => {
                        setSelectedProject(proj);
                        setProjectOpen(false);
                      }}
                      className={`block w-full rounded px-2.5 py-1.5 text-left text-xs ${
                        selectedProject === proj
                          ? "bg-neutral-100 font-semibold text-neutral-900 dark:bg-neutral-800 dark:text-white"
                          : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800/60"
                      }`}
                    >
                      {proj}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-md bg-neutral-900 text-[10px] font-bold text-white dark:bg-white dark:text-neutral-900">
              L
            </div>
          )}

          {/* Toggle sidebar button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={compact ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden h-7 w-7 items-center justify-center rounded-md lg:flex text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            {compact ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Search input */}
        {!compact && (
          <div className="px-3 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="h-8 w-full rounded-lg border border-neutral-200 bg-neutral-50/80 pl-8 pr-8 text-xs text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-neutral-100 dark:focus:border-neutral-700"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-neutral-400">
                ⌘K
              </span>
            </div>
          </div>
        )}

        {/* Nav entries list */}
        <nav className="sidebar-scroll mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {filteredEntries.map((entry) => {
            const Icon = entry.icon;
            const active = isSelected(entry);

            return (
              <button
                key={entry.id}
                type="button"
                title={compact ? entry.label : undefined}
                onClick={() => handleClick(entry)}
                className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                  active
                    ? "bg-neutral-200/80 font-medium text-neutral-950 dark:bg-[#262626] dark:text-white"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-[#a3a3a3] dark:hover:bg-[#1c1c1c] dark:hover:text-white"
                } ${compact ? "justify-center px-2" : ""}`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 stroke-[1.75] ${
                    active
                      ? "text-neutral-950 dark:text-white"
                      : "text-neutral-500 group-hover:text-neutral-950 dark:text-[#8e8e8e] dark:group-hover:text-white"
                  }`}
                />
                {!compact && (
                  <span className="flex flex-1 items-center justify-between">
                    <span>{entry.label}</span>
                    {entry.badge && (
                      <span className="rounded bg-purple-100 px-1.5 py-0.2 text-[10px] font-semibold text-purple-700 dark:border dark:border-purple-800/40 dark:bg-purple-950/60 dark:text-purple-300">
                        {entry.badge}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Active User Account Profile */}
      <div className="border-t border-neutral-200/80 p-3 dark:border-neutral-800/80">
        <button
          type="button"
          onClick={() => {
            if (currentUser && currentUser.provider !== "guest") {
              onDashboard();
            } else {
              onOpenAuth?.();
            }
          }}
          title={currentUser && currentUser.provider !== "guest" ? "Open Account & Dashboard" : "Sign in to your account"}
          className={`flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition hover:bg-neutral-100 dark:hover:bg-neutral-800/60 ${
            compact ? "justify-center" : ""
          }`}
        >
          {/* Avatar circle */}
          <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-900 font-semibold text-white dark:bg-white dark:text-neutral-950 text-xs">
            {currentUser?.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : currentUser?.name ? (
              currentUser.name.charAt(0).toUpperCase()
            ) : (
              "D"
            )}
            {currentUser?.provider === "google" && !currentUser.avatar && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-white ring-1 ring-neutral-200 dark:ring-neutral-800">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4285F4]" />
              </span>
            )}
            {currentUser?.provider === "apple" && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-neutral-900 ring-1 ring-neutral-200 dark:bg-white dark:ring-neutral-800">
                <span className="h-1.5 w-1.5 rounded-full bg-white dark:bg-neutral-950" />
              </span>
            )}
          </div>
          {!compact && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                {currentUser?.name || "Sign In"}
              </p>
              <p className="truncate text-[10px] text-neutral-500">
                {currentUser?.provider && currentUser.provider !== "guest"
                  ? `${currentUser.provider.charAt(0).toUpperCase() + currentUser.provider.slice(1)} Account`
                  : "Click to sign in"}
              </p>
            </div>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={onCloseMobile}
          className="fixed inset-x-0 bottom-0 top-14 z-40 bg-neutral-950/40 backdrop-blur-xs dark:bg-black/70 lg:hidden"
        />
      )}

      <aside
        ref={navigationRef}
        id="site-navigation"
        aria-label="Main navigation"
        className={`fixed bottom-0 left-0 top-14 z-40 h-[calc(100dvh-3.5rem)] border-r border-neutral-200/80 bg-white transition-all duration-200 ease-in-out dark:border-neutral-800/80 dark:bg-[#121212] lg:sticky lg:top-14 lg:z-20 lg:translate-x-0 ${
          mobileOpen ? "visible translate-x-0 shadow-2xl" : "invisible -translate-x-full lg:visible lg:translate-x-0"
        } ${compact ? "w-16" : "w-60"}`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
