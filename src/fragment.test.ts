import assert from "node:assert/strict";
import { test } from "node:test";

import { fragmentOffset } from "./fragment.ts";

// Pages as toMarkdown writes them: the permalink beside a heading or a definition stays a link.
const SPHINX = [
  "# json[¶](#module-json)",
  "",
  "## Basic Usage[¶](#basic-usage)",
  "",
  'json.dump(obj, fp)[¶](#json.dump "Link to this definition")',
  "",
  "See [dump()](#json.dump) and [loads()](#json.loads).",
].join("\n");

test("starts at the heading whose permalink is the fragment", () => {
  assert.equal(fragmentOffset(SPHINX, "#basic-usage"), SPHINX.indexOf("## Basic Usage"));
});

test("starts at a definition's permalink, not at a link that refers to it", () => {
  assert.equal(fragmentOffset(SPHINX, "#json.dump"), SPHINX.indexOf("json.dump(obj"));
  assert.equal(fragmentOffset(SPHINX, "#json.loads"), undefined);
});

test("starts at the heading whose words match the fragment, when no permalink names it", () => {
  const page = "# Fetch\n\nIntro.\n\n## Request `options`\n\nText.";
  assert.equal(fragmentOffset(page, "#request-options"), page.indexOf("## Request"));
});

test("starts at the heading that declares the fragment as its id", () => {
  // react.dev serves MDX comments, Markdown extensions write `{#id}`.
  const page =
    "## Reference {/*reference*/}\n\n### `useState(initialState)` {/*usestate*/}\n\n## Options {#opts}";
  assert.equal(fragmentOffset(page, "#reference"), 0);
  assert.equal(fragmentOffset(page, "#usestate"), page.indexOf("### "));
  assert.equal(fragmentOffset(page, "#opts"), page.indexOf("## Options"));
  assert.equal(fragmentOffset("## A {#a%20b}", "#a%20b"), 0);
});

test("skips lines inside fenced code", () => {
  // A fence line with an info string opens a block but can't close one.
  const page =
    "```sh\n# install\n```js\n## Install\n```\n\n~~~\n[¶](#install)\n~~~\n\n## Install\n";
  assert.equal(fragmentOffset(page, "#install"), page.lastIndexOf("## Install"));
});

test("prefers a heading whose words and separators match over one whose words alone do", () => {
  const page = "## A-B\n\n## AB\n";
  assert.equal(fragmentOffset(page, "#ab"), page.indexOf("## AB"));
  assert.equal(fragmentOffset(page, "#a-b"), 0);
});

test("decodes the fragment as URL.hash gives it", () => {
  const page = "# Markdown\n\n## 脚注[¶](#%E8%84%9A%E6%B3%A8)\n\n## 利用例と方言\n";
  assert.equal(
    fragmentOffset(page, new URL("https://ja.example.test/#脚注").hash),
    page.indexOf("## 脚注"),
  );
  assert.equal(
    fragmentOffset(page, new URL("https://ja.example.test/#利用例と方言").hash),
    page.indexOf("## 利用例"),
  );
});

test("finds nothing for an empty fragment or one that names nothing", () => {
  const page = "# Title\n\n## —\n\nText.";
  assert.equal(fragmentOffset(page, ""), undefined);
  assert.equal(fragmentOffset(page, "#"), undefined);
  assert.equal(fragmentOffset(page, "#-"), undefined);
  assert.equal(fragmentOffset(page, "#missing"), undefined);
});

test("reads a line of unclosed brackets in linear time", () => {
  // The page comes from any site, and a regex that backtracks over a line like this would spend the Worker's CPU.
  const line =
    "[".repeat(50_000) + "[a](".repeat(10_000) + "{#".repeat(10_000) + "{/* ".repeat(10_000);
  const started = performance.now();
  assert.equal(fragmentOffset(`# ${line}\n${line}`, "#x"), undefined);
  assert.ok(performance.now() - started < 1_000, `${performance.now() - started} ms`);
});
