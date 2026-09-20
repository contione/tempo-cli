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

It asks for the Atlassian host, Jira email, Atlassian API token, Tempo API
token, then default work attribute values in step 5. Choose dropdown defaults
by number; optional attributes can be skipped, while required ones need a
value. The dropdown labels come from Tempo, and their immutable values are
stored. Setup calls Jira `GET /rest/api/3/myself` with the Atlassian token and
stores the returned Jira `accountId`; this is the Jira identity used for Tempo
worklog queries, not a separate Tempo account identifier.

`log`, tracker stops, and `start --stop-previous` automatically submit the saved
attribute defaults. If Tempo reports a missing or invalid work attribute such
as Task, rerun `tempo setup` to choose the correct defaults. Setup fetches the
definitions using the new token and saves only after all steps succeed.

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
tempo tasks
tempo log ISSUE-123 1h Task=TASK_VALUE
tempo log ISSUE-123 1h yesterday Task=TASK_VALUE
```

Run `tempo tasks` before writing when you need a Task value. Its alias is
`tempo task:list`; it lists Task display labels, immutable Tempo values or IDs,
and the current setup default. If Task is missing or is not a static attribute,
it reports that no Task values are available and does not invent values.

`log` / `l` accept trailing `KEY=VALUE` pairs and repeatable
`-a, --attribute KEY=VALUE` overrides. An optional `WHEN` comes before the
trailing pairs. The two forms may be mixed; an explicit key overrides its setup
default, omitted keys keep their defaults, and the last occurrence on the
command line wins. Use the immutable Tempo value or ID, not a dropdown display
label. An explicit empty value, such as `Task=`, stays empty and does not fall
back to the setup default. Blank keys and arguments without `=` are rejected.
Only the first `=` separates the key from the value, so a value may contain
another `=`. These overrides do not change stored defaults or trigger another
work-attribute metadata request.

`WHEN` defaults to today and accepts `YYYY-MM-DD`, `y`, `yesterday`,
`today+N`, `today-N`, `t+N`, and `t-N`. Durations include `30m`, `2h`, and
`1h15m`; intervals may cross midnight. `--start` applies to duration input;
an interval already contains its start time.

Review one selected day with `list` (alias `ls`):

```text
tempo list
tempo list 2026-09-18 --verbose
```

The no-argument form remains today's single-day view. A single-day value may be
`YYYY-MM-DD`, `t`, `today`, `y`, `yesterday`, `t+N`, `today+N`, `t-N`, or
`today-N`. The command fetches the month containing the selected date, then
displays the current user's worklogs for that date plus the existing monthly
schedule summary and selected-day footer. `--verbose` adds descriptions and
issue links.

Use two endpoints for an inclusive range:

```text
tempo list 2026-09-01 2026-09-20
tempo list t-6 t
```

Both endpoints accept a calendar date or a single-day shortcut. The start date
must not be after the end date. One-argument range shortcuts are also
available:

```text
tempo list 7d
tempo list 7day
tempo list 7days
tempo list last7days
tempo list this-week
tempo list lastweek
tempo list this-month
tempo list lastmonth
```

`Nd`, `Nday`, `Ndays`, and `lastNdays` accept a positive integer `N` and
include today. `week`, `this-week`, and `thisweek` mean the current Monday
through Sunday week; `last-week` and `lastweek` mean the previous week.
`month`, `this-month`, and `thismonth` mean the current calendar month;
`last-month` and `lastmonth` mean the previous month. A range shortcut cannot
be followed by a second endpoint, and these range forms apply to `list` / `ls`
only.

Range output groups dates from newest to oldest, orders worklogs within each
date by time, shows the weekday and daily logged/required total, and ends with
logged/required totals for the entire range. A range crossing months uses the
range total instead of a single-month summary. `--verbose`, `--debug`, and `ls`
continue to work for ranges. Delete one or more remote worklogs by ID with:

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
tempo stop ISSUE-123 Task=TASK_VALUE
```

The short commands are `start`, `pause`, `resume`, and `stop`. Use
`--stop-previous` with `tracker:start` to finish an existing tracker for the
same issue before starting a new one; this option also uploads worklogs.
A trailing `KEY=VALUE` pair or `--attribute KEY=VALUE` may be supplied to
`start` / `tracker:start` only with `--stop-previous`. It applies to the old
tracker's uploaded intervals and is not persisted for the new tracker.
`stop` / `tracker:stop` accept both forms and apply them to every interval
uploaded by that stop. Unmentioned attributes continue to use setup defaults.
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

Failed operations return a nonzero exit code. Also check the command's output
for IDs and partial results: a failed tracker stop or batch delete may have
completed some items. For the full behavior contract, read
[the compatibility contract](https://github.com/contione/tempo-cli/blob/main/docs/compatibility.md).
