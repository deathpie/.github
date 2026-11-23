set shell := ["bash", "-euo", "pipefail", "-c"]

# List the recipes.
default:
    @just --list

# Compare standards/core.md with the other four owners' copies. Needs gh logged in as two accounts.
core-drift:
    bun scripts/core-drift.ts

# Audit every repository of this owner against the core and owner standards.
# `just fleet-audit --timing` adds the C5.1 median pull request CI wall time.
fleet-audit *args:
    bun scripts/fleet-audit.ts {{args}}

# Format the repository. standards/core.md and scripts/core-drift.ts are ignored.
fmt:
    bun fmt

# Fail if any file needs formatting.
fmt-check:
    bun fmt --check

# Lint the workflows: actionlint for syntax, zizmor for security.
lint:
    actionlint
    zizmor .github/workflows

# Check the agent skill files: frontmatter, recipes and the .claude symlinks.
agent-files:
    bun scripts/agent-files.ts

# Everything a pull request in this repository must pass.
check: fmt-check lint agent-files
