import cli from 'cli-ux'
import { trimIndent } from '../trimIndent'
import { Credentials } from './authenticator'
import { getCurrentUser } from '../api/atlassianIdentity'

export default {
    async promptCredentials(): Promise<Credentials> {
        const hostname = await promptHostname()
        const atlassianUserEmail = await promptAtlassianUserEmail()
        const atlassianToken = await promptAtlassianToken()

        let accountId: string
        try {
            const identity = await getCurrentUser({
                hostname,
                email: atlassianUserEmail,
                apiToken: atlassianToken
            })
            accountId = identity.accountId
            console.log(`Authenticated Jira user: ${identity.displayName ?? accountId}`)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            throw Error(`Could not discover Jira accountId via /myself: ${message}`)
        }

        const tempoToken = await promptTempoToken(hostname)
        if (!tempoToken) throw Error('Failure. Tempo token was not set properly.')

        return {
            tempoToken,
            atlassianUserEmail,
            atlassianToken,
            accountId,
            hostname
        }
    }
}

async function promptHostname(): Promise<string> {
    const input = await cli.prompt(trimIndent(`
    Step 1/4:
    Enter your Atlassian URL.
    For example: yourcompany.atlassian.net
    `))

    try {
        const trimmed = input.trim()
        const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
        if (!url.hostname) throw new Error('Hostname is empty')
        return url.hostname
    } catch {
        throw Error('Cannot parse Atlassian URL.')
    }
}

async function promptAtlassianUserEmail(): Promise<string> {
    const input = await cli.prompt(trimIndent(`
    Step 2/4:
    Enter your Jira (Atlassian) user email.
    `))
    if (!input.trim()) throw Error('Atlassian email cannot be empty.')
    return input.trim()
}

async function promptAtlassianToken(): Promise<string> {
    const atlassianTokenUrl = 'https://id.atlassian.com/manage-profile/security/api-tokens'
    cli.open(atlassianTokenUrl)
    const input = await cli.prompt(trimIndent(`
    Step 3/4:
    Enter your Atlassian API token.
    The CLI will call Jira /rest/api/3/myself to discover your accountId.
    Generate a token here: ${atlassianTokenUrl}
    `), { type: 'hide' })
    if (!input.trim()) throw Error('Atlassian token cannot be empty.')
    return input.trim()
}

async function promptTempoToken(hostname: string): Promise<string> {
    const tempoConfigurationUrl = `https://${hostname}/plugins/servlet/ac/io.tempo.jira/tempo-app#!/configuration/api-integration`
    cli.open(tempoConfigurationUrl)
    const input = await cli.prompt(trimIndent(`
    Step 4/4:
    Enter your Tempo API token.
    Generate it here: ${tempoConfigurationUrl}
    `), { type: 'hide' })
    return input.trim()
}
