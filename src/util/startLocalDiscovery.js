import { Bonjour } from 'bonjour-service'
import { isIPv4 } from 'node:net'
/** @import { MapeoManager } from '@comapeo/core' */
/** @import { Service } from 'bonjour-service' */

const BONJOUR_SERVICE_TYPE = 'comapeo'

/**
 * @param {object} options
 * @param {MapeoManager} options.mapeoManager
 * @param {(fn: () => unknown) => unknown} options.onCleanup
 * @param {(message: string) => unknown} options.debug
 * @returns {Promise<void>}
 */
export async function startLocalDiscovery({ mapeoManager, onCleanup, debug }) {
  const { name, port } = await mapeoManager.startLocalPeerDiscoveryServer()
  onCleanup(() => {
    debug('Stopping local peer discovery server...')
    return mapeoManager.stopLocalPeerDiscoveryServer()
  })
  debug(
    `Started local peer discovery server on port ${port} with name ${name}.`,
  )

  const bonjour = new Bonjour()

  const publishedService = bonjour.publish({
    type: BONJOUR_SERVICE_TYPE,
    name,
    port,
  })
  onCleanup(() => {
    debug('Stopping Bonjour service...')
    return publishedService.stop?.()
  })
  debug(`Published Bonjour service with name ${name}.`)

  const browser = bonjour.find({ type: BONJOUR_SERVICE_TYPE }, (service) => {
    if (service.name === name) return
    debug(
      `Found peer named ${JSON.stringify(service.name)} on port ${service.port} with address(es) ${JSON.stringify(service.addresses)}.`,
    )
    const peer = bonjourServiceToMapeoPeer(service)
    if (peer) {
      mapeoManager.connectLocalPeer(peer)
      debug(`Connected peer ${JSON.stringify(service.name)}.`)
    } else {
      debug(
        `Peer ${JSON.stringify(service.name)} could not be converted to a Mapeo peer; ignoring.`,
      )
    }
  })
  onCleanup(() => {
    debug('Stopping Bonjour browser...')
    return browser.stop()
  })
  debug('Started Bonjour browser.')
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
