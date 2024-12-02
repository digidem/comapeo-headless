/** @import { MapeoManager } from '@comapeo/core' */

/**
 * @param {object} options
 * @param {MapeoManager} options.mapeoManager
 * @param {(message: string) => unknown} options.debug
 * @returns {Promise<void>}
 */
export async function enableSyncForAllProjects({ mapeoManager, debug }) {
  const projects = await mapeoManager.listProjects()
  await Promise.all(
    projects.map(async ({ projectId }) => {
      const project = await mapeoManager.getProject(projectId)
      project.$sync.start()
    }),
  )

  switch (projects.length) {
    case 0:
      break
    case 1:
      debug('Enabled sync for 1 existing project.')
      break
    default:
      debug(`Enabled sync for ${projects.length} existing projects.`)
      break
  }
}
