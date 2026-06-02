# ef-mandate-localize-jp

Japanese localization of the [EF Mandate PDF](https://ethereum.foundation/ef-mandate.pdf).

## Repository layout

- `source/en/chapters/` - frozen English chapter snapshots
- `source/ja/chapters/` - Japanese translation chapters
- `dist/` - generated merged markdown and PDF
- `scripts/build.py` - merge/export entrypoint

## Prerequisites 

### For translating and localizing

This repository has no prerequisite softwares, as it only requires editing markdown files in `source/ja/chapters/*.md`.

Only for exporting the merged markdown and PDF into `/dist`, the following dependencies are needed:
- [`python3`](https://www.python.org/)
- [`pandoc`](https://pandoc.org/)
- [`lualatex`](https://www.luatex.org/)

## Workflow

1. Add or update chapter files under `source/en/chapters/` and `source/ja/chapters/`.
2. Keep terminology aligned with `GLOSSARY.md`.
3. Run the build script to merge chapters and export the final document.

The canonical source text is the official PDF at \
https://ethereum.foundation/ef-mandate.pdf.
The English and Japanese chapter sets must match by two-digit chapter number.

## Build

For merged markdown & pdf:
```bash
# exports a merged markdown and pdf to /dist
# requires python3, pandoc and lualatex
python3 scripts/build.py

#also works
make pdf
```

For merged markdown only:
``` bash
# exports a merged markdown without pdf
# requires only python3, no pandoc needed
python3 scripts/build.py --no-pdf

# also works
make markdown
```
The script validates that the English and Japanese chapter numbers line up, writes a merged markdown manuscript to `dist/ef-mandate-ja.md`, and renders `dist/ef-mandate-ja.pdf` when `pandoc` and the LaTeX toolchain are installed.

For markdown-only work, pass `--no-pdf`.
