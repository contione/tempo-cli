import { afterEach, expect, test, vi } from 'vitest'
import api from '../src/api/api.js'
import authenticator from '../src/config/authenticator.js'
import flags from '../src/globalFlags.js'

vi.mock('../src/config/authenticator.js', () => ({
    default: {
        getCredentials: vi.fn()
    }
}))

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
    flags.debug = false
    vi.restoreAllMocks()
})

test('creates a Tempo worklog with bearer auth and an integer issueId', async () => {
    vi.mocked(authenticator.getCredentials).mockResolvedValue({
        tempoToken: 'tempo-secret',
        accountId: 'account-123'
    })
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
        tempoWorklogId: 42,
        startDate: '2026-09-19',
        startTime: '09:00:00',
        author: { accountId: 'account-123' },
        issue: { id: 10001, self: 'https://api.tempo.io/4/issue/10001' },
        timeSpentSeconds: 3_600
    }))
    globalThis.fetch = fetchMock

    const result = await api.addWorklog({
        issueId: '10001',
        timeSpentSeconds: 3_600,
        startDate: '2026-09-19',
        startTime: '09:00:00',
        description: 'Implementation'
    })

    expect(result.tempoWorklogId).toBe('42')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [requestUrl, requestInit] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toBe('https://api.tempo.io/4/worklogs')
    expect(requestInit?.method).toBe('POST')
    expect(requestInit?.redirect).toBe('error')
    expect(requestInit?.headers).toMatchObject({
        Accept: 'application/json',
        Authorization: 'Bearer tempo-secret',
        'Content-Type': 'application/json'
    })
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({
        issueId: 10001,
        authorAccountId: 'account-123',
        description: 'Implementation'
    })
})

test('follows same-origin Tempo pagination and normalizes response ids', async () => {
    vi.mocked(authenticator.getCredentials).mockResolvedValue({
        tempoToken: 'tempo-secret',
        accountId: 'account-123'
    })
    const firstPage = {
        metadata: { next: 'https://api.tempo.io/4/worklogs/user/account-123?offset=1' },
        results: [worklog(1)]
    }
    const secondPage = {
        metadata: {},
        results: [worklog(2)]
    }
    const fetchMock = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse(firstPage))
        .mockResolvedValueOnce(jsonResponse(secondPage))
    globalThis.fetch = fetchMock

    const result = await api.getWorklogs({ fromDate: '2026-09-01', toDate: '2026-09-30' })

    expect(result.results.map(item => item.tempoWorklogId)).toEqual(['1', '2'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const [, init] of fetchMock.mock.calls) {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer tempo-secret' })
    }
})

test('rejects cross-origin pagination before sending the Tempo token', async () => {
    vi.mocked(authenticator.getCredentials).mockResolvedValue({
        tempoToken: 'tempo-secret',
        accountId: 'account-123'
    })
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
        metadata: { next: 'https://attacker.example/steal' },
        results: []
    }))
    globalThis.fetch = fetchMock

    await expect(api.getWorklogs({ fromDate: '2026-09-01', toDate: '2026-09-30' }))
        .rejects.toThrow('Refusing to send credentials to another origin.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
})

test('retries GET once after a rate limit and does not retry POST failures', async () => {
    vi.mocked(authenticator.getCredentials).mockResolvedValue({
        tempoToken: 'tempo-secret',
        accountId: 'account-123'
    })
    const getFetchMock = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse({ errors: [{ message: 'busy' }] }, 429, { 'Retry-After': '0' }))
        .mockResolvedValueOnce(jsonResponse({
            tempoWorklogId: 7,
            startDate: '2026-09-19',
            author: { accountId: 'account-123' },
            issue: { id: 10001, self: 'https://api.tempo.io/4/issue/10001' },
            timeSpentSeconds: 60
        }))
    globalThis.fetch = getFetchMock
    await api.getWorklog(7)
    expect(getFetchMock).toHaveBeenCalledTimes(2)

    const postFetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ errors: [{ message: 'busy' }] }, 503))
    globalThis.fetch = postFetchMock
    await expect(api.addWorklog({
        issueId: '10001',
        timeSpentSeconds: 60,
        startDate: '2026-09-19',
        startTime: '09:00:00'
    })).rejects.toThrow('busy')
    expect(postFetchMock).toHaveBeenCalledTimes(1)
})

test('formats Jira errorMessages and errors map without exposing request data', async () => {
    vi.mocked(authenticator.getCredentials).mockResolvedValue({
        hostname: 'example.atlassian.net',
        atlassianUserEmail: 'user@example.com',
        atlassianToken: 'jira-secret'
    })
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
        errorMessages: ['Issue was not found'],
        errors: { issue: 'Unknown issue key' }
    }, 400))
    globalThis.fetch = fetchMock
    flags.debug = true
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await expect(api.getIssueId('ABC-123')).rejects.toThrow('Issue was not found')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(logSpy.mock.calls.join(' ')).not.toContain('jira-secret')
    expect(logSpy.mock.calls.join(' ')).not.toContain('user@example.com')
})

function worklog(id: number) {
    return {
        tempoWorklogId: id,
        startDate: '2026-09-19',
        startTime: '09:00:00',
        author: { accountId: 'account-123' },
        issue: { id: 10000 + id, self: `https://api.tempo.io/4/issue/${10000 + id}` },
        timeSpentSeconds: 60
    }
}

function jsonResponse(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(value), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers }
    })
}
