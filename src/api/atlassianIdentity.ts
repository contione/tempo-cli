import { HttpClientError, requestJson } from './httpClient'

export type AtlassianIdentityInput = {
    hostname: string
    email: string
    apiToken: string
}

export type AtlassianIdentity = {
    accountId: string
    active?: boolean
    displayName?: string
}

export async function getCurrentUser(input: AtlassianIdentityInput): Promise<AtlassianIdentity> {
    const origin = normalizeAtlassianOrigin(input.hostname)
    const email = input.email.trim()
    const apiToken = input.apiToken.trim()
    if (!email) throw new Error('Jira email cannot be empty.')
    if (!apiToken) throw new Error('Jira API token cannot be empty.')

    try {
        const response = await requestJson<unknown>(`${origin}/rest/api/3/myself`, {
            headers: {
                Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`, 'utf8').toString('base64')}`
            },
            allowedOrigin: origin
        })
        return parseIdentity(response.data)
    } catch (error) {
        if (error instanceof HttpClientError) throw jiraError(error)
        throw error
    }
}

function normalizeAtlassianOrigin(hostname: string): string {
    const value = hostname.trim()
    if (!value) throw new Error('Jira hostname cannot be empty.')

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

function parseIdentity(value: unknown): AtlassianIdentity {
    if (!isRecord(value) || typeof value.accountId !== 'string' || !value.accountId.trim()) {
        throw new Error('Jira /myself did not return an accountId.')
    }
    const active = typeof value.active === 'boolean' ? value.active : undefined
    if (active === false) throw new Error('The Jira user is inactive.')

    return {
        accountId: value.accountId.trim(),
        active: active ?? true,
        ...(typeof value.displayName === 'string' ? { displayName: value.displayName } : {})
    }
}

function jiraError(error: HttpClientError): Error {
    if (error.status === 401 || error.status === 403) {
        return new Error('Unauthorized access to Jira. Check your email and API token.')
    }

    const messages = extractJiraMessages(error.data)
    if (messages.length > 0) {
        return new Error(`Failure (Jira API). Reason: ${error.message}. Errors: ${messages.join(', ')}`)
    }

    return new Error(error.status
        ? `Error connecting to Jira. Server status code: ${error.status}.`
        : error.message)
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
