import { Dialog } from "@base-ui-components/react/dialog";
import { useEffect, useState } from "react";
import { CONTRIBUTION_TYPES, type ContributionType } from "../../web3/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (type: ContributionType, body: string) => void;
  pending?: boolean;
  error?: string | null;
}

export function Composer({ open, onOpenChange, onSubmit, pending, error }: Props) {
  const [type, setType] = useState<ContributionType>("Commentary");
  const [body, setBody] = useState("");
  // Reset the form each time the dialog opens (it's reused across selections).
  useEffect(() => {
    if (open) {
      setBody("");
      setType("Commentary");
    }
  }, [open]);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-30 bg-black/30" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-40 w-[min(28rem,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-stone-200 bg-white p-4 shadow-lg dark:border-stone-700 dark:bg-stone-900">
          <Dialog.Title className="text-sm font-semibold">New comment</Dialog.Title>
          <label className="mt-3 block text-xs text-stone-500">
            Type
            <select
              className="mt-1 w-full rounded border border-stone-300 bg-transparent p-1.5 dark:border-stone-700"
              value={type}
              onChange={(e) => setType(e.target.value as ContributionType)}
            >
              {CONTRIBUTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs text-stone-500">
            Comment
            <textarea
              className="mt-1 h-28 w-full rounded border border-stone-300 bg-transparent p-2 dark:border-stone-700"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close className="rounded px-3 py-1 text-sm hover:bg-stone-100 dark:hover:bg-stone-800">
              Cancel
            </Dialog.Close>
            <button
              type="button"
              className="rounded bg-stone-900 px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
              disabled={pending || body.trim() === ""}
              onClick={() => onSubmit(type, body.trim())}
            >
              {pending ? "Publishing…" : "Publish to Sepolia"}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
