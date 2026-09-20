import api, { WorklogEntity, GetWorklogsResponse } from '../api/api'
import * as timeParser from './timeParser'
import { ParseResult, Interval } from './timeParser'
import time from '../time'
import format from 'date-fns/format'
import isValid from 'date-fns/isValid'
import addDays from 'date-fns/addDays'
import fnsParse from 'date-fns/parse'
import startOfMonth from 'date-fns/startOfMonth'
import endOfMonth from 'date-fns/endOfMonth'
import { ScheduleDetails } from './schedule'
import * as schedule from './schedule'
import { appName } from '../appName'
import authenticator from '../config/authenticator'
import aliases from '../config/aliases'

const DATE_FORMAT = 'yyyy-MM-dd'
const START_TIME_FORMAT = 'HH:mm:ss'
const YESTERDAY_LITERALS = ['y', 'yesterday']
const TODAY_LITERALS = ['t', 'today']
const TODAY_REFERENCE_REGEX = RegExp(`^(${TODAY_LITERALS.join('|')})[-+][0-9]+$`)

export type AddWorklogInput = {
    issueKeyOrAlias: string
    durationOrInterval: string
    when?: string
    description?: string
    startTime?: string,
    remainingEstimate?: string
}

export type Worklog = {
    id: string,
    interval?: Interval,
    issueId: string,
    issueKey: string,
    duration: string,
    description: string,
    link: string
}

export type UserWorklogs = {
    worklogs: Worklog[]
    date: Date,
    scheduleDetails: ScheduleDetails
}

export default {

    async addWorklog(input: AddWorklogInput): Promise<Worklog> {
        await checkTokens()
        const credentials = await authenticator.getCredentials()
        const referenceDate = parseWhenArg(time.now(), input.when)
        const parseResult = timeParser.parse(input.durationOrInterval, referenceDate)
        if (parseResult == null) {
            throw Error(`Error parsing "${input.durationOrInterval}". Try something like 1h10m or 11-12:30. See ${appName} log --help for more examples.`)
        }
        if (parseResult.seconds <= 0) {
            throw Error('Error. Minutes worked must be larger than 0.')
        }
        const issueKey = (await aliases.getIssueKey(input.issueKeyOrAlias) ?? input.issueKeyOrAlias).toUpperCase()
        const issueId = await api.getIssueId(issueKey)
        let worklogEntity: WorklogEntity
        try {
            worklogEntity = await api.addWorklog({
                issueId: issueId,
                timeSpentSeconds: parseResult.seconds,
                startDate: format(referenceDate, DATE_FORMAT),
                startTime: startTime(parseResult, input.startTime, referenceDate),
                description: input.description,
                remainingEstimateSeconds: remainingEstimateSeconds(referenceDate, input.remainingEstimate),
                ...(credentials.workAttributeDefaults?.length ? { attributes: credentials.workAttributeDefaults } : {})
            })
        } catch (error) {
            if (error instanceof Error && /work attribute/i.test(error.message)) {
                throw new Error(`${error.message} Run tempo setup to choose valid default work attributes.`)
            }
            throw error
        }
        return toWorklog(worklogEntity, { [worklogEntity.issue.id]: issueKey }, credentials.hostname)
    },

    async deleteWorklog(worklogIdInput: string): Promise<Worklog> {
        await checkTokens()
        const credentials = await authenticator.getCredentials()
        const worklogId = Number(worklogIdInput)
        if (!/^\d+$/.test(worklogIdInput) || !Number.isSafeInteger(worklogId) || worklogId <= 0) {
            throw Error('Error. Worklog id should be an integer number.')
        }
        const worklogEntity = await api.getWorklog(worklogId)
        const issueKey = await api.getIssueKey(worklogEntity.issue.id)
        const worklog = toWorklog(worklogEntity, { [worklogEntity.issue.id]: issueKey }, credentials.hostname)
        await api.deleteWorklog(worklogId)
        return worklog
    },

    async getUserWorklogs(when?: string): Promise<UserWorklogs> {
        await checkTokens()
        const credentials = await authenticator.getCredentials()
        const now = time.now()
        const date = parseWhenArg(now, when)
        const formattedDate = format(date, DATE_FORMAT)
        const monthStart = format(startOfMonth(date), DATE_FORMAT)
        const monthEnd = format(endOfMonth(date), DATE_FORMAT)
        const [worklogsResponse, scheduleResponse] = await Promise.all([
            api.getWorklogs({ fromDate: monthStart, toDate: monthEnd }),
            api.getUserSchedule({ fromDate: monthStart, toDate: monthEnd })
        ])
        const worklogs = await generateWorklogs(worklogsResponse, formattedDate)
        const scheduleDetails = schedule.createScheduleDetails(
            worklogsResponse.results,
            scheduleResponse.results,
            formattedDate,
            credentials.accountId
        )

        return { worklogs, date, scheduleDetails }
    }
}

function remainingEstimateSeconds(referenceDate: Date, remainingEstimate?: string): number | undefined {
    if (remainingEstimate) {
        const result = timeParser.parse(remainingEstimate, referenceDate)
        if (result == null) {
            throw Error(`Error parsing "${remainingEstimate}". Try something like 1h. See ${appName} log --help for more examples.`)
        }
        return result.seconds
    }
    return undefined
}

async function generateWorklogs(worklogsResponse: GetWorklogsResponse, formattedDate: string): Promise<Worklog[]> {
    const credentials = await authenticator.getCredentials()

    const selectedWorklogs = worklogsResponse.results
        .filter(e => e.author.accountId === credentials.accountId && e.startDate === formattedDate)
    const uniqueIssueIds = [...new Set(selectedWorklogs.map(worklog => worklog.issue.id))]
    const issueKeys = await Promise.all(uniqueIssueIds.map(issueId => api.getIssueKey(issueId)))
    const issueIdToKey = Object.fromEntries(uniqueIssueIds.map((id, index) => [id, issueKeys[index]]))

    return selectedWorklogs
        .map((e: WorklogEntity) => toWorklog(e, issueIdToKey, credentials.hostname))
}

function toWorklog(entity: WorklogEntity, issueIdToKey: Record<string, string>, hostname?: string) {
    const referenceDate = fnsParse(entity.startDate, DATE_FORMAT, time.now())
    return {
        id: entity.tempoWorklogId,
        interval: timeParser.toInterval(entity.timeSpentSeconds, entity.startTime, referenceDate) ?? undefined,
        issueId: entity.issue.id,
        duration: timeParser.toDuration(entity.timeSpentSeconds) ?? 'unknown',
        description: entity.description,
        issueKey: issueIdToKey[entity.issue.id],
        link: generateIssueLink(issueIdToKey[entity.issue.id], entity.issue.self, hostname)
    }
}

async function checkTokens() {
    const isTempoTokenSet = await authenticator.hasTempoToken()
    const isAtlassianTokenSet = await authenticator.hasAtlassianToken()
    if (!isTempoTokenSet || !isAtlassianTokenSet) {
        throw Error('This tool is not configured. Run `tempo setup` first.')
    }
}

function parseWhenArg(now: Date, when: string | undefined): Date {
    if (when === undefined) return now
    if (YESTERDAY_LITERALS.includes(when)) {
        const nowAtMidnight = new Date(now)
        nowAtMidnight.setHours(0, 0, 0, 0)
        return addDays(nowAtMidnight, -1)
    }
    if (when.match(TODAY_REFERENCE_REGEX)) {
        const nowAtMidnight = new Date(now)
        nowAtMidnight.setHours(0, 0, 0, 0)
        return addDays(nowAtMidnight, parseInt(when.replace(/[^\d+-]/g, '')))
    }
    const date = fnsParse(when, DATE_FORMAT, new Date())
    if (isValid(date)) {
        return date
    } else {
        throw Error(`Cannot parse "${when}" to valid date. Try to use YYYY-MM-DD format. See ${appName} --help for more examples.`)
    }
}

function startTime(parseResult: ParseResult, inputStartTime: string | undefined, referenceDate: Date) {
    if (parseResult.startTime) {
        if (inputStartTime) console.log(`Start time param is ignored, ${parseResult.startTime} is used instead.`)
        return parseResult.startTime
    }
    if (inputStartTime) return parseStartTime(inputStartTime, referenceDate)
    return format(referenceDate, START_TIME_FORMAT)
}

function parseStartTime(startTime: string, referenceDate: Date): string {
    const parsedTime = timeParser.parseTime(startTime, referenceDate)
    if (parsedTime) {
        return format(parsedTime, START_TIME_FORMAT)
    } else {
        throw Error(`Cannot parse ${startTime} to valid start time. Try to use HH:mm format. See ${appName} --help for more examples.`)
    }
}

function generateIssueLink(issueKey: string, self: string, hostname?: string): string {
    const url = new URL(self)
    const configuredHost = hostname?.trim()
    const issueHost = configuredHost && (configuredHost.includes('.') || configuredHost === 'localhost')
        ? configuredHost
        : url.hostname
    return `https://${issueHost}/browse/${issueKey}`
}
