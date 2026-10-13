import { Globe2 } from "lucide-react";

export function Footer({ onNavigate }: { onNavigate: (page: string) => void }) {
  return (
    <footer className="mt-24 border-t border-neutral-200/80 bg-white py-14 text-xs text-neutral-600 dark:border-neutral-800/80 dark:bg-[#0d0d0d] dark:text-neutral-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-black dark:bg-white">
                <img
                  src={`${import.meta.env.BASE_URL}assets/lingofusion-logo-square.png`}
                  alt="LingoFusion"
                  width="28"
                  height="28"
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                LingoFusion Developers
              </span>
            </div>
            <p className="mt-3 max-w-sm text-xs leading-5 text-neutral-500">
              The universal multilingual intelligence platform. Powering natural translation, speech synthesis, dubbing, and multimodal localization for global applications.
            </p>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
              <span>All Systems Operational</span>
            </div>
          </div>

          {/* Models Column */}
          <div>
            <p className="font-semibold text-neutral-900 dark:text-neutral-200">Models</p>
            <ul className="mt-3 space-y-2">
              {["LingoFusion Pro", "LingoFusion Ultra", "LingoFusion", "LingoFusion Lite", "LingoFusion Explain", "LingoFusion Nano"].map((m) => (
                <li key={m}>
                  <button
                    type="button"
                    onClick={() => onNavigate(m)}
                    className="hover:text-neutral-950 dark:hover:text-white"
                  >
                    {m}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Platform Column */}
          <div>
            <p className="font-semibold text-neutral-900 dark:text-neutral-200">Platform</p>
            <ul className="mt-3 space-y-2">
              <li>
                <button type="button" onClick={() => onNavigate("Models")} className="hover:text-neutral-950 dark:hover:text-white">
                  Model Catalog
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate("API Prices")} className="hover:text-neutral-950 dark:hover:text-white">
                  API Pricing
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate("Subscription Prices")} className="hover:text-neutral-950 dark:hover:text-white">
                  Subscriptions
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate("Playground")} className="hover:text-neutral-950 dark:hover:text-white">
                  Playground
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate("Quickstart")} className="hover:text-neutral-950 dark:hover:text-white">
                  Documentation
                </button>
              </li>
            </ul>
          </div>

          {/* Resources Column */}
          <div>
            <p className="font-semibold text-neutral-900 dark:text-neutral-200">Resources</p>
            <ul className="mt-3 space-y-2">
              {["Text generation", "Speech generation", "Dubbing", "Image translation", "Changelog", "Support", "Status"].map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item)}
                    className="hover:text-neutral-950 dark:hover:text-white"
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-200/80 pt-8 sm:flex-row dark:border-neutral-800/80">
          <p className="text-neutral-500">
            &copy; {new Date().getFullYear()} LingoFusion Inc. All rights reserved.
          </p>
          <div className="flex gap-4 text-neutral-500">
            <span>Privacy Policy</span>
            <span>&bull;</span>
            <span>Terms of Service</span>
            <span>&bull;</span>
            <span>Security</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
