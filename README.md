# tempo-cli

<img src="logo.svg" width="320" alt="tempo-cli">

A focused command-line client for Tempo Cloud and Jira. Record worklogs, review monthly schedule progress, manage local time trackers, and use issue aliases without leaving the terminal.

## Highlights

- Writes, lists, and deletes worklogs through Tempo REST API v4.
- Resolves Jira issue keys through Atlassian REST API v3.
- Supports durations, time intervals, absolute dates, relative dates, descriptions, and remaining estimates.
- Provides local trackers with pause, resume, interval uploads, and retryable failures.
- Includes aliases, batch worklog deletion, verbose list output, shell completion, and debug logging.

## Requirements

- Node.js 22.12 or later.
- A Jira/Atlassian account with an API token.
- A Tempo Cloud API token for the Jira site.

## Install

```bash
npm install --global @contione/tempo-cli

tempo-cli --help
# The shorter binary name is also available:
tempo --help
```

## Setup

Run setup once before using commands that access Jira or Tempo:

```bash
tempo-cli setup
```

The setup flow asks for:

1. Your Atlassian host, such as `acme.atlassian.net`.
2. Your Jira/Atlassian email address.
3. An Atlassian API token.
4. A Tempo API token.

After the Jira token is entered, the CLI calls `GET /rest/api/3/myself` and stores the returned `accountId`. Credentials, aliases, and local trackers are stored in `~/.tempo-cli.json` with restricted file permissions.

Create tokens from [Atlassian account security](https://id.atlassian.com/manage-profile/security/api-tokens) and the Tempo API integration settings for your Jira site.

## Quick Start

The following examples use sample issue keys and worklog IDs:

```bash
# Record a duration with a description.
tempo-cli log NOVA-318 1h20m --description "Investigated webhook retries"

# Record an explicit interval on a specific date.
tempo-cli log NOVA-318 09:40-11:00 2026-09-18

# Review the selected day and include descriptions and issue links.
tempo-cli list 2026-09-18 --verbose

# Delete one or more worklogs.
tempo-cli delete 931842 931859
```

A successful log prints the recorded duration, issue key, and a delete command for the new worklog.

## Dates and Time Inputs

`log` and `list` accept `WHEN` as `YYYY-MM-DD`, `y`, `yesterday`, `t+N`, `today+N`, `t-N`, or `today-N`. `N` is a non-negative day offset; `t+0` and `today-0` mean today.

Durations include `30m`, `2h`, and `1h15m`. Intervals include `09:40-11:00`, `9-12:30`, and `23:30-00:30`. When a duration is used, `--start` sets its start time. `--remaining-estimate` accepts the same duration syntax, including `0h`.

## Trackers

Trackers are stored locally until they are stopped. Each interval is uploaded as a separate Tempo worklog. Successful intervals are removed immediately; failed intervals remain available for a later retry.

```bash
tempo-cli tracker:start NOVA-318 --description "Release investigation"
tempo-cli tracker:pause NOVA-318
tempo-cli tracker:resume NOVA-318
tempo-cli tracker:list
tempo-cli tracker:stop NOVA-318 --remaining-estimate 2h
tempo-cli tracker:delete NOVA-318
```

Use `--stop-previous` to finish an existing tracker before starting another one for the same issue:

```bash
tempo-cli tracker:start NOVA-318 --stop-previous
```

The short tracker aliases are `start`, `pause`, `resume`, and `stop`.

## Issue Aliases

```bash
tempo-cli alias:set release NOVA-318
tempo-cli log release 20m --description "Release checklist"
tempo-cli alias:list
tempo-cli alias:delete release
```

Aliases can be used anywhere an issue key is accepted, including all tracker commands.

## Command Overview

| Command | Purpose |
| --- | --- |
| `setup` | Configure Jira and Tempo credentials. |
| `log` / `l` | Add a worklog from a duration or interval. |
| `list` / `ls` | Show selected-day worklogs and monthly schedule progress. |
| `delete` / `d` | Delete one or more worklogs by ID. |
| `alias:set` | Store an issue alias. |
| `alias:list` | Print stored aliases. |
| `alias:delete` | Remove an issue alias. |
| `tracker:start` / `start` | Start a local tracker. |
| `tracker:pause` / `pause` | Save the current tracker interval and pause. |
| `tracker:resume` / `resume` | Resume a paused tracker. |
| `tracker:stop` / `stop` | Upload tracker intervals as worklogs. |
| `tracker:list` | Show local trackers and their intervals. |
| `tracker:delete` | Remove a local tracker. |
| `autocomplete` | Install shell completion. |

Every action command supports `--help`; commands that call an API also support `--debug`.

## Completion and Help

```bash
tempo-cli help tracker:stop
tempo-cli help --nested-commands
tempo-cli autocomplete
tempo-cli autocomplete zsh
tempo-cli autocomplete --refresh-cache
```

## Development

The project uses modern ESM TypeScript and oclif.

```bash
npm install
npm run build
npm test
npm run lint
npm run release:check
```

Run the built CLI locally with:

```bash
node bin/run --help
```

The full behavior contract is documented in [`docs/compatibility.md`](docs/compatibility.md).

## Release Automation

- Pushes to `main` run the check/build pipeline.
- A version tag matching `v*` runs the checks and publishes `@contione/tempo-cli` to npm with public access.
- Configure the repository `NPM_TOKEN` secret before publishing.

The project repository is [contione/tempo-cli](https://github.com/contione/tempo-cli).

## License

MIT. See [`LICENSE`](LICENSE).
