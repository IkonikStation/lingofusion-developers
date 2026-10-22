import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export type PickerItem = {
  id: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
};

export type PopoverAlign = "left" | "right";

const panelPositionClass = (align: PopoverAlign) => (align === "right" ? "right-0" : "left-0");

/** Shared outside-click + Escape dismissal for popover-style controls. */
function useDismiss(open: boolean, close: () => void) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return rootRef;
}

const triggerBaseClass =
  "inline-flex h-10 w-full items-center gap-2 rounded-xl border bg-white pl-3 pr-2.5 text-xs outline-none transition focus-visible:border-neutral-900 dark:focus-visible:border-neutral-300";

const triggerOpenClass = "border-neutral-900 dark:border-neutral-300";
const triggerClosedClass =
  "border-neutral-300 hover:bg-neutral-50 dark:border-white/15 dark:bg-neutral-950 dark:hover:bg-neutral-900";

const panelBaseClass =
  "absolute top-[calc(100%+6px)] z-40 w-[min(19rem,calc(100vw-2.5rem))] rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl dark:border-white/15 dark:bg-neutral-900 sm:w-[17rem]";

/**
 * Searchable select (listbox) used for languages and models where the raw
 * native <select> is hard to navigate (hundreds of options, no icons/hints).
 */
export function Picker({
  label,
  items,
  value,
  onChange,
  testId,
  className,
  align = "left",
  searchPlaceholder = "Search…",
}: {
  label: string;
  items: PickerItem[];
  value: string;
  onChange: (id: string) => void;
  testId?: string;
  className?: string;
  align?: PopoverAlign;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useDismiss(open, () => setOpen(false));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  const selected = items.find((item) => item.id === value);
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? items.filter((item) => item.label.toLowerCase().includes(normalized))
    : items;

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      searchRef.current?.focus();
      selectedRef.current?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
      return;
    }
    setQuery("");
    setOpen(true);
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid={testId}
        onClick={toggle}
        className={`${triggerBaseClass} ${open ? triggerOpenClass : triggerClosedClass}`}
      >
        {selected?.icon}
        <span className="min-w-0 flex-1 truncate text-left font-semibold text-neutral-950 dark:text-white">
          {selected?.label ?? "Select…"}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className={`${panelBaseClass} ${panelPositionClass(align)}`}>
          <div className="flex items-center gap-2 rounded-lg bg-neutral-100 px-2.5 dark:bg-neutral-800">
            <Search className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full bg-transparent text-xs text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white"
            />
          </div>

          <div
            role="listbox"
            aria-label={label}
            className="mt-1 max-h-64 overflow-y-auto overscroll-contain"
          >
            {filtered.length === 0 ? (
              <p className="px-2.5 py-3 text-xs text-neutral-400 dark:text-neutral-500">
                No matches for “{query}”.
              </p>
            ) : (
              filtered.map((item) => {
                const isSelected = item.id === value;
                return (
                  <button
                    key={item.id}
                    ref={isSelected ? selectedRef : undefined}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(item.id);
                      setOpen(false);
                      requestAnimationFrame(() => triggerRef.current?.focus());
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs ${
                      isSelected
                        ? "bg-neutral-100 text-neutral-950 dark:bg-white/10 dark:text-white"
                        : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-white/5"
                    }`}
                  >
                    {item.icon}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint && (
                      <span className="shrink-0 font-sans tabular-nums text-[10px] text-neutral-400">
                        {item.hint}
                      </span>
                    )}
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Generic anchored popover (trigger content + panel content as render prop). */
export function Popover({
  trigger,
  badge,
  children,
}: {
  trigger: ReactNode;
  badge?: number;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useDismiss(open, () => setOpen(false));
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold text-neutral-950 outline-none transition focus-visible:border-neutral-900 dark:text-white dark:focus-visible:border-neutral-300 ${
          open
            ? "border-neutral-900 bg-neutral-100 dark:border-neutral-300 dark:bg-neutral-900"
            : "border-neutral-300 bg-white hover:bg-neutral-50 dark:border-white/15 dark:bg-neutral-950 dark:hover:bg-neutral-900"
        }`}
      >
        {trigger}
        {typeof badge === "number" && badge > 0 && (
          <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-neutral-950 px-1 font-mono text-[10px] font-semibold text-white dark:bg-white dark:text-neutral-950">
            {badge}
          </span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-neutral-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-[calc(100%+6px)] z-40 w-[min(19rem,calc(100vw-2.5rem))] rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl dark:border-white/15 dark:bg-neutral-900 lg:left-auto lg:right-0 lg:w-64"
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

function OptionPill({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-neutral-950 dark:bg-white" : "bg-neutral-300 dark:bg-neutral-700"
      }`}
    >
      <span
        className={`block h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform dark:bg-neutral-950 ${
          checked ? "translate-x-[16px]" : "translate-x-[2px]"
        }`}
      />
    </span>
  );
}

/** A labelled toggle row: hidden checkbox + custom pill switch. */
export function SwitchRow({
  icon: Icon,
  label,
  checked,
  onChange,
  testId,
}: {
  icon: typeof Check;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId?: string;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neutral-950/20 dark:text-neutral-200 dark:hover:bg-white/5 dark:has-[:focus-visible]:ring-white/30">
      <input
        type="checkbox"
        data-testid={testId}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
      <span className="min-w-0 flex-1">{label}</span>
      <OptionPill checked={checked} />
    </label>
  );
}
