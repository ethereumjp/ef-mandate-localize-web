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
- `python3`
- `pandoc` 
- `xelatex`

## Workflow

1. Add or update matching chapter files under `source/en/chapters/` and `source/ja/chapters/`.
2. Keep terminology aligned with `GLOSSARY.md`.
3. Run the build script to merge chapters and export the final document.

The canonical source text is the official PDF at \
https://ethereum.foundation/ef-mandate.pdf.

## Build

```bash
python3 scripts/build.py
```

The script checks that the English and Japanese chapter filenames match, writes a merged markdown manuscript to `dist/ef-mandate-ja.md`, and renders `dist/ef-mandate-ja.pdf` when `pandoc` and the LaTeX toolchain are installed.

For markdown-only work, pass `--no-pdf`.
