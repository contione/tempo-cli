const { Plugin } = require('@oclif/core')
const { writeFile } = require('node:fs/promises')
const path = require('node:path')

async function buildManifest() {
    const root = path.resolve(__dirname, '..')
  const plugin = new Plugin({ root, ignoreManifest: true, errorOnManifestCreate: true })
    await plugin.load()
    await writeFile(path.join(root, 'oclif.manifest.json'), `${JSON.stringify(plugin.manifest, null, 2)}\n`)
}

buildManifest().catch(error => {
    console.error(error.message)
    process.exitCode = 1
})
