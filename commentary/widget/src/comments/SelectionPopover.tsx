import type { CSSProperties } from "react";

interface Props {
  rect: DOMRect;
  onClick: () => void;
}

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
      className="rounded h-8 border border-stone-300 bg-white px-2 py-1 text-xs shadow hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800"
    >
      💬 Comment
    </button>
  );
}
