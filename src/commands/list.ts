import { Command, Flags, Args } from '@oclif/core'
import { appName } from '../appName'
import { trimIndent } from '../trimIndent'
import tempo from '../tempo'
import globalFlags from '../globalFlags'

export default class List extends Command {
    static description = '[or ls], print worklogs for a date or date range'

    static examples = [
        `${appName} list`,
        `${appName} ls`,
        `${appName} list y `,
        `${appName} list yesterday `,
        `${appName} list 2020-02-17`,
        `${appName} list 7d`,
        `${appName} list this-week`,
        `${appName} list last-month`,
        `${appName} list 2026-09-01 2026-09-20`,
        `${appName} ls t-6 t -v`,
        `${appName} list -v`
    ]

    static aliases = ['ls']

    static flags = {
        help: Flags.help({ char: 'h' }),
        debug: Flags.boolean(),
        verbose: Flags.boolean({
            char: 'v',
            description: 'verbose output with description and task link'
        })
    }

    static args = {
        when: Args.string({
            description: trimIndent(`date or range shortcut, defaulted to today
    * YYYY-MM-DD, t/today, y/yesterday, t-N/today-N, t+N/today+N
    * Nd, Nday, Ndays, lastNdays: last N days including today
    * week/this-week/thisweek, last-week/lastweek: Monday through Sunday
    * month/this-month/thismonth, last-month/lastmonth: full calendar month`),
            required: false
        }),
        to: Args.string({
            description: 'inclusive end date; use only with a single start date, not a range shortcut',
            ignoreStdin: true,
            required: false
        })
    }

    async run() {
        const { args, flags } = await this.parse(List)
        globalFlags.debug = flags.debug
        if (!await tempo.listUserWorklogs(args.when, flags.verbose, args.to)) this.exit(1)
    }
}
