import { Bonjour } from 'bonjour-service'
import { MapeoManager } from '@comapeo/core'
import process from 'node:process'
import * as path from 'node:path'
import { temporaryDirectory } from 'tempy'
import * as crypto from 'node:crypto'
import { isIPv4 } from 'node:net'
import Fastify from 'fastify'
/** @import { Service } from 'bonjour-service' */

// TODO: organize imports

const BONJOUR_SERVICE_TYPE = 'comapeo'

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

  // TODO: Set device info

  const { name, port } = await mapeoManager.startLocalPeerDiscoveryServer()
  beforeExit(() => {
    console.log('Stopping local peer discovery server...')
    return mapeoManager.stopLocalPeerDiscoveryServer()
  })
  console.log(
    `Started local peer discovery server on port ${port} with name ${name}.`,
  )

  const bonjour = new Bonjour()

  const publishedService = bonjour.publish({
    type: BONJOUR_SERVICE_TYPE,
    name,
    port,
  })
  beforeExit(() => {
    console.log('Stopping Bonjour service...')
    return publishedService.stop?.()
  })
  console.log(`Published Bonjour service with name ${name}.`)

  const browser = bonjour.find({ type: BONJOUR_SERVICE_TYPE }, (service) => {
    if (service.name === name) return
    console.log(
      `Found peer named ${JSON.stringify(service.name)} on port ${service.port} with address(es) ${JSON.stringify(service.addresses)}.`,
    )
    const peer = bonjourServiceToMapeoPeer(service)
    if (peer) {
      mapeoManager.connectLocalPeer(peer)
      console.log(`Connected peer ${JSON.stringify(service.name)}.`)
    } else {
      console.log(
        `Peer ${JSON.stringify(service.name)} could not be converted to a Mapeo peer; ignoring.`,
      )
    }
  })
  beforeExit(() => {
    console.log('Stopping Bonjour browser...')
    return browser.stop()
  })
  console.log('Started Bonjour browser.')
}

/**
 * @returns {(fn: () => unknown) => void}
 */
function gracefulCloser() {
  /** @type {Array<() => unknown>} */ const fns = []

  const onSignal = async () => {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)

    await Promise.allSettled(fns.map((fn) => fn()))

    process.exit(0)
  }

  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)

  return fns.push.bind(fns)
}

/**
 * @param {Readonly<Service>} service
 * @returns {null | Parameters<typeof MapeoManager.prototype.connectLocalPeer>[0]}
 */
function bonjourServiceToMapeoPeer({ name, port, addresses = [] }) {
  // Prefer IPv4 addresses.
  const address = addresses.find(isIPv4) || addresses[0]
  if (!address) return null
  return { name, port, address }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
