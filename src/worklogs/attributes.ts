import type { WorkAttributeValue } from '../api/api'

export function parseAttributes(values: string[] = []): WorkAttributeValue[] {
    return values.map(input => {
        const separator = input.indexOf('=')
        const key = input.slice(0, separator).trim()
        if (separator < 1 || !key) throw new Error('Use --attribute KEY=VALUE, for example --attribute Task=option-id.')
        return { key, value: input.slice(separator + 1) }
    })
}

export function mergeAttributes(defaults: WorkAttributeValue[] = [], overrides: WorkAttributeValue[] = []): WorkAttributeValue[] {
    const values = new Map(defaults.map(attribute => [attribute.key, attribute.value]))
    for (const attribute of overrides) values.set(attribute.key, attribute.value)
    return [...values].map(([key, value]) => ({ key, value }))
}
