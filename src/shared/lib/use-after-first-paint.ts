import { useEffect, useState } from 'react'

/**
 * `false` on the first render, `true` once the browser has painted and is idle (at most
 * `timeout` ms later). For content below the fold that every page carries, such as the footer:
 * rendering it in its own task keeps the first render, and its layout, shorter.
 */
export function useAfterFirstPaint(timeout = 1000): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => setReady(true), { timeout })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(() => setReady(true), 50)
    return () => window.clearTimeout(id)
  }, [timeout])
  return ready
}
