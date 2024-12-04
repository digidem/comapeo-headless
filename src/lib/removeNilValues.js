/**
 * @template T
 * @template {keyof T} [K=keyof T]
 * @typedef {{ [K in keyof T]: NonNullable<T[K]> }} NonNullableValues
 */

/**
 * @template {object} T
 * @param {T} obj
 * @returns {NonNullableValues<T>}
 */
export function removeNilValues(obj) {
  /** @type {Record<string, unknown>} */
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value != null) result[key] = value
  }
  return /** @type {NonNullableValues<T>} */ (result)
}
