# deathpie repository standard

`deathpie` is a personal GitHub account on the Free plan. Its repositories hold the owner's
personal data, settings exports and small personal tools, and most of them are private.
[`core.md`](core.md) applies in full unless a **(profile)** rule is adjusted below. This file adds
the account's choices, its enforcement and its open gaps.

## Scope

From `gh repo list deathpie --limit 200` on 2026-11-23. Six repositories: none archived, none a
fork, none a template. All default to `main`.

| repo                   | visibility | kind                               | notes                                                                          |
| ---------------------- | ---------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| `deathpie`             | public     | profile README and icon            | Two files: `README.md`, `favicon.svg`. No code, no CI.                         |
| `.github`              | public     | account defaults and this standard | The only repository with secret scanning and push protection on.               |
| `deathpie-discord`     | private    | data export                        | Discord server JSON export. No code, no scripts.                               |
| `nsfw-model-testing`   | private    | code                               | Windows PowerShell setup script and ComfyUI graph JSON.                        |
| `sd-card-tools`        | private    | code                               | 51 KB Bash formatter. Real card identities stay in the ignored `targets.conf`. |
| `wow-forever-settings` | private    | code and data                      | Python, PowerShell and CMD helpers, Lua settings, snapshot releases.           |

## Plan and protection

GitHub Free, one user account, no organization, no security features on private repositories.
Private repositories cannot use branch protection or rulesets: both return
`403 Upgrade to GitHub Pro`. Public repositories can use a repository ruleset. C2.1 is therefore
enforced two ways.

### Public repositories: `deathpie`, `deathpie/.github`

One ruleset named `main`, enforcement active, target `refs/heads/main`, and **no bypass actors**.
The owner pushes through pull requests like anyone else.

| rule                                  | setting                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Require a pull request before merging | on; 0 approving reviews; no code-owner review; no last-push approval; thread resolution not required                               |
| Required status checks                | `check` once the repository has a `checks.yml`; "require branches to be up to date" off, because C2.6 update-branch does that work |
| Require linear history                | on                                                                                                                                 |
| Allowed merge methods                 | squash only                                                                                                                        |
| Block force pushes                    | on                                                                                                                                 |
| Restrict deletions                    | on                                                                                                                                 |
| Require signed commits                | on (C2.7)                                                                                                                          |
| Bypass list                           | empty                                                                                                                              |

Until a repository has the `check` workflow, the ruleset omits required status checks; the pull
request itself is the only gate and the missing check is a backlog row, not a quiet exception.

### Private repositories: `deathpie-discord`, `nsfw-model-testing`, `sd-card-tools`, `wow-forever-settings`

The same three pieces in every repository:

1. `.githooks/pre-push`, installed by `just hooks`. It refuses a push whose remote ref is `main`
   and refuses a commit whose `git log --format=%G?` is not `G` (a good SSH signature). An
   owner-approved recovery may set `ALLOW_MAIN_PUSH=1` for one push.
2. `.github/workflows/guard-direct-push.yml`, the same design as
   `sakuragaoka-homelab/agent-tooling`: after a push to `main` it asks the API whether every new
   commit belongs to a merged pull request, opens or comments on one `direct-push` issue, and
   fails the run when it cannot verify, so a broken check never reports success. It uses the API
   only and never checks out the pushed code.
3. `.github/workflows/pr-automerge.yml`, the homelab label-driven design with
   `MERGE_METHOD: squash`. `dependabot/fetch-metadata` labels minor and patch updates
   `automerge`, holds majors as `major-update` with one comment, and the merge job merges only
   when every other check run on the exact head commit has passed and the branch is mergeable.

The workflows are per-repository copies, not a reusable workflow: a private repository cannot
resolve a cross-repository `uses:`, and that failure breaks every Dependabot action update. The
guard is API calls through `gh`; the automerge workflow's only action,
`dependabot/fetch-metadata`, is pinned to a full commit SHA and updated by Dependabot (C4.1).

## Profile choices

| rule | choice                                                                                                                                                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1.5 | Issues on everywhere. Wiki, Projects and Discussions off in all six repositories.                                                                                                         |
| C2.7 | Commits are signed with SSH keys. Already configured in the account's folder git config; the public ruleset requires signatures and the private `pre-push` hook refuses unsigned commits. |

## Required checks

The check name is the workflow job name, so every repository that has CI calls it `check` and
runs `just check` behind it. Required on pull requests.

| repo                   | required check | recipes                                                                                              |
| ---------------------- | -------------- | ---------------------------------------------------------------------------------------------------- |
| `sd-card-tools`        | `check`        | `fmt-check` (`bun fmt --check`), `shellcheck format-photos.sh`                                       |
| `nsfw-model-testing`   | `check`        | `fmt-check`, `actionlint`, `zizmor`, PSScriptAnalyzer on `scripts/*.ps1`                             |
| `wow-forever-settings` | `check`        | `fmt-check`, `actionlint`, `zizmor`; while the Python helpers remain, `python -m py_compile` on them |
| `.github`              | none yet       | `check` = `fmt-check` locally; the repository has no workflow                                        |
| `deathpie-discord`     | none           | Data-only; owner rule 2 exempts it from CI                                                           |
| `deathpie`             | none           | Text-only profile repository                                                                         |

C7.5 asks for `install`, `fmt`, `fmt-check`, `lint`, `typecheck`, `test`, `check`, `hooks` and
`agent-files` in every repository. This repository has only what a docs-only tree can run:
`default`, `fmt`, `fmt-check` and `check`, plus `core-drift`. The rest go into
`docs/exceptions.md` as C7.5 exceptions, with the reason that there is nothing to install, lint,
typecheck or test (backlog). In a repository with scripts, `hooks` installs `.githooks/pre-push`
and `agent-files` fails when `.agents/skills` and `.claude/skills` disagree or a skill names a
missing recipe.

`just check` in `.github` runs `fmt-check`; `core-drift` needs `gh` logged in as two accounts, so
it stays a local command and never a required check.

C5.3 needs no diff selection here: the three CI repositories run the same `just check` on every
push to `main` and on a weekly schedule, so a pull request that skips a slow check cannot hide a
failure for long.

CI median (C5.1): none of the six repositories has a workflow run, so there is no median to
report. Each repository records its first median after 20 pull-request runs; until then the
backlog row stays open rather than claiming a number.

## Owner rules

1. **Privacy baseline.** Treat every repository as if it could become public. No personal
   identifiers, email addresses, IP addresses, hostnames, device serial numbers or tokens in
   Git. Machine-specific values come from a git-ignored local file with a committed
   `*.example` next to it, the way `sd-card-tools` pairs `targets.conf` with
   `targets.example.conf`. Read the diff for those values before opening a pull request that
   touches data.
2. **CI where there is code.** `sd-card-tools`, `nsfw-model-testing` and
   `wow-forever-settings` carry the required checks above. Data-only repositories
   (`deathpie-discord`) and the profile repository may have no CI. They still get
   `.github/dependabot.yml` for `github-actions` once they have workflows, because the guard and
   automerge workflows are theirs.
3. **Features.** C1.5: wiki, Projects and Discussions stay off; issues stay on.
4. **Signing.** C2.7: SSH-signed commits everywhere, as enforced in Plan and protection.
5. **Destructive scripts.** A script that formats devices or rewrites game files defaults to a
   dry run, prints the plan, and does nothing until the owner types its confirmation word. Its
   `AGENTS.md` says both things. The words are `FORMAT` in `sd-card-tools`, `RESTORE` for a
   snapshot restore and `APPLY` for a character-settings copy in `wow-forever-settings`.
6. **`save/` branches.** A `save/` branch is a parked handoff, not a change to merge. Close its
   pull request unmerged and delete the branch once its content is captured in a document, a
   `docs/` record or a release; before deleting, confirm the capture exists.
7. **Existing scripts.** PowerShell stays where the target is Windows-only: ComfyUI setup in
   `nsfw-model-testing` and WoW settings work on Windows in `wow-forever-settings`. Python
   helpers in `wow-forever-settings` move to TypeScript/Bun under C7.4 or get an exception row
   with a reason and a revisit date in `docs/exceptions.md`. Shell stays a thin launcher.
8. **No license on private repositories.** C1.6: public owner-written code is MIT, private
   repositories carry none. `sd-card-tools` becomes MIT only if it is ever made public.
9. **GitHub settings are owner changes.** No workflow, agent or script changes repository
   settings, visibility, secrets or access. They are recorded in the backlog and changed in the
   UI by the owner.

## Superseded

Nothing formal was superseded. The account's only standard-like document is the `.github` README
section "Shared defaults". Its statements stay accurate and are kept unchanged: defaults apply
only when a repository has no local equivalent, they are not copied into clones, and workflows,
branch protection, repository settings and agent instructions need explicit configuration.

What changes from the practices the audit recorded:

| before                                                                                     | after                                                                                                    |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| merge, squash and rebase all allowed, so `Merge pull request #N` commits appear in history | squash merge only (C2.3); pull request titles are Conventional Commits (C2.4)                            |
| no protection anywhere; private repositories return `403` on protection and rulesets       | ruleset on public repositories; `pre-push` hook plus guard workflow on private ones (C2.1)               |
| plain imperative commit subjects as the default                                            | Conventional Commit pull request titles; squash commits take that title                                  |
| `save/*` pull requests closed unmerged with the branch left on origin                      | close unmerged and delete the branch after the content is captured elsewhere (C2.5)                      |
| no dependency or merge automation at all                                                   | weekly Dependabot with grouped minor and patch updates that merge through the label-driven workflow (C3) |

No other repository is edited by this change. Each adopts the standard the next time it is
touched; the Conformance backlog is the list.

## Conformance backlog

Derived from the audit report and a fresh look at each local clone on 2026-11-23. No CI median is
listed: every repository has `runs.total_count: 0`.

| repo                   | gaps vs core + owner standard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | proposed fix                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.github`              | C1.5 wiki and Projects on. C2.1 no ruleset. C2.3 settings still allow merge and rebase. C2.6 `delete_branch_on_merge=false` and a stale `chore/t3-project-icon` branch. C1.6 no MIT `LICENSE`. C2.2 and C5.1 no `check` workflow, so no required status check. C7.5 `install`, `lint`, `typecheck`, `test`, `hooks` and `agent-files` have nothing to run.                                                                                                                                                                                                                  | Owner applies the `main` ruleset and turns the merge settings to squash-only with branch deletion. Add an MIT `LICENSE`, a `checks.yml` running `just check`, and exception rows for the recipes that do not apply to a docs-only repository. Delete the stale branch.                                                                                       |
| `deathpie`             | C1.2 no description. C1.5 wiki and Projects on. C2.1 no ruleset. C2.6 stale `chore/t3-project-icon`. C1.6 no license. C7.5 and C7.7 no `justfile`, `mise.toml`, `.editorconfig` or `.gitattributes`. C8.1 no `AGENTS.md`. C2.2 no required check.                                                                                                                                                                                                                                                                                                                           | One pull request with the description, the ruleset and the same cheap skeleton as `.github`. Record C1.6 as an exception while the repository is a two-file profile README.                                                                                                                                                                                  |
| `deathpie-discord`     | C2.1 no hook, guard or automerge workflow. C3.2 no `dependabot.yml`. C1.5 Projects on. C2.5 `save/opentofu-pilot-handoff` and three merged `chore/*` branches remain. C7.5 and C7.7 no `justfile`, `mise.toml`, `.editorconfig` or `.gitattributes`.                                                                                                                                                                                                                                                                                                                        | Add `.githooks/pre-push`, the two workflows, `dependabot.yml` for `github-actions`, the toolchain skeleton and `AGENTS.md` updates for the new recipes. Delete the `save/` and merged branches after confirming the handoff document exists. No CI: data-only.                                                                                               |
| `nsfw-model-testing`   | C2.1 no hook, guard or automerge workflow. C3.2 no `dependabot.yml`. C5.1 no required check in a repository that ships a script. C8.1 no `AGENTS.md`. C7.5 and C7.7 no `justfile`, `mise.toml`, `.editorconfig` or `.gitattributes`. C1.5 Projects on. C2.5 stale `save/research-notes-prereinstall-20261029` branch.                                                                                                                                                                                                                                                       | Same protection and dependency files, plus `justfile` with `check` (`fmt-check`, `actionlint`, `zizmor`, PSScriptAnalyzer) and a `checks.yml`; `AGENTS.md` covering the model tree and the adult-content constraints. Delete the `save/` branch after the notes land in `docs/`.                                                                             |
| `sd-card-tools`        | C2.1 no hook, guard or automerge workflow. C3.2 no `dependabot.yml`. C5.1 no required check. C8.1 no `AGENTS.md`, and the destructive-script rule has nowhere to live. Owner rule 5: `format-photos.sh` plans and asks for `FORMAT`, but `--yes` bypasses the word and there is no dry-run default. C7.7 no `.editorconfig` or `.gitattributes`. C1.5 Projects on.                                                                                                                                                                                                          | Add protection, dependency and toolchain files with `check` = `fmt-check` plus `shellcheck`. Make `--dry-run` the default when `--yes` is absent, keep `FORMAT` as the interactive word, and state both in a new `AGENTS.md` with the `targets.conf` privacy rule.                                                                                           |
| `wow-forever-settings` | C2.1 no hook, guard or automerge workflow. C3.2 no `dependabot.yml`. C5.1 no required check. C8.1 no `AGENTS.md`; the constraints live in README prose. C7.4 four Python helpers (`export_portable_settings.py`, `make_snapshot_linux.py`, `restore_snapshot_linux.py`, `compare_savedvariables.py`). Owner rule 5: restore and apply need a dry-run default and a confirmation word; `restore_snapshot_linux.py` has `--dry-run` only as an option. C7.7 `.gitattributes` has byte rules but no `* text=auto eol=lf`. C2.5 `docs/research-keyboard-party-invites` remains. | Add protection, dependency and toolchain files; `check` = `fmt-check`, `actionlint`, `zizmor`, `py_compile` until the migration. Port the helpers to Bun TypeScript one at a time, recording an exception for any that cannot move. Add the global `text=auto` line above the `/WTF/**` byte rules, and `AGENTS.md` with the dry-run and confirmation rules. |
