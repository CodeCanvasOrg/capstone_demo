import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

WORKER = Path(__file__).resolve().parent.parent / "worker.py"
sys.path.insert(0, str(WORKER.parent))  # unit tests import the worker modules directly
FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "pdf"


class Worker:
    """Drives worker.py exactly as Node does: `python -I`, JSON lines on stdin/stdout."""

    def __init__(self):
        self.process = subprocess.Popen(
            [sys.executable, "-I", "-X", "utf8", str(WORKER)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env={"PATH": os.environ.get("PATH", ""), "OMP_NUM_THREADS": "2"},
        )
        self.counter = 0

    def request(self, op, **payload):
        self.counter += 1
        self.process.stdin.write(json.dumps({"id": str(self.counter), "op": op, **payload}) + "\n")
        self.process.stdin.flush()
        reply = json.loads(self.process.stdout.readline())
        assert reply["id"] == str(self.counter)
        return reply

    def close(self):
        self.process.stdin.close()
        self.process.wait(timeout=10)


@pytest.fixture(scope="session")
def worker():
    instance = Worker()
    yield instance
    instance.close()


@pytest.fixture
def fixture_pdf():
    return lambda name: str(FIXTURES / name)
