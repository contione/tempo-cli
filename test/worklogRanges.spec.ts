import type { Config } from '@oclif/core'
import chalk from 'chalk'
import format from 'date-fns/format'
import api, { WorklogEntity } from '../src/api/api'
import List from '../src/commands/list'
import tempo from '../src/tempo'
import worklogs from '../src/worklogs/worklogs'
import * as table from '../src/worklogs/worklogsTable'
import { fakeCredentials } from './mocks/fakeCredentials'
import { mockCurrentDate } from './mocks/currentDate'

jest.mock('../src/config/configStore', () => jest.requireActual('./mocks/configStore'))

fakeCredentials()

const from = new Date(2026, 7, 31)
const to = new Date(2026, 8, 2)

function entity(id: string, date: string, startTime = '09:00:00', accountId = 'fakeAccountId'): WorklogEntity {
    return {
        tempoWorklogId: id,
        issue: { id: '123', self: 'https://example.atlassian.net/rest/api/3/issue/123' },
        author: { accountId },
        startDate: date,
        startTime,
        timeSpentSeconds: 3600,
        description: 'Range test work'
    }
}

beforeEach(() => {
    mockCurrentDate(new Date(2026, 8, 2, 12))
    jest.spyOn(api, 'getWorklogs').mockResolvedValue({ results: [
        entity('1', '2026-08-31'),
        entity('2', '2026-09-02', '14:00:00'),
        entity('3', '2026-09-02', '10:00:00'),
        entity('4', '2026-08-30'),
        entity('5', '2026-09-03'),
        entity('6', '2026-09-01', '09:00:00', 'someone-else')
    ] })
    jest.spyOn(api, 'getUserSchedule').mockResolvedValue({ results: [
        { date: '2026-08-30', requiredSeconds: 28800, type: 'WORKING_DAY' },
        { date: '2026-08-31', requiredSeconds: 28800, type: 'WORKING_DAY' },
        { date: '2026-09-01', requiredSeconds: 28800, type: 'WORKING_DAY' },
        { date: '2026-09-02', requiredSeconds: 14400, type: 'WORKING_DAY' },
        { date: '2026-09-03', requiredSeconds: 28800, type: 'WORKING_DAY' }
    ] })
    jest.spyOn(api, 'getIssueKey').mockResolvedValue('NOVA-123')
})

afterEach(() => jest.restoreAllMocks())

test('queries one inclusive cross-month range, groups and sorts only this user, and resolves each issue once', async () => {
    const result = await worklogs.getUserWorklogsRange(from, to)
    expect(api.getWorklogs).toHaveBeenCalledTimes(1)
    expect(api.getWorklogs).toHaveBeenCalledWith({ fromDate: '2026-08-31', toDate: '2026-09-02' })
    expect(api.getUserSchedule).toHaveBeenCalledWith({ fromDate: '2026-08-31', toDate: '2026-09-02' })
    expect(api.getIssueKey).toHaveBeenCalledTimes(1)
    expect(result.days.map(day => [format(day.date, 'yyyy-MM-dd'), day.worklogs.map(log => log.id), day.loggedDuration, day.requiredDuration]))
        .toEqual([
            ['2026-09-02', ['3', '2'], '2h', '4h'],
            ['2026-08-31', ['1'], '1h', '8h']
        ])
    // Includes required time on September 1, even though this user has no logs that day.
    expect(result.loggedDuration).toBe('3h')
    expect(result.requiredDuration).toBe('20h')
})

test('an empty range still includes scheduled hours and avoids Jira issue lookups', async () => {
    jest.spyOn(api, 'getWorklogs').mockResolvedValue({ results: [] })
    const result = await worklogs.getUserWorklogsRange(from, to)
    expect(result.days).toEqual([])
    expect(result.loggedDuration).toBe('0h')
    expect(result.requiredDuration).toBe('20h')
    expect(api.getIssueKey).not.toHaveBeenCalled()
    const output = (await table.renderRange(result)).toString()
    expect(output).toContain('No worklogs')
    expect(output).toContain('Range: required 20h, logged:')
})

test.each([false, true])('range table includes dates, weekdays and totals (verbose=%s)', async verbose => {
    const output = (await table.renderRange(await worklogs.getUserWorklogsRange(from, to), verbose)).toString()
    expect(output).toContain('2026-08-31 to 2026-09-02')
    expect(output).toContain('Wednesday, 2026-09-02')
    expect(output).toContain('Monday, 2026-08-31')
    expect(output).toContain('Day: required 4h, logged:')
    expect(output).toContain('Range: required 20h, logged:')
    expect(output.includes('Range test work')).toBe(verbose)
    expect(output.includes('https://example.atlassian.net/browse/NOVA-123')).toBe(verbose)
})

test('break highlighting never compares intervals on different days', async () => {
    const range = await worklogs.getUserWorklogsRange(from, to)
    range.days[0].worklogs = range.days[0].worklogs.slice(0, 1)
    const previousLevel = chalk.level
    chalk.level = 1
    try {
        const output = (await table.renderRange(range)).toString()
        expect(output).not.toContain('\u001b[91m')
    } finally {
        chalk.level = previousLevel
    }
})

test.each([undefined, 'y', 'yesterday', 't-1', 'today-1', 't+1', '2026-08-31'])('single date %s retains monthly query and day rendering', async when => {
    const single = jest.spyOn(worklogs, 'getUserWorklogs')
    const render = jest.spyOn(table, 'render')
    const range = jest.spyOn(worklogs, 'getUserWorklogsRange')
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    await expect(tempo.listUserWorklogs(when, true)).resolves.toBe(true)
    expect(single).toHaveBeenCalledTimes(1)
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ scheduleDetails: expect.any(Object) }), true)
    expect(range).not.toHaveBeenCalled()
    expect(api.getWorklogs).toHaveBeenCalledWith(when === '2026-08-31'
        ? { fromDate: '2026-08-01', toDate: '2026-08-31' }
        : { fromDate: '2026-09-01', toDate: '2026-09-30' })
})

test('shortcut and explicit endpoints reach range rendering with verbose preserved', async () => {
    const range = jest.spyOn(worklogs, 'getUserWorklogsRange')
    const render = jest.spyOn(table, 'renderRange')
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    await expect(tempo.listUserWorklogs('3d', true)).resolves.toBe(true)
    expect(range).toHaveBeenLastCalledWith(from, to)
    expect(render).toHaveBeenLastCalledWith(expect.objectContaining({ loggedDuration: '3h' }), true)
    await expect(tempo.listUserWorklogs('t-2', false, 't')).resolves.toBe(true)
    expect(range).toHaveBeenLastCalledWith(from, to)
})

test.each([
    ['2026-09-02', '2026-09-01'],
    ['7d', 'today'],
    ['0d', undefined],
    ['2026-02-30', undefined]
])('invalid range %s %s fails before API requests', async (when, toDate) => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    await expect(tempo.listUserWorklogs(when, false, toDate)).resolves.toBe(false)
    expect(api.getWorklogs).not.toHaveBeenCalled()
    expect(api.getUserSchedule).not.toHaveBeenCalled()
})

test('a range API failure returns failure and never renders a successful table', async () => {
    jest.spyOn(api, 'getWorklogs').mockRejectedValue(new Error('Read failed'))
    const render = jest.spyOn(table, 'renderRange')
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    await expect(tempo.listUserWorklogs('7d')).resolves.toBe(false)
    expect(render).not.toHaveBeenCalled()
})

test('list parses both dates and flags, and rejects a third positional argument', async () => {
    const config = { bin: 'tempo', runHook: jest.fn().mockResolvedValue({ successes: [], failures: [] }) } as unknown as Config
    const list = jest.spyOn(tempo, 'listUserWorklogs').mockResolvedValue(true)
    await new List(['t-6', 't', '-v'], config).run()
    expect(list).toHaveBeenCalledWith('t-6', true, 't')
    list.mockClear()
    await expect(new List(['t-6', 't', 'extra'], config).run()).rejects.toThrow()
    expect(list).not.toHaveBeenCalled()
    expect(List.aliases).toContain('ls')
})

test('stdin still supplies the selected day but never becomes an implicit end date', async () => {
    const config = { bin: 'tempo', runHook: jest.fn().mockResolvedValue({ successes: [], failures: [] }) } as unknown as Config
    const list = jest.spyOn(tempo, 'listUserWorklogs').mockResolvedValue(true)
    const runtime = globalThis as typeof globalThis & { oclif?: { stdinCache?: string } }
    const previous = runtime.oclif
    const ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true })
    runtime.oclif = { ...previous, stdinCache: '2026-09-01' }
    try {
        await new List([], config).run()
        expect(list).toHaveBeenLastCalledWith('2026-09-01', undefined, undefined)
        await new List(['2026-08-31'], config).run()
        expect(list).toHaveBeenLastCalledWith('2026-08-31', undefined, undefined)
        await new List(['7d'], config).run()
        expect(list).toHaveBeenLastCalledWith('7d', undefined, undefined)
    } finally {
        runtime.oclif = previous
        if (ttyDescriptor) Object.defineProperty(process.stdin, 'isTTY', ttyDescriptor)
        else Reflect.deleteProperty(process.stdin, 'isTTY')
    }
})
