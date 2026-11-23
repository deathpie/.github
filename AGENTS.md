# Agent instructions

This repository holds the account-wide GitHub defaults for `deathpie` and the repository standard
that applies to the account.

## Layout

- `README.md`, `CONTRIBUTING.md`, `SUPPORT.md`: the community defaults GitHub copies into any
  repository of this account that has no local equivalent.
- `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/`: the default forms.
- `standards/core.md`: the shared core standard. Byte-identical in five owner repositories.
- `standards/owner.md`: the rules for this account on top of the core.
- `scripts/core-drift.ts`: compares the five copies of `core.md`.
- `favicon.svg`: the T3 Code project icon.

## Commands

- `just` lists the recipes.
- `just fmt` formats the repository; `just fmt-check` reports files that need it.
- `just check` is the gate: `fmt-check`.
- `just core-drift` compares `standards/core.md` with the other four owners. It needs `gh` logged
  in as both `deathpie` and `simpsonm09`, so it runs locally only.

## Invariants

- `standards/core.md` stays byte-identical across all five owner `.github` repositories. Never
  edit it in one repository alone: change it in one pull request per owner with the same content,
  and run `just core-drift` to confirm. An owner standard may tighten a core rule, and may
  loosen only the rules marked **(profile)**.
- `standards/core.md` and `scripts/core-drift.ts` are excluded from formatting in
  `.prettierignore`. Do not "fix" them.
- The README section "Shared defaults" describes how GitHub propagates these files. Keep it
  accurate; it is not marketing copy.

## Never

- Push to `main`. It is a public repository with a ruleset: work on a branch and merge a pull
  request.
- Change GitHub settings, repository visibility or access from a workflow, script or agent run.
- Commit credentials, tokens, personal identifiers or local machine state.
