import os


def extract(worker, fixture_pdf, tmp_path, name):
    reply = worker.request("extract", path=fixture_pdf(name), outDir=str(tmp_path / "out"), options={})
    return reply


def blocks_of(worker, fixture_pdf, tmp_path, name):
    reply = extract(worker, fixture_pdf, tmp_path, name)
    assert reply["ok"], reply
    return reply["result"]


def test_headings_keep_levels_and_repeated_headers_footers_are_dropped(worker, fixture_pdf, tmp_path):
    result = blocks_of(worker, fixture_pdf, tmp_path, "sections.pdf")
    headings = [(b["text"], b["headingLevel"], b["pageNumber"]) for b in result["blocks"] if b["blockType"] == "heading"]
    assert headings[:3] == [("Acme Warehouse Modernisation", 1, 1), ("Background", 2, 1), ("Approach", 2, 2)]
    assert ("Scanning app", 3, 2) in headings
    texts = " ".join(b["text"] for b in result["blocks"])
    assert "Acme Confidential" not in texts and "Page 2" not in texts
    assert [b["text"] for b in result["blocks"] if b["blockType"] == "list_item"] == [
        "Manual counts took three hours per site.",
        "The error rate was twelve percent.",
    ]
    assert result["title"] == "Acme Warehouse Modernisation"
    assert result["toc"][0] == [1, "Acme Warehouse Modernisation", 1]
    assert [b["key"] for b in result["blocks"]] == [f"b{i}" for i in range(len(result["blocks"]))]


def test_ruled_and_borderless_tables_become_rows_with_their_header(worker, fixture_pdf, tmp_path):
    rows = [b for b in blocks_of(worker, fixture_pdf, tmp_path, "tables.pdf")["blocks"] if b["blockType"] == "table_row"]
    assert [r["text"] for r in rows] == [
        "Metric | Before | After",
        "Count time | 3 h | 20 min",
        "Error rate | 12% | 1%",
        "Site | Go-live",
        "Glasgow | March",
        "Leeds | April",
    ]
    assert {r["tableHeader"] for r in rows[:3]} == {"Metric | Before | After"}
    assert rows[0]["isHeader"] and not rows[1]["isHeader"]


def test_two_columns_are_read_column_by_column(worker, fixture_pdf, tmp_path):
    paragraphs = [b["text"] for b in blocks_of(worker, fixture_pdf, tmp_path, "two_column.pdf")["blocks"] if b["blockType"] == "paragraph"]
    assert paragraphs[0].startswith("Alpha") and "Beta" not in paragraphs[0]
    assert paragraphs[1].startswith("Beta")


def test_vector_figure_is_cropped_with_its_caption(worker, fixture_pdf, tmp_path):
    result = blocks_of(worker, fixture_pdf, tmp_path, "figure.pdf")
    figures = [b for b in result["blocks"] if b["blockType"] == "image"]
    assert len(figures) == 1
    assert figures[0]["caption"] == "Figure 1: Count time per site after the rollout."
    path = tmp_path / "out" / figures[0]["figure"]
    assert path.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"


def test_page_without_a_text_layer_is_rendered_for_ocr(worker, fixture_pdf, tmp_path):
    result = blocks_of(worker, fixture_pdf, tmp_path, "scanned.pdf")
    assert result["scannedPages"] == [1]
    [block] = result["blocks"]
    assert block["blockType"] == "image" and block["scanned"] is True
    assert os.path.getsize(tmp_path / "out" / block["figure"]) > 1000


def test_standard_font_text_in_a_margin_is_kept(worker, fixture_pdf, tmp_path):
    texts = [b["text"] for b in blocks_of(worker, fixture_pdf, tmp_path, "standard-font.pdf")["blocks"]]
    assert texts == ["Standard font evidence"]


def test_encrypted_and_corrupt_files_return_closed_error_codes(worker, fixture_pdf, tmp_path):
    assert extract(worker, fixture_pdf, tmp_path, "encrypted.pdf")["error"]["code"] == "encrypted"
    assert extract(worker, fixture_pdf, tmp_path, "corrupt.pdf")["error"]["code"] == "corrupt"
    missing = worker.request("extract", path=str(tmp_path / "missing.pdf"), outDir=str(tmp_path), options={})
    assert missing["error"]["code"] == "corrupt"
    assert worker.request("hello")["ok"]
