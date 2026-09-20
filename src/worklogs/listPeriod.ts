import addDays from 'date-fns/addDays'
import addMonths from 'date-fns/addMonths'
import isValid from 'date-fns/isValid'
import parse from 'date-fns/parse'
import startOfDay from 'date-fns/startOfDay'
import startOfMonth from 'date-fns/startOfMonth'
import startOfWeek from 'date-fns/startOfWeek'

const DATE_FORMAT = 'yyyy-MM-dd'
// Keep date-fns' existing acceptance of non-padded month/day values while
// retaining a four-digit, lexicographically sortable year.
const DATE_LITERAL = /^(\d{4})-(\d{1,2})-(\d{1,2})$/
const RELATIVE_DAY_LITERAL = /^(t|today)([+-])(\d+)$/
const RECENT_DAYS_LITERAL = /^(\d+)(?:d|day|days)$/
const LAST_DAYS_LITERAL = /^last(\d+)days$/

const RANGE_LITERALS = new Set([
    'this-week',
    'thisweek',
    'week',
    'last-week',
    'lastweek',
    'this-month',
    'thismonth',
    'month',
    'last-month',
    'lastmonth'
])

export type ListPeriod = {
    from: Date
    to: Date
    isRange: boolean
}

/** Resolve the list command's date or date-range syntax in local calendar time. */
export function resolveListPeriod(now: Date, when?: string, to?: string): ListPeriod {
    if (!isValid(now)) {
        throw new Error('Cannot resolve a list period from an invalid current date.')
    }

    const today = startOfDay(now)
    assertValidDate(today)

    if (to !== undefined && when === undefined) {
        throw new Error('An end date cannot be used without a start date.')
    }

    if (when === undefined) {
        return singleDay(today)
    }

    const startInput = normalizeInput(when)
    if (to !== undefined) {
        if (isRangeShortcut(startInput)) {
            throw new Error(`Range shortcut "${when}" cannot be followed by an end date.`)
        }
        const from = parseSingleDay(now, startInput)
        const end = parseSingleDay(now, normalizeInput(to))
        return dateRange(from, end, when, to)
    }

    const shortcut = resolveRangeShortcut(today, startInput)
    if (shortcut !== undefined) {
        return shortcut
    }

    return singleDay(parseSingleDay(now, startInput))
}

export default resolveListPeriod

function normalizeInput(value: string): string {
    return value.trim().toLowerCase()
}

function singleDay(day: Date): ListPeriod {
    assertValidDate(day)
    return {
        from: new Date(day.getTime()),
        to: new Date(day.getTime()),
        isRange: false
    }
}

function dateRange(from: Date, to: Date, fromInput: string, toInput: string): ListPeriod {
    assertValidDate(from)
    assertValidDate(to)
    if (from.getTime() > to.getTime()) {
        throw new Error(`Start date "${fromInput}" cannot be after end date "${toInput}".`)
    }
    return {
        from: new Date(from.getTime()),
        to: new Date(to.getTime()),
        isRange: true
    }
}

function resolveRangeShortcut(today: Date, input: string): ListPeriod | undefined {
    const recentDaysMatch = input.match(RECENT_DAYS_LITERAL)
    if (recentDaysMatch !== null) {
        return recentDays(today, parsePositiveCount(recentDaysMatch[1], input))
    }

    const lastDaysMatch = input.match(LAST_DAYS_LITERAL)
    if (lastDaysMatch !== null) {
        return recentDays(today, parsePositiveCount(lastDaysMatch[1], input))
    }

    switch (input) {
    case 'this-week':
    case 'thisweek':
    case 'week': {
        const from = startOfWeek(today, { weekStartsOn: 1 })
        return dateRange(from, addDays(from, 6), input, input)
    }
    case 'last-week':
    case 'lastweek': {
        const from = addDays(startOfWeek(today, { weekStartsOn: 1 }), -7)
        return dateRange(from, addDays(from, 6), input, input)
    }
    case 'this-month':
    case 'thismonth':
    case 'month': {
        const from = startOfMonth(today)
        return dateRange(from, addDays(addMonths(from, 1), -1), input, input)
    }
    case 'last-month':
    case 'lastmonth': {
        const from = addMonths(startOfMonth(today), -1)
        return dateRange(from, addDays(addMonths(from, 1), -1), input, input)
    }
    default:
        return undefined
    }
}

function recentDays(today: Date, count: number): ListPeriod {
    const from = addDays(today, -(count - 1))
    return dateRange(from, today, `${count}days`, `${count}days`)
}

function parsePositiveCount(value: string, input: string): number {
    const count = Number(value)
    if (!Number.isSafeInteger(count) || count <= 0) {
        throw new Error(`Cannot parse "${input}" as a positive number of days.`)
    }
    return count
}

function parseSingleDay(now: Date, input: string): Date {
    if (input === 'y' || input === 'yesterday') {
        return validDay(addDays(startOfDay(now), -1), input)
    }
    if (input === 't' || input === 'today') {
        return validDay(startOfDay(now), input)
    }

    const relativeMatch = input.match(RELATIVE_DAY_LITERAL)
    if (relativeMatch !== null) {
        const count = parseOffset(relativeMatch[3], input)
        const direction = relativeMatch[2] === '+' ? 1 : -1
        return validDay(addDays(startOfDay(now), direction * count), input)
    }

    if (isRangeShortcut(input)) {
        throw new Error(`Range shortcut "${input}" can only be used without an end date.`)
    }

    const dateMatch = input.match(DATE_LITERAL)
    if (dateMatch === null) {
        throw invalidDateError(input)
    }

    const year = Number(dateMatch[1])
    if (year < 1 || year > 9999) {
        throw invalidDateError(input)
    }

    let parsed: Date
    try {
        parsed = parse(input, DATE_FORMAT, new Date(now.getTime()))
    } catch {
        throw invalidDateError(input)
    }
    if (!isValid(parsed) || parsed.getFullYear() !== year || parsed.getMonth() + 1 !== Number(dateMatch[2]) || parsed.getDate() !== Number(dateMatch[3])) {
        throw invalidDateError(input)
    }
    return validDay(startOfDay(parsed), input)
}

function parseOffset(value: string, input: string): number {
    const offset = Number(value)
    if (!Number.isSafeInteger(offset)) {
        throw new Error(`Cannot parse "${input}" as a valid day offset.`)
    }
    return offset
}

function isRangeShortcut(input: string): boolean {
    return RANGE_LITERALS.has(input) || RECENT_DAYS_LITERAL.test(input) || LAST_DAYS_LITERAL.test(input)
}

function validDay(day: Date, input: string): Date {
    if (!isValid(day)) {
        throw invalidDateError(input)
    }
    return day
}

function assertValidDate(date: Date): void {
    if (!isValid(date)) {
        throw new Error('The requested list period is outside the valid date range.')
    }
}

function invalidDateError(input: string): Error {
    return new Error(`Cannot parse "${input}" to a valid date or list period.`)
}
