import { bindings, defineConfig } from "cf/config";

import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig(({ mode }) => ({
  worker: {
    name: "webtools-mcp",
    compatibilityDate: "2026-10-25",
    entrypoint,
    env: {
      // websearch() doesn't run locally, so dev searches hit the real API and bill the account.
      AI: bindings.ai({ dev: { remote: true } }),
      // AI Gateway's rate limit doesn't apply to Web Search, so searches are limited here.
      SEARCH_RATE_LIMIT: bindings.rateLimit({
        namespace: "1001",
        simple: { limit: 30, period: 60 },
      }),
      ACCESS_AUD: bindings.text("da8dccd8776bc89a68e82e6a445e17e67753d3ffc6ffb7abaf8654fe7e0702e2"),
      // Access isn't in front of `cf dev`. Production builds never define it; the Worker also checks for localhost.
      ...(mode === "development" && { SKIP_ACCESS_AUTH: bindings.text("1") }),
    },
    domains: ["webtools.mcp.hajike.lu"],
    workersDev: false,
    observability: { enabled: true },
  },
}));
