import authenticator from '../config/authenticator'
import { HttpClientError, assertSameOrigin, requestJson } from './httpClient'
import type { Credentials } from '../config/authenticator'
import type { HttpRequestOptions } from './httpClient'

export type AddWorklogRequest = {
    issueId: string | number
    timeSpentSeconds: number
    startDate: string
    startTime: string
    description?: string
    remainingEstimateSeconds?: number
}

export type GetWorklogsRequest = {
    fromDate: string
    toDate: string
}

export type GetUserScheduleRequest = {
    fromDate: string
    toDate: string
}

export type GetUserScheduleResponse = {
    results: ScheduleEntity[]
}

export type ScheduleEntity = {
    date: string
    requiredSeconds: number
    type: string
}

export type GetWorklogsResponse = {
    results: WorklogEntity[]
}

export type WorklogEntity = {
    tempoWorklogId: string
    startDate: string
    startTime: string
    author: AuthorEntity
    issue: IssueEntity
    description: string
    timeSpentSeconds: number
}

export type AuthorEntity = {
    accountId: string
}

export type IssueEntity = {
    self: string
    id: string
}

const TEMPO_ORIGIN = 'https://api.tempo.io'
const TEMPO_BASE_URL = `${TEMPO_ORIGIN}/4`

const api = {
    async addWorklog(request: AddWorklogRequest): Promise<WorklogEntity> {
        return execute('Tempo', async () => {
            const credentials = await requireTempoCredentials()
            const accountId = requireAccountId(credentials)
            const body = {
                ...request,
                issueId: parsePositiveInteger(request.issueId, 'issueId'),
                authorAccountId: accountId
            }
            const response = await tempoRequest<unknown>('/worklogs', credentials.tempoToken!, {
                method: 'POST',
                body
            })
            return parseWorklog(response.data)
        })
    },

    async deleteWorklog(worklogId: number): Promise<void> {
        return execute('Tempo', async () => {
            const credentials = await requireTempoCredentials()
            await tempoRequest<unknown>(`/worklogs/${encodeURIComponent(String(worklogId))}`, credentials.tempoToken!, {
                method: 'DELETE'
            })
        })
    },

    async getWorklog(worklogId: number): Promise<WorklogEntity> {
        return execute('Tempo', async () => {
            const credentials = await requireTempoCredentials()
            const response = await tempoRequest<unknown>(`/worklogs/${encodeURIComponent(String(worklogId))}`, credentials.tempoToken!)
            return parseWorklog(response.data)
        })
    },

    async getWorklogs(request: GetWorklogsRequest): Promise<GetWorklogsResponse> {
        return execute('Tempo', async () => {
            const credentials = await requireTempoCredentials()
            const accountId = requireAccountId(credentials)
            const url = tempoUrl(`/worklogs/user/${encodeURIComponent(accountId)}`)
            url.searchParams.set('from', request.fromDate)
            url.searchParams.set('to', request.toDate)
            url.searchParams.set('limit', '1000')

            const results: WorklogEntity[] = []
            const visited = new Set<string>()
            let next: URL | undefined = url
            let pages = 0

            while (next) {
                const pageUrl = next.toString()
                if (visited.has(pageUrl)) throw new Error('Tempo pagination loop detected.')
                visited.add(pageUrl)
                pages += 1
                if (pages > 100) throw new Error('Tempo pagination exceeded the safety limit.')

                const response = await tempoRequest<unknown>(pageUrl, credentials.tempoToken!)
                const page = parseWorklogPage(response.data)
                results.push(...page.results)
                next = resolveTempoNext(page.next, response.url || pageUrl)
            }

            return { results }
        })
    },

    async getUserSchedule(request: GetUserScheduleRequest): Promise<GetUserScheduleResponse> {
        return execute('Tempo', async () => {
            const credentials = await requireTempoCredentials()
            const url = tempoUrl('/user-schedule')
            url.searchParams.set('from', request.fromDate)
            url.searchParams.set('to', request.toDate)
            const response = await tempoRequest<unknown>(url, credentials.tempoToken!)
            return parseScheduleResponse(response.data)
        })
    },

    async getIssueId(issueKey: string): Promise<string> {
        return execute('Jira', async () => {
            const credentials = await requireJiraCredentials()
            const response = await jiraRequest<unknown>(`/issue/${encodeURIComponent(issueKey)}`, credentials)
            const value = isRecord(response.data) ? response.data.id : undefined
            return parseId(value, 'Jira issue id')
        })
    },

    async getIssueKey(issueId: string): Promise<string> {
        return execute('Jira', async () => {
            const credentials = await requireJiraCredentials()
            const response = await jiraRequest<unknown>(`/issue/${encodeURIComponent(issueId)}`, credentials)
            if (!isRecord(response.data) || typeof response.data.key !== 'string' || !response.data.key.trim()) {
                throw new Error('Jira issue response did not contain a key.')
            }
            return response.data.key
        })
    }
}

export default api

async function tempoRequest<T>(
    input: string | URL,
    token: string,
    options: Omit<HttpRequestOptions, 'headers' | 'allowedOrigin'> = {}
) {
    const url = tempoUrl(input)
    return requestJson<T>(url, {
        ...options,
        headers: { Authorization: `Bearer ${token}` },
        allowedOrigin: TEMPO_ORIGIN
    })
}

async function jiraRequest<T>(input: string | URL, credentials: JiraCredentials) {
    const url = jiraUrl(input, credentials.origin)
    return requestJson<T>(url, {
        headers: {
            Authorization: credentials.authorization
        },
        allowedOrigin: credentials.origin
    })
}

function tempoUrl(input: string | URL): URL {
    if (input instanceof URL) return new URL(input.toString())
    if (/^https?:\/\//i.test(input)) return new URL(input)
    return new URL(input.replace(/^\/+/, ''), `${TEMPO_BASE_URL}/`)
}

function jiraUrl(input: string | URL, origin: string): URL {
    if (input instanceof URL) {
        const url = new URL(input.toString())
        assertSameOrigin(url, origin)
        return url
    }
    if (/^https?:\/\//i.test(input)) {
        const url = new URL(input)
        assertSameOrigin(url, origin)
        return url
    }
    return new URL(input.replace(/^\/+/, ''), `${origin}/rest/api/3/`)
}

function resolveTempoNext(next: string | undefined, currentUrl: string): URL | undefined {
    if (!next) return undefined
    const url = new URL(next, currentUrl)
    assertSameOrigin(url, TEMPO_ORIGIN)
    return url
}

async function requireTempoCredentials(): Promise<Credentials & { tempoToken: string }> {
    const credentials = await authenticator.getCredentials()
    if (!credentials.tempoToken?.trim()) throw new Error('Tempo token is missing. Run tempo setup.')
    return { ...credentials, tempoToken: credentials.tempoToken.trim() }
}

function requireAccountId(credentials: Credentials): string {
    if (!credentials.accountId?.trim()) throw new Error('Jira accountId is missing. Run tempo setup.')
    return credentials.accountId.trim()
}

type JiraCredentials = {
    origin: string
    authorization: string
}

async function requireJiraCredentials(): Promise<JiraCredentials> {
    const credentials = await authenticator.getCredentials()
    const email = credentials.atlassianUserEmail?.trim()
    const token = credentials.atlassianToken?.trim()
    if (!email || !token || !credentials.hostname?.trim()) {
        throw new Error('Jira credentials are missing. Run tempo setup.')
    }
    const origin = normalizeAtlassianOrigin(credentials.hostname)
    return {
        origin,
        authorization: `Basic ${Buffer.from(`${email}:${token}`, 'utf8').toString('base64')}`
    }
}

function normalizeAtlassianOrigin(hostname: string): string {
    const value = hostname.trim()
    let url: URL
    try {
        url = new URL(value.includes('://') ? value : `https://${value}`)
    } catch {
        throw new Error('Cannot parse Jira hostname.')
    }
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
        throw new Error('Jira hostname must be an HTTPS host without a path.')
    }
    return url.origin
}

function parseWorklogPage(value: unknown): { results: WorklogEntity[]; next?: string } {
    if (!isRecord(value) || !Array.isArray(value.results) || !isRecord(value.metadata)) {
        throw new Error('Tempo worklogs response has an invalid shape.')
    }
    const next = value.metadata.next
    if (next !== undefined && next !== null && typeof next !== 'string') {
        throw new Error('Tempo worklogs pagination link has an invalid shape.')
    }
    return {
        results: value.results.map(parseWorklog),
        ...(typeof next === 'string' && next.length > 0 ? { next } : {})
    }
}

function parseWorklog(value: unknown): WorklogEntity {
    if (!isRecord(value)) throw new Error('Tempo worklog response has an invalid shape.')
    if (!isRecord(value.author) || typeof value.author.accountId !== 'string' || !value.author.accountId.trim()) {
        throw new Error('Tempo worklog response has an invalid author.')
    }
    if (!isRecord(value.issue) || typeof value.issue.self !== 'string' || !value.issue.self) {
        throw new Error('Tempo worklog response has an invalid issue.')
    }
    if (typeof value.startDate !== 'string' || !value.startDate) {
        throw new Error('Tempo worklog response has an invalid startDate.')
    }
    const timeSpentSeconds = numericValue(value.timeSpentSeconds)
    if (timeSpentSeconds === undefined) throw new Error('Tempo worklog response has an invalid duration.')

    return {
        tempoWorklogId: parseId(value.tempoWorklogId, 'Tempo worklog id'),
        startDate: value.startDate,
        startTime: typeof value.startTime === 'string' ? value.startTime : '',
        author: { accountId: value.author.accountId },
        issue: {
            self: value.issue.self,
            id: parseId(value.issue.id, 'Tempo issue id')
        },
        description: typeof value.description === 'string' ? value.description : '',
        timeSpentSeconds
    }
}

function parseScheduleResponse(value: unknown): GetUserScheduleResponse {
    if (!isRecord(value) || !Array.isArray(value.results)) {
        throw new Error('Tempo schedule response has an invalid shape.')
    }
    return {
        results: value.results.map(item => {
            if (!isRecord(item) || typeof item.date !== 'string' || typeof item.type !== 'string') {
                throw new Error('Tempo schedule response has an invalid entry.')
            }
            const requiredSeconds = numericValue(item.requiredSeconds)
            if (requiredSeconds === undefined) throw new Error('Tempo schedule response has an invalid duration.')
            return { date: item.date, requiredSeconds, type: item.type }
        })
    }
}

function parsePositiveInteger(value: string | number, field: string): number {
    const numberValue = typeof value === 'number' ? value : Number(value)
    if (!Number.isSafeInteger(numberValue) || numberValue <= 0) {
        throw new Error(`Tempo ${field} must be a positive integer.`)
    }
    return numberValue
}

function parseId(value: unknown, field: string): string {
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    throw new Error(`${field} response has an invalid id.`)
}

function numericValue(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
    return undefined
}

async function execute<T>(service: 'Tempo' | 'Jira', action: () => Promise<T>): Promise<T> {
    try {
        return await action()
    } catch (error) {
        throw normalizeError(service, error)
    }
}

function normalizeError(service: 'Tempo' | 'Jira', error: unknown): Error {
    if (!(error instanceof HttpClientError)) {
        return error instanceof Error ? error : new Error(String(error))
    }

    if (error.message.startsWith('Refusing to send credentials')) {
        return new Error(error.message)
    }
    if (error.status === 401) {
        throw new Error('Unauthorized access. Tokens are invalid or have expired. Run tempo setup to configure access.')
    }

    const messages = service === 'Jira' ? extractJiraMessages(error.data) : extractTempoMessages(error.data)
    if (messages.length > 0) {
        throw new Error(`Failure (${service} API). Reason: ${error.message}. Errors: ${messages.join(', ')}`)
    }

    if (error.status) throw new Error(`Error connecting to server. Server status code: ${error.status}.`)
    return new Error(error.message)
}

function extractTempoMessages(value: unknown): string[] {
    if (!isRecord(value)) return []
    const errors = value.errors
    if (Array.isArray(errors)) {
        return errors.flatMap(item => {
            if (typeof item === 'string') return [item]
            if (isRecord(item) && typeof item.message === 'string') return [item.message]
            return []
        })
    }
    if (typeof errors === 'string') return [errors]
    if (isRecord(errors)) return Object.values(errors).filter((item): item is string => typeof item === 'string')
    if (typeof value.message === 'string') return [value.message]
    return []
}

function extractJiraMessages(value: unknown): string[] {
    if (!isRecord(value)) return []
    const messages: string[] = []
    if (Array.isArray(value.errorMessages)) {
        messages.push(...value.errorMessages.filter((item): item is string => typeof item === 'string'))
    }
    if (isRecord(value.errors)) {
        messages.push(...Object.values(value.errors).filter((item): item is string => typeof item === 'string'))
    }
    return messages
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}
