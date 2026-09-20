import { Command, Flags, Args } from '@oclif/core'
import { appName } from '../../appName'
import tempo from '../../tempo'
import globalFlags from '../../globalFlags'
import time from '../../time'
import { parseAttributes } from '../../worklogs/attributes'

export default class Start extends Command {
    static id = 'tracker:start'
    static description = '[or start], start a new tracker'

    static examples = [
        `${appName} tracker:start abc-123`,
        `${appName} start abc-123`,
        `${appName} tracker:start abc-123 -d "worklog description"`
    ]

    static aliases = ['start']

    static flags = {
        help: Flags.help({ char: 'h' }),
        debug: Flags.boolean(),
        description: Flags.string({ char: 'd', description: 'description for worklog once tracker is stopped' }),
        attribute: Flags.string({ char: 'a', multiple: true, multipleNonGreedy: true, dependsOn: ['stop-previous'], description: 'work attribute KEY=VALUE for the previous tracker upload only; repeat to override setup defaults' }),
        'stop-previous': Flags.boolean({ description: 'stops and logs previous tracker with the same issue key if it exists' })
    }

    static args = {
        issue_key_or_alias: Args.string({
            description: 'issue key or alias',
            required: true
        })
    }

    async run() {
        const { args, flags } = await this.parse(Start)
        globalFlags.debug = flags.debug
        await tempo.startTracker({
            issueKeyOrAlias: args.issue_key_or_alias,
            description: flags.description,
            attributes: parseAttributes(flags.attribute),
            now: time.now(),
            stopPreviousTracker: flags['stop-previous']
        })
    }
}
