"""PDF extraction (implemented in Phase 2)."""


class ExtractionError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def extract(path: str, out_dir: str, options: dict) -> dict:
    raise ExtractionError("internal", "PDF extraction is not available yet.")
