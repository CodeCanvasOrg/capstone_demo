"""Structure-aware chunk plan for extracted PDF blocks.

The plan is a list of groups of block keys. Node turns each group into one chunk and re-checks
its token count with the embedding tokenizer, so the estimate here only has to be close.

Rules:
- a heading closes the current chunk (headings become the section path, not chunk content);
- a figure or scanned page is a chunk of its own;
- a table never shares a chunk with prose; it stays whole when it fits, otherwise it is split by
  rows and each continuation carries the header row in `header` for Node to repeat;
- prose and list items of one section are packed up to the target size, continuing across page
  breaks when no heading intervenes.
"""

CHARS_PER_TOKEN = 4


def estimate(text: str) -> int:
    return max(1, len(text) // CHARS_PER_TOKEN)


class Planner:
    def __init__(self, target_tokens: int):
        self.target = target_tokens
        self.groups: list[dict] = []
        self.keys: list[str] = []
        self.size = 0
        self.table: str | None = None  # header of the table the open group belongs to
        self.repeat: str | None = None  # header row to prepend (split-table continuation)

    def close(self):
        if self.keys:
            self.groups.append({"blocks": self.keys, "header": self.repeat})
        self.keys, self.size, self.table, self.repeat = [], 0, None, None

    def add(self, key: str, cost: int):
        self.keys.append(key)
        self.size += cost

    def fits(self, cost: int) -> bool:
        return not self.keys or self.size + cost <= self.target


def plan(blocks: list[dict], target_tokens: int = 450) -> list[dict]:
    planner = Planner(target_tokens)
    for block in blocks:
        kind = block["blockType"]
        cost = estimate(block["text"])

        if kind == "heading":
            planner.close()
        elif kind == "image":
            planner.close()
            planner.groups.append({"blocks": [block["key"]], "header": None})
        elif kind == "table_row":
            header = block.get("tableHeader")
            if planner.table != header:
                planner.close()  # a new table starts its own group
                planner.table = header
            elif not planner.fits(cost):
                planner.close()
                planner.table = header
                planner.repeat = header  # continuation of the same table
                planner.size = estimate(header or "")
            planner.add(block["key"], cost)
        else:
            if planner.table is not None or not planner.fits(cost):
                planner.close()
            planner.add(block["key"], cost)

    planner.close()
    return planner.groups
