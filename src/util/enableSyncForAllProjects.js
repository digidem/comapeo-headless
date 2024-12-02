/** @import { MapeoManager } from '@comapeo/core' */

/**
 * @param {MapeoManager} mapeoManager
 * @returns {Promise<void>}
 */
export async function enableSyncForAllProjects(mapeoManager) {
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
      console.log('Enabled sync for 1 existing project.')
      break
    default:
      console.log(`Enabled sync for ${projects.length} existing projects.`)
      break
  }
}
