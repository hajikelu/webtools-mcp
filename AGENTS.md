# webtools-mcp

Remote MCP server on Cloudflare Workers that exposes `web_search` and `web_fetch` by wrapping the AI SDK adapters from `agents/websearch/ai-sdk` and `agents/webfetch/ai-sdk`, plus `web_render`, which reads JavaScript-rendered pages through Browser Run's `/markdown` Quick Action. Cloudflare Access (Managed OAuth) signs clients in; the Worker verifies the Access JWT.

- Write code comments, commit messages, docs, issues, and PRs in English, even when the conversation is in Japanese. The exception is `README.ja.md`, the Japanese translation of `README.md`: write it in Japanese, and update it whenever `README.md` changes.
- Before every commit, run `pnpm fmt` (oxfmt), `pnpm run typecheck`, and `pnpm test`. CI only deploys, so nothing else checks them.
- mise provides Node.js and pnpm from `devEngines` in `package.json`. In a shell where mise isn't activated, prefix commands with `mise exec --` (for example `mise exec -- pnpm test`); otherwise the `devEngines` check rejects the Node.js on `PATH`.
- Run everything through `cf` and the scaffold's `package.json` scripts. Keep Vite+ out: `vp migrate` swaps `vite` for a package without a `vite` binary, and `cf dev` and `cf build` stop working.
- Keep the tool names `web_search` and `web_fetch`: the adapters' descriptions, result headers, and error messages refer to them by name.
- Pin `agents`, `@modelcontextprotocol/server`, `cf`, and `@cloudflare/vite-plugin` to exact versions. `agents` peers on one exact `@modelcontextprotocol/server` version, and its web adapters are `@beta`. After changing dependencies, run `pnpm peers check`: `pnpm install` only warns about unmet peers, and the deploy job fails on them.
- Auth fails closed: verify the JWT's signature, issuer, and audience on every request. The auth bypass exists only in development mode, and `cf deploy --dry-run` must not list it.
- Unit tests cover the auth module only (`node --test`). Verify the adapter wiring against a deployed Worker.
- Node.js runs the tests by stripping types, so code under test stays Node-safe: use erasable syntax only (`erasableSyntaxOnly` enforces it), import with the `.ts` extension, and keep Workers-only modules such as `cloudflare:workers` out of it. Tests type-check under `tsconfig.test.json`.
- Keep the Cloudflare account ID and client MCP configs out of the repo.
- Workers Logs is on. Keep the `Cf-Access-Jwt-Assertion` header out of logs: it carries the user's email.
- Changes reach `main` only through a pull request that the user merges; a ruleset enforces this. Work on a branch and open a PR.
- Keep `allowBuilds` in `pnpm-workspace.yaml` as it is: install scripts run in the deploy job, next to the Cloudflare secrets. If a new dependency needs one, explain why in the PR and let the user decide.
- Production deploys run from `.github/workflows/deploy.yaml` on pushes to `main`. Name workflow files `*.yaml`, and pin every action to a commit SHA with `pinact run`. The repository allows only `actions/checkout` and `jdx/mise-action`; a PR that adds another action must say so, so the user can extend the allowlist. The workflow has no `pull_request` trigger, so pull requests never reach Cloudflare credentials.
