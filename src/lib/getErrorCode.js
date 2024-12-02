/**
 * @param {unknown} err
 * @returns {null | string}
 */
export const getErrorCode = (err) =>
  err &&
  typeof err === 'object' &&
  'code' in err &&
  typeof err.code === 'string'
    ? err.code
    : null
