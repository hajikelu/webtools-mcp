import { DEFAULT_WEB_SEARCH_DESCRIPTION_CHARS, type WebSearchSource } from "agents/websearch";

/**
 * Wraps a search source so each result's description is trimmed to the length the text content shows. The adapter
 * trims only the text and returns descriptions whole for `structuredContent`, and Claude Code gives the model
 * `structuredContent` instead of the text.
 */
export function trimDescriptions(source: WebSearchSource): WebSearchSource {
  return {
    ...source,
    async search(request, options) {
      const response = await source.search(request, options);
      return {
        ...response,
        items: response.items.map((item) => ({
          ...item,
          description: compactDescription(item.description),
        })),
      };
    },
  };
}

// A copy of the function of the same name in `agents`, which renderWebSearchResults uses but doesn't export. search.test.ts
// checks that the two still agree.
function compactDescription(description: string | undefined) {
  const compact = description?.replace(/\s+/g, " ").trim();
  if (!compact) return undefined;
  if (compact.length <= DEFAULT_WEB_SEARCH_DESCRIPTION_CHARS) return compact;
  const cut = compact.slice(0, DEFAULT_WEB_SEARCH_DESCRIPTION_CHARS - 1);
  const space = cut.lastIndexOf(" ");
  // Ends on a whole word when one ends in the last 20 characters.
  return `${cut.slice(0, space >= cut.length - 20 ? space : cut.length).trimEnd()}…`;
}
