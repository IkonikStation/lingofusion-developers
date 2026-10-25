import { HelpCircle, X } from "lucide-react";
import { useEffect } from "react";

interface FeeBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountCredit: string;
  cardNetworkFee: string;
  totalCharged: string;
}

export function FeeBreakdownModal({
  isOpen,
  onClose,
  accountCredit,
  cardNetworkFee,
  totalCharged,
}: FeeBreakdownModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fee-breakdown-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-2xl transition-all dark:border-white/10 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800 dark:bg-white/10 dark:text-neutral-200">
              <HelpCircle className="h-4 w-4" />
            </div>
            <h3
              id="fee-breakdown-title"
              className="text-base font-semibold text-neutral-950 dark:text-white"
            >
              Fee Breakdown
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
          Payment Processing Breakdown. Card networks and issuing banks apply a standard interchange and settlement fee to every online transaction. To ensure that 100% of your deposit goes directly toward your usable API balance, this processing cost is billed at cost rather than deducted from your compute credits.
        </p>

        <div className="mt-5 divide-y divide-neutral-200/80 rounded-xl border border-neutral-200/80 bg-neutral-50/70 text-xs dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <span className="font-medium text-neutral-600 dark:text-neutral-400">Account Credit</span>
            <span className="font-sans tabular-nums font-semibold text-neutral-900 dark:text-white">
              {accountCredit}
            </span>
          </div>
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <span className="font-medium text-neutral-600 dark:text-neutral-400">Card Network Fee</span>
            <span className="font-sans tabular-nums text-neutral-700 dark:text-neutral-300">
              {cardNetworkFee}
            </span>
          </div>
          <div className="flex items-center justify-between px-3.5 py-2.5 font-bold text-neutral-950 dark:text-white">
            <span>Total Charged</span>
            <span className="font-sans tabular-nums text-sm text-neutral-950 dark:text-white">
              {totalCharged}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={onClose}
            className="pressable inline-flex h-10 w-full items-center justify-center rounded-xl bg-neutral-950 text-xs font-semibold text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
