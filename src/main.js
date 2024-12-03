import { Command } from 'commander'
import envPaths from 'env-paths'
import { gracefulCloser } from './util/gracefulCloser.js'
import { createMapeoManager } from './util/createMapeoManager.js'
import { enableSyncForAllProjects } from './util/enableSyncForAllProjects.js'
import { autoAcceptAllInvites } from './util/autoAcceptAllInvites.js'
import { startLocalDiscovery } from './util/startLocalDiscovery.js'
import { noop } from './lib/noop.js'

const APP_NAME = 'comapeo-headless'

function main() {
  const program = new Command()
  const paths = envPaths(APP_NAME)
  const onCleanup = gracefulCloser()

  program.name(APP_NAME).description('Headless CoMapeo instance')

  program
    .command('start')
    .description(
      'Start the instance. Automatically accepts invites and starts sync for all projects.',
    )
    .option('-n, --name <name>', 'Instance name', 'CoMapeo CLI')
    .action(async ({ name }) => {
      const debug = console.log.bind(console)
      const mapeoManager = await createMapeoManager({
        name,
        dataPath: paths.data,
        debug,
      })
      await enableSyncForAllProjects({ mapeoManager, debug })
      autoAcceptAllInvites({ mapeoManager, onCleanup, debug })
      await startLocalDiscovery({ mapeoManager, onCleanup, debug })
    })

  program
    .command('list-projects')
    .description('List all projects for this instance.')
    .action(async () => {
      const mapeoManager = await createMapeoManager({
        dataPath: paths.data,
        debug: noop,
      })
      const projects = await mapeoManager.listProjects()
      for (const project of projects) {
        console.log(project.projectId, project.name)
      }
    })

  program
    .command('import-legacy-mapeo-data')
    .description('Import legacy Mapeo data.')
    // TODO
    // .requiredOption(
    //   '-m, --mlef-path <mlefPath>',
    //   'Path of .mlef file to import',
    // )
    .requiredOption('-p, --project-id <projectId>', 'Project ID to import to')
    .action(async ({ projectId }) => {
      const debug = console.log.bind(console)
      const mapeoManager = await createMapeoManager({
        dataPath: paths.data,
        debug,
      })
      const project = await mapeoManager.getProject(projectId)
      // TODO: Actually read legacy data
      await project.observation.create({
        schemaName: 'observation',
        lat: 42,
        lon: -87,
        attachments: [],
        tags: {},
      })
    })

  program.parse()
}

main()
