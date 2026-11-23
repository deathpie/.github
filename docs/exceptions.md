# Exceptions

Rules from [`standards/core.md`](../standards/core.md) and
[`standards/owner.md`](../standards/owner.md) that this repository cannot meet, with the reason
and the date to revisit.

| Rule | Reason                                                                                                                                                                                     | Revisit    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| C7.5 | `install`, `typecheck`, `test` and `hooks` have nothing to run: this repository is documentation and community defaults only. `fmt`, `fmt-check`, `lint`, `check` and `agent-files` exist. | 2027-02-23 |
| C5.1 | Fewer than 20 pull request runs exist, so there is no median to report. The `check` job is one short job; the median is recorded once 20 runs exist.                                       | 2027-02-23 |
