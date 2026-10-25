import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { webFetchTool } from "agents/webfetch/ai-sdk";
import { webSearchTool } from "agents/websearch/ai-sdk";

import { accessJwks, verifyAccessJwt } from "./auth.ts";

interface Tool<I, O> {
  description: string;
  inputSchema: Parameters<McpServer["registerTool"]>[1]["inputSchema"];
  execute(input: I, options: { abortSignal?: AbortSignal }): Promise<O>;
  toModelOutput(options: { output: O }): { value: string };
}

function register<I, O extends Record<string, unknown>>(
  server: McpServer,
  name: string,
  tool: Tool<I, O>,
) {
  server.registerTool(
    name,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args, ctx) => {
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

function createServer(env: Env) {
  const server = new McpServer({ name: "webtools", version: "0.1.0" });
  register(
    server,
    "web_search",
    webSearchTool({ binding: env.AI, gateway: "webtools", provider: "exa" }),
  );
  register(server, "web_fetch", webFetchTool({ binding: env.AI }));
  return server;
}

export default {
  async fetch(req, env, ctx) {
    // `cf deploy --mode development` would carry the bypass binding, so also require a local request.
    const local = "SKIP_ACCESS_AUTH" in env && new URL(req.url).hostname === "localhost";
    if (
      !local &&
      !(await verifyAccessJwt(
        req.headers.get("cf-access-jwt-assertion"),
        accessJwks,
        env.ACCESS_AUD,
      ))
    ) {
      return new Response("Unauthorized", { status: 401 });
    }
    return createMcpHandler(() => createServer(env))(req, env, ctx);
  },
} satisfies ExportedHandler<Env>;
