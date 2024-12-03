import assert from 'node:assert/strict'
import test from 'node:test'
import { getErrorCode } from '../../src/lib/getErrorCode.js'

test('returns null when no string error code is found', () => {
  assert.equal(getErrorCode(123), null)
  assert.equal(getErrorCode({ code: 123 }), null)
})

test("returns error codes when they're own properties", () => {
  assert.equal(getErrorCode({ code: 'foo' }), 'foo')
})

test("returns error codes when they're inherited properties", () => {
  class Klass {
    get code() {
      return 'foo'
    }
  }
  assert.equal(getErrorCode(new Klass()), 'foo')
})
