// Builds the Worker as the deploy job does, without uploading it, and reads the bindings it would carry.
import { spawnSync } from "node:child_process";

const { status, stdout, stderr } = spawnSync(
  "cf",
  ["deploy", "--dry-run", "--mode", "production"],
  { encoding: "utf8" },
);
// `cf` prints the bindings on stderr.
const output = `${stdout}${stderr}`;
if (status !== 0) throw new Error(`the dry run failed:\n${output}`);
// `cf` is a beta: a changed output format must not read as "no bypass".
if (!output.includes("env.ACCESS_AUD"))
  throw new Error(`the dry run lists no bindings:\n${output}`);
if (output.includes("SKIP_ACCESS_AUTH")) {
  throw new Error(`a production build carries the auth bypass:\n${output}`);
}
