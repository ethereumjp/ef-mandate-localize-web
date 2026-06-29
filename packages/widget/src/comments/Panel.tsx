import type { ReactNode } from "react";
import { ct } from "./i18n";

interface Props {
  lang: string;
  count: number;
  mode: "list" | "compose";
  /** Wallet control (ConnectButton) rendered in the header — built inside the providers. */
  wallet: ReactNode;
  onBack: () => void;
  children: ReactNode;
}

/**
 * Fixed right sidebar shell: header (title/count or back · wallet) + a scrollable
 * body slot. Layout-independent (pinned to the viewport) so it works on any host.
 * Closing is owned by the floating button's chevron, so there's no header ✕.
 */
export function Panel({ lang, count, mode, wallet, onBack, children }: Props) {
  return (
    <aside className="annotation-panel-shadow fixed inset-x-0 bottom-0 z-40 flex max-h-[75dvh] flex-col overflow-hidden border-t border-cobalt bg-white font-mono sm:inset-x-auto sm:right-0 sm:h-full sm:max-h-none sm:w-[340px] sm:border-t-0 sm:border-l">
      <div className="flex items-center justify-between gap-2 border-b border-cobalt/40 px-3 py-2.5">
        {mode === "compose" ? (
          <button
            type="button"
            onClick={onBack}
            className="flex cursor-pointer items-center gap-1 px-1.5 py-1 text-xs font-semibold uppercase text-cobalt hover:bg-surface"
          >
            <span aria-hidden="true">←</span> {ct(lang, "back")}
          </button>
        ) : (
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-cobalt">
            <span aria-hidden="true">▸ </span>
            {ct(lang, "threadTitle")}
            {count > 0 ? (
              <span className="ml-1.5 font-normal text-cobalt/70">
                [{count}]
              </span>
            ) : null}
          </h2>
        )}
        {wallet}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-20 sm:pb-0">
        {children}
      </div>
      {mode === "list" ? (
        <div className="border-t border-cobalt/40 px-3 py-2.5 text-[11px] text-cobalt/50">
          <span aria-hidden="true">✎ </span>
          {ct(lang, "selectToComment")}
        </div>
      ) : null}
    </aside>
  );
}
