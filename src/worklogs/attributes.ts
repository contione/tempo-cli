import type { WorkAttributeValue } from '../api/api'

export function parseAttributes(values: string[] = []): WorkAttributeValue[] {
    return values.map(input => {
        const separator = input.indexOf('=')
        const key = input.slice(0, separator).trim()
        if (separator < 1 || !key) throw new Error('Use KEY=VALUE, for example Task=option-id (or --attribute Task=option-id).')
        return { key, value: input.slice(separator + 1) }
    })
}

type ArgumentToken = { type: 'arg'; input: string } | { type: 'flag'; flag: string; input: string }

export function parseAttributeArguments(tokens: ArgumentToken[], requiredArguments: number, allowDate = false): { when?: string; attributes: WorkAttributeValue[] } {
    let position = 0
    let when: string | undefined
    const values: string[] = []
    for (const token of tokens) {
        if (token.type === 'flag') {
            if (token.flag === 'attribute') values.push(token.input)
            continue
        }
        if (position++ < requiredArguments) continue
        if (allowDate && position === requiredArguments + 1 && !token.input.includes('=')) when = token.input
        else values.push(token.input)
    }
    return { when, attributes: parseAttributes(values) }
}

export function mergeAttributes(defaults: WorkAttributeValue[] = [], overrides: WorkAttributeValue[] = []): WorkAttributeValue[] {
    const values = new Map(defaults.map(attribute => [attribute.key, attribute.value]))
    for (const attribute of overrides) values.set(attribute.key, attribute.value)
    return [...values].map(([key, value]) => ({ key, value }))
}
