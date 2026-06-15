import { useEnsAvatar, useEnsName } from "wagmi";
import { mainnet } from "wagmi/chains";
import { normalize } from "viem/ens";
import type { CommentNode } from "../web3/thread";
import type { StoredAnno } from "@commentary/core/anno/locate";
import type { Projection } from "@commentary/core/lib/anchoring";
import { ct } from "./i18n";
import { AnchorStatusBadge } from "./AnchorStatusBadge";

function short(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

interface Props {
  node: CommentNode<StoredAnno>;
  projection?: Projection;
  lang: string;
  depth?: number;
  focusedUid?: string | null;
  pendingUids?: Set<string>;
  onFocus?: (uid: string) => void;
}

export function CommentCard({
  node,
  projection,
  lang,
  depth = 0,
  focusedUid,
  pendingUids,
  onFocus,
}: Props) {
  const c = node.comment;
  const focused = depth === 0 && focusedUid === c.uid;
  const pending = pendingUids?.has(c.uid) ?? false;
  // ENS reverse records live on mainnet; resolve there and fall back to the
  // shortened address when the attester has no name.
  const { data: ensName } = useEnsName({
    address: c.attester as `0x${string}`,
    chainId: mainnet.id,
  });
  // Show the attester's ENS avatar when they have one (resolved on mainnet).
  const { data: ensAvatar } = useEnsAvatar({
    name: ensName ? normalize(ensName) : undefined,
    chainId: mainnet.id,
  });
  return (
    <div
      data-uid={depth === 0 ? c.uid : undefined}
      onClick={depth === 0 ? () => onFocus?.(c.uid) : undefined}
      className={
        depth > 0
          ? "mt-3 border-l border-cobalt/30 pl-3"
          : `cursor-pointer border-l-3 px-3.5 py-4 transition-colors ${
              focused
                ? "border-cobalt bg-surface"
                : "border-cobalt/40 hover:bg-surface"
            }`
      }
    >
      {depth === 0 ? (
        <blockquote className="line-clamp-1 border-l border-cobalt/40 pl-2 text-xs leading-snug text-cobalt/45">
          {c.spanExact}
        </blockquote>
      ) : null}
      <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-cobalt">
        {c.body}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-cobalt/45">
        {ensAvatar ? (
          <img
            src={ensAvatar}
            alt=""
            className="size-4 shrink-0 rounded-full border border-cobalt/30 object-cover"
          />
        ) : null}
        <span className="font-mono">{ensName ?? short(c.attester)}</span>
        {c.time > 0 ? <span>{new Date(c.time * 1000).toLocaleDateString(lang)}</span> : null}
        {projection ? <AnchorStatusBadge status={projection.status} lang={lang} /> : null}
        {projection?.pastVersion ? (
          <span className="text-cobalt/70">{ct(lang, "pastVersion")}</span>
        ) : null}
        {pending ? (
          <span
            aria-hidden
            className="inline-block size-1.5 animate-pulse bg-cobalt"
          />
        ) : null}
        <button
          type="button"
          disabled
          onClick={(e) => e.stopPropagation()}
          className="cursor-not-allowed opacity-50"
        >
          {ct(lang, "reply")}
        </button>
      </div>
      {node.replies.map((r) => (
        <CommentCard
          key={r.comment.uid}
          node={r}
          lang={lang}
          depth={depth + 1}
          focusedUid={focusedUid}
          pendingUids={pendingUids}
          onFocus={onFocus}
        />
      ))}
    </div>
  );
}
