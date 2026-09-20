import cli from 'cli-ux'
import { trimIndent } from '../trimIndent'
import { Credentials } from './authenticator'
import { getCurrentUser } from '../api/atlassianIdentity'
import api, { type WorkAttribute, type WorkAttributeValue } from '../api/api'

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
        const workAttributeDefaults = await promptWorkAttributeDefaults(tempoToken)

        return {
            tempoToken,
            atlassianUserEmail,
            atlassianToken,
            accountId,
            hostname,
            workAttributeDefaults
        }
    }
}

async function promptHostname(): Promise<string> {
    const input = await cli.prompt(trimIndent(`
    Step 1/5:
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
    Step 2/5:
    Enter your Jira (Atlassian) user email.
    `))
    if (!input.trim()) throw Error('Atlassian email cannot be empty.')
    return input.trim()
}

async function promptAtlassianToken(): Promise<string> {
    const atlassianTokenUrl = 'https://id.atlassian.com/manage-profile/security/api-tokens'
    cli.open(atlassianTokenUrl)
    const input = await cli.prompt(trimIndent(`
    Step 3/5:
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
    Step 4/5:
    Enter your Tempo API token.
    Generate it here: ${tempoConfigurationUrl}
    `), { type: 'hide' })
    return input.trim()
}

async function promptWorkAttributeDefaults(tempoToken: string): Promise<WorkAttributeValue[]> {
    console.log('\nStep 5/5: Choose default Tempo work attributes.')
    console.log('These values will be used for new worklogs and tracker uploads. Run tempo setup again to change them.')
    const attributes = await api.getWorkAttributes(tempoToken)
    const defaults: WorkAttributeValue[] = []
    if (!attributes.length) console.log('No work attributes are configured for this Tempo site.')
    for (const attribute of attributes) {
        const value = await promptAttributeValue(attribute)
        if (value !== undefined) defaults.push({ key: attribute.key, value })
    }
    return defaults
}

async function promptAttributeValue(attribute: WorkAttribute): Promise<string | undefined> {
    const label = `${attribute.name} (${attribute.required ? 'required' : 'optional'})`
    const options = attribute.type === 'STATIC_LIST'
        ? (attribute.values || []).map(value => ({ value, label: attribute.names?.[value] || value }))
        : attribute.type === 'CHECKBOX'
            ? [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]
            : undefined
    if (options) {
        if (!options.length) {
            if (attribute.required) throw new Error(`${attribute.name} is required but has no available options. Ask your Tempo administrator to configure it.`)
            return undefined
        }
        console.log(`\n${label}`)
        options.forEach((option, index) => console.log(`  ${index + 1}. ${option.label}`))
        if (!attribute.required) console.log('  0. No default')
        for (;;) {
            const answer = String(await cli.prompt('Choose the default option number', { required: attribute.required })).trim()
            if (!attribute.required && (answer === '' || answer === '0')) return undefined
            const index = Number(answer) - 1
            if (/^\d+$/.test(answer) && Number.isInteger(index) && options[index]) return options[index].value
            console.log(`Enter a number from ${attribute.required ? 1 : 0} to ${options.length}.`)
        }
    }
    for (;;) {
        const hint = attribute.type === 'ACCOUNT' ? 'Tempo account key' : 'default value'
        const value = String(await cli.prompt(`${label}: ${hint}`, { required: attribute.required })).trim()
        if (!value) {
            if (!attribute.required) return undefined
            console.log(`${attribute.name} is required.`)
            continue
        }
        if (attribute.type === 'INPUT_NUMERIC' && !Number.isFinite(Number(value))) {
            console.log(`Enter a number for ${attribute.name}.`)
            continue
        }
        return value
    }
}
