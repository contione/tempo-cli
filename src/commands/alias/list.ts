import { Command, Flags } from '@oclif/core'
import { appName } from '../../appName'
import aliases from '../../config/aliases'
import globalFlags from '../../globalFlags'

export default class List extends Command {
    static description = 'print aliases list'

    static examples = [
        `${appName} alias:list`
    ]

    static flags = {
        help: Flags.help({ char: 'h' }),
        debug: Flags.boolean()
    }

    async run() {
        const { flags } = await this.parse(List)
        globalFlags.debug = flags.debug
        const all = await aliases.all()
        all?.forEach((value, key) => this.log(`${key} => ${value}`))
    }
}
