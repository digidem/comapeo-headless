import { Bonjour } from 'bonjour-service'
import { isIPv4 } from 'node:net'
/** @import { MapeoManager } from '@comapeo/core' */
/** @import { Service } from 'bonjour-service' */

const BONJOUR_SERVICE_TYPE = 'comapeo'

/**
 * @param {MapeoManager} mapeoManager
 * @param {(fn: () => unknown) => unknown} onCleanup
 * @returns {Promise<void>}
 */
export async function startLocalDiscovery(mapeoManager, onCleanup) {
  const { name, port } = await mapeoManager.startLocalPeerDiscoveryServer()
  onCleanup(() => {
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
  onCleanup(() => {
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
  onCleanup(() => {
    console.log('Stopping Bonjour browser...')
    return browser.stop()
  })
  console.log('Started Bonjour browser.')
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
