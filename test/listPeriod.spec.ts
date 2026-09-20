import format from 'date-fns/format'
import { resolveListPeriod } from '../src/worklogs/listPeriod'

const DATE_FORMAT = 'yyyy-MM-dd'

function dates(period: ReturnType<typeof resolveListPeriod>): [string, string] {
    return [format(period.from, DATE_FORMAT), format(period.to, DATE_FORMAT)]
}

describe('resolveListPeriod', () => {
    const now = new Date('2024-03-27T15:45:12+01:00')

    test('defaults to today without mutating now', () => {
        const original = now.getTime()
        const period = resolveListPeriod(now)

        expect(dates(period)).toEqual(['2024-03-27', '2024-03-27'])
        expect(period.isRange).toBe(false)
        expect(period.from).not.toBe(period.to)
        expect(now.getTime()).toBe(original)
    })

    test.each([
        ['y', '2024-03-26'],
        ['yesterday', '2024-03-26'],
        ['t', '2024-03-27'],
        ['today', '2024-03-27'],
        ['t-2', '2024-03-25'],
        ['today+2', '2024-03-29'],
        ['t+0', '2024-03-27'],
        ['today-0', '2024-03-27']
    ])('resolves %s as a single day', (input, expected) => {
        const period = resolveListPeriod(now, input)
        expect(dates(period)).toEqual([expected, expected])
        expect(period.isRange).toBe(false)
    })

    test.each([
        ['1d', '2024-03-27', '2024-03-27'],
        ['7day', '2024-03-21', '2024-03-27'],
        ['7days', '2024-03-21', '2024-03-27'],
        ['last7days', '2024-03-21', '2024-03-27']
    ])('resolves recent-day shortcut %s', (input, from, to) => {
        const period = resolveListPeriod(now, input)
        expect(dates(period)).toEqual([from, to])
        expect(period.isRange).toBe(true)
    })

    test.each([
        ['this-week', '2024-03-25', '2024-03-31'],
        ['thisweek', '2024-03-25', '2024-03-31'],
        ['week', '2024-03-25', '2024-03-31'],
        ['last-week', '2024-03-18', '2024-03-24'],
        ['lastweek', '2024-03-18', '2024-03-24'],
        ['this-month', '2024-03-01', '2024-03-31'],
        ['thismonth', '2024-03-01', '2024-03-31'],
        ['month', '2024-03-01', '2024-03-31'],
        ['last-month', '2024-02-01', '2024-02-29'],
        ['lastmonth', '2024-02-01', '2024-02-29']
    ])('resolves calendar shortcut %s', (input, from, to) => {
        expect(dates(resolveListPeriod(now, input))).toEqual([from, to])
    })

    test('supports explicit ranges and relative endpoints', () => {
        expect(dates(resolveListPeriod(now, '2024-03-01', '2024-03-31'))).toEqual(['2024-03-01', '2024-03-31'])
        expect(resolveListPeriod(now, '2024-03-01', '2024-03-31').isRange).toBe(true)
        expect(dates(resolveListPeriod(now, 't-2', 'today'))).toEqual(['2024-03-25', '2024-03-27'])
        expect(dates(resolveListPeriod(now, 'yesterday', 't+1'))).toEqual(['2024-03-26', '2024-03-28'])
    })

    test('keeps an explicit one-day range as a range', () => {
        const period = resolveListPeriod(now, '2024-03-27', '2024-03-27')
        expect(dates(period)).toEqual(['2024-03-27', '2024-03-27'])
        expect(period.isRange).toBe(true)
    })

    test('handles year and month boundaries', () => {
        const newYear = new Date('2025-01-01T12:00:00+01:00')
        expect(dates(resolveListPeriod(newYear, 'last-month'))).toEqual(['2024-12-01', '2024-12-31'])
        expect(dates(resolveListPeriod(newYear, 'last-week'))).toEqual(['2024-12-23', '2024-12-29'])

        const monthEnd = new Date('2024-02-29T12:00:00+01:00')
        expect(dates(resolveListPeriod(monthEnd, '7days'))).toEqual(['2024-02-23', '2024-02-29'])
    })

    test('keeps local dates across the Europe/Warsaw DST transition', () => {
        const beforeSpringTransition = new Date('2024-03-31T12:00:00+02:00')
        const period = resolveListPeriod(beforeSpringTransition, 'last7days')
        expect(dates(period)).toEqual(['2024-03-25', '2024-03-31'])
        expect(period.from.getHours()).toBe(0)
        expect(period.to.getHours()).toBe(0)
    })

    test.each([
        ['0d', /positive number/],
        ['last0days', /positive number/],
        ['2024-02-30', /valid date/],
        ['not-a-date', /valid date/],
        ['t--1', /valid date/],
        ['t+9007199254740992', /valid day offset/]
    ])('rejects invalid input %s', (input, error) => {
        expect(() => resolveListPeriod(now, input)).toThrow(error)
    })

    test('keeps the existing non-padded month/day date forms', () => {
        expect(dates(resolveListPeriod(now, '2024-3-7'))).toEqual(['2024-03-07', '2024-03-07'])
        expect(dates(resolveListPeriod(now, '2024-03-7'))).toEqual(['2024-03-07', '2024-03-07'])
    })

    test('rejects a range shortcut followed by an end date', () => {
        expect(() => resolveListPeriod(now, '7days', 'today')).toThrow(/cannot be followed by an end date/)
        expect(() => resolveListPeriod(now, 'this-week', 'today')).toThrow(/cannot be followed by an end date/)
    })

    test('rejects range shortcuts as explicit end points', () => {
        expect(() => resolveListPeriod(now, 'today', 'this-week')).toThrow(/can only be used without an end date/)
    })

    test('rejects a missing start date and a reversed range', () => {
        expect(() => resolveListPeriod(now, undefined, 'today')).toThrow(/without a start date/)
        expect(() => resolveListPeriod(now, '2024-03-28', '2024-03-27')).toThrow(/cannot be after end date/)
    })

    test('rejects a period outside the valid Date range', () => {
        expect(() => resolveListPeriod(now, 't+1000000000')).toThrow(/valid date/)
        expect(() => resolveListPeriod(now, '10000-01-01')).toThrow(/valid date/)
    })
})
