set shell := ["bash", "-euo", "pipefail", "-c"]

# List the recipes.
default:
    @just --list

# Compare standards/core.md with the other four owners' copies. Needs gh logged in as two accounts.
core-drift:
    bun scripts/core-drift.ts

# Format the repository. standards/core.md and scripts/core-drift.ts are ignored.
fmt:
    bun fmt

# Fail if any file needs formatting.
fmt-check:
    bun fmt --check

# Everything a pull request in this repository must pass.
check: fmt-check
