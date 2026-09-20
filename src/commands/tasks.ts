import { Command, Flags } from '@oclif/core'
import { appName } from '../appName'
import api, { type WorkAttribute } from '../api/api'
import authenticator from '../config/authenticator'
import globalFlags from '../globalFlags'

export default class Tasks extends Command {
    static description = 'list available Tempo Task work attribute values'

    static examples = [
        `${appName} tasks`,
        `${appName} task:list`
    ]

    static aliases = ['task:list']

    static flags = {
        help: Flags.help({ char: 'h' }),
        debug: Flags.boolean()
    }

    async run() {
        const { flags } = await this.parse(Tasks)
        globalFlags.debug = flags.debug

        const [attributes, credentials] = await Promise.all([
            api.getWorkAttributes(),
            authenticator.getCredentials()
        ])
        const task = findTaskAttribute(attributes)

        if (!task) {
            this.log('Tempo does not expose a Task work attribute for this account.')
            return
        }

        const defaultValue = credentials.workAttributeDefaults?.find(value => value.key === task.key)?.value
        this.log(`Task work attribute`)
        this.log(`Key: ${task.key}`)
        this.log(`Required: ${task.required ? 'yes' : 'no'}`)
        this.log(`Type: ${task.type}`)
        this.log(`Default: ${defaultValue ?? 'not configured'}`)

        if (task.type !== 'STATIC_LIST') {
            this.log('This attribute accepts a manual value; Tempo does not provide fixed options.')
            return
        }

        if (!task.values || task.values.length === 0) {
            this.log('Options: none returned by Tempo.')
            return
        }

        this.log('Options:')
        for (const value of task.values) {
            const marker = value === defaultValue ? '*' : ' '
            const label = task.names?.[value] ?? value
            this.log(`${marker} ${value} - ${label}`)
        }
    }
}

function findTaskAttribute(attributes: WorkAttribute[]): WorkAttribute | undefined {
    return attributes.find(attribute => attribute.key === 'Task')
        ?? attributes.find(attribute => attribute.name === 'Task')
}
