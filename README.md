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

tempo --help
```

## Setup

Run setup once before using commands that access Jira or Tempo:

```bash
tempo setup
```

The setup flow asks for:

1. Your Atlassian host, such as `acme.atlassian.net`.
2. Your Jira/Atlassian email address.
3. An Atlassian API token.
4. A Tempo API token.
5. Default Tempo work attribute values, such as **Task**. For dropdowns, choose an option by its displayed number. Required attributes need a value; optional attributes can be skipped. Text and numeric attributes prompt for a value, and checkboxes offer Yes or No.

After the Jira token is entered, the CLI calls `GET /rest/api/3/myself` and stores the returned `accountId`. Step 5 loads `/4/work-attributes` using the new Tempo token. Credentials, default work attributes, aliases, and local trackers are stored in `~/.tempo-cli.json` with restricted file permissions. Setup saves only after every step succeeds.

Saved work attribute defaults are sent automatically by `tempo log`, `tempo stop` / `tempo tracker:stop`, and `tempo start --stop-previous`. Dropdowns store their immutable values rather than display labels. Options are fetched during setup, so daily logging does not need another metadata request. Run `tempo setup` again to change the defaults or resolve a `Work attribute Task (Task) is required` error from an older configuration. The Tempo token must have permission to read work attributes. CLI defaults are independent of the userscript's settings.

Create tokens from [Atlassian account security](https://id.atlassian.com/manage-profile/security/api-tokens) and the Tempo API integration settings for your Jira site.

## Quick Start

The following examples use sample issue keys and worklog IDs:

```bash
# Record a duration with a description.
tempo log NOVA-318 1h20m --description "Investigated webhook retries"

# Record an explicit interval on a specific date.
tempo log NOVA-318 09:40-11:00 2026-09-18

# Review the selected day and include descriptions and issue links.
tempo list 2026-09-18 --verbose

# Delete one or more worklogs.
tempo delete 931842 931859
```

A successful log prints the recorded duration, issue key, and a delete command for the new worklog.

## Dates and Time Inputs

`log` and `list` accept `WHEN` as `YYYY-MM-DD`, `y`, `yesterday`, `t+N`, `today+N`, `t-N`, or `today-N`. `N` is a non-negative day offset; `t+0` and `today-0` mean today.

Durations include `30m`, `2h`, and `1h15m`. Intervals include `09:40-11:00`, `9-12:30`, and `23:30-00:30`. When a duration is used, `--start` sets its start time. `--remaining-estimate` accepts the same duration syntax, including `0h`.

## Trackers

Trackers are stored locally until they are stopped. Each interval is uploaded as a separate Tempo worklog. Successful intervals are removed immediately; failed intervals remain available for a later retry.

```bash
tempo tracker:start NOVA-318 --description "Release investigation"
tempo tracker:pause NOVA-318
tempo tracker:resume NOVA-318
tempo tracker:list
tempo tracker:stop NOVA-318 --remaining-estimate 2h
tempo tracker:delete NOVA-318
```

Use `--stop-previous` to finish an existing tracker before starting another one for the same issue:

```bash
tempo tracker:start NOVA-318 --stop-previous
```

The short tracker aliases are `start`, `pause`, `resume`, and `stop`.

## Issue Aliases

```bash
tempo alias:set release NOVA-318
tempo log release 20m --description "Release checklist"
tempo alias:list
tempo alias:delete release
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
tempo help tracker:stop
tempo help --nested-commands
tempo autocomplete
tempo autocomplete zsh
tempo autocomplete --refresh-cache
```

## Development

The project uses TypeScript and oclif. Building also generates the command manifest to keep startup fast.

```bash
npm install
npm run build
npm link
npm test
npm run lint
npm run release:check
```

Run the built CLI locally with:

```bash
node bin/run --help
node bin/run list
```

After `npm link`, use `tempo` from any directory. Rebuild after changing TypeScript source.

The full behavior contract is documented in [`docs/compatibility.md`](docs/compatibility.md).

## Agent Skill

[`doc/tempo-cli/SKILL.md`](doc/tempo-cli/SKILL.md) provides installation, configuration, and command guidance for AI agents. To use it with Codex, copy the `doc/tempo-cli` folder into your Codex skills directory (usually `~/.codex/skills`), then invoke `$tempo-cli` with your task.

## Release Automation

- Pushes to `main` run the check/build pipeline.
- A version tag matching `v*` runs the checks and publishes `@contione/tempo-cli` to npm with public access.
- Configure the repository `NPM_TOKEN` secret before publishing.

The project repository is [contione/tempo-cli](https://github.com/contione/tempo-cli).

## License

MIT. See [`LICENSE`](LICENSE).
