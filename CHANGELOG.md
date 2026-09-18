# Changelog

All notable changes to `@contione/tempo-cli` are documented here. Release versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Documentation

- Rewrote the user guide and compatibility contract in English.
- Added original, concise command examples and documented the `tempo-cli` and `tempo` binaries.
- Documented the `main` branch check/build flow and `v*` tag publishing flow.

### Compatibility

- Preserved the original worklog, schedule, alias, batch delete, and six-command tracker workflows.
- Documented relative dates, descriptions, remaining estimates, verbose listing, shell completion, and tracker retry behavior.

## [0.1.0]

### Added

- Initial `@contione/tempo-cli` package line for the `contione/tempo-cli` repository.
- `tempo-cli` and `tempo` executable names.
- Jira `/rest/api/3/myself` lookup during setup to discover the authenticated `accountId`.
- JSON configuration at `~/.tempo-cli.json`.
- Modern Node.js 22.12+ ESM TypeScript and oclif runtime target.

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
