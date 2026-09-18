import flags from '../globalFlags'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type HttpRequestOptions = {
    method?: HttpMethod
    headers?: Record<string, string>
    body?: unknown
    timeoutMs?: number
    maxRetries?: number
    allowedOrigin?: string
}

export type HttpResponse<T> = {
    data: T
    status: number
    headers: Headers
    url: string
}

export type HttpClientErrorOptions = {
    method: HttpMethod
    url: string
    status?: number
    data?: unknown
    cause?: unknown
}

export class HttpClientError extends Error {
    readonly method: HttpMethod
    readonly url: string
    readonly status?: number
    readonly data?: unknown

    constructor(message: string, options: HttpClientErrorOptions) {
        super(message)
        if (options.cause !== undefined) {
            Object.defineProperty(this, 'cause', {
                configurable: true,
                value: options.cause
            })
        }
        this.name = 'HttpClientError'
        this.method = options.method
        this.url = options.url
        this.status = options.status
        this.data = options.data
    }
}

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_GET_RETRIES = 2
const MAX_RETRY_DELAY_MS = 2_000
const INITIAL_RETRY_DELAY_MS = 250

export async function requestJson<T>(
    input: string | URL,
    options: HttpRequestOptions = {}
): Promise<HttpResponse<T>> {
    const method = options.method ?? 'GET'
    const requestUrl = new URL(input.toString())
    if (options.allowedOrigin) assertSameOrigin(requestUrl, options.allowedOrigin)

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const maxRetries = method === 'GET' ? options.maxRetries ?? DEFAULT_GET_RETRIES : 0
    const body = options.body === undefined ? undefined : JSON.stringify(options.body)
    const headers = {
        Accept: 'application/json',
        ...options.headers,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    }

    for (let attempt = 0; ; attempt += 1) {
        const startedAt = Date.now()
        let response: Response

        try {
            response = await fetchWithTimeout(requestUrl, {
                method,
                headers,
                body,
                timeoutMs
            })
        } catch (error) {
            const elapsedMs = Date.now() - startedAt
            debugRequest(method, requestUrl, 'network-error', elapsedMs)
            if (error instanceof HttpClientError) throw error
            throw new HttpClientError('Error connecting to server.', {
                method,
                url: requestUrl.toString(),
                cause: error
            })
        }

        const elapsedMs = Date.now() - startedAt
        const data = await readResponseBody(response)
        const responseHeaders = response.headers ?? new Headers()
        debugRequest(method, requestUrl, response.status, elapsedMs)

        if (response.ok) {
            return {
                data: data as T,
                status: response.status,
                headers: responseHeaders,
                url: response.url || requestUrl.toString()
            }
        }

        if (attempt < maxRetries && isRetryableStatus(response.status)) {
            await delay(retryDelay(responseHeaders, attempt))
            continue
        }

        throw new HttpClientError(`HTTP ${response.status}`, {
            method,
            url: requestUrl.toString(),
            status: response.status,
            data
        })
    }
}

export function assertSameOrigin(url: URL, allowedOrigin: string): void {
    const expectedOrigin = new URL(allowedOrigin).origin
    if (url.origin !== expectedOrigin) {
        throw new HttpClientError('Refusing to send credentials to another origin.', {
            method: 'GET',
            url: url.toString()
        })
    }
}

function fetchWithTimeout(
    url: URL,
    options: {
        method: HttpMethod
        headers: Record<string, string>
        body?: string
        timeoutMs: number
    }
): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options.timeoutMs)
    const init = {
        method: options.method,
        headers: options.headers,
        redirect: 'error' as const,
        signal: controller.signal,
        body: options.body
    }

    return globalThis.fetch(url, init).catch((error: unknown) => {
        if (controller.signal.aborted) {
            throw new HttpClientError(`Request timed out after ${options.timeoutMs}ms.`, {
                method: options.method,
                url: url.toString(),
                cause: error
            })
        }
        throw error
    }).finally(() => clearTimeout(timer))
}

async function readResponseBody(response: Response): Promise<unknown> {
    const responseWithText = response as Response & { text?: () => Promise<string> }
    if (typeof responseWithText.text === 'function') {
        const text = await responseWithText.text()
        if (!text) return undefined
        try {
            return JSON.parse(text) as unknown
        } catch {
            return text
        }
    }

    const responseWithJson = response as Response & { json?: () => Promise<unknown> }
    if (typeof responseWithJson.json === 'function') return responseWithJson.json()
    return undefined
}

function isRetryableStatus(status: number): boolean {
    return status === 429 || (status >= 500 && status <= 599)
}

function retryDelay(headers: Headers, attempt: number): number {
    const retryAfter = headers.get('retry-after')
    if (retryAfter) {
        const seconds = Number(retryAfter)
        if (Number.isFinite(seconds)) {
            return Math.min(Math.max(seconds, 0) * 1_000, MAX_RETRY_DELAY_MS)
        }

        const retryAt = Date.parse(retryAfter)
        if (Number.isFinite(retryAt)) {
            return Math.min(Math.max(retryAt - Date.now(), 0), MAX_RETRY_DELAY_MS)
        }
    }

    return Math.min(INITIAL_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS)
}

function delay(milliseconds: number): Promise<void> {
    if (milliseconds <= 0) return Promise.resolve()
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function debugRequest(method: HttpMethod, url: URL, status: number | string, elapsedMs: number): void {
    if (!flags.debug) return
    console.log(`HTTP ${method} ${redactPath(url.pathname)} ${status} ${elapsedMs}ms`)
}

function redactPath(pathname: string): string {
    return pathname
        .replace(/\/issue\/[^/]+(?=\/|$)/, '/issue/:id')
        .replace(/\/user\/[^/]+(?=\/|$)/, '/user/:id')
        .replace(/\/worklogs\/[^/]+(?=\/|$)/, '/worklogs/:id')
}
