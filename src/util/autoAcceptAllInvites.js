/** @import { MapeoManager } from '@comapeo/core' */

/**
 * @internal
 * @typedef {any} Invite
 */

/**
 * @param {object} options
 * @param {MapeoManager} options.mapeoManager
 * @param {(fn: () => unknown) => unknown} options.onCleanup
 * @param {(message: string) => unknown} options.debug
 * @returns {void}
 */
export function autoAcceptAllInvites({ mapeoManager, onCleanup, debug }) {
  /**
   * @param {Invite} invite
   * @returns {Promise<void>}
   */
  const onInviteReceived = async (invite) => {
    debug(
      `Received invite ${invite.inviteId} for project ${JSON.stringify(invite.projectName)}.`,
    )
    const projectId = await mapeoManager.invite.accept(invite)
    const project = await mapeoManager.getProject(projectId)
    project.$sync.start()
    debug(
      `Accepted invite ${invite.inviteId} for project ${JSON.stringify(invite.projectName)}.`,
    )
  }

  mapeoManager.invite.on('invite-received', onInviteReceived)
  onCleanup(() => {
    mapeoManager.invite.off('invite-received', onInviteReceived)
  })

  debug('Auto-accepting all invites.')
}
