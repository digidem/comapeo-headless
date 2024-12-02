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
   * @returns {Promise<void>}
   */
  const onInviteReceived = async (invite) => {
    console.log(
      `Received invite ${invite.inviteId} for project ${JSON.stringify(invite.projectName)}.`,
    )
    const projectId = await mapeoManager.invite.accept(invite)
    const project = await mapeoManager.getProject(projectId)
    project.$sync.start()
    console.log(
      `Accepted invite ${invite.inviteId} for project ${JSON.stringify(invite.projectName)}.`,
    )
  }

  mapeoManager.invite.on('invite-received', onInviteReceived)
  onCleanup(() => {
    mapeoManager.invite.off('invite-received', onInviteReceived)
  })

  console.log('Auto-accepting all invites.')
}
