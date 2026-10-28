"""Regenerates the synthetic PDFs in tests/fixtures/pdf/.

    python/pdf_worker/.venv/bin/python python/pdf_worker/tests/build_fixtures.py

All content is invented; the files only exercise extraction paths.
"""

from pathlib import Path

import pymupdf

OUT = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "pdf"
BODY = pymupdf.Rect(72, 72, 540, 760)


def header_footer(page: pymupdf.Page, number: int):
    page.insert_text((72, 40), "Acme Confidential - Case Study", fontsize=8)
    page.insert_text((290, 810), f"Page {number}", fontsize=8)


def sections():
    pages = [
        """<h1>Acme Warehouse Modernisation</h1>
        <h2>Background</h2>
        <p>Acme Logistics tracked inventory in spreadsheets across three warehouses in Leeds,
        Bristol and Glasgow. Weekly stock counts were slow and error prone.</p>
        <ul><li>Manual counts took three hours per site.</li><li>The error rate was twelve percent.</li></ul>""",
        """<h2>Approach</h2>
        <h3>Scanning app</h3>
        <p>The team built a barcode scanning app with React Native and a Node backend that syncs
        counts to the central inventory database every five minutes.</p>
        <h3>Rollout</h3>
        <p>Glasgow piloted the app in March before the other two sites adopted it in April.</p>""",
        """<h2>Results</h2>
        <p>Stock counts now take twenty minutes and the error rate fell to one percent. Revenue lost
        to stock-outs dropped by an estimated eight percent in the first quarter.</p>""",
    ]
    doc = pymupdf.open()
    for number, html in enumerate(pages, start=1):
        page = doc.new_page()
        header_footer(page, number)
        page.insert_htmlbox(BODY, html)
    doc.set_metadata({"title": "Acme Warehouse Modernisation"})
    doc.set_toc([[1, "Acme Warehouse Modernisation", 1], [2, "Background", 1], [2, "Approach", 2], [2, "Results", 3]])
    doc.save(OUT / "sections.pdf")


def tables():
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_htmlbox(pymupdf.Rect(72, 60, 540, 100), "<h2>Ruled results table</h2>")
    rows = [["Metric", "Before", "After"], ["Count time", "3 h", "20 min"], ["Error rate", "12%", "1%"]]
    x0, y0, widths, height = 72, 110, [160, 100, 100], 24
    for r, row in enumerate(rows):
        x = x0
        for c, value in enumerate(row):
            rect = pymupdf.Rect(x, y0 + r * height, x + widths[c], y0 + (r + 1) * height)
            page.draw_rect(rect, color=(0, 0, 0), width=0.8)
            page.insert_text((rect.x0 + 6, rect.y0 + 16), value, fontsize=10)
            x += widths[c]
    page.insert_htmlbox(
        pymupdf.Rect(72, 220, 540, 420),
        """<h2>Borderless site table</h2>
        <table><tr><th>Site</th><th>Go-live</th></tr><tr><td>Glasgow</td><td>March</td></tr>
        <tr><td>Leeds</td><td>April</td></tr></table>""",
    )
    doc.save(OUT / "tables.pdf")


def two_column():
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_htmlbox(pymupdf.Rect(72, 60, 540, 100), "<h1>Two column report</h1>")
    left = "<p>" + " ".join(["Alpha column text describes the Glasgow pilot."] * 8) + "</p>"
    right = "<p>" + " ".join(["Beta column text describes the Leeds rollout."] * 8) + "</p>"
    page.insert_htmlbox(pymupdf.Rect(72, 110, 296, 700), left)
    page.insert_htmlbox(pymupdf.Rect(316, 110, 540, 700), right)
    doc.save(OUT / "two_column.pdf")


def figure():
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_htmlbox(pymupdf.Rect(72, 60, 540, 120), "<h2>Count time per site</h2><p>The chart compares sites.</p>")
    page.draw_rect(pymupdf.Rect(72, 140, 400, 320), color=(0, 0, 0), width=0.5)
    for i, h in enumerate([150, 60, 40]):
        page.draw_rect(pymupdf.Rect(100 + i * 90, 310 - h, 150 + i * 90, 310), fill=(0.2, 0.4, 0.8), color=None)
    page.insert_htmlbox(pymupdf.Rect(72, 330, 540, 360), "<p>Figure 1: Count time per site after the rollout.</p>")
    doc.save(OUT / "figure.pdf")


def scanned():
    source = pymupdf.open()
    page = source.new_page()
    page.insert_htmlbox(BODY, "<h1>Scanned delivery note</h1><p>Delivered 40 scanners to the Leeds warehouse.</p>")
    pixmap = page.get_pixmap(dpi=110, colorspace=pymupdf.csGRAY)
    doc = pymupdf.open()
    doc.new_page().insert_image(doc[0].rect, stream=pixmap.tobytes("jpeg", jpg_quality=70))
    doc.save(OUT / "scanned.pdf")


def encrypted():
    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), "Secret", fontsize=12)
    doc.save(OUT / "encrypted.pdf", encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw="secret", owner_pw="owner")


SITES = [
    ("Leeds", 4, 35, 3, "conveyor"),
    ("Bristol", 9, 25, 5, "forklift"),
    ("Glasgow", 7, 20, 2, "mezzanine"),
    ("Cardiff", 12, 40, 6, "loading bay"),
    ("Belfast", 3, 30, 4, "cold store"),
    ("Aberdeen", 11, 15, 1, "racking"),
]


def eval_sites():
    """Retrieval evaluation corpus: paragraphs never name their site; only the heading does."""
    sections = []
    for name, growth, minutes, hires, asset in SITES:
        sections.append(
            f"""<h2>{name} warehouse</h2>
            <p>Revenue grew {growth}% during the quarter after the scanning rollout.</p>
            <p>Weekly stock counts now take {minutes} minutes instead of three hours.</p>
            <p>The site hired {hires} new staff and replaced its {asset} equipment.</p>"""
        )
    doc = pymupdf.open()
    # Two sites per page so page-level extraction mixes them.
    for start in range(0, len(sections), 2):
        page = doc.new_page()
        header_footer(page, start // 2 + 1)
        heading = "<h1>Quarterly site report</h1>" if start == 0 else ""
        page.insert_htmlbox(BODY, heading + "".join(sections[start : start + 2]))
    doc.set_metadata({"title": "Quarterly site report"})
    doc.save(OUT / "eval_sites.pdf")


def corrupt():
    (OUT / "corrupt.pdf").write_bytes(b"%PDF-1.7\n1 0 obj\n<< /Type /Catalog broken")


BUILDERS = (sections, tables, two_column, figure, scanned, encrypted, corrupt, eval_sites)

if __name__ == "__main__":
    import sys

    OUT.mkdir(parents=True, exist_ok=True)
    wanted = set(sys.argv[1:])  # e.g. `eval_sites`; default rebuilds everything
    for build in BUILDERS:
        if not wanted or build.__name__ in wanted:
            build()
    print("\n".join(sorted(path.name for path in OUT.glob("*.pdf"))))
