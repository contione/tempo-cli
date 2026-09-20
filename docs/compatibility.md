# CLI Compatibility Contract

This document is the acceptance checklist for `@contione/tempo-cli`. It records the behavior of the original `tempo` CLI for the single installed `tempo` command.

## General Rules

- [ ] `tempo setup` is required before commands that access Jira or Tempo. Missing credentials produce an actionable setup message.
- [ ] Credentials, aliases, and local trackers survive process restarts in `~/.tempo-cli.json`.
- [ ] Any argument that accepts an issue key also accepts a configured alias. Worklog writes resolve aliases first and send the uppercase issue key's Jira issue ID to Tempo.
- [ ] API action commands support `-h, --help` and `--debug`, except for the interactive `setup` command. Debug output shows request metadata and response data without authentication headers.
- [ ] Unauthorized responses tell the user to run `tempo setup` again.
- [ ] Missing local objects and API failures are reported as readable command output rather than uncaught exceptions.

## Command Names and Aliases

| Canonical command | Alias | Arguments |
| --- | --- | --- |
| `tempo log` | `tempo l` | `ISSUE_KEY_OR_ALIAS DURATION_OR_INTERVAL [WHEN]` |
| `tempo list` | `tempo ls` | `[WHEN]` |
| `tempo delete` | `tempo d` | `WORKLOG_ID...` |
| `tempo tracker:start` | `tempo start` | `ISSUE_KEY_OR_ALIAS` |
| `tempo tracker:pause` | `tempo pause` | `ISSUE_KEY_OR_ALIAS` |
| `tempo tracker:resume` | `tempo resume` | `ISSUE_KEY_OR_ALIAS` |
| `tempo tracker:stop` | `tempo stop` | `ISSUE_KEY_OR_ALIAS` |
| `tempo tracker:list` | none | none |
| `tempo tracker:delete` | none | `ISSUE_KEY_OR_ALIAS` |
| `tempo alias:set` | none | `ALIAS ISSUE_KEY` |
| `tempo alias:list` | none | none |
| `tempo alias:delete` | none | `ALIAS_NAME` |

Nested oclif commands retain the `alias:*` and `tracker:*` names shown above.

## Setup, Help, and Completion

### `tempo setup`

- [ ] Takes no positional arguments or business flags.
- [ ] Prompts for the Atlassian host, Jira email, Atlassian API token, Tempo API token, and default work attribute values in five steps.
- [ ] Reads `/4/work-attributes` using the newly entered Tempo token before saving. Dropdowns offer numbered labels and store immutable values; required attributes cannot be skipped, while optional attributes can have no default.
- [ ] Handles checkbox values `true`/`false`, numeric values including `0`, and text/account-key values. A failed or cancelled setup leaves existing configuration unchanged.
- [ ] Uses the Atlassian token to call `GET https://{host}/rest/api/3/myself` and persists the returned `accountId`.
- [ ] Rejects an empty email, token, or invalid host. A successful setup reports completion.
- [ ] Stores credentials with restricted permissions and does not require users to copy a Jira profile URL.
- [ ] Prints instructions for `tempo autocomplete` and optional shell aliases `tl`, `tls`, and `td`.

### `tempo help [COMMAND...]`

- [ ] Shows root help without a command and command-specific usage, arguments, flags, aliases, and examples when a command is supplied.
- [ ] Supports `-n, --nested-commands` for including nested commands in root help.
- [ ] Per-command `-h, --help` output matches the corresponding help command.

### `tempo autocomplete [SHELL]`

- [ ] Prints installation instructions without a shell argument and shell-specific instructions for shells such as `bash` and `zsh`.
- [ ] Supports `-r, --refresh-cache` to refresh the completion cache.

## Worklog Entry

### `tempo log ISSUE_KEY_OR_ALIAS DURATION_OR_INTERVAL [WHEN]`

Flags:

- `-d, --description=<value>`: worklog description.
- `-s, --start=<value>`: start time when the input is a duration.
- `-r, --remaining-estimate=<value>`: remaining estimate after logging.
- `--debug` and `-h, --help`.

Acceptance behavior:

- [ ] Accepts durations such as `15m`, `1h`, and `1h15m`; `h/H` and `m/M` are equivalent. Logged time must be greater than zero.
- [ ] Accepts intervals such as `11-14`, `11-14:30`, `11:35-14:20`, and `11.35-14.20`. Time forms include `H`, `HH`, `H:mm`, `HH:mm`, `H.mm`, and `HH.mm`.
- [ ] Treats an end time earlier than or equal to the start time as a cross-midnight interval; `12-12` represents 24 hours.
- [ ] Uses `--start` only for duration input. If an interval already supplies a start time, `--start` is ignored and the user is told which start time was used.
- [ ] Defaults a duration start time to the resolved reference time. An omitted `WHEN` uses the current time; date-only and relative date values resolve to the start of the selected day.
- [ ] Resolves aliases before looking up the Jira issue ID, then sends duration, start date, start time, description, and remaining estimate to Tempo.
- [ ] Includes work attribute defaults from setup without requesting the attribute definitions again. Older configurations without defaults continue to omit attributes; a Tempo attribute validation failure instructs the user to run setup.
- [ ] Parses `--remaining-estimate` with the same parser. Values such as `2h` and `0h` are valid; negative or invalid values fail before the write request.
- [ ] Supports `YYYY-MM-DD`, `y`, `yesterday`, `t+N`, `today+N`, `t-N`, and `today-N` for `WHEN`; `N` is a non-negative integer and `+0`/`-0` mean today.
- [ ] Invalid duration, interval, date, or start time prevents an API write and includes the input value in the error.
- [ ] A successful command prints the duration, issue key, and a delete command containing the new worklog ID.

## Worklog Listing and Deletion

### `tempo list [WHEN]`

Flags:

- `-v, --verbose`: include descriptions and issue URLs.
- `--debug` and `-h, --help`.

Acceptance behavior:

- [ ] Uses the same date parser as `log`; the default is today.
- [ ] Requests the full month containing the selected date for worklogs and user schedule, then displays only the current user's worklogs for the selected date.
- [ ] The default table contains ID, interval, issue, and duration. Verbose mode adds description and issue URL.
- [ ] The header shows month logged/required time and current-period difference; the footer shows selected-day required/logged time.
- [ ] Shows `No worklogs` for an empty selected day while retaining schedule and summary information.
- [ ] Displays aliases alongside issue keys and marks gaps between adjacent intervals using the original highlighted output behavior.
- [ ] `tempo ls` is equivalent to `tempo list`.

### `tempo delete WORKLOG_ID...`

Flags: `--debug` and `-h, --help`.

Acceptance behavior:

- [ ] Accepts one or more IDs, for example `tempo delete 931842 931859`; `tempo d` is equivalent.
- [ ] Processes IDs in command-line order. For each ID it loads the worklog, resolves the issue key, deletes the worklog, and prints deletion details.
- [ ] Rejects values that are not positive integer IDs. A failure for one ID is reported and does not prevent later IDs from being attempted.
- [ ] Successful output includes the ID, issue key, interval, and duration.

## Issue Aliases

### `tempo alias:set ALIAS ISSUE_KEY`

- [ ] Supports `--debug` and `-h, --help`.
- [ ] Persists `ALIAS -> ISSUE_KEY`; setting an existing alias replaces its value.
- [ ] The alias works with `log` and all tracker commands and appears beside the issue key in rendered tables.

### `tempo alias:list`

- [ ] Supports `--debug` and `-h, --help`.
- [ ] Prints one line per mapping in the form `alias => ISSUE-KEY` and prints no fabricated entries when empty.

### `tempo alias:delete ALIAS_NAME`

- [ ] Supports `--debug` and `-h, --help`.
- [ ] Removes only the requested mapping; deleting an absent alias does not affect other mappings.

## Tracker Commands

Trackers are local timers. They do not create remote worklogs until `stop` is called. All six tracker commands accept an issue key or alias and support `--debug` and `-h, --help`.

### `tempo tracker:start ISSUE_KEY_OR_ALIAS`

Additional flags: `-d, --description=<value>` and `--stop-previous`.

- [ ] Creates an active tracker with issue key, description, start timestamp, and an empty interval list.
- [ ] Refuses to create a second tracker for the same issue unless `--stop-previous` is supplied.
- [ ] Saves `--description`; a later stop uses it for generated worklogs unless stop supplies another description.
- [ ] With `--stop-previous`, stops and uploads the existing tracker before creating the new one.
- [ ] If any old interval fails to upload, the old tracker remains inactive with failed intervals and the new tracker is not created. A later `tracker:stop` retries the retained intervals.
- [ ] `tempo start` is equivalent.

### `tempo tracker:pause ISSUE_KEY_OR_ALIAS`

- [ ] Saves the active interval from the latest start/resume through the current time.
- [ ] Discards intervals shorter than one minute; pausing an already paused tracker does not create a new interval.
- [ ] Missing trackers produce a readable message without modifying other trackers.
- [ ] `tempo pause` is equivalent.

### `tempo tracker:resume ISSUE_KEY_OR_ALIAS`

- [ ] Resumes an inactive tracker from the current time; resuming an already active tracker does not reset its active timestamp.
- [ ] Missing trackers produce a readable message.
- [ ] `tempo resume` is equivalent.

### `tempo tracker:stop ISSUE_KEY_OR_ALIAS`

Additional flags: `-d, --description=<value>` and `-r, --remaining-estimate=<value>`.

- [ ] Applies pause semantics first, then converts each stored interval to a worklog using its start date, start time, and minute duration.
- [ ] Uses stop's description when supplied; otherwise uses the description saved at start. Passes `--remaining-estimate` to each generated worklog.
- [ ] Applies the saved work attribute defaults to every uploaded interval, including uploads triggered by `start --stop-previous`.
- [ ] Deletes the local tracker only after every interval uploads successfully.
- [ ] Does not call the write API for intervals shorter than one minute; an empty tracker is cleaned up.
- [ ] Attempts every interval even when one upload fails. Each successful interval is removed immediately; failed intervals remain in the inactive tracker and the command reports partial failure.
- [ ] A later `tracker:stop` retries only retained intervals. Once all retries succeed, the tracker is deleted.
- [ ] `tempo stop` is equivalent.

### `tempo tracker:delete ISSUE_KEY_OR_ALIAS`

- [ ] Deletes the local tracker without calling Tempo's remote worklog deletion API.
- [ ] Reports a missing tracker without affecting other trackers.

### `tempo tracker:list`

- [ ] Lists every local tracker with issue/alias, Active or INACTIVE state, last resume time, each interval, and total duration.
- [ ] Includes live minutes from the latest resume for an active tracker.
- [ ] Shows `No intervals` when a tracker has no stored intervals.

## Acceptance Scenarios

- [ ] Run `log` with today, yesterday, `t+N` and `t-N`, an explicit date, a cross-midnight interval, `--start`, a description, an alias, and a remaining estimate.
- [ ] Verify invalid duration, zero work duration, invalid date/time, and invalid remaining estimate do not write to the API.
- [ ] Verify `list` month schedule summaries, an empty day, and verbose description/URL columns.
- [ ] Delete multiple IDs and verify that a failed middle ID does not block later IDs.
- [ ] Exercise all six tracker commands, their short aliases, alias resolution, repeated pause/resume, and sub-minute intervals.
- [ ] Make selected tracker interval uploads fail; verify successful intervals are removed, failed intervals remain, and a later stop completes the retry.
- [ ] Run `start --stop-previous` once with a successful old tracker and once with a failed old upload; verify the new tracker is created only in the first case.
- [ ] Verify root help, nested help, `--nested-commands`, shell autocomplete, and `--refresh-cache`.
