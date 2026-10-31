// Prints tool names and result text only: the schemas in tools/list run long.
const [name, args = "{}"] = process.argv.slice(2);
if (!name) throw new Error("usage: node scripts/mcp.ts tools/list | <tool> [JSON arguments]");

const request =
  name === "tools/list"
    ? { jsonrpc: "2.0", id: 1, method: "tools/list" }
    : {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: JSON.parse(args) },
      };
const response = await fetch("http://localhost:5173/mcp", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
  body: JSON.stringify(request),
});
const body = await response.text();
if (!response.ok) throw new Error(`${response.status}: ${body}`);
// An event-stream answer carries the JSON-RPC response on its last data line.
const data =
  body
    .split("\n")
    .findLast((line) => line.startsWith("data: "))
    ?.slice(6) ?? body;
const { result, error } = JSON.parse(data);
if (error) throw new Error(JSON.stringify(error));
if (name === "tools/list") {
  for (const tool of result.tools) console.log(tool.name);
} else {
  for (const item of result.content)
    console.log(item.type === "text" ? item.text : JSON.stringify(item));
  if (result.isError) process.exitCode = 1;
}
