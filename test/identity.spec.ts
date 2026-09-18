import { afterEach, expect, test, vi } from 'vitest'
import { getCurrentUser } from '../src/api/atlassianIdentity.js'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
})

test('gets the current Jira user with direct Basic Auth credentials', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
        accountId: 'abc:123',
        active: true,
        displayName: 'Ada Lovelace'
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    }))
    globalThis.fetch = fetchMock

    const result = await getCurrentUser({
        hostname: 'example.atlassian.net',
        email: 'ada@example.com',
        apiToken: 'jira-secret'
    })

    expect(result).toEqual({
        accountId: 'abc:123',
        active: true,
        displayName: 'Ada Lovelace'
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [requestUrl, requestInit] = fetchMock.mock.calls[0]
    expect(String(requestUrl)).toBe('https://example.atlassian.net/rest/api/3/myself')
    expect(requestInit?.method).toBe('GET')
    expect(requestInit?.redirect).toBe('error')
    const headers = requestInit?.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('ada@example.com:jira-secret').toString('base64')}`)
    expect(headers.Authorization).not.toContain('jira-secret')
})

test('rejects an inactive Jira user', async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
        accountId: 'abc:123',
        active: false
    }), { status: 200 }))

    await expect(getCurrentUser({
        hostname: 'example.atlassian.net',
        email: 'ada@example.com',
        apiToken: 'jira-secret'
    })).rejects.toThrow('inactive')
})

test('rejects a Jira /myself response without accountId', async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
        active: true
    }), { status: 200 }))

    await expect(getCurrentUser({
        hostname: 'example.atlassian.net',
        email: 'ada@example.com',
        apiToken: 'jira-secret'
    })).rejects.toThrow('accountId')
})

test('maps Jira authentication errors without logging credentials', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
        errorMessages: ['The token is invalid'],
        errors: { authentication: 'Authentication failed' }
    }), { status: 401 }))
    globalThis.fetch = fetchMock

    await expect(getCurrentUser({
        hostname: 'example.atlassian.net',
        email: 'ada@example.com',
        apiToken: 'jira-secret'
    })).rejects.toThrow('Unauthorized access to Jira')
})
