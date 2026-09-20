import api from '../src/api/api'
import configStore from '../src/config/configStore'
import worklogs from '../src/worklogs/worklogs'
import tempo from '../src/tempo'

jest.mock('../src/config/configStore', () => jest.requireActual('./mocks/configStore'))

const defaults = [{ key: 'Task', value: 'task-review' }, { key: 'Billable', value: 'false' }, { key: 'Count', value: '0' }]
const baseDate = new Date('2026-09-20T09:00:00+02:00')

beforeEach(async () => {
    await configStore.save({
        hostname: 'example.atlassian.net', accountId: 'account-123',
        tempoToken: 'tempo-token', atlassianToken: 'jira-token', atlassianUserEmail: 'test@example.com',
        workAttributeDefaults: structuredClone(defaults)
    })
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.spyOn(api, 'getIssueId').mockResolvedValue('123')
    jest.spyOn(api, 'getWorkAttributes').mockRejectedValue(new Error('Options must only be fetched during setup'))
    jest.spyOn(api, 'addWorklog').mockResolvedValue({
        tempoWorklogId: '42', issue: { id: '123', self: 'https://api.tempo.io/4/issues/123' },
        author: { accountId: 'account-123' }, startDate: '2026-09-20', startTime: '09:00:00',
        description: '', timeSpentSeconds: 1800
    })
})
afterEach(() => jest.restoreAllMocks())

test('ordinary worklogs automatically use the saved values without another metadata request', async () => {
    await worklogs.addWorklog({ issueKeyOrAlias: 'NOVA-123', durationOrInterval: '30m' })
    expect(api.addWorklog).toHaveBeenCalledWith(expect.objectContaining({ attributes: defaults }))
    expect(api.getWorkAttributes).not.toHaveBeenCalled()
})

test('legacy configurations still omit attributes', async () => {
    const config = await configStore.read()
    delete config.workAttributeDefaults
    await configStore.save(config)
    await worklogs.addWorklog({ issueKeyOrAlias: 'NOVA-123', durationOrInterval: '30m' })
    expect((api.addWorklog as jest.Mock).mock.calls[0][0]).not.toHaveProperty('attributes')
})

test('every tracker interval uses defaults, including stop-previous uploads', async () => {
    await tempo.startTracker({ issueKeyOrAlias: 'NOVA-123', now: baseDate })
    await tempo.pauseTracker({ issueKeyOrAlias: 'NOVA-123', now: new Date(baseDate.getTime() + 600_000) })
    await tempo.resumeTracker({ issueKeyOrAlias: 'NOVA-123', now: new Date(baseDate.getTime() + 900_000) })
    await tempo.startTracker({ issueKeyOrAlias: 'NOVA-123', now: new Date(baseDate.getTime() + 1_800_000), stopPreviousTracker: true })
    expect(api.addWorklog).toHaveBeenCalledTimes(2)
    for (const [request] of (api.addWorklog as jest.Mock).mock.calls) expect(request.attributes).toEqual(defaults)
    expect((await configStore.read()).trackers?.get('NOVA-123')?.isActive).toBe(true)
    expect(api.getWorkAttributes).not.toHaveBeenCalled()
})

test('attribute failures suggest setup and retain tracker work for a later retry', async () => {
    ;(api.addWorklog as jest.Mock).mockRejectedValue(new Error('Work attribute Task (Task) is required'))
    await tempo.startTracker({ issueKeyOrAlias: 'NOVA-123', now: baseDate })
    await tempo.stopTracker({ issueKeyOrAlias: 'NOVA-123', now: new Date(baseDate.getTime() + 600_000) })
    const tracker = (await configStore.read()).trackers?.get('NOVA-123')
    expect(tracker?.isActive).toBe(false)
    expect(tracker?.intervals).toHaveLength(1)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Run tempo setup'))
})
