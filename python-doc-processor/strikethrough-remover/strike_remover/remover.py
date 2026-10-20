"""Core logic for removing strikethrough runs from Word documents."""

import re

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table


def _is_strikethrough(run) -> bool:
    """Return True if the run has direct strikethrough formatting."""
    return bool(run.font.strike) or bool(run.font.double_strike)


def _remove_strikethrough_from_paragraph(paragraph) -> None:
    """Remove all strikethrough runs from a single paragraph."""
    for run in list(paragraph.runs):
        if _is_strikethrough(run):
            paragraph._p.remove(run._r)


def _is_empty_run(run) -> bool:
    """Return True if the run holds no text and no other content (images, tabs, breaks...)."""
    for child in run._r:
        if child.tag == qn("w:rPr"):
            continue
        if child.tag != qn("w:t") or child.text:
            return False
    return True


def _normalize_paragraph_whitespace(paragraph) -> None:
    """Collapse consecutive spaces and trim duplicated border spaces across runs.

    Operates on <w:t> elements directly: assigning run.text would wipe
    non-text content such as embedded images.
    """
    t_elems = [t for run in paragraph.runs for t in run._r.iter(qn("w:t"))]

    # Collapse multiple spaces inside each text element
    for t in t_elems:
        if t.text and "  " in t.text:
            t.text = re.sub(r" +", " ", t.text)

    # Remove duplicated border spaces between adjacent text elements
    for prev, cur in zip(t_elems, t_elems[1:]):
        if (prev.text or "").endswith(" ") and (cur.text or "").startswith(" "):
            cur.text = cur.text.lstrip(" ")

    # Drop runs that became empty
    for run in list(paragraph.runs):
        if _is_empty_run(run):
            paragraph._p.remove(run._r)


def _remove_strikethrough_from_paragraphs(paragraphs) -> None:
    for paragraph in paragraphs:
        _remove_strikethrough_from_paragraph(paragraph)
        _normalize_paragraph_whitespace(paragraph)


def _remove_empty_table_rows(table: Table) -> None:
    """Remove rows where every cell is empty after cleanup."""
    rows_to_remove = []
    for row in table.rows:
        has_media = any(True for _ in row._tr.iter(qn("w:drawing"), qn("w:pict")))
        if not has_media and all(not cell.text.strip() for cell in row.cells):
            rows_to_remove.append(row)
    for row in rows_to_remove:
        table._tbl.remove(row._tr)


def _remove_strikethrough_from_table(table: Table) -> None:
    """Recursively remove strikethrough runs from a table and nested tables."""
    for row in table.rows:
        for cell in row.cells:
            _remove_strikethrough_from_paragraphs(cell.paragraphs)
            for nested_table in cell.tables:
                _remove_strikethrough_from_table(nested_table)
    _remove_empty_table_rows(table)


def _remove_strikethrough_from_header_footer(section) -> None:
    """Process all headers and footers in a section."""
    headers = [section.header]
    footers = [section.footer]

    if section.different_first_page_header_footer:
        headers.extend([section.first_page_header])
        footers.extend([section.first_page_footer])

    if getattr(section, "different_odd_even_pages_header_footer", False):
        headers.extend([section.even_page_header])
        footers.extend([section.even_page_footer])

    for header in headers:
        if header is None:
            continue
        _remove_strikethrough_from_paragraphs(header.paragraphs)
        for table in header.tables:
            _remove_strikethrough_from_table(table)

    for footer in footers:
        if footer is None:
            continue
        _remove_strikethrough_from_paragraphs(footer.paragraphs)
        for table in footer.tables:
            _remove_strikethrough_from_table(table)


def remove_strikethrough(input_path: str, output_path: str) -> None:
    """Remove all direct strikethrough runs, normalize spaces and save a new document."""
    doc = Document(input_path)

    # Body paragraphs and tables
    _remove_strikethrough_from_paragraphs(doc.paragraphs)
    for table in doc.tables:
        _remove_strikethrough_from_table(table)

    # Headers and footers
    for section in doc.sections:
        _remove_strikethrough_from_header_footer(section)

    doc.save(output_path)
