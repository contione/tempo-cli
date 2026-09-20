import { Parser } from '@oclif/core'
import Log from '../src/commands/log'
import Start from '../src/commands/tracker/start'
import Stop from '../src/commands/tracker/stop'
import { mergeAttributes, parseAttributes } from '../src/worklogs/attributes'

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
