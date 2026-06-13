import { useState } from "react";
import type { AnnoFields } from "@commentary/core/anno/schema";
import { ct } from "./i18n";

const shortHex = (h: string) => (h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h);

interface Props {
  /** The anchored fields for the current selection (quote + on-chain preview). */
  fields: AnnoFields | null;
  lang: string;
  pending?: boolean;
  error?: string | null;
  connected?: boolean;
  onConnect?: () => void;
  onSubmit: (body: string) => void;
  schemaUid?: string;
}

/** Inline composer rendered in the Panel body when mode === "compose". */
export function Composer({
  fields,
  lang,
  pending,
  error,
  connected = true,
  onConnect,
  onSubmit,
  schemaUid,
}: Props) {
  const [body, setBody] = useState("");
  return (
    <div className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
        {ct(lang, "compose")}
      </p>
      {fields ? (
        <blockquote className="mt-2 border-l-2 border-amber-300 pl-2 text-xs italic leading-snug text-stone-500 dark:border-amber-500/60 dark:text-stone-400">
          “{fields.spanExact}”
        </blockquote>
      ) : null}
      <textarea
        className="mt-3 h-28 w-full rounded border border-stone-300 bg-transparent p-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-700"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={!connected}
        aria-label="Comment"
        placeholder={connected ? ct(lang, "composePlaceholder") : ""}
      />
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {fields ? (
        <details className="mt-3 text-xs text-stone-400 dark:text-stone-500">
          <summary className="cursor-pointer select-none">{ct(lang, "onchainDetails")}</summary>
          <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-2 border-t border-stone-100 pt-2 font-mono dark:border-stone-800">
            <dt>lang</dt>
            <dd>{fields.lang}</dd>
            <dt>origin</dt>
            <dd className="truncate">{fields.origin}</dd>
            <dt>url</dt>
            <dd className="truncate">{fields.urlCanonical}</dd>
            <dt>rootSelector</dt>
            <dd className="truncate">{fields.rootSelector}</dd>
            <dt>containerHash</dt>
            <dd className="truncate">{shortHex(fields.containerHash)}</dd>
            <dt>spanStart</dt>
            <dd>{fields.spanStart}</dd>
            <dt>spanEnd</dt>
            <dd>{fields.spanEnd}</dd>
            <dt>spanExact</dt>
            <dd className="truncate">{fields.spanExact}</dd>
            <dt>spanPrefix</dt>
            <dd className="truncate">{fields.spanPrefix}</dd>
            <dt>spanSuffix</dt>
            <dd className="truncate">{fields.spanSuffix}</dd>
            <dt>parentUid</dt>
            <dd className="truncate">{shortHex(fields.parentUid)}</dd>
            <dt>meta</dt>
            <dd className="truncate">{fields.meta || "—"}</dd>
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
        </details>
      ) : null}
      <div className="mt-4 flex justify-end">
        {connected ? (
          <button
            type="button"
            className="rounded bg-stone-900 px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
            disabled={pending || body.trim() === ""}
            onClick={() => onSubmit(body.trim())}
          >
            {pending ? ct(lang, "publishing") : ct(lang, "publish")}
          </button>
        ) : (
          <button
            type="button"
            className="rounded bg-stone-900 px-3 py-1 text-sm text-white dark:bg-stone-100 dark:text-stone-900"
            onClick={onConnect}
          >
            {ct(lang, "connectToPublish")}
          </button>
        )}
      </div>
    </div>
  );
}
