import { Bonjour } from 'bonjour-service'
import { MapeoManager } from '@comapeo/core'
import process from 'node:process'
import * as path from 'node:path'
import { temporaryDirectory } from 'tempy'
import * as crypto from 'node:crypto'
import Fastify from 'fastify'

// TODO: organize imports

const BONJOUR_SERVICE_TYPE = 'comapeo'

/**
 * @returns {(fn: () => unknown) => void}
 */
function gracefulCloser() {
  /** @type {Array<() => unknown>} */ const fns = []

  /**
   * @param {NodeJS.Signals} signal
   * @returns {Promise<void>}
   */
  const onSignal = async (signal) => {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)

    await Promise.allSettled(fns.map((fn) => fn()))

    process.kill(process.pid, signal)
  }

  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)

  return fns.push.bind(fns)
}

async function main() {
  const beforeExit = gracefulCloser()

  const migrationsDir = new URL(
    '../node_modules/@comapeo/core/drizzle',
    import.meta.url,
  ).pathname

  const mapeoManager = new MapeoManager({
    rootKey: crypto.randomBytes(16), // TODO: Save/load this value
    projectMigrationsFolder: path.join(migrationsDir, 'project'),
    clientMigrationsFolder: path.join(migrationsDir, 'client'),
    dbFolder: temporaryDirectory(), // TODO: Use a real value
    coreStorage: temporaryDirectory(), // TODO: Use a real value
    fastify: Fastify(),
  })
  console.log(`Created manager with device ID ${mapeoManager.deviceId}.`)

  const { name, port } = await mapeoManager.startLocalPeerDiscoveryServer()
  beforeExit(() => mapeoManager.stopLocalPeerDiscoveryServer())
  console.log(
    `Started local peer discovery server on port ${port} with name ${name}.`,
  )

  const bonjour = new Bonjour()

  const publishedService = bonjour.publish({
    type: BONJOUR_SERVICE_TYPE,
    name,
    port,
  })
  beforeExit(() => publishedService.stop?.())
  console.log(`Published Bonjour service with name ${name}.`)

  const browser = bonjour.find({ type: BONJOUR_SERVICE_TYPE }, (service) => {
    if (service.name === name) return
    // TODO: Do something with this
    console.log('Found a peer:', service)
  })
  beforeExit(() => browser.stop())
  console.log('Started Bonjour browser.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
