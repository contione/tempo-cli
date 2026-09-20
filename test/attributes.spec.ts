import { Parser, type Config } from '@oclif/core'
import Log from '../src/commands/log'
import Start from '../src/commands/tracker/start'
import Stop from '../src/commands/tracker/stop'
import { mergeAttributes, parseAttributes, parseAttributeArguments } from '../src/worklogs/attributes'
import tempo from '../src/tempo'

afterEach(() => jest.restoreAllMocks())

function commandConfig(): Config {
    return { bin: 'tempo', runHook: jest.fn().mockResolvedValue({successes: [], failures: []}) } as unknown as Config
}

test('parses repeated attributes without consuming positional arguments', async () => {
    const result = await Parser.parse(['-a', 'Task=option-id', 'NOVA-123', '30m', '--attribute', 'Count=0', 'yesterday'], Log)
    expect(result.args).toEqual({ issue_key_or_alias: 'NOVA-123', duration_or_interval: '30m', when: 'yesterday' })
    expect(parseAttributes(result.flags.attribute)).toEqual([{ key: 'Task', value: 'option-id' }, { key: 'Count', value: '0' }])
})

test('stop accepts repeated attributes and stop-previous requires its explicit flag', async () => {
    const stop = await Parser.parse(['NOVA-123', '-a', 'Task=option-id', '-a', 'Billable=false'], Stop)
    expect(stop.flags.attribute).toEqual(['Task=option-id', 'Billable=false'])
    await expect(Parser.parse(['NOVA-123', '-a', 'Task=option-id'], Start)).rejects.toThrow(/stop-previous/)
    const start = await Parser.parse(['NOVA-123', '--stop-previous', '--attribute=Task=option-id'], Start)
    expect(start.flags.attribute).toEqual(['Task=option-id'])
})

test('keeps explicit empty values and splits on only the first equals sign', () => {
    expect(parseAttributes(['Note=', 'Query=a=b c', ' Task =id'])).toEqual([
        { key: 'Note', value: '' }, { key: 'Query', value: 'a=b c' }, { key: 'Task', value: 'id' }
    ])
})

test.each(['Task', '=value', '   =value', ''])('rejects malformed attribute %j', input => {
    expect(() => parseAttributes([input])).toThrow('KEY=VALUE')
})

test('explicit values override matching defaults, preserve other defaults and do not mutate them', () => {
    const defaults = [{ key: 'Task', value: 'default' }, { key: 'Note', value: 'keep' }]
    const result = mergeAttributes(defaults, parseAttributes(['Task=first', 'Count=0', 'Task=last', 'Billable=false']))
    expect(result).toEqual([
        { key: 'Task', value: 'last' }, { key: 'Note', value: 'keep' },
        { key: 'Count', value: '0' }, { key: 'Billable', value: 'false' }
    ])
    expect(defaults).toEqual([{ key: 'Task', value: 'default' }, { key: 'Note', value: 'keep' }])
})

test.each([
    [['Task=option-id', 'Count=0'], undefined],
    [['yesterday', 'Task=option-id', 'Count=0'], 'yesterday'],
    [['2026-09-20', 'Task=option-id', 'Count=0'], '2026-09-20']
])('log accepts trailing attributes with optional date: %j', async (tail, when) => {
    const write = jest.spyOn(tempo, 'addWorklog').mockResolvedValue(true)
    await new Log(['NOVA-123', '30m', ...(tail as string[])], commandConfig()).run()
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
        issueKeyOrAlias: 'NOVA-123', durationOrInterval: '30m', when,
        attributes: [{key: 'Task', value: 'option-id'}, {key: 'Count', value: '0'}]
    }))
})

test('mixes flags and trailing attributes in command-line order without mistaking description for an attribute', async () => {
    const parsed = await Parser.parse(['NOVA-123', '30m', 'Task=first', '--description', 'message=keep', '-a', 'Task=second', 'Task=last'], Log)
    const {when, attributes} = parseAttributeArguments(parsed.raw, 2, true)
    expect(when).toBeUndefined()
    expect(parsed.flags.description).toBe('message=keep')
    expect(mergeAttributes([], attributes)).toEqual([{key: 'Task', value: 'last'}])
})

test('stop and stop-previous forward trailing attributes to their upload operations', async () => {
    const stop = jest.spyOn(tempo, 'stopTracker').mockResolvedValue(undefined)
    const start = jest.spyOn(tempo, 'startTracker').mockResolvedValue(undefined)
    await new Stop(['NOVA-123', 'Task=option-id', 'Note='], commandConfig()).run()
    expect(stop).toHaveBeenCalledWith(expect.objectContaining({attributes: [{key: 'Task', value: 'option-id'}, {key: 'Note', value: ''}]}))
    await new Start(['NOVA-123', '--stop-previous', 'Task=option-id'], commandConfig()).run()
    expect(start).toHaveBeenCalledWith(expect.objectContaining({stopPreviousTracker: true, attributes: [{key: 'Task', value: 'option-id'}]}))
})

test('unexpected trailing arguments and unsupported start overrides fail before any mutation', async () => {
    const log = jest.spyOn(tempo, 'addWorklog').mockResolvedValue(true)
    const stop = jest.spyOn(tempo, 'stopTracker').mockResolvedValue(undefined)
    const start = jest.spyOn(tempo, 'startTracker').mockResolvedValue(undefined)
    await expect(new Log(['NOVA-123', '30m', 'yesterday', 'unexpected'], commandConfig()).run()).rejects.toThrow('KEY=VALUE')
    await expect(new Stop(['NOVA-123', 'unexpected'], commandConfig()).run()).rejects.toThrow('KEY=VALUE')
    await expect(new Start(['NOVA-123', 'Task=option-id'], commandConfig()).run()).rejects.toThrow('stop-previous')
    expect(log).not.toHaveBeenCalled()
    expect(stop).not.toHaveBeenCalled()
    expect(start).not.toHaveBeenCalled()
})
