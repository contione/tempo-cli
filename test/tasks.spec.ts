import Tasks from '../src/commands/tasks'
import api from '../src/api/api'
import authenticator from '../src/config/authenticator'
import type { Config } from '@oclif/core'

function createCommand(argv: string[] = []) {
    const config = {
        topicSeparator: ':',
        runHook: jest.fn().mockResolvedValue({ successes: [] })
    } as unknown as Config
    const command = new Tasks(argv, config)
    const log = jest.fn()
    command.log = log
    return { command, log }
}

beforeEach(() => {
    jest.spyOn(authenticator, 'getCredentials').mockResolvedValue({
        workAttributeDefaults: [{ key: 'Task', value: 'task-review' }]
    })
})

afterEach(() => jest.restoreAllMocks())

test('prints actual Task key, labels, ids, required state and saved default marker', async () => {
    jest.spyOn(api, 'getWorkAttributes').mockResolvedValue([
        { key: 'Task', name: 'Task', type: 'STATIC_LIST', required: true, values: ['task-build', 'task-review'], names: { 'task-build': 'Build', 'task-review': 'Review' } },
        { key: 'Other', name: 'Other', type: 'INPUT_FIELD', required: false }
    ])
    const { command, log } = createCommand()

    await command.run()

    const output = log.mock.calls.map(([message]) => message).join('\n')
    expect(output).toContain('Key: Task')
    expect(output).toContain('Required: yes')
    expect(output).toContain('Default: task-review')
    expect(output).toContain('  task-build - Build')
    expect(output).toContain('* task-review - Review')
})

test('falls back to the Task name while preserving the actual key', async () => {
    jest.spyOn(api, 'getWorkAttributes').mockResolvedValue([
        { key: 'custom-task-key', name: 'Task', type: 'STATIC_LIST', required: false, values: ['option-id'], names: { 'option-id': 'Option label' } }
    ])
    jest.spyOn(authenticator, 'getCredentials').mockResolvedValue({
        workAttributeDefaults: [{ key: 'custom-task-key', value: 'option-id' }]
    })
    const { command, log } = createCommand()

    await command.run()

    const output = log.mock.calls.map(([message]) => message).join('\n')
    expect(output).toContain('Key: custom-task-key')
    expect(output).toContain('* option-id - Option label')
})

test('reports when Task is not available', async () => {
    jest.spyOn(api, 'getWorkAttributes').mockResolvedValue([
        { key: 'Billable', name: 'Billable', type: 'CHECKBOX', required: true }
    ])
    const { command, log } = createCommand()

    await command.run()

    expect(log).toHaveBeenCalledWith('Tempo does not expose a Task work attribute for this account.')
})

test('does not invent options for a non-list Task attribute', async () => {
    jest.spyOn(api, 'getWorkAttributes').mockResolvedValue([
        { key: 'Task', name: 'Task', type: 'INPUT_FIELD', required: true }
    ])
    const { command, log } = createCommand()

    await command.run()

    const output = log.mock.calls.map(([message]) => message).join('\n')
    expect(output).toContain('manual value')
    expect(output).not.toContain('Options:')
})

test('reports when a static Task has no options', async () => {
    jest.spyOn(api, 'getWorkAttributes').mockResolvedValue([
        { key: 'Task', name: 'Task', type: 'STATIC_LIST', required: true, values: [] }
    ])
    const { command, log } = createCommand()

    await command.run()

    expect(log).toHaveBeenCalledWith('Options: none returned by Tempo.')
})

test('propagates metadata and credential errors', async () => {
    const error = new Error('Tempo request failed')
    jest.spyOn(api, 'getWorkAttributes').mockRejectedValue(error)
    const { command } = createCommand()

    await expect(command.run()).rejects.toBe(error)

    const credentialsError = new Error('Configuration unavailable')
    jest.restoreAllMocks()
    jest.spyOn(api, 'getWorkAttributes').mockResolvedValue([])
    jest.spyOn(authenticator, 'getCredentials').mockRejectedValue(credentialsError)
    const second = createCommand()
    await expect(second.command.run()).rejects.toBe(credentialsError)
})
