import Fastify from 'fastify'
import { MapeoManager } from '@comapeo/core'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import * as crypto from 'node:crypto'
import { getErrorCode } from '../lib/getErrorCode.js'

/**
 * @param {object} options
 * @param {string} options.name
 * @param {string} options.dataPath
 * @returns {Promise<MapeoManager>}
 */
export async function createMapeoManager({ name, dataPath }) {
  const migrationsDir = new URL(
    '../../node_modules/@comapeo/core/drizzle',
    import.meta.url,
  ).pathname

  const rootKeyPromise = getRootKey(dataPath)

  const dbFolder = path.join(dataPath, 'db')
  const coreStorage = path.join(dataPath, 'corestorage')
  await Promise.all([mkdirp(dbFolder), mkdirp(coreStorage)])

  const result = new MapeoManager({
    rootKey: await rootKeyPromise,
    projectMigrationsFolder: path.join(migrationsDir, 'project'),
    clientMigrationsFolder: path.join(migrationsDir, 'client'),
    dbFolder,
    coreStorage,
    fastify: Fastify(),
  })

  await result.setDeviceInfo({ name, deviceType: 'desktop' })

  console.log(`Created manager with device ID ${result.deviceId}.`)

  return result
}

/**
 * @param {string} dataPath
 * @returns {Promise<Buffer>}
 */
async function getRootKey(dataPath) {
  const rootKeyPath = path.join(dataPath, 'root-key')

  try {
    return await fs.readFile(rootKeyPath)
  } catch (err) {
    if (getErrorCode(err) !== 'ENOENT') throw err
  }

  await mkdirp(dataPath)

  const result = crypto.randomBytes(16)
  await fs.writeFile(rootKeyPath, result)
  return result
}

/**
 * @param {string} path
 * @returns {Promise<void>}
 */
const mkdirp = async (path) => {
  await fs.mkdir(path, { recursive: true, mode: 0o700 })
}
