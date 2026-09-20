import cli from 'cli-ux'
import api from '../src/api/api'
import { getCurrentUser } from '../src/api/atlassianIdentity'
import configStore from '../src/config/configStore'
import tempo from '../src/tempo'

jest.mock('cli-ux', () => ({
    __esModule: true,
    default: { prompt: jest.fn(), open: jest.fn(), action: { start: jest.fn(), stop: jest.fn() } }
}))
jest.mock('../src/api/atlassianIdentity', () => ({ getCurrentUser: jest.fn() }))
jest.mock('../src/config/configStore', () => jest.requireActual('./mocks/configStore'))

const oldConfig = {
    hostname: 'old.atlassian.net', tempoToken: 'old-token',
    workAttributeDefaults: [{ key: 'OldTask', value: 'old-value' }],
    aliases: new Map([['review', 'NOVA-318']]), trackers: new Map()
}

beforeEach(async () => {
    jest.clearAllMocks()
    await configStore.save({
        ...oldConfig,
        workAttributeDefaults: oldConfig.workAttributeDefaults.map(value => ({ ...value })),
        aliases: new Map(oldConfig.aliases), trackers: new Map(oldConfig.trackers)
    })
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    ;(getCurrentUser as jest.Mock).mockResolvedValue({ accountId: 'account-123', displayName: 'Test User' })
})
afterEach(() => jest.restoreAllMocks())

function answers(...values: string[]) {
    const prompt = cli.prompt as jest.Mock
    for (const value of ['example.atlassian.net', 'test@example.com', 'jira-token', 'tempo-token', ...values]) {
        prompt.mockResolvedValueOnce(value)
    }
    // An unexpected extra question fails the test instead of hanging in a retry loop.
    prompt.mockRejectedValue(new Error('Unexpected setup question'))
}

test('setup chooses immutable defaults, validates answers and saves everything together', async () => {
    const getAttributes = jest.spyOn(api, 'getWorkAttributes').mockResolvedValue([
        { key: 'Task', name: 'Task', type: 'STATIC_LIST', required: true, values: ['task-build', 'task-review'], names: { 'task-build': 'Build', 'task-review': 'Review' } },
        { key: 'Billable', name: 'Billable', type: 'CHECKBOX', required: true },
        { key: 'Count', name: 'Count', type: 'INPUT_NUMERIC', required: true },
        { key: 'Note', name: 'Note', type: 'INPUT_FIELD', required: false }
    ])
    answers('99', '2', '2', 'invalid', '0', '')
    await tempo.setup()
    expect(getAttributes).toHaveBeenCalledWith('tempo-token')
    expect(await configStore.read()).toEqual({
        hostname: 'example.atlassian.net', tempoToken: 'tempo-token', accountId: 'account-123',
        atlassianUserEmail: 'test@example.com', atlassianToken: 'jira-token',
        workAttributeDefaults: [{ key: 'Task', value: 'task-review' }, { key: 'Billable', value: 'false' }, { key: 'Count', value: '0' }],
        aliases: oldConfig.aliases, trackers: oldConfig.trackers
    })
    expect(console.log).toHaveBeenCalledWith('  2. Review')
})

test('required text cannot be blank and optional dropdown defaults can be skipped', async () => {
    jest.spyOn(api, 'getWorkAttributes').mockResolvedValue([
        { key: 'Task', name: 'Task', type: 'INPUT_FIELD', required: true },
        { key: 'Team', name: 'Team', type: 'STATIC_LIST', required: false, values: ['team-a'] }
    ])
    answers('', 'Support', '0')
    await tempo.setup()
    expect((await configStore.read()).workAttributeDefaults).toEqual([{ key: 'Task', value: 'Support' }])
})

test('sites without work attributes need no extra answers and clear stale defaults', async () => {
    jest.spyOn(api, 'getWorkAttributes').mockResolvedValue([])
    answers()
    await tempo.setup()
    expect((await configStore.read()).workAttributeDefaults).toEqual([])
    expect(cli.prompt).toHaveBeenCalledTimes(4)
})

test('failed attribute loading preserves the existing configuration', async () => {
    jest.spyOn(api, 'getWorkAttributes').mockRejectedValue(new Error('Unauthorized access to Tempo'))
    answers()
    await tempo.setup()
    expect(await configStore.read()).toEqual(oldConfig)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Unauthorized access to Tempo'))
})

test('an unconfigured required dropdown does not save a partial setup', async () => {
    jest.spyOn(api, 'getWorkAttributes').mockResolvedValue([
        { key: 'Task', name: 'Task', type: 'STATIC_LIST', required: true, values: [] }
    ])
    answers()
    await tempo.setup()
    expect(await configStore.read()).toEqual(oldConfig)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('no available options'))
})

test.each([
    {hostname: 'example.atlassian.net', accountId: 'old-account'},
    {hostname: 'old.atlassian.net', accountId: 'account-123'}
])('does not switch identity with local trackers: %j', async identity => {
    const config = {
        ...oldConfig, ...identity,
        trackers: new Map([['NOVA-123', {issueKey: 'NOVA-123', activeTimestamp: 0, isActive: true, intervals: []}]])
    }
    await configStore.save(config)
    jest.spyOn(api, 'getWorkAttributes').mockResolvedValue([])
    answers()
    await expect(tempo.setup()).resolves.toBe(false)
    expect(await configStore.read()).toEqual(config)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('before switching Jira account or site'))
})

test.each([true, false])('keeps trackers during same-identity or initial setup (configured=%s)', async configured => {
    const trackers = new Map([['NOVA-123', {issueKey: 'NOVA-123', activeTimestamp: 0, isActive: true, intervals: []}]])
    await configStore.save({trackers, ...(configured ? {hostname: 'example.atlassian.net', accountId: 'account-123'} : {})})
    jest.spyOn(api, 'getWorkAttributes').mockResolvedValue([])
    answers()
    await expect(tempo.setup()).resolves.toBe(true)
    expect((await configStore.read()).trackers).toEqual(trackers)
})
