import type { ReactNode } from "react";
import { ct } from "./i18n";

interface Props {
  lang: string;
  count: number;
  mode: "list" | "compose";
  /** Wallet control (ConnectButton) rendered in the header — built inside the providers. */
  wallet: ReactNode;
  onBack: () => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Fixed right sidebar shell: header (wallet · title/count or back · close) + a
 * scrollable body slot. Layout-independent (pinned to the viewport) so it works
 * on any host. The body is the comment list or the composer, chosen by the caller.
 */
export function Panel({ lang, count, mode, wallet, onBack, onClose, children }: Props) {
  return (
    <aside className="fixed right-0 top-0 z-40 flex h-full w-[340px] max-w-[85vw] flex-col border-l border-stone-200 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] dark:border-stone-700 dark:bg-stone-900">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-3 py-2.5 dark:border-stone-700">
        {mode === "compose" ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            <span aria-hidden="true">←</span> {ct(lang, "back")}
          </button>
        ) : (
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            {ct(lang, "threadTitle")}
            {count > 0 ? (
              <span className="ml-1.5 font-normal text-stone-400 dark:text-stone-500">{count}</span>
            ) : null}
          </h2>
        )}
        <div className="flex items-center gap-2">
          {wallet}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}
