import type { Config } from '@oclif/core'
import Log from '../src/commands/log'
import List from '../src/commands/list'
import Delete from '../src/commands/delete'
import Setup from '../src/commands/setup'
import Start from '../src/commands/tracker/start'
import Stop from '../src/commands/tracker/stop'
import Pause from '../src/commands/tracker/pause'
import Resume from '../src/commands/tracker/resume'
import TrackerList from '../src/commands/tracker/list'
import TrackerDelete from '../src/commands/tracker/delete'
import tempo from '../src/tempo'
import worklogs from '../src/worklogs/worklogs'
import trackers from '../src/trackers/trackers'

function config(): Config {
    return {bin: 'tempo', runHook: jest.fn().mockResolvedValue({successes: [], failures: []})} as unknown as Config
}

afterEach(() => jest.restoreAllMocks())

test.each([
    {name: 'log', command: Log, args: ['NOVA-123', '1h'], fail: () => jest.spyOn(tempo, 'addWorklog').mockResolvedValue(false)},
    {name: 'list', command: List, args: [], fail: () => jest.spyOn(tempo, 'listUserWorklogs').mockResolvedValue(false)},
    {name: 'delete', command: Delete, args: ['123'], fail: () => jest.spyOn(tempo, 'deleteWorklogs').mockResolvedValue(false)},
    {name: 'setup', command: Setup, args: [], fail: () => jest.spyOn(tempo, 'setup').mockResolvedValue(false)},
    {name: 'start', command: Start, args: ['NOVA-123'], fail: () => jest.spyOn(tempo, 'startTracker').mockResolvedValue(false)},
    {name: 'stop', command: Stop, args: ['NOVA-123'], fail: () => jest.spyOn(tempo, 'stopTracker').mockResolvedValue(false)},
    {name: 'pause', command: Pause, args: ['NOVA-123'], fail: () => jest.spyOn(tempo, 'pauseTracker').mockResolvedValue(false)},
    {name: 'resume', command: Resume, args: ['NOVA-123'], fail: () => jest.spyOn(tempo, 'resumeTracker').mockResolvedValue(false)},
    {name: 'tracker:list', command: TrackerList, args: [], fail: () => jest.spyOn(tempo, 'listTrackers').mockResolvedValue(false)},
    {name: 'tracker:delete', command: TrackerDelete, args: ['NOVA-123'], fail: () => jest.spyOn(tempo, 'deleteTracker').mockResolvedValue(false)}
])('$name reports a business failure with exit code 1', async ({command, args, fail}) => {
    fail()
    await expect(new command(args, config()).run()).rejects.toMatchObject({oclif: {exit: 1}})
})

test.each([['unexpected'], ['--unknown']])('setup rejects unexpected arguments before prompting: %j', async argument => {
    const setup = jest.spyOn(tempo, 'setup').mockResolvedValue(true)
    await expect(new Setup([argument], config()).run()).rejects.toThrow()
    expect(setup).not.toHaveBeenCalled()
})

test('listing awaits its work and propagates failure to the caller', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    let release = () => {}
    const pending = new Promise<void>(resolve => { release = resolve })
    jest.spyOn(worklogs, 'getUserWorklogs').mockImplementation(async () => { await pending; throw new Error('Read failed') })
    let settled = false
    const listing = tempo.listUserWorklogs().then(result => { settled = true; return result })
    await Promise.resolve()
    expect(settled).toBe(false)
    release()
    await expect(listing).resolves.toBe(false)
})

test('batch deletion still tries every ID but reports partial failure', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const remove = jest.spyOn(worklogs, 'deleteWorklog')
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce({id: '2', issueId: '123', issueKey: 'NOVA-123', duration: '1h', description: '', link: ''})
    await expect(tempo.deleteWorklogs(['1', '2'])).resolves.toBe(false)
    expect(remove.mock.calls).toEqual([['1'], ['2']])
})

test('stop-previous does not start a new tracker after a failed upload', async () => {
    jest.spyOn(trackers, 'findTracker').mockResolvedValue({issueKey: 'NOVA-123', activeTimestamp: 0, isActive: false, intervals: []})
    jest.spyOn(tempo, 'stopTracker').mockResolvedValue(false)
    const start = jest.spyOn(trackers, 'startTracker')
    await expect(tempo.startTracker({issueKeyOrAlias: 'NOVA-123', now: new Date(), stopPreviousTracker: true})).resolves.toBe(false)
    expect(start).not.toHaveBeenCalled()
})
