import { Args, Command, Flags } from '@oclif/core'
import { appName } from '../../appName'
import aliases from '../../config/aliases'
import globalFlags from '../../globalFlags'

export default class Delete extends Command {
    static description = 'delete issue key alias'

    static examples = [
        `${appName} alias:delete lunch`
    ]

    static flags = {
        help: Flags.help({ char: 'h' }),
        debug: Flags.boolean()
    }

    static args = {
        alias_name: Args.string({description: 'Alias name', required: true})
    }
    
    async run() {
        const { args, flags } = await this.parse(Delete)
        globalFlags.debug = flags.debug
        await aliases.delete(args.alias_name)
    }
}
