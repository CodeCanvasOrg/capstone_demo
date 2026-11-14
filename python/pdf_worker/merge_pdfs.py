"""Count pages in, or merge, finished PDFs for collection output.

Run with `python -I merge_pdfs.py count FILE...` to print a JSON list of page
counts, or `python -I merge_pdfs.py merge OUT TOC.json FILE...` to join the
files in order. TOC.json is a list of [title, page] pairs written as PDF
bookmarks. Links inside each part are kept. Nothing is fetched.
"""
import json
import sys

import pymupdf


def count(files):
    out = []
    for file in files:
        with pymupdf.open(file) as doc:
            out.append(doc.page_count)
    print(json.dumps(out))


def merge(out, toc_file, files):
    with open(toc_file, encoding="utf-8") as handle:
        toc = json.load(handle)
    merged = pymupdf.open()
    for file in files:
        with pymupdf.open(file) as part:
            merged.insert_pdf(part)
    merged.set_toc([[1, title, page] for title, page in toc])
    merged.save(out, garbage=3, deflate=True)


if __name__ == "__main__":
    mode, *args = sys.argv[1:]
    if mode == "count":
        count(args)
    elif mode == "merge":
        merge(args[0], args[1], args[2:])
    else:
        sys.exit(f"unknown mode {mode}")
