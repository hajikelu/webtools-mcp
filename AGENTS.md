# webtools-mcp

- Write code comments, commit messages, docs, issues, and PRs in English, even when the conversation is in Japanese. The exception is `README.ja.md`, the Japanese translation of `README.md`: write it in Japanese, and update it whenever `README.md` changes.
- mise provides Node.js and pnpm from `devEngines` in `package.json`. In a shell where mise isn't activated, prefix commands with `mise exec --` (for example `mise exec -- pnpm test`); otherwise the `devEngines` check rejects the Node.js on `PATH`.
- Run everything through `cf` and the scaffold's `package.json` scripts. Keep Vite+ out: `vp migrate` swaps `vite` for a package without a `vite` binary, and `cf dev` and `cf build` stop working.
- Before every commit, run `pnpm fmt` (oxfmt), `pnpm run typecheck`, and `pnpm test`.
- Unit tests cover the auth module only (`node --test`); the top of `src/auth.ts` says what keeps it runnable under Node. Verify the tools against a running Worker: `cf dev` connects the same remote bindings as production.
- Pin `agents`, `@modelcontextprotocol/server`, `cf`, and `@cloudflare/vite-plugin` to exact versions. `agents` peers on one exact `@modelcontextprotocol/server` version, and its web adapters are `@beta`. After changing dependencies, run `pnpm peers check`: `pnpm install` only warns about unmet peers, and CI fails on them.
- Keep `allowBuilds` in `pnpm-workspace.yaml` as it is: install scripts run in the deploy job, next to the Cloudflare secrets. If a new dependency needs one, explain why in the PR and let the user decide.
- Keep the tool names `web_search` and `web_fetch`: the `agents` web adapters' descriptions, result headers, and error messages refer to them by name.
- Auth fails closed: verify the Access JWT's signature, issuer, and audience on every request. The auth bypass exists only in development mode, and `cf deploy --dry-run` must not list it.
- Keep the Cloudflare account ID and client MCP configs out of the repo.
- Workers Logs is on. Keep the `Cf-Access-Jwt-Assertion` header out of logs: it carries the user's email.
- Changes reach `main` only through a pull request that the user merges; a ruleset enforces this. Work on a branch and open a PR.
- `.github/workflows/deploy.yaml` holds the Cloudflare secrets: keep it triggered only by pushes to `main`, so pull requests never reach them. Name workflow files `*.yaml`, and pin every action to a commit SHA with `pinact run`. The repository allows only `actions/checkout` and `jdx/mise-action`; a PR that adds another action must say so, so the user can extend the allowlist.
