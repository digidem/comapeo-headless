/** @import { MapeoManager } from '@comapeo/core' */

/**
 * @internal
 * @typedef {any} Invite
 */

/**
 * @param {MapeoManager} mapeoManager
 * @param {(fn: () => unknown) => unknown} onCleanup
 * @returns {void}
 */
export function autoAcceptAllInvites(mapeoManager, onCleanup) {
  /**
   * @param {Invite} invite
   * @returns {void}
   */
  const onInviteReceived = (invite) => {
    mapeoManager.invite.accept(invite)
  }

  mapeoManager.invite.on('invite-received', onInviteReceived)
  onCleanup(() => {
    mapeoManager.invite.off('invite-received', onInviteReceived)
  })

  console.log('Auto-accepting all invites.')
}
