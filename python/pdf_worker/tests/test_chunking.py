import chunking


def block(key, kind="paragraph", text="x" * 40, **extra):
    return {"key": key, "blockType": kind, "text": text, **extra}


def keys(groups):
    return [group["blocks"] for group in groups]


def test_headings_close_chunks_and_are_not_content():
    groups = chunking.plan([block("b0", "heading"), block("b1"), block("b2"), block("b3", "heading"), block("b4")])
    assert keys(groups) == [["b1", "b2"], ["b4"]]


def test_prose_is_packed_up_to_the_target_and_continues_across_pages():
    blocks = [block(f"b{i}", text="y" * 400, pageNumber=1 + i // 2) for i in range(5)]  # 100 tokens each
    assert keys(chunking.plan(blocks, target_tokens=250)) == [["b0", "b1"], ["b2", "b3"], ["b4"]]


def test_figures_are_chunks_of_their_own():
    groups = chunking.plan([block("b0"), block("b1", "image"), block("b2")])
    assert keys(groups) == [["b0"], ["b1"], ["b2"]]


def test_tables_never_mix_with_prose_and_split_tables_repeat_their_header():
    header = "Metric | Before | After"
    rows = [block("b1", "table_row", header, tableHeader=header, isHeader=True)] + [
        block(f"b{i}", "table_row", "r" * 200, tableHeader=header) for i in range(2, 6)
    ]
    groups = chunking.plan([block("b0")] + rows + [block("b6")], target_tokens=120)
    assert keys(groups) == [["b0"], ["b1", "b2", "b3"], ["b4", "b5"], ["b6"]]
    assert [g["header"] for g in groups] == [None, None, header, None]


def test_adjacent_tables_are_separate_chunks():
    a = [block("b0", "table_row", "A | B", tableHeader="A | B"), block("b1", "table_row", "1 | 2", tableHeader="A | B")]
    c = [block("b2", "table_row", "C | D", tableHeader="C | D")]
    assert keys(chunking.plan(a + c)) == [["b0", "b1"], ["b2"]]


def test_extract_returns_a_plan_covering_every_non_heading_block(worker, fixture_pdf, tmp_path):
    result = worker.request("extract", path=fixture_pdf("sections.pdf"), outDir=str(tmp_path), options={})["result"]
    planned = [key for group in result["chunkPlan"] for key in group["blocks"]]
    expected = [b["key"] for b in result["blocks"] if b["blockType"] != "heading"]
    assert planned == expected
