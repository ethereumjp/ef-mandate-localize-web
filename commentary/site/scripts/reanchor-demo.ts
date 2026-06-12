// In-memory demonstration of the four re-anchoring outcomes. No files are touched.
import { buildChapterAnchors } from "../src/lib/anchors";
import { makeAnchor, project, type CurrentBlock } from "@commentary/core/lib/anchoring";

const base = (p2: string) =>
  `<!-- block: 02-p1 -->\n# II. Our Role\n\n<!-- block: 02-p2 -->\n${p2}`;

const ORIGINAL_P2 = "Our ultimate goal is for Ethereum to pass the walkaway test.";

const orig = buildChapterAnchors(base(ORIGINAL_P2))["02-p2"];
const qs = [...orig.text.slice(0, orig.text.indexOf("walkaway"))].length;
const anchor = makeAnchor(orig.blockHash, orig.text, qs, qs + "walkaway".length);

function blockOf(p2: string | null): CurrentBlock | null {
  if (p2 === null) return null;
  return buildChapterAnchors(base(p2))["02-p2"] ?? null;
}

const scenarios: Array<[string, string | null]> = [
  ["unchanged block", ORIGINAL_P2],
  ["block edited, quote survives", "Ultimately, Ethereum must pass the walkaway test someday."],
  ["quote rewritten", "Our ultimate goal is for Ethereum to pass the leave test."],
  ["block removed", null],
];

console.log(`anchor: "${anchor.exact}" @ [${anchor.start},${anchor.end}) of 02-p2\n`);
for (const [label, p2] of scenarios) {
  const p = project(anchor, blockOf(p2));
  const tag = p.pastVersion ? " [past version]" : "";
  const at = p.start !== null ? ` @ [${p.start},${p.end})` : "";
  console.log(`${label.padEnd(32)} -> ${p.status}${at}${tag}`);
}
