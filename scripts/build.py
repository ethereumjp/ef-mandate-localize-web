#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_DIR = ROOT / "source" / "ja" / "chapters"
DEFAULT_REFERENCE_DIR = ROOT / "source" / "en" / "chapters"
DEFAULT_DIST_DIR = ROOT / "dist"
DEFAULT_OUTPUT_MD = DEFAULT_DIST_DIR / "ef-mandate-ja.md"
DEFAULT_OUTPUT_PDF = DEFAULT_DIST_DIR / "ef-mandate-ja.pdf"


@dataclass(frozen=True)
class Chapter:
    path: Path
    text: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Merge chapter markdown and optionally export PDF.")
    parser.add_argument(
        "--chapters-dir",
        type=Path,
        default=DEFAULT_SOURCE_DIR,
        help="Directory containing chapter markdown files.",
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=DEFAULT_REFERENCE_DIR,
        help="Directory containing the frozen English source chapters.",
    )
    parser.add_argument(
        "--output-md",
        type=Path,
        default=DEFAULT_OUTPUT_MD,
        help="Path to the merged markdown manuscript.",
    )
    parser.add_argument(
        "--output-pdf",
        type=Path,
        default=DEFAULT_OUTPUT_PDF,
        help="Path to the rendered PDF.",
    )
    parser.add_argument(
        "--title",
        default="EF Mandate 日本語版",
        help="Document title for the merged manuscript.",
    )
    parser.add_argument(
        "--no-pdf",
        action="store_true",
        help="Skip PDF generation even if pandoc is installed.",
    )
    return parser.parse_args()


def list_chapters(chapters_dir: Path) -> list[Path]:
    if not chapters_dir.exists():
        raise FileNotFoundError(f"Chapter directory does not exist: {chapters_dir}")

    chapter_paths = sorted(
        path for path in chapters_dir.glob("*.md") if path.is_file() and not path.name.startswith(".")
    )
    if not chapter_paths:
        raise FileNotFoundError(f"No markdown chapters found in: {chapters_dir}")

    return chapter_paths


def chapter_stems(paths: list[Path]) -> set[str]:
    return {path.stem for path in paths}


def validate_alignment(source_paths: list[Path], translation_paths: list[Path]) -> None:
    source_stems = chapter_stems(source_paths)
    translation_stems = chapter_stems(translation_paths)

    missing_in_translation = sorted(source_stems - translation_stems)
    missing_in_source = sorted(translation_stems - source_stems)

    if missing_in_translation or missing_in_source:
        parts: list[str] = ["Chapter files are not aligned between source and translation."]
        if missing_in_translation:
            parts.append(f"Missing in source/ja: {', '.join(missing_in_translation)}")
        if missing_in_source:
            parts.append(f"Missing in source/en: {', '.join(missing_in_source)}")
        raise ValueError("\n".join(parts))


def read_chapters(chapter_paths: list[Path]) -> list[Chapter]:
    chapters: list[Chapter] = []
    for path in chapter_paths:
        text = path.read_text(encoding="utf-8").strip()
        if not text:
            raise ValueError(f"Chapter is empty: {path}")
        chapters.append(Chapter(path=path, text=text))
    return chapters


def build_markdown(title: str, chapters: list[Chapter]) -> str:
    lines: list[str] = [
        "---",
        f"title: {yaml_quote(title)}",
        "lang: ja-JP",
        "toc: true",
        "toc-depth: 2",
        "---",
        "",
        "<!-- This file is generated. Edit chapter sources in source/ja/chapters/. -->",
        "",
    ]

    for index, chapter in enumerate(chapters):
        if index > 0:
            lines.extend(["", "\\newpage", ""])
        lines.extend([chapter.text, ""])

    return "\n".join(lines).rstrip() + "\n"


def yaml_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def write_output(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def export_pdf(markdown_path: Path, pdf_path: Path) -> None:
    pandoc = shutil.which("pandoc")
    if pandoc is None:
        raise FileNotFoundError(
            "pandoc is required for PDF export. Install pandoc or pass --no-pdf."
        )

    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        pandoc,
        str(markdown_path),
        "-o",
        str(pdf_path),
        "--pdf-engine=xelatex",
        "--toc",
    ]
    subprocess.run(command, check=True)


def main() -> int:
    args = parse_args()
    source_paths = list_chapters(args.source_dir)
    chapter_paths = list_chapters(args.chapters_dir)
    validate_alignment(source_paths, chapter_paths)
    chapters = read_chapters(chapter_paths)
    markdown = build_markdown(args.title, chapters)
    write_output(args.output_md, markdown)

    if not args.no_pdf:
        export_pdf(args.output_md, args.output_pdf)

    print(f"Wrote {args.output_md}")
    if not args.no_pdf:
        print(f"Wrote {args.output_pdf}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
