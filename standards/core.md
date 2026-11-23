# Core repository standard

This file is byte-identical in every owner's `.github` repository:
`deathpie/.github`, `simpsonm09/.github`, `sakuragaoka-homelab/.github`,
`awepeeps/.github` and `simpsonm09-projects/.github`, at `standards/core.md`.
Change it in one pull request per owner, with the same content, or not at all.
`just core-drift` in any of those repositories compares the five copies of
this file and of `hooks/core.yml`.

Each owner adds `standards/owner.md`. An owner standard may tighten any rule
here. It may loosen only a rule marked **(profile)**, and it says how.

A repository that cannot meet a rule records it in `docs/exceptions.md`: one
row per rule with the rule id, the reason, and a revisit date. An exception
without a reason or a date is drift.

## C1. Identity

- C1.1 Repository names are lowercase kebab-case. No owner prefix unless the
  name would be ambiguous outside the owner.
- C1.2 Every repository has a one-sentence description.
- C1.3 Every repository has `favicon.svg` at the root. It is the project icon.
- C1.4 The default branch is `main`. A fork that keeps upstream on `main` may
  default to its patch branch; `AGENTS.md` says so.
- C1.5 Issues are on. Wiki, Projects and Discussions are off unless used. **(profile)**
- C1.6 Public code written by the owner is MIT licensed. Private repositories
  carry no license. Forks keep the upstream license.
- C1.7 Every local clone of a fork runs `gh repo set-default <owner>/<fork>`
  once, so `gh` never falls back to the upstream repository. Agents always
  pass `-R <owner>/<repo>` (and `--base` for forks) to `gh pr`, and never open,
  comment on, or close anything in an upstream repository.

## C2. Branches, pull requests and merging

- C2.1 `main` changes only through a pull request. No direct pushes.
  Enforcement depends on the plan: a ruleset where GitHub allows one, otherwise
  a local `pre-push` hook plus a direct-push guard workflow.
- C2.2 Pull requests need **0** approving reviews. Passing required checks is
  the gate.
- C2.3 **Squash merge only.** Merge commits and rebase merges are disabled. The
  squash commit uses the pull request title and body.
- C2.4 Pull request titles are Conventional Commits:
  `type(scope)?: lowercase imperative summary`, no trailing period. Types:
  `feat fix docs chore refactor perf test build ci revert`.
- C2.5 Branch names are `type/kebab-slug` using the C2.4 types plus `deps/`
  (bots) and `save/` (a parked handoff that will not merge). Dates in names are
  `YYYY-MM-DD`.
- C2.6 Head branches are deleted on merge. "Update branch" is enabled.
- C2.7 Commits are signed (SSH signing). **(profile)**

## C3. Dependency automation

- C3.1 Dependabot alerts and Dependabot security updates are on.
- C3.2 `.github/dependabot.yml` covers `github-actions` and every package
  ecosystem in the repository. Schedule: weekly, Monday 06:00 `Etc/UTC`.
  Cooldown: 3 days patch, 7 days minor, 14 days major.
- C3.3 Minor and patch updates are grouped per ecosystem and merge
  automatically once every check on the exact head commit has passed. Native
  auto-merge is used where the plan allows it; otherwise the owner's
  automerge workflow.
- C3.4 Major updates open their own pull request, get the `major-update`
  label, and are never merged automatically.
- C3.5 Commit prefixes: `chore(deps)` for packages, `chore(actions)` for
  actions. Label: `dependencies`.

## C4. GitHub Actions

- C4.1 Every `uses:` is pinned to a full 40-character commit SHA with a
  trailing `# vX.Y.Z` comment. The repository setting "require actions to be
  pinned to a full-length commit SHA" is on.
- C4.2 The default `GITHUB_TOKEN` is read-only and cannot approve pull
  requests. Every workflow declares a top-level `permissions:` block; jobs
  widen it only where needed.
- C4.3 Checkouts use `persist-credentials: false` unless the job pushes.
- C4.4 Every job sets `timeout-minutes`. Pull request workflows set
  `concurrency` with `cancel-in-progress: true`.
- C4.5 Workflows pass `actionlint` and `zizmor`.

## C5. CI speed

- C5.1 The required checks on a pull request finish in **under 60 seconds**
  wall clock, measured from the first job starting to the last required check
  finishing, as the median of the last 20 pull request runs.
- C5.2 How: independent jobs run in parallel (format, lint, type check,
  build, test); tools are pinned and cached; test shards are balanced by
  recorded test time; pull requests run only the tests the diff can reach;
  a build runs once per process and is reused.
- C5.3 The full test suite runs on every push to `main` and weekly, so diff
  selection never hides a failure for long.
- C5.4 Slow, non-diff work does not block a pull request: CodeQL,
  full-history secret scans and scheduled audits run on `main`, on a
  schedule, or as non-required checks.
- C5.5 A repository that cannot meet C5.1 records an exception with the
  measured median and what dominates it.
- C5.6 Linux only. Every machine the owners develop on is Linux, so every
  job runs on `ubuntu-*` runners and nothing is built, tested or supported
  for Windows or macOS. Code that must run on a Windows target machine
  (for example `parents-windows-pc`) is linted and parsed on Linux, never on
  a Windows runner. A fork keeps upstream's Windows or macOS code, but its
  own CI runs on Linux only.

## C6. Security

- C6.1 Public repositories: secret scanning and push protection on; CodeQL
  default setup on (no `codeql.yml` unless default setup cannot express it,
  recorded as an exception).
- C6.2 Private repositories on a plan without those features: `gitleaks` runs
  on the pull request diff in CI and in the `pre-push` hook.
- C6.3 Secrets never live in Git. `.env*` files are ignored; examples are
  named `*.example`.

## C7. Toolchain and scripts

- C7.1 `just` is the single entry point for humans, agents and CI. CI runs
  `just` recipes, not raw tool commands.
- C7.2 `mise.toml` pins `just`, `bun` and every other CLI the recipes call.
  All repositories of one owner pin the same versions.
- C7.3 JavaScript and TypeScript work uses Bun only:

  | Job | Command | Recipe |
  | --- | --- | --- |
  | install | `bun install --frozen-lockfile` | `install` |
  | format | `bun fmt` / `bun fmt --check` | `fmt` / `fmt-check` |
  | lint | `bun lint --no-script` (oxlint until `bun lint` ships in a stable Bun) | `lint` |
  | types | `bun check` | `typecheck` |
  | test | `bun test` | `test` |
  | build | `bun build` | `build` |

  `package.json` has no `lint` script (`bun lint` would run it instead).
- C7.4 Repository scripts are TypeScript run by Bun. Shell is allowed only as
  a thin launcher (hooks, one-line wrappers). PowerShell only for code that
  runs on a Windows target machine (C5.6). Python only where TypeScript
  cannot do the job, recorded as an exception.
- C7.5 Every repository has the recipes `install`, `fmt`, `fmt-check`,
  `lint`, `typecheck` (when there is TypeScript), `test`, `check` (everything
  CI requires, in parallel where possible), `hooks` (installs the git hooks)
  and `agent-files`. `just --list` documents each one.
- C7.6 Non-JavaScript checks: `shellcheck` for shell, `actionlint` and
  `zizmor` for workflows, `gitleaks` per C6. Other languages use their own
  standard toolchain behind the same recipe names.
- C7.7 `.editorconfig` is present. `.gitattributes` contains
  `* text=auto eol=lf`.
- C7.8 Git hooks run through Lefthook, pinned in `mise.toml` as
  `"aqua:evilmartians/lefthook"`. Each owner's `.github` repository holds
  `hooks/core.yml` (byte-identical across owners) and `hooks/owner.yml`
  (owner jobs named `owner-*`), released as an annotated tag `hooks-v<N>`.
  A repository's `lefthook.yml` loads both through `remotes` at that tag and
  adds its own jobs under names that never start with `core-` or `owner-`.
  `just hooks` removes a local `core.hooksPath` only when it equals
  `.githooks`, refuses any other value or a global one, runs
  `lefthook install`, and then asserts that `lefthook dump` contains the
  `core-*` and `owner-*` jobs, because a failed remote fetch only warns.
  `lefthook-local.yml` is git-ignored.
- C7.9 CI has a `hooks` job: `lefthook install`, the same `lefthook dump`
  assertion, then `lefthook validate` (which does not fetch remotes on its
  own).
- C7.10 The hook recipe contract. Every repository defines these recipes; a
  recipe with nothing to do exits 0. Variadic recipes need
  `set positional-arguments`.

  | Recipe | Hook | Does |
  | --- | --- | --- |
  | `fmt *files` | pre-commit | formats the given files (all when none); fixes are re-staged |
  | `lint *files` | pre-commit | lints the given files, check only |
  | `secrets-staged` | pre-commit | `gitleaks git --staged --redact` |
  | `forbidden-files *files` | pre-commit | rejects `.env*` except `*.example`, `*.pem`, `*.key`, `id_*`, kubeconfig, files over 5 MB |
  | `workflows *files` | pre-commit | `actionlint` and `zizmor` |
  | `shellcheck *files` | pre-commit | `shellcheck` |
  | `agent-files` | pre-commit | C8.3 |
  | `commit-msg file` | commit-msg | warns when the subject is not a Conventional Commit; never fails |
  | `hook-pre-push` | pre-push | reads the pushed ref lines from stdin, refuses `refs/heads/main`, scans the exact pushed range with gitleaks plus the owner's scans |
  | `pre-push-check` | pre-push | fast subset: type check and the tests the diff can reach |
  | `deps-refresh` | post-checkout, post-merge | `bun install` when `bun.lock` changed, `mise install` when `mise.toml` changed |

  Budgets: pre-commit under 3 seconds and pre-push under 30 seconds on a
  typical change.

  Every hook job, core and owner, runs as `mise exec -- just <recipe>` so the
  repository's pinned tools are on PATH without shell activation. `mise` itself
  must be on PATH on every machine that commits.
- C7.11 Agents never skip hooks: no `LEFTHOOK=0`, no `--no-verify`, no
  `lefthook-local.yml`. Hooks are advisory for humans; rulesets, the
  direct-push guard and CI are the enforcement.

## C8. Agent instructions and skills

- C8.1 Every repository has `AGENTS.md`: purpose, layout, commands (`just`
  recipes), invariants, and anything an agent must never do. No standalone
  `CLAUDE.md`.
- C8.2 Skills live in `.agents/skills/<name>/SKILL.md` with `name` and
  `description` frontmatter. Codex, OpenCode, Pi, Cursor, Copilot CLI,
  Antigravity and Gemini CLI read this path.
- C8.3 Claude Code reads only `.claude/skills/`, so each skill also has a
  relative symlink `.claude/skills/<name>` → `../../.agents/skills/<name>`.
  `just agent-files` fails when the two sets differ, a link is broken, or a
  skill names a recipe that does not exist.
- C8.4 A checkout where the links became text files (for example a clone
  made with `core.symlinks=false`) fails `just agent-files`.

## C9. Lifecycle

- C9.1 A retired repository is archived. Before archiving: description starts
  `Retired (archived):`, the README starts with a `> **Retired.**` note saying
  what replaced it, and scheduled workflows are disabled.
- C9.2 A repository moves to the owner whose purpose it serves:
  `deathpie` personal, `simpsonm09` professional personal,
  `sakuragaoka-homelab` homelab, `awepeeps` friend group,
  `simpsonm09-projects` professional coding.
