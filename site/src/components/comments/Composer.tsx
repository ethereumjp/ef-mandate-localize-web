import { Dialog } from "@base-ui-components/react/dialog";
import { useEffect, useState } from "react";
import type { CommentFields } from "../../web3/schema";

const shortHex = (h: string) => (h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (body: string) => void;
  pending?: boolean;
  error?: string | null;
  connected?: boolean;
  onConnect?: () => void;
  fieldsPreview?: Omit<CommentFields, "body"> | null;
  schemaUid?: string;
}

export function Composer({
  open,
  onOpenChange,
  onSubmit,
  pending,
  error,
  connected = true,
  onConnect,
  fieldsPreview,
  schemaUid,
}: Props) {
  const [body, setBody] = useState("");
  // Reset the form each time the dialog opens (it's reused across selections).
  useEffect(() => {
    if (open) {
      setBody("");
    }
  }, [open]);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-30 bg-black/20 dark:bg-white/20 backdrop-blur-xxs" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-40 w-[min(28rem,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-stone-200 bg-white p-4 shadow-lg dark:border-stone-700 dark:bg-stone-900">
          <Dialog.Title className="flex items-center gap-2 text-sm font-semibold">
            <svg
              className="size-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z"
              />
            </svg>
            <span className="sr-only">New comment</span>
            {fieldsPreview ? (
              <span className="min-w-0 truncate font-normal italic" title={fieldsPreview.spanExact}>
                “{fieldsPreview.spanExact}”
              </span>
            ) : null}
          </Dialog.Title>
          <textarea
            className="mt-3 h-28 w-full rounded border border-stone-300 bg-transparent p-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={!connected}
            aria-label="Comment"
            placeholder={connected ? "Write your comment…" : ""}
          />
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          {fieldsPreview ? (
            <div className="mt-3 border-t border-stone-100 pt-2 text-xs text-stone-400 dark:border-stone-800 dark:text-stone-500">
              <p className="mb-1">Recorded on-chain (EAS attestation):</p>
              <dl className="grid grid-cols-[7rem_1fr] gap-x-2 font-mono">
                <dt>lang</dt>
                <dd>{fieldsPreview.lang}</dd>
                <dt>chapter</dt>
                <dd>{fieldsPreview.chapter}</dd>
                <dt>blockId</dt>
                <dd>{fieldsPreview.blockId}</dd>
                <dt>blockHash</dt>
                <dd className="truncate">{shortHex(fieldsPreview.blockHash)}</dd>
                <dt>spanStart</dt>
                <dd>{fieldsPreview.spanStart}</dd>
                <dt>spanEnd</dt>
                <dd>{fieldsPreview.spanEnd}</dd>
                <dt>spanExact</dt>
                <dd className="truncate">{fieldsPreview.spanExact}</dd>
                <dt>spanPrefix</dt>
                <dd className="truncate">{fieldsPreview.spanPrefix}</dd>
                <dt>spanSuffix</dt>
                <dd className="truncate">{fieldsPreview.spanSuffix}</dd>
                <dt>parentUid</dt>
                <dd className="truncate">{shortHex(fieldsPreview.parentUid)}</dd>
                <dt>body</dt>
                <dd className="truncate">{body ? `"${body}"` : "—"}</dd>
              </dl>
              {schemaUid ? (
                <a
                  href={`https://sepolia.easscan.org/schema/view/${schemaUid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block underline hover:text-stone-600 dark:hover:text-stone-300"
                >
                  EAS schema ↗
                </a>
              ) : null}
            </div>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close className="rounded px-3 py-1 text-sm hover:bg-stone-100 dark:hover:bg-stone-800">
              Cancel
            </Dialog.Close>
            {connected ? (
              <button
                type="button"
                className="rounded bg-stone-900 px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
                disabled={pending || body.trim() === ""}
                onClick={() => onSubmit(body.trim())}
              >
                {pending ? "Publishing…" : "Publish to Sepolia"}
              </button>
            ) : (
              <button
                type="button"
                className="rounded bg-stone-900 px-3 py-1 text-sm text-white dark:bg-stone-100 dark:text-stone-900"
                onClick={onConnect}
              >
                Connect to publish
              </button>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
