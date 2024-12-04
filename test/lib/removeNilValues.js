import assert from 'node:assert/strict'
import test from 'node:test'
import { removeNilValues } from '../../src/lib/removeNilValues.js'

test('removes undefined and null values from the top level of an object', () => {
  const obj = {
    regularProperty: 123,
    falsyButNotNil: false,
    und: undefined,
    nul: null,
    nested: { value: null },
  }
  assert.deepEqual(removeNilValues(obj), {
    regularProperty: 123,
    falsyButNotNil: false,
    nested: { value: null },
  })
})
