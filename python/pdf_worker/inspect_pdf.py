"""Inspect a finished PDF for the layout acceptance checks (RND-02/03).

Run with `python -I inspect_pdf.py FILE`; prints one JSON object. It reads the
bytes only: page counts, text, fonts, links and per-page statistics that the
TypeScript side turns into findings. Nothing here fetches or writes anything.
"""
import json
import os
import statistics
import sys

import pymupdf


def font_report(doc):
    seen = {}
    for page in doc:
        for xref, ext, kind, basefont, name, *_ in page.get_fonts(full=True):
            # `ext == "n/a"` means no font program is embedded in the file.
            seen[(basefont or name)] = {
                "name": basefont or name,
                "type": kind,
                "embedded": ext != "n/a",
            }
    return sorted(seen.values(), key=lambda font: font["name"])


def page_stat(page, index):
    words = page.get_text("words")
    blocks = [b for b in page.get_text("dict")["blocks"] if b["type"] == 0]
    sizes = [s["size"] for b in blocks for l in b["lines"] for s in l["spans"] if s["text"].strip()]
    body = statistics.median(sizes) if sizes else 0
    rect = page.rect
    clipped = []
    for number, block in enumerate(blocks):
        x0, y0, x1, y1 = block["bbox"]
        if x0 < -1 or y0 < -1 or x1 > rect.width + 1 or y1 > rect.height + 1:
            clipped.append(f"p{index + 1}b{number}")
    ends_with_heading = False
    if blocks:
        last = max(blocks, key=lambda b: b["bbox"][3])
        spans = [s for l in last["lines"] for s in l["spans"] if s["text"].strip()]
        text_words = sum(len(s["text"].split()) for s in spans)
        if spans and body and text_words <= 14 and max(s["size"] for s in spans) >= body * 1.18:
            ends_with_heading = True
    return {
        "words": len(words),
        "figures": len(page.get_images()),
        "kind": "entry",
        "endsWithHeading": ends_with_heading,
        "clippedBlocks": clipped,
    }


def bleeds(page):
    """Large filled rectangles on a page, for checking that bands reach the page edges."""
    out = []
    for drawing in page.get_drawings():
        fill = drawing.get("fill")
        rect = drawing["rect"]
        if fill and rect.height > 40 and rect.width > page.rect.width * 0.5:
            out.append(
                {
                    "x0": round(rect.x0, 2),
                    "y0": round(rect.y0, 2),
                    "x1": round(rect.x1, 2),
                    "y1": round(rect.y1, 2),
                    "fill": "#%02x%02x%02x" % tuple(round(c * 255) for c in fill[:3]),
                }
            )
    return out


def hero_text_bottom(page):
    """Bottom of the lowest text that sits on the first large dark band (the hero)."""
    bands = [
        d["rect"]
        for d in page.get_drawings()
        if d.get("fill") and sum(d["fill"][:3]) < 0.6 and d["rect"].height > 60 and d["rect"].width > page.rect.width * 0.9
    ]
    if not bands:
        return 0
    band = bands[0]
    bottom = 0
    for block in page.get_text("blocks"):
        x0, y0, x1, y1 = block[:4]
        if y0 >= band.y0 and y1 <= band.y1 + 1:
            bottom = max(bottom, y1)
    return bottom


def text_blocks(page):
    """Text blocks on a page with their vertical extent, for spacing checks."""
    return [
        {"x0": round(b[0], 2), "y0": round(b[1], 2), "x1": round(b[2], 2), "y1": round(b[3], 2), "text": b[4].strip()[:80]}
        for b in page.get_text("blocks")
        if b[6] == 0
    ]


def main(path):
    doc = pymupdf.open(path)
    links = []
    internal = 0
    for page in doc:
        for link in page.get_links():
            if link.get("uri"):
                links.append(link["uri"])
            elif link.get("kind") == pymupdf.LINK_GOTO:
                internal += 1
    print(
        json.dumps(
            {
                "bytes": os.path.getsize(path),
                "pages": doc.page_count,
                "text": "\n".join(page.get_text() for page in doc),
                "links": links,
                "internalLinks": internal,
                "fonts": font_report(doc),
                "pageStats": [page_stat(page, i) for i, page in enumerate(doc)],
                "pageWidth": doc[0].rect.width if doc.page_count else 0,
                "bleeds": bleeds(doc[0]) if doc.page_count else [],
                "textBlocks": text_blocks(doc[0]) if doc.page_count else [],
                "heroTextBottom": hero_text_bottom(doc[0]) if doc.page_count else 0,
                "metadata": doc.metadata,
            }
        )
    )


if __name__ == "__main__":
    main(sys.argv[1])
