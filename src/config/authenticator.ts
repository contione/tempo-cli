import configStore from './configStore'
import type { WorkAttributeValue } from '../api/api'

export type Credentials = {
    tempoToken?: string;
    accountId?: string;
    atlassianUserEmail?: string;
    atlassianToken?: string;
    hostname?: string;
    workAttributeDefaults?: WorkAttributeValue[];
}

export default {

    async saveCredentials(credentials: Credentials) {
        const config = await configStore.read()
        config.tempoToken = credentials.tempoToken
        config.accountId = credentials.accountId
        config.atlassianUserEmail = credentials.atlassianUserEmail
        config.atlassianToken = credentials.atlassianToken
        config.hostname = credentials.hostname
        if (credentials.workAttributeDefaults !== undefined) config.workAttributeDefaults = credentials.workAttributeDefaults
        await configStore.save(config)
    },

    async getCredentials(): Promise<Credentials> {
        const config = await configStore.read()
        return {
            tempoToken: config.tempoToken,
            accountId: config.accountId,
            atlassianUserEmail: config.atlassianUserEmail,
            atlassianToken: config.atlassianToken,
            hostname: config.hostname,
            workAttributeDefaults: config.workAttributeDefaults
        }
    },

    async hasTempoToken(): Promise<boolean> {
        try {
            const config = await configStore.read()
            return Boolean(config.tempoToken?.trim())
        } catch {
            return false
        }
    },

    async hasAtlassianToken(): Promise<boolean> {
        try {
            const config = await configStore.read()
            return Boolean(config.atlassianToken?.trim())
        } catch {
            return false
        }
    }
}
