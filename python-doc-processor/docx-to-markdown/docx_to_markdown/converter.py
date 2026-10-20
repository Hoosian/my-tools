"""Convert a Word document (.docx) to Markdown."""

from __future__ import annotations

from itertools import groupby
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph


def _escape_markdown(text: str) -> str:
    """Escape characters that have special meaning in Markdown."""
    return text.replace("\\", "\\\\").replace("*", "\\*").replace("_", "\\_").replace("[", "\\[").replace("]", "\\]")


def _wrap_emphasis(text: str, bold: bool, italic: bool) -> str:
    """Wrap text with emphasis markers, keeping surrounding spaces outside them.

    Markdown ignores markers adjacent to whitespace (``** a**``), so leading and
    trailing spaces are moved out of the markers.
    """
    marker = "***" if bold and italic else "**" if bold else "*" if italic else ""
    core = text.strip()
    if not marker or not core:
        return text
    lead = text[: len(text) - len(text.lstrip())]
    trail = text[len(text.rstrip()):]
    return f"{lead}{marker}{core}{marker}{trail}"


def _paragraph_text(paragraph) -> str:
    """Concatenate all runs in a paragraph, preserving inline styles.

    Adjacent runs with the same formatting are merged first so that Word's
    arbitrary run splits don't produce output like ``**a****b**``.
    """
    parts = []
    for (bold, italic), runs in groupby(paragraph.runs, key=lambda r: (bool(r.bold), bool(r.italic))):
        text = _escape_markdown("".join(run.text for run in runs))
        parts.append(_wrap_emphasis(text, bold, italic))
    return "".join(parts)


def _is_heading(paragraph) -> bool:
    """Check if paragraph style is a heading."""
    style_name = paragraph.style.name if paragraph.style else ""
    return style_name.startswith("Heading")


def _heading_level(paragraph) -> int:
    """Return heading level (1-9) based on style name."""
    style_name = paragraph.style.name if paragraph.style else ""
    if style_name.startswith("Heading"):
        try:
            return int(style_name.replace("Heading", "").strip())
        except ValueError:
            return 1
    return 1


def _is_list_bullet(paragraph) -> bool:
    """Check if paragraph is an unordered list item."""
    style_name = paragraph.style.name if paragraph.style else ""
    return "List Bullet" in style_name or "List Paragraph" in style_name


def _is_list_number(paragraph) -> bool:
    """Check if paragraph is an ordered list item."""
    style_name = paragraph.style.name if paragraph.style else ""
    return "List Number" in style_name


def _convert_paragraph(paragraph) -> str | None:
    """Convert a single paragraph to Markdown, or None to skip."""
    text = _paragraph_text(paragraph).strip()

    if not text:
        return None

    if _is_heading(paragraph):
        level = _heading_level(paragraph)
        return f"{'#' * level} {text}"

    if _is_list_bullet(paragraph):
        return f"- {text}"

    if _is_list_number(paragraph):
        return f"1. {text}"

    # Default paragraph
    return text


def _convert_table(table: Table) -> str:
    """Convert a Word table to a Markdown table."""
    if not table.rows:
        return ""

    lines: list[str] = []
    for i, row in enumerate(table.rows):
        cells = [_escape_markdown(cell.text).replace("|", "\\|").replace("\n", " ").strip() for cell in row.cells]
        lines.append("| " + " | ".join(cells) + " |")
        if i == 0:
            lines.append("| " + " | ".join(["---"] * len(cells)) + " |")

    return "\n".join(lines)


def docx_to_markdown(input_path: str, output_path: str | None = None) -> str:
    """Convert a .docx file to Markdown.

    Args:
        input_path: Path to the input .docx file.
        output_path: Optional path to write the Markdown output. If omitted,
            the Markdown string is returned but not written to disk.

    Returns:
        The Markdown string.
    """
    doc = Document(input_path)

    blocks: list[str] = []
    last_was_blank = False

    # Top-level iteration over paragraphs and tables in document order.
    # python-docx does not expose a unified top-level iterator, so we use the
    # underlying body element and dispatch on tag names.
    body = doc.element.body
    for child in body:
        if child.tag == qn("w:p"):
            paragraph = Paragraph(child, doc)
            converted = _convert_paragraph(paragraph)
            if converted is None:
                if not last_was_blank and blocks:
                    blocks.append("")
                    last_was_blank = True
                continue
            blocks.append(converted)
            last_was_blank = False
        elif child.tag == qn("w:tbl"):
            table = Table(child, doc)
            converted = _convert_table(table)
            if converted:
                blocks.append(converted)
                last_was_blank = False

    # Strip trailing blank lines
    while blocks and blocks[-1] == "":
        blocks.pop()

    markdown = "\n\n".join(blocks)

    if output_path is not None:
        Path(output_path).write_text(markdown, encoding="utf-8")

    return markdown
