/**
 * @returns {(fn: () => unknown) => void}
 */
export function gracefulCloser() {
  /** @type {Array<() => unknown>} */ const fns = []

  const onSignal = async () => {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)

    await Promise.allSettled(fns.map((fn) => fn()))

    process.exit(0)
  }

  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)

  return fns.push.bind(fns)
}
