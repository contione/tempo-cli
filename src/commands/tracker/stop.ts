import { Command, Flags, Args } from '@oclif/core'
import { appName } from '../../appName'
import tempo from '../../tempo'
import globalFlags from '../../globalFlags'
import time from '../../time'
import { parseAttributes } from '../../worklogs/attributes'

export default class Stop extends Command {
    static description = '[or stop], stop a tracker and log it'

    static examples = [
        `${appName} tracker:stop abc-123`,
        `${appName} stop abc-123`,
        `${appName} tracker:stop abc-123 -d "worklog description"`
    ]

    static aliases = ['stop']

    static flags = {
        help: Flags.help({ char: 'h' }),
        debug: Flags.boolean(),
        description: Flags.string({ char: 'd', description: 'description for worklog' }),
        attribute: Flags.string({ char: 'a', multiple: true, multipleNonGreedy: true, description: 'work attribute KEY=VALUE for each uploaded interval; repeat to override setup defaults' }),
        'remaining-estimate': Flags.string({ char: 'r', description: 'remaining estimate' })
    }

    static args = {
        issue_key_or_alias: Args.string({
            description: 'issue key or alias',
            required: true
        })
    }

    async run() {
        const { args, flags } = await this.parse(Stop)
        globalFlags.debug = flags.debug
        await tempo.stopTracker({
            issueKeyOrAlias: args.issue_key_or_alias,
            description: flags.description,
            remainingEstimate: flags['remaining-estimate'],
            attributes: parseAttributes(flags.attribute),
            now: time.now()
        })
    }
}
