import assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import test from 'node:test'
import { temporaryDirectory } from 'tempy'
import { noop } from '../../src/lib/noop.js'
import { createMapeoManager } from '../../src/util/createMapeoManager.js'

test("creates a new MapeoManager if the data path doesn't exist yet", async (t) => {
  const parentPath = temporaryDirectory()
  t.after(() => fs.rm(parentPath, { force: true, recursive: true }))
  const dataPath = path.join(parentPath, 'test_data_path')

  assert(!(await fsExists(dataPath)), 'test setup: data path should not exist')

  const result = await createMapeoManager({
    name: 'foo bar',
    dataPath,
    debug: noop,
  })

  assert.equal(result.getDeviceInfo().name, 'foo bar')

  assert(await fsExists(dataPath), 'data path now exists')
})

test('persists data on disk', async (t) => {
  const dataPath = temporaryDirectory()
  t.after(() => fs.rm(dataPath, { force: true, recursive: true }))

  const original = await createMapeoManager({
    name: 'foo bar',
    dataPath,
    debug: noop,
  })
  assert.equal(
    original.getDeviceInfo().name,
    'foo bar',
    'test setup: manager is named',
  )

  const copy = await createMapeoManager({ dataPath, debug: noop })
  assert.equal(copy.getDeviceInfo().name, 'foo bar', 'manager name survives')
})

/**
 * @param {string} path
 * @returns {Promise<boolean>}
 */
async function fsExists(path) {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}
