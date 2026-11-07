---
name: update-dependencies
description: Update npm dependencies, GitHub Actions, Node.js, and pnpm, then open a PR.
disable-model-invocation: true
---

Start from an up-to-date `main`, on a new branch `chore/update-dependencies`. Each run opens one PR:

- A **major** update changes the first number of a version. `agents` on 0.x and the `cf` betas stay non-major however far they move, because steps 7 and 8 cover their risk.
- A run applies every non-major update and holds back the majors. Only when no non-major update exists does it apply one major.
- These packages move together, whichever group they fall in: `agents` with `@modelcontextprotocol/server`, and `cf` with `@cloudflare/vite-plugin`.

1. **Vulnerabilities in production.** Run `pnpm audit` before changing anything. `main` is what's deployed, so a finding here makes the update urgent, and only this run lets the PR say what it fixes. Nothing else reports these: GitHub's dependency graph can't read the two-document `pnpm-lock.yaml` that pnpm 12 writes, so Dependabot alerts miss every npm package. Done when you have noted each finding, or that there are none.

2. **Node.js and pnpm.** `pnpm update` leaves `devEngines` alone. Compare it with `mise latest node` and `mise latest pnpm`, set the non-major versions in `package.json`, then run `mise install`. Update them through mise only: `pnpm self-update` and `pnpm runtime set` install a second pnpm or Node.js beside mise's. Done when `node --version` and `pnpm --version` print the versions in `devEngines`.

3. **Dependencies and actions.** `pnpm outdated --json --include-github-actions` lists what can move. Pass the non-major names to `pnpm update --latest --include-github-actions <names>`, which keeps exact pins exact and moves the pinned action SHAs. If there are no names, skip the command: without names it updates everything, majors included. Done when `pnpm outdated` lists only held-back majors and releases under a day old.

4. **`@cloudflare/vite-plugin`.** Step 3 and `pnpm outdated` follow the `latest` dist-tag, which sits below the 2.0 beta this repo pins, so they skip the plugin. Its betas ship in step with `cf`. Walk back from the `beta` dist-tag to the newest version that depends on the same `miniflare` as the installed `cf` (`pnpm view <package>@<version> dependencies.miniflare`) and was published at least a day ago (`pnpm view @cloudflare/vite-plugin time --json`): pnpm's built-in release age limit isn't strict, so it may let a version named directly through. Install it with `pnpm add -D -E`. Done when both packages print the same `miniflare`. If no beta qualifies, stop and ask the user. Delete this step once `latest` reaches the pin, because step 3 then covers the plugin.

5. **What this run updates.** Run `git status --short`. If it prints nothing and a major is held back, apply one major now, through step 2 or 3, along with any package that moves with it. If nothing is held back either, switch back to `main`, delete the branch, report the findings from step 1, and stop.

6. **Vulnerabilities after the update.** Run `pnpm audit` again. Done when it reports nothing, or each finding is ready to name in the PR.

7. **Release notes.** Read the notes from the old version to the new one for every package under `dependencies` that moved, and for any major this run applies. Done when you can name each breaking change that touches what `src` imports, or say that none does.

8. **`agents` diff.** The tests never load `src/index.ts`, and comparing `agents` costs nothing, so this decides which billed tools step 9 calls. If `agents` moved, download both tarballs (`pnpm view agents@<version> dist.tarball`) into separate empty temp directories. Diff the files that `exports` in its `package.json` maps `src`'s imports to, and follow their imports into the hashed chunks: a chunk whose name changed has changed contents, so diff the old and new pair. Done when you can say whether any code differs beyond comments and chunk names.

9. **Checks.** If `pnpm peers check` fails on `@modelcontextprotocol/server`, pin it to the version `pnpm view agents@<version> peerDependencies` names. Then start `pnpm dev`, make these calls, which `pnpm run check` doesn't cover, and stop the server:
   - `node scripts/mcp.ts tools/list`. Done when every tool `src/index.ts` registers is listed.
   - `node scripts/mcp.ts web_fetch '{"url":"https://example.com/"}'`. Done when it returns status 200.
   - Only if step 8 found a code difference, once each without asking: `node scripts/mcp.ts web_search '{"query":"example domain","limit":1}'` and `node scripts/mcp.ts web_render '{"url":"https://example.com/"}'`. Done when both return results.

   When a check fails or step 7 names a change that touches `src`, that package needs code. If the run holds other updates, put its old version back in `package.json`, run `pnpm install`, and hold it back with anything that moves with it. If it's the run's only update, fix `src` here. Stop and ask when the fix would change a tool's name, input, or output, touch auth, or isn't clear.

10. **PR.** Commit as `chore: update dependencies`. In the body, show the version changes as a `diff`, say which findings from step 1 this update fixes, give the verdicts from steps 7 and 8, list the checks you ran, name any tool you didn't call, and list each held-back update with its reason. Done when `gh pr checks <n> --watch` passes. Stop there and report: the user merges.

11. **After the user asks to merge.** Run `gh pr merge <n> --delete-branch` with the merge method `AGENTS.md` picks. On a squash, add `--body-file` when `src` changed so the merged commit says why. Merging deploys to production, so watch the `Deploy` run for the merge commit with `gh run watch <run-id> --exit-status`. Done when that run has finished and you have reported its conclusion, and told the user to run this skill again if anything was held back.
