import { McpServer, type StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import type { WebFetchToolOutput } from "agents/webfetch";
import { webFetchTool } from "agents/webfetch/ai-sdk";
import type { WebSearchToolOutput } from "agents/websearch";
import { webSearchTool } from "agents/websearch/ai-sdk";
import { z } from "zod";

import { isAuthorized } from "./auth.ts";
import { webRenderOutput, webRenderTool } from "./render.ts";

interface Tool<I, O> {
  description: string;
  inputSchema: StandardSchemaWithJSON;
  execute(input: I, options: { abortSignal?: AbortSignal }): Promise<O>;
  toModelOutput(options: { output: O }): { value: string };
}

function register<I, O extends Record<string, unknown>>(
  server: McpServer,
  name: string,
  tool: Tool<I, O>,
  outputSchema: z.ZodType<O>,
  rateLimit: RateLimit,
) {
  server.registerTool(
    name,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args, ctx) => {
      // Not retryable: the limits are there to stop a runaway loop.
      if (!(await rateLimit.limit({ key: name })).success) {
        return {
          content: [
            {
              type: "text",
              text: `${name} is rate limited. Do not retry it; answer with what you have, and say that ${name} was unavailable.`,
            },
          ],
          isError: true,
        };
      }
      try {
        const output = await tool.execute(args as I, { abortSignal: ctx.mcpReq.signal });
        return {
          content: [{ type: "text", text: tool.toModelOutput({ output }).value }],
          structuredContent: output,
        };
      } catch (e) {
        // The adapters write `message` for the model and keep operator detail (credits, request IDs) in `cause`.
        if (!(e instanceof Error)) throw e;
        console.error(name, e.cause);
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    },
  );
}

// The agents adapters export their output types but no schemas, so `Exact` fails typecheck when an `agents` bump
// changes the output types. The schemas are loose because `Exact` sees only the types: `agents` builds these
// objects, and a key it adds at runtime would fail validation in clients that use a closed schema (z.object()
// advertises additionalProperties: false). `Shape` drops the `[key: string]: unknown` that z.looseObject() adds
// to the inferred type.
type Shape<T> = T extends readonly (infer U)[]
  ? Shape<U>[]
  : T extends object
    ? { [K in keyof T as string extends K ? (unknown extends T[K] ? never : K) : K]: Shape<T[K]> }
    : T;
type Exact<A, B> =
  (<T>() => T extends Shape<A> ? 1 : 2) extends <T>() => T extends Shape<B> ? 1 : 2 ? true : false;

const webSearchOutput = z.looseObject({
  items: z.array(
    z.looseObject({
      url: z.string(),
      title: z.string(),
      description: z.string().optional(),
      lastModifiedDate: z.string().optional(),
      imageUrl: z.string().optional(),
      faviconUrl: z.string().optional(),
    }),
  ),
  metadata: z.looseObject({ query: z.string(), requestId: z.string(), latencyMs: z.number() }),
  provider: z.string().optional(),
});
true satisfies Exact<z.infer<typeof webSearchOutput>, WebSearchToolOutput>;

const webFetchOutput = z.looseObject({
  url: z.string(),
  finalUrl: z.string(),
  status: z.number(),
  contentType: z.string(),
  via: z.enum(["markdown-negotiated", "converted", "json", "text", "raw", "rendered"]),
  content: z.string(),
  totalChars: z.number(),
  title: z.string().optional(),
  headers: z.record(z.string(), z.string()),
  bytes: z.number(),
  redirects: z.array(z.string()),
  offset: z.number(),
  nextOffset: z.number().nullable(),
});
true satisfies Exact<z.infer<typeof webFetchOutput>, WebFetchToolOutput>;

function createServer(env: Env) {
  const server = new McpServer(
    { name: "webtools", version: "0.1.0" },
    {
      // Clients that don't declare the tools upfront (Pi's default codemode exposure) describe the server
      // to the model with the first line of these instructions, so it must say on its own what the tools are for.
      instructions:
        "Web access: web_search searches the public web, web_fetch reads http(s) URLs, and web_render reads pages that need JavaScript when web_fetch comes back empty. Use them for current events, documentation, and facts you can't verify.",
    },
  );
  register(
    server,
    "web_search",
    webSearchTool({ binding: env.AI, gateway: "webtools", provider: "exa" }),
    webSearchOutput,
    env.SEARCH_RATE_LIMIT,
  );
  register(
    server,
    "web_fetch",
    webFetchTool({ binding: env.AI }),
    webFetchOutput,
    env.FETCH_RATE_LIMIT,
  );
  register(
    server,
    "web_render",
    webRenderTool(env.BROWSER),
    webRenderOutput,
    env.RENDER_RATE_LIMIT,
  );
  return server;
}

export default {
  async fetch(req, env, ctx) {
    if (!(await isAuthorized(req, env))) return new Response("Unauthorized", { status: 401 });
    return createMcpHandler(() => createServer(env))(req, env, ctx);
  },
} satisfies ExportedHandler<Env>;
