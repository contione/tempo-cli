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

Saved work attribute defaults are sent automatically by `tempo log`, `tempo stop` / `tempo tracker:stop`, and `tempo start --stop-previous`. Dropdowns store their immutable values rather than display labels. Options are fetched during setup, so daily logging does not need another metadata request. Run `tempo setup` again to change the saved defaults or resolve a `Work attribute Task (Task) is required` error from an older configuration. The Tempo token must have permission to read work attributes. CLI defaults are independent of the userscript's settings.

Finish or discard local trackers before switching Jira accounts or sites. Setup allows credential and default updates for the same identity, but blocks an identity change while trackers remain so old intervals cannot be uploaded under a different account.

`log` / `l` and `stop` / `tracker:stop` accept repeatable `-a, --attribute KEY=VALUE` overrides. An explicit key replaces its setup default; omitted keys keep their defaults. Use the immutable Tempo value or ID for dropdowns, not the displayed label. Repeating a key uses the last value. An empty value is explicit and does not fall back to the default. Blank keys or arguments without `=` are rejected, and only the first `=` separates the key from the value. `start` / `tracker:start` accepts `--attribute` only together with `--stop-previous`; those overrides apply to the old tracker's uploaded intervals and are not saved for the new tracker.

Create tokens from [Atlassian account security](https://id.atlassian.com/manage-profile/security/api-tokens) and the Tempo API integration settings for your Jira site.

For a one-off override, attributes can also be written as trailing `KEY=VALUE` arguments. Put an optional `WHEN` before them. The two forms can be mixed; when a key is repeated, the last occurrence on the command line wins. These arguments do not change the saved setup defaults.

## Task Values

Use the read-only Task lookup before writing a worklog:

```bash
tempo tasks
```

`tempo task:list` is the equivalent command. The output shows each Task display label, its immutable Tempo value or ID, and which value is the current setup default. Copy the actual value into a trailing attribute pair; do not use the display label. If Task is missing or is not a static attribute, the command reports that no Task values are available and does not invent values.

## Quick Start

The following examples use sample issue keys and worklog IDs:

```bash
# Record a duration with a description.
tempo log NOVA-318 1h20m --description "Investigated webhook retries"

# Look up the immutable Task value first, then use it as a trailing attribute.
tempo tasks
tempo log NOVA-318 1h20m Task=TASK_VALUE

# Record an explicit interval on a specific date.
tempo log NOVA-318 09:40-11:00 2026-09-18

# Review the selected day and include descriptions and issue links.
tempo list 2026-09-18 --verbose

# Review the last seven days or an explicit inclusive range.
tempo list 7d
tempo list t-6 t

# Review the current Monday-to-Sunday week.
tempo ls this-week

# Delete one or more worklogs.
tempo delete 931842 931859
```

A successful log prints the recorded duration, issue key, and a delete command for the new worklog.

## Dates and Time Inputs

`log` accepts `WHEN` as `YYYY-MM-DD`, `y`, `yesterday`, `t+N`, `today+N`, `t-N`, or `today-N`. `N` is a non-negative day offset; `t+0` and `today-0` mean today.

`list` with no date still shows today. Its single-day forms are `YYYY-MM-DD`, `t`, `today`, `y`, `yesterday`, `t+N`, `today+N`, `t-N`, and `today-N`; `N` is a non-negative day offset. Single-day output keeps the existing monthly schedule summary and selected-day footer.

Use `tempo list WHEN TO` for an inclusive date range. Both endpoints may be a calendar date or a single-day shortcut, for example `tempo list 2026-09-01 2026-09-20` or `tempo list t-6 t`. The start date must not be after the end date.

The following one-argument shortcuts select ranges and cannot be followed by `TO`:

- `Nd`, `Nday`, `Ndays`, or `lastNdays`, where `N` is a positive integer and the range contains today. For example, `7d`, `7day`, `7days`, and `last7days` mean the latest seven calendar days including today.
- `week`, `this-week`, or `thisweek` for the current Monday through Sunday week; `last-week` or `lastweek` for the previous one.
- `month`, `this-month`, or `thismonth` for the current calendar month; `last-month` or `lastmonth` for the previous one.

Range results are grouped by date from newest to oldest. Each date shows its weekday, worklogs in time order, and a daily logged/required total. The final summary shows logged/required time for the whole range; ranges crossing month boundaries use this range total instead of a monthly summary. These range forms apply to `list` / `ls` only; `log` remains a single-worklog command. The no-argument `list` form remains a single-day view and is not changed to a seven-day default.

Durations include `30m`, `2h`, and `1h15m`. Intervals include `09:40-11:00`, `9-12:30`, and `23:30-00:30`. When a duration is used, `--start` sets its start time. `--remaining-estimate` accepts the same duration syntax, including `0h`.

## Trackers

Trackers are stored locally until they are stopped. Each interval is uploaded as a separate Tempo worklog. Successful intervals are removed immediately; failed intervals remain available for a later retry.

```bash
tempo tracker:start NOVA-318 --description "Release investigation"
tempo tracker:pause NOVA-318
tempo tracker:resume NOVA-318
tempo tracker:list
tempo tracker:stop NOVA-318 --remaining-estimate 2h
# Alternatively, override Task when stopping.
tempo stop NOVA-318 Task=TASK_VALUE
tempo tracker:delete NOVA-318
```

Use `--stop-previous` to finish an existing tracker before starting another one for the same issue:

```bash
tempo tracker:start NOVA-318 --stop-previous
# The override applies only while uploading the old tracker.
tempo start NOVA-318 --stop-previous Task=TASK_VALUE
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
| `tasks` / `task:list` | List immutable Task values and the setup default. |
| `list` / `ls` | Show selected-day worklogs or an inclusive date range with schedule progress. |
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

Failed operations return a nonzero exit code so shell scripts can detect errors. Batch deletion still attempts all IDs, and a partial tracker upload retains failed intervals while returning failure. Commands wait for their work to finish before returning.

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
