"""PDF → canonical blocks with PyMuPDF layout analysis.

Every block carries a stable `key` (b0, b1, …) that the chunk plan refers to; Node assigns
database IDs. Text is rebuilt from span geometry so cells and words never run together, page
headers and footers are dropped, tables become one `table_row` block per row, and figures are
written as PNG crops for Node to store and OCR.
"""

import json
import os
import re
import time

import pymupdf

MAX_PAGES = 2000
FIGURE_DPI = 144
SCAN_DPI = 200
MIN_FIGURE_POINTS = 48  # ignore icons and rules smaller than this on either side
TABLE_DRAWINGS = 6  # only look for ruled tables on pages with at least this many vector paths
ALIGN = 3  # points of tolerance when matching column starts across lines

HEADING_CLASSES = {"title", "section-header"}
FURNITURE_CLASSES = {"page-header", "page-footer"}
PAGE_NUMBER = re.compile(r"^(page\s*)?\d+(\s*(of|/)\s*\d+)?$", re.IGNORECASE)
CAPTION = re.compile(r"^(figure|fig\.|chart|diagram|image)\s*\d+", re.IGNORECASE)


class ExtractionError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def open_document(path: str) -> pymupdf.Document:
    try:
        doc = pymupdf.open(path, filetype="pdf")
    except Exception as error:  # MuPDF raises several types for damaged input
        raise ExtractionError("corrupt", "The file is not a readable PDF.") from error
    if doc.needs_pass:
        raise ExtractionError("encrypted", "The PDF is password protected.")
    if doc.page_count == 0:
        raise ExtractionError("corrupt", "The PDF has no pages.")
    if doc.page_count > MAX_PAGES:
        raise ExtractionError("too_many_pages", f"The PDF has more than {MAX_PAGES} pages.")
    return doc


def line_text(spans: list[dict]) -> str:
    """Join spans on one line, restoring the spaces MuPDF encodes as gaps between spans."""
    out = ""
    previous = None
    for span in spans:
        text = span["text"]
        if not text:
            continue
        if previous is not None and out and not out.endswith(" ") and not text.startswith(" "):
            if span["bbox"][0] - previous["bbox"][2] > 0.15 * max(span["size"], 1):
                out += " "
        out += text
        previous = span
    return re.sub(r"\s+", " ", out).strip()


def box_text(box: dict) -> str:
    lines = [line_text(line["spans"]) for line in box.get("textlines") or []]
    text = " ".join(line for line in lines if line)
    return re.sub(r"(\w)- (\w)", r"\1\2", text)  # rejoin words hyphenated across lines


def bbox(box: dict) -> list[float]:
    return [round(box["x0"], 1), round(box["y0"], 1), round(box["x1"], 1), round(box["y1"], 1)]


def overlap(a: list[float], b: list[float]) -> float:
    """Share of rectangle `a` covered by rectangle `b`."""
    width = min(a[2], b[2]) - max(a[0], b[0])
    height = min(a[3], b[3]) - max(a[1], b[1])
    area = max((a[2] - a[0]) * (a[3] - a[1]), 1e-6)
    return max(width, 0) * max(height, 0) / area


class Builder:
    def __init__(self, out_dir: str):
        self.blocks: list[dict] = []
        self.figures = 0
        self.out_dir = out_dir

    def add(self, block_type: str, text: str, page: int, rect: list[float], method: str, **extra):
        if not text and block_type != "image":
            return None
        block = {
            "key": f"b{len(self.blocks)}",
            "blockType": block_type,
            "text": text,
            "pageNumber": page,
            "bbox": rect,
            "extractionMethod": method,
            **extra,
        }
        self.blocks.append(block)
        return block

    def figure(self, page: pymupdf.Page, rect: list[float], dpi: int) -> str:
        os.makedirs(self.out_dir, exist_ok=True)
        name = f"f{self.figures}.png"
        self.figures += 1
        pixmap = page.get_pixmap(clip=pymupdf.Rect(rect), dpi=dpi, alpha=False)
        pixmap.save(os.path.join(self.out_dir, name))
        return name


def ruled_tables(page: pymupdf.Page) -> list[tuple[list[float], list[list[str]]]]:
    if len(page.get_drawings()) < TABLE_DRAWINGS:
        return []
    found = []
    spans = [
        span
        for block in page.get_text("dict")["blocks"]
        for line in block.get("lines", [])
        for span in line["spans"]
    ]
    for table in page.find_tables().tables:
        # table.extract() drops inter-glyph spaces for some generators; rebuild cells from spans.
        rows = [
            [cell_text(spans, cell) if cell else "" for cell in row.cells] for row in table.rows
        ]
        rows = [row for row in rows if any(row)]
        if len(rows) >= 2 and max(len(row) for row in rows) >= 2:
            found.append(([round(v, 1) for v in table.bbox], rows))
    return found


def cell_text(spans: list[dict], cell: tuple) -> str:
    inside = [span for span in spans if overlap(list(span["bbox"]), list(cell)) > 0.5]
    return line_text(sorted(inside, key=lambda span: (round(span["bbox"][1]), span["bbox"][0])))


def furniture(pages: list[dict]) -> set[str]:
    """Header/footer text that repeats on two or more pages (digits ignored)."""
    seen: dict[str, set[int]] = {}
    for page in pages:
        for box in page["boxes"]:
            if box["boxclass"] in FURNITURE_CLASSES:
                seen.setdefault(normalise(box_text(box)), set()).add(page["page_number"])
    return {text for text, numbers in seen.items() if len(numbers) >= 2}


def normalise(text: str) -> str:
    return re.sub(r"\d+", "#", text.lower()).strip()


def borderless_rows(box: dict) -> list[list[str]] | None:
    """Rows of a table without ruling lines: every line starts a cell at the same x positions.

    Prose lines rarely share a span boundary at an identical x on every line; table columns do.
    """
    lines = [[span for span in line["spans"] if span["text"].strip()] for line in box.get("textlines") or []]
    lines = [line for line in lines if line]
    if len(lines) < 2 or any(len(line) < 2 for line in lines):
        return None
    starts = [{round(span["bbox"][0]) for span in line[1:]} for line in lines]
    columns = sorted(x for x in starts[0] if all(any(abs(x - other) <= ALIGN for other in row) for row in starts[1:]))
    if not columns:
        return None
    rows = []
    for line in lines:
        cells: list[list[dict]] = [[]]
        for span in line:
            if any(abs(span["bbox"][0] - x) <= ALIGN for x in columns) and cells[-1]:
                cells.append([])
            cells[-1].append(span)
        rows.append([line_text(cell) for cell in cells])
    return rows


def add_table(builder: Builder, rows: list[list[str]], page: int, rect: list[float], method: str):
    header = " | ".join(rows[0])
    for index, row in enumerate(rows):
        builder.add(
            "table_row",
            " | ".join(row),
            page,
            rect,
            method,
            tableHeader=header,
            isHeader=index == 0,
        )


def attach_caption(builder: Builder, text: str, page: int) -> bool:
    previous = builder.blocks[-1] if builder.blocks else None
    if previous and previous["blockType"] == "image" and previous["pageNumber"] == page and not previous.get("caption"):
        previous["caption"] = text
        previous["text"] = text
        return True
    return False


def extract(path: str, out_dir: str, options: dict) -> dict:
    started = time.perf_counter()
    doc = open_document(path)
    timings = {"open": round((time.perf_counter() - started) * 1000)}
    layout_started = time.perf_counter()
    analysed = json.loads(doc.to_json(page_chunks=True, use_ocr=False))
    timings["layout"] = round((time.perf_counter() - layout_started) * 1000)
    builder = Builder(out_dir)
    scanned_pages = []
    repeated = furniture(analysed["pages"])

    for page_data in analysed["pages"]:
        number = page_data["page_number"]
        page = doc[number - 1]
        tables = ruled_tables(page)
        emitted_tables: set[int] = set()
        page_has_text = False
        caption_above = None

        for box in page_data["boxes"]:
            kind = box["boxclass"]
            rect = bbox(box)
            if kind in FURNITURE_CLASSES:
                text = box_text(box)
                if normalise(text) in repeated or PAGE_NUMBER.match(text):
                    continue
                kind = "text"  # a one-off line the model placed in a margin is still content
            covering = next(
                (i for i, (table_rect, _) in enumerate(tables) if overlap(rect, table_rect) > 0.5),
                None,
            )
            if covering is not None:
                if covering not in emitted_tables:
                    emitted_tables.add(covering)
                    add_table(builder, tables[covering][1], number, tables[covering][0], "pymupdf-table")
                    page_has_text = True
                continue

            if kind == "picture":
                width, height = rect[2] - rect[0], rect[3] - rect[1]
                if width < MIN_FIGURE_POINTS or height < MIN_FIGURE_POINTS:
                    continue
                builder.add(
                    "image",
                    caption_above or "",
                    number,
                    rect,
                    "pymupdf-figure",
                    figure=builder.figure(page, rect, FIGURE_DPI),
                    caption=caption_above,
                )
                caption_above = None
                continue

            text = box_text(box)
            if not text:
                continue
            page_has_text = True
            caption_above = None
            if kind in HEADING_CLASSES:
                level = max(1, min(6, box.get("header_level") or 1))
                builder.add("heading", text, number, rect, "pymupdf-layout", headingLevel=level)
            elif kind == "list-item":
                builder.add("list_item", re.sub(r"^[•\-–·*]\s*", "", text), number, rect, "pymupdf-layout")
            elif (rows := borderless_rows(box)) is not None:
                add_table(builder, rows, number, rect, "pymupdf-layout")
            elif kind == "caption" or CAPTION.match(text):
                if not attach_caption(builder, text, number):
                    caption_above = text  # a caption printed above its figure
                    builder.add("paragraph", text, number, rect, "pymupdf-layout", isCaption=True)
            elif kind == "code":
                builder.add("code", text, number, rect, "pymupdf-layout")
            else:
                builder.add("paragraph", text, number, rect, "pymupdf-layout")

        if not page_has_text and page.get_images():
            # No text layer: render the whole page so Node can OCR it.
            rect = [round(v, 1) for v in page.rect]
            builder.add(
                "image",
                "",
                number,
                rect,
                "pymupdf-scan",
                figure=builder.figure(page, rect, SCAN_DPI),
                scanned=True,
            )
            scanned_pages.append(number)

    timings["total"] = round((time.perf_counter() - started) * 1000)
    return {
        "pages": doc.page_count,
        "title": (doc.metadata or {}).get("title") or None,
        "toc": [[level, title, page] for level, title, page in doc.get_toc(simple=True)],
        "blocks": builder.blocks,
        "scannedPages": scanned_pages,
        "timingsMs": timings,
    }
