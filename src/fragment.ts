import {
  createDirectWebFetch,
  WEB_FETCH_TOOL_DESCRIPTION,
  windowWebFetchPage,
  type WebFetchPage,
} from "agents/webfetch";
import { webFetchTool, type WebFetchTool } from "agents/webfetch/ai-sdk";

const DESCRIPTION = `${WEB_FETCH_TOOL_DESCRIPTION} A URL with a #fragment starts at the heading or definition it names when no \`offset\` is given; pass \`offset: 0\` to read from the top.`;

/** `web_fetch`, but a call without an offset starts at the element the URL's fragment names, when the page has it. */
export function webFetchFromFragment(binding: Ai): WebFetchTool {
  const source = createDirectWebFetch({ binding });
  return {
    ...webFetchTool({ source, description: DESCRIPTION }),
    async execute(input, options) {
      let page: WebFetchPage | undefined;
      // A tool per call, so each call reads only the page it fetched itself. The adapter still turns failures into
      // the messages the model gets.
      const output = await webFetchTool({
        source: { fetch: async (request, call) => (page = await source.fetch(request, call)) },
        description: DESCRIPTION,
      }).execute(input, options);
      // Plain text too: react.dev serves its Markdown as text/plain.
      if (input.offset !== undefined || !page) return output;
      // Only the start moves: toMarkdown leaves some code blocks unfenced, so a `# comment` can pass for a heading
      // and the next heading is no safe place to end.
      const start = fragmentOffset(page.content, new URL(input.url).hash);
      return start ? windowWebFetchPage(page, { offset: start }) : output;
    },
  };
}

/** Where the element a URL fragment names starts in a page's Markdown: the start of its line, or undefined. */
export function fragmentOffset(markdown: string, hash: string): number | undefined {
  const id = decode(hash.slice(1));
  const idSlug = slug(id);
  if (!idSlug) return undefined;
  let bySlug: number | undefined;
  let byLetters: number | undefined;
  let fence: string | undefined;
  let next = 0;
  // The patterns below exclude their own delimiters, so a line of unclosed brackets from the page can't make them
  // backtrack.
  for (const line of markdown.split("\n")) {
    const start = next;
    next += line.length + 1;
    const [, marker = "", info = ""] = /^ {0,3}(`{3,}|~{3,})(.*)/.exec(line) ?? [];
    if (fence) {
      // As in CommonMark, only a bare run of the opening character, at least as long, closes the block.
      if (marker[0] === fence[0] && marker.length >= fence.length && !info.trim())
        fence = undefined;
      continue;
    }
    if (marker) {
      fence = marker;
      continue;
    }
    // A link without words is the element's own permalink, like `[¶](#json.dump)`; `[dump()](#json.dump)` only
    // refers to it.
    for (const [, target = ""] of line.matchAll(/\[[^[\]\p{L}\p{N}]*\]\(#([^)\s]+)/gu)) {
      if (decode(target) === id) return start;
    }
    const heading = /^ {0,3}#{1,6}\s+(.*)/.exec(line)?.[1];
    if (heading === undefined) continue;
    const ids = /\{#([^{}\s]+)\}|\{\/\*\s*([^*{}\s]+)\s*\*\/\}/g;
    for (const [, attr, comment = ""] of heading.matchAll(ids))
      if (decode(attr ?? comment) === id) return start;
    const text = slug(heading.replace(ids, "").replace(/\[([^[\]]*)\]\([^()\s]*\)/g, "$1"));
    if (text === idSlug) bySlug ??= start;
    if (text.replaceAll("-", "") === idSlug.replaceAll("-", "")) byLetters ??= start;
  }
  return bySlug ?? byLetters;
}

/** Text as an id-like slug: NFKC, lowercase, and each run of other characters than letters and digits as one `-`. */
function slug(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

function decode(text: string) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
