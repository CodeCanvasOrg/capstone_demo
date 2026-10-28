"""Long-lived PDF worker for source preparation.

Node starts this script with the project's prepared virtualenv and exchanges one JSON object per
line: requests on stdin, replies on the original stdout. MuPDF and the layout module print
diagnostics straight to file descriptor 1, so the reply channel is duplicated before PyMuPDF is
imported and fd 1 is pointed at stderr. Nothing the libraries print can corrupt a reply.
"""

import json
import os
import platform
import sys

PROTOCOL = 1

# Started with `python -I`, which drops the script directory from sys.path; add only our own.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

_reply = os.fdopen(os.dup(1), "w", buffering=1, encoding="utf-8")
os.dup2(2, 1)
sys.stdout = sys.stderr

import pymupdf  # noqa: E402  (must follow the descriptor swap)

import chunking  # noqa: E402
import extraction  # noqa: E402


class WorkerError(Exception):
    """An expected failure with a closed error code Node can show safely."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def hello(_request: dict) -> dict:
    return {
        "protocol": PROTOCOL,
        "python": platform.python_version(),
        "pymupdf": pymupdf.VersionBind,
        "extractor": f"pymupdf:{pymupdf.VersionBind}",
    }


def extract(request: dict) -> dict:
    options = request.get("options") or {}
    try:
        result = extraction.extract(request["path"], request["outDir"], options)
    except extraction.ExtractionError as error:
        raise WorkerError(error.code, str(error)) from error
    result["chunkPlan"] = chunking.plan(result["blocks"], int(options.get("chunkTargetTokens", 450)))
    result["extractor"] = f"pymupdf:{pymupdf.VersionBind}"
    return result


OPERATIONS = {"hello": hello, "extract": extract}


def handle(line: str) -> dict:
    request: dict = {}
    try:
        request = json.loads(line)
        operation = OPERATIONS.get(request.get("op"))
        if operation is None:
            raise WorkerError("internal", f"Unknown operation: {request.get('op')!r}")
        return {"id": request.get("id"), "ok": True, "result": operation(request)}
    except WorkerError as error:
        return {"id": request.get("id"), "ok": False, "error": {"code": error.code, "message": str(error)}}
    except Exception as error:  # noqa: BLE001 — the loop must survive any single bad request
        print(f"pdf_worker: {type(error).__name__}: {error}", file=sys.stderr)
        return {
            "id": request.get("id"),
            "ok": False,
            "error": {"code": "internal", "message": "The PDF could not be processed."},
        }


def main() -> None:
    for line in sys.stdin:
        if line.strip():
            _reply.write(json.dumps(handle(line), ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
