---
name: update-dependencies
description: Update npm dependencies, GitHub Actions, Node.js, and pnpm, then open a PR.
disable-model-invocation: true
---

Start from an up-to-date `main`, on a new branch `chore/update-dependencies`.

1. **Node.js and pnpm.** `pnpm update` leaves `devEngines` alone. Set it in `package.json` to the versions `mise latest node` and `mise latest pnpm` print, then run `mise install`. Update them through mise only: `pnpm self-update` and `pnpm runtime set` install a second pnpm or Node.js beside mise's. Done when `node --version` and `pnpm --version` print the new versions.

2. **Dependencies and actions.** Run `pnpm update --latest --include-github-actions`. It crosses major versions, keeps exact pins exact, and moves the pinned action SHAs. Done when `pnpm outdated` lists nothing, or only releases under a day old.

3. **`@cloudflare/vite-plugin`.** Step 2 and `pnpm outdated` follow the `latest` dist-tag, which sits below the 2.0 beta this repo pins, so they skip the plugin. Its betas ship in step with `cf`. Walk back from the `beta` dist-tag to the newest version that depends on the same `miniflare` as the installed `cf` (`pnpm view <package>@<version> dependencies.miniflare`) and was published at least a day ago (`pnpm view @cloudflare/vite-plugin time --json`): pnpm's built-in release age limit isn't strict, so it may let a version named directly through. Install it with `pnpm add -D -E`. Done when both packages print the same `miniflare`. If no beta qualifies, stop and ask the user. Delete this step once `latest` reaches the pin, because step 2 then covers the plugin.

4. **Vulnerabilities.** Run `pnpm audit`. This is the only check: GitHub's dependency graph can't read the two-document `pnpm-lock.yaml` that pnpm 12 writes, so Dependabot alerts miss every npm package. Done when it reports nothing, or each finding is ready to name in the PR.

5. **Release notes.** Read the notes from the old version to the new one for every package under `dependencies` that moved. The tests never load `src/index.ts`, so these notes are the only warning of a runtime break. Done when you can name each breaking change that touches what `src` imports, or say that none does.

6. **Checks.** If `pnpm peers check` fails on `@modelcontextprotocol/server`, pin it to the version `pnpm view agents@<version> peerDependencies` names. Then run these, which `pnpm run check` doesn't cover:
   - `pnpm cf deploy --dry-run --mode production` builds the Worker as the deploy job does. Done when it builds and its bindings omit `SKIP_ACCESS_AUTH`.
   - `pnpm dev`, then `node scripts/mcp.ts tools/list`, then stop the server. Done when every tool `src/index.ts` registers is listed. This listing is the only request an update sends to a running Worker: tool calls bill the account, so this flow leaves them out.

7. **PR.** Commit as `chore: update dependencies`. In the body, show the version changes as a `diff`, give the verdict from step 5, list the checks you ran, and say that no tool was called. Done when `gh pr checks <n> --watch` passes. Stop there and report: the user merges.

8. **After the user asks to merge.** Run `gh pr merge <n> --squash --delete-branch`. Merging deploys to production, so watch the `Deploy` run for the merge commit with `gh run watch <run-id> --exit-status`. Done when that run has finished and you have reported its conclusion.
