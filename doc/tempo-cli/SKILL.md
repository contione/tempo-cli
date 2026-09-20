---
name: tempo-cli
description: Use the Tempo CLI to configure Jira and Tempo access, record and review worklogs, manage local trackers, aliases, and worklog deletions from a terminal.
---

# Tempo CLI

Use the installed `tempo` executable for this repository's CLI. The package is
named `@contione/tempo-cli`, but `tempo-cli` is not a command name.

## Installation

Requires Node.js 22.12 or later.

Check whether the command is already available:

```text
tempo --help
```

For a published package, install it globally:

```text
npm install --global @contione/tempo-cli
```

Do not assume the package is published. When working from this repository,
install and build it first, then either link it or run the local launcher:

```text
npm install
npm run build
npm link
tempo --help
```

The local alternative is `node bin/run --help` after the build. Preserve any
repository-required shell wrapper around these commands.

## Configuration and secrets

If credentials have not been configured, run the interactive setup:

```text
tempo setup
```

It asks for the Atlassian host, Jira email, Atlassian API token, and Tempo API
token. Setup calls Jira `GET /rest/api/3/myself` with the Atlassian token and
stores the returned Jira `accountId`; this is the Jira identity used for Tempo
worklog queries, not a separate Tempo account identifier.

Credentials, aliases, and local tracker state are stored in
`~/.tempo-cli.json` with restricted permissions. Never put either token in a
command argument, shell history, debug transcript, or user-visible output, and
never print the configuration file. If access is unauthorized or setup is
missing, run `tempo setup` again rather than editing the file manually.

## Worklogs

Record a duration or an interval with `log` (alias `l`):

```text
tempo log ISSUE-123 1h20m --description "Investigated retries"
tempo log ISSUE-123 09:40-11:00 2026-09-18
tempo log ISSUE-123 45m yesterday --start 09:00 --remaining-estimate 2h
```

`WHEN` defaults to today and accepts `YYYY-MM-DD`, `y`, `yesterday`,
`today+N`, `today-N`, `t+N`, and `t-N`. Durations include `30m`, `2h`, and
`1h15m`; intervals may cross midnight. `--start` applies to duration input;
an interval already contains its start time.

Review one selected day with `list` (alias `ls`):

```text
tempo list
tempo list 2026-09-18 --verbose
```

The command fetches the month containing the selected date, then displays the
current user's worklogs for that date plus schedule totals. `--verbose` adds
descriptions and issue links. Delete one or more remote worklogs by ID with:

```text
tempo delete 931842 931859
```

`delete` also has the short alias `d`. Treat `log` and `delete` as remote
mutations and run them only when the user's request authorizes the operation.

## Trackers

Trackers are local timers. Starting without `--stop-previous`, pausing,
resuming, and listing do not create remote worklogs; `tracker:stop` uploads
the saved intervals:

```text
tempo tracker:start ISSUE-123 --description "Release investigation"
tempo tracker:pause ISSUE-123
tempo tracker:resume ISSUE-123
tempo tracker:list
tempo tracker:stop ISSUE-123 --remaining-estimate 2h
```

The short commands are `start`, `pause`, `resume`, and `stop`. Use
`--stop-previous` with `tracker:start` to finish an existing tracker for the
same issue before starting a new one; this option also uploads worklogs.
A stop attempts every stored interval;
successful intervals are removed immediately and failed intervals remain for a
later retry. `tracker:delete` removes only the local tracker and does not call
Tempo to delete already uploaded worklogs.

## Issue aliases

Aliases are local shortcuts accepted anywhere an issue key is accepted,
including all tracker commands:

```text
tempo alias:set release ISSUE-123
tempo alias:list
tempo log release 20m --description "Release checklist"
tempo alias:delete release
```

## Reliability and diagnostics

Use command help before composing unfamiliar syntax:

```text
tempo help log
tempo help tracker:stop
tempo help --nested-commands
tempo autocomplete
```

API commands accept `--debug`; debug output includes request metadata and
response data without authentication headers. The HTTP client has a 15-second
request timeout. GET requests retry HTTP 429 and 5xx responses up to two times;
write requests do not retry automatically.

A timeout during `tempo log` or a tracker stop is ambiguous because the remote
POST may have succeeded. Do not immediately repeat the write. First inspect
the relevant date with `tempo list` (and inspect the Tempo UI if needed), then
retry only when the worklog is absent. For a tracker stop, also inspect
`tempo tracker:list`, but a retained local interval alone does not prove that a
timed-out remote request failed.

Check the command's human-readable output for success, IDs, and errors instead
of relying only on the process exit code. For the full behavior contract, read
[the compatibility contract](https://github.com/contione/tempo-cli/blob/main/docs/compatibility.md).
