# deathpie GitHub defaults

Public community defaults for repositories owned by [deathpie](https://github.com/deathpie).

The personal profile README lives separately in [deathpie/deathpie](https://github.com/deathpie/deathpie).

## Shared defaults

- CONTRIBUTING.md: basic contribution guidance.
- SUPPORT.md: how to ask for help.
- .github/pull_request_template.md: a concise change and verification template.
- .github/ISSUE_TEMPLATE/: bug reports and feature requests.

GitHub uses supported defaults when a repository owned by this account has no local equivalent. Local files take precedence. Defaults are not copied into clones, and defaults from an upstream organization do not automatically extend to forks owned by another account.

Project-specific setup, session guidance, and validation remain in each project repository.

Workflows, branch protection, repository settings, and agent instructions require explicit configuration. Merely placing them here does not apply them across the account.

## Standards

The account's repository standard lives in `standards/`:

- [`standards/core.md`](standards/core.md): the shared core. Byte-identical in every owner's
  `.github` repository; `just core-drift` compares the five copies.
- [`standards/owner.md`](standards/owner.md): the rules for this account on top of the core.

See [GitHub's default community health file documentation](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file).
