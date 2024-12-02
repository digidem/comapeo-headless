import { Command } from 'commander'
import envPaths from 'env-paths'
import { gracefulCloser } from './util/gracefulCloser.js'
import { createMapeoManager } from './util/createMapeoManager.js'
import { enableSyncForAllProjects } from './util/enableSyncForAllProjects.js'
import { autoAcceptAllInvites } from './util/autoAcceptAllInvites.js'
import { startLocalDiscovery } from './util/startLocalDiscovery.js'

const APP_NAME = 'comapeo-headless'

function main() {
  const program = new Command()
  const paths = envPaths(APP_NAME)
  const beforeExit = gracefulCloser()

  program.name(APP_NAME).description('Headless CoMapeo instance')

  program
    .command('start')
    .description('Start the instance')
    .option('-n, --name <name>', 'Instance name', 'CoMapeo CLI')
    .action(async ({ name }) => {
      const mapeoManager = await createMapeoManager({
        name,
        dataPath: paths.data,
      })
      await enableSyncForAllProjects(mapeoManager)
      autoAcceptAllInvites(mapeoManager, beforeExit)
      await startLocalDiscovery(mapeoManager, beforeExit)
    })

  program.parse()
}

main()
