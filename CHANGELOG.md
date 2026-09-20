# Changelog

Changes to `@contione/tempo-cli`, based on this repository's Git history starting on September 19, 2026. Dates use Asia/Shanghai (UTC+08:00). Versions identify the package version in each commit; they do not indicate an npm publication.

## 2026-09-20

### 0.1.5 — Date ranges and shortcuts

[Commit 8ae4c23](https://github.com/contione/tempo-cli/commit/8ae4c23)

- Added inclusive start/end dates to `list` / `ls`.
- Added recent-day shortcuts such as `7d`, `7day`, `7days`, and `last7days`, plus current/previous week and month shortcuts.
- Grouped range results by date and weekday, with daily and full-range scheduled/logged totals.
- Preserved default-today behavior, single-day monthly summaries, verbose output, and existing commands.

### 0.1.4 — Reliability fixes

[Commit bf7feae](https://github.com/contione/tempo-cli/commit/bf7feae)

- Preserved dates supplied through stdin when using trailing work attributes.
- Blocked Jira account/site changes while local trackers remain.
- Returned nonzero exit codes for failed operations, including partial batch failures.
- Awaited list operations and prevented a new tracker from starting when `--stop-previous` fails.
- Rejected unexpected setup arguments before prompting and updated vulnerable transitive dependencies.

### 0.1.3 — Task lookup and trailing attributes

[Commit a709973](https://github.com/contione/tempo-cli/commit/a709973)

- Added `tasks` / `task:list` to display Task labels, immutable values, and the saved default.
- Added trailing `KEY=VALUE` arguments to `log`, `stop`, and `start --stop-previous`, including support for mixing them with attribute flags.

### 0.1.2 — Per-command attribute overrides

[Commit c24946a](https://github.com/contione/tempo-cli/commit/c24946a)

- Added repeatable `--attribute KEY=VALUE` overrides to `log` and `stop`, and to the old tracker upload in `start --stop-previous`.
- Kept saved defaults for unspecified keys without changing the stored configuration.

### 0.1.1 — Default work attributes

[Commit 873c63c](https://github.com/contione/tempo-cli/commit/873c63c)

- Added a fifth setup step to choose default Tempo work attributes, including required Task values.
- Stored immutable dropdown values and reused them for direct worklogs and tracker uploads.
- Saved setup changes only after all steps succeed and added guidance for missing or invalid work attributes.

### 0.1.0 — Startup and documentation updates

[Commit fda396c](https://github.com/contione/tempo-cli/commit/fda396c). The package version remained `0.1.0` in this commit.

- Fixed the Windows startup regression by pinning compatible oclif versions, generating a command manifest, and reducing unnecessary imports.
- Resolved Jira issue keys only for the selected day's worklogs while retaining monthly totals.
- Added local build/run instructions and the CLI usage skill at `doc/tempo-cli/SKILL.md`.

## 2026-09-19

### 0.1.0 — Initial repository

[Initial commit efb5dbd](https://github.com/contione/tempo-cli/commit/efb5dbd) and [command-name fix b1b8b8f](https://github.com/contione/tempo-cli/commit/b1b8b8f).

- Created the TypeScript/Node.js CLI repository and `@contione/tempo-cli` package configuration.
- Integrated Tempo REST API v4 and Jira REST API v3, including Jira account lookup during setup.
- Included worklog creation, listing and deletion, monthly schedule summaries, issue aliases, and local trackers with pause/resume and retryable uploads.
- Added local configuration storage, English documentation, tests, and GitHub CI/release workflows.
- Corrected the installed executable to `tempo` as the only command name.
