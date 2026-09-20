# Changelog

All notable changes to `@contione/tempo-cli` are documented here. Release versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Review fixes

- Updated vulnerable transitive dependency patches; the production dependency audit reports no remaining advisories.
- Preserve dates supplied through stdin when parsing trailing work attributes.
- Block account/site switches while local trackers remain, preserving their original identity.
- Return nonzero command exit codes for business failures and partially failed batch operations.
- Await worklog and tracker listing operations, and stop `start --stop-previous` immediately if the old upload fails.
- Reject unexpected setup arguments before opening the credential prompts.

### Work Attributes

- Added a fifth setup step to choose default Tempo work attributes, including required Task dropdowns.
- Save immutable dropdown values locally and include defaults in direct worklogs and every tracker upload without additional metadata requests.
- Added repeatable per-command `--attribute KEY=VALUE` overrides for `log` and `stop`; `start --stop-previous` can apply overrides to the old tracker's upload without changing saved defaults.
- Added trailing `KEY=VALUE` work attribute arguments, optional `WHEN` placement before them, and the read-only `tasks` / `task:list` lookup for real Task values.
- Keep existing settings when setup cannot finish, and suggest setup when Tempo rejects a work attribute.

### Performance

- Generate an oclif command manifest during build and packaging to avoid loading every command at startup.
- Pin the original oclif versions to avoid the Windows startup regression introduced by the framework upgrade.
- Load alias storage directly and import only the date helpers needed at runtime.
- Resolve Jira issue keys only for the selected day's worklogs; monthly totals still use the full month.

### Documentation

- Added a reusable CLI usage skill at `doc/tempo-cli/SKILL.md` and local build/run instructions.

- Rewrote the user guide and compatibility contract in English.
- Added original, concise command examples for the installed `tempo` command.
- Corrected command examples to use the installed `tempo` command consistently.
- Documented the `main` branch check/build flow and `v*` tag publishing flow.

### Compatibility

- Preserved the original worklog, schedule, alias, batch delete, and six-command tracker workflows.
- Documented relative dates, descriptions, remaining estimates, verbose listing, shell completion, and tracker retry behavior.

## [0.1.0]

### Added

- Initial `@contione/tempo-cli` package line for the `contione/tempo-cli` repository.
- The single installed `tempo` command.
- Jira `/rest/api/3/myself` lookup during setup to discover the authenticated `accountId`.
- JSON configuration at `~/.tempo-cli.json`.
- Modern Node.js 22.12+ TypeScript and oclif runtime target.

### Compatibility

- Tempo REST API v4 worklog integration.
- Atlassian REST API v3 issue lookup.
- Worklog duration and interval parsing, aliases, monthly schedule summaries, and verbose output.
- Local trackers with pause, resume, stop, interval-level failure retention, and retry.

## Legacy Baseline

The following changes describe the behavior inherited from the original CLI implementation.

### 2.0.1 - 2025-12-04

- Updated setup handling for the current Jira profile URL structure.

### 2.0.0 - 2025-04-08

- Migrated from Tempo API v3 to v4.
- Switched worklog writes from issue keys to Jira issue IDs.
- Added Atlassian API integration for issue ID lookup.
- Added Atlassian email and API token requirements to setup.

### 1.1.0 - 2020-08-13

- Added local time trackers.
- Added alias display in worklog tables.
- Improved setup instructions, error handling, and time handling.

### 1.0.5 - 2020-07-29

- Initial public release.
