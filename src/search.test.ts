import assert from "node:assert/strict";
import { test } from "node:test";

import { renderWebSearchResults, type WebSearchResponse } from "agents/websearch";

import { trimDescriptions } from "./search.ts";

test("trims a long description the way the text content trims it", async () => {
  const response: WebSearchResponse = {
    items: [
      {
        url: "https://example.test/",
        title: "Example",
        description: "Workers  run\n\ncode at the edge. ".repeat(40),
      },
    ],
    metadata: { query: "workers", requestId: "req", latencyMs: 1 },
  };
  const trimmed = await trimDescriptions({ search: async () => response }).search({
    query: "workers",
  });

  const description = trimmed.items[0]?.description ?? "";
  // renderWebSearchResults trims on its own, so the comparison below passes even when nothing was trimmed.
  assert.ok(description.length <= 600, `${description.length} characters`);
  assert.equal(renderWebSearchResults(trimmed), renderWebSearchResults(response));
});
