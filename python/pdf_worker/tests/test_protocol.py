def test_hello_reports_versions(worker):
    reply = worker.request("hello")
    assert reply["ok"] is True
    assert reply["result"]["protocol"] == 1
    assert reply["result"]["pymupdf"].startswith("2.")
    assert reply["result"]["extractor"].startswith("pymupdf:")


def test_unknown_operation_is_a_clean_error_and_the_worker_survives(worker):
    reply = worker.request("nope")
    assert reply == {"id": reply["id"], "ok": False, "error": {"code": "internal", "message": "Unknown operation: 'nope'"}}
    assert worker.request("hello")["ok"] is True


def test_malformed_line_does_not_kill_the_worker(worker):
    worker.process.stdin.write("not json\n")
    worker.process.stdin.flush()
    reply = __import__("json").loads(worker.process.stdout.readline())
    assert reply["ok"] is False and reply["error"]["code"] == "internal"
    assert worker.request("hello")["ok"] is True
