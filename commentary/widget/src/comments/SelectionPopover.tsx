import type { CSSProperties } from "react";

// Same chat-bubble glyph as the floating launcher pill.
const BUBBLE_PATH =
  "M12 20.25c4.97 0 9-3.69 9-8.25s-4.03-8.25-9-8.25S3 7.44 3 12c0 2.1.86 4.02 2.27 5.48.43.45.74 1.04.59 1.64a4.5 4.5 0 0 1-.92 1.79A5.97 5.97 0 0 0 6 21c1.28 0 2.47-.4 3.45-1.09.81.22 1.67.34 2.55.34Z";

interface Props {
  rect: DOMRect;
  onClick: () => void;
}

/** Floating "comment" affordance over a text selection — matches the launcher pill. */
export function SelectionPopover({ rect, onClick }: Props) {
  const style: CSSProperties = {
    position: "fixed",
    top: rect.top,
    left: rect.left,
    zIndex: 20,
  };
  return (
    <button
      type="button"
      style={style}
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-white shadow-[0_4px_16px_rgba(0,0,0,0.2)] hover:bg-stone-800"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        aria-hidden="true"
      >
        <path d={BUBBLE_PATH} />
      </svg>
      Comment
    </button>
  );
}
