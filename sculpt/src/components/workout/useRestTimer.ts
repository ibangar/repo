import { useCallback, useEffect, useRef, useState } from 'react'
import { haptic } from '../../lib/haptics'
import { sound } from '../../lib/sound'

interface RestState { endAt: number; total: number }

export interface RestTimer {
  active: boolean
  /** Seconds left (computed from the stored end timestamp, never counted down). */
  remaining: number
  total: number
  finished: boolean
  start: (sec: number) => void
  adjust: (deltaSec: number) => void
  skip: () => void
}

function read(key?: string): RestState | null {
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const s = JSON.parse(raw) as RestState
    // Ignore stale timers (finished more than a minute ago).
    if (!s || typeof s.endAt !== 'number' || s.endAt < Date.now() - 60_000) { localStorage.removeItem(key); return null }
    return s
  } catch { return null }
}
function write(key: string | undefined, s: RestState | null) {
  if (!key) return
  try { if (s) localStorage.setItem(key, JSON.stringify(s)); else localStorage.removeItem(key) } catch { /* ignore */ }
}

/**
 * Rest timer that survives screen lock: stores the end timestamp and derives the
 * remaining time from Date.now() on every tick / visibilitychange.
 */
export function useRestTimer(storageKey?: string): RestTimer {
  const [st, setSt] = useState<RestState | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [finished, setFinished] = useState(false)
  const firedRef = useRef(false)
  const keyRef = useRef(storageKey)

  // (Re)load when the storage key becomes available.
  useEffect(() => {
    keyRef.current = storageKey
    const restored = read(storageKey)
    if (restored) { firedRef.current = false; setSt(restored); setNow(Date.now()) }
  }, [storageKey])

  useEffect(() => { write(keyRef.current, st) }, [st])

  useEffect(() => {
    if (!st) return
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick) }
  }, [st])

  const remaining = st ? Math.max(0, Math.ceil((st.endAt - now) / 1000)) : 0

  useEffect(() => {
    if (!st) { firedRef.current = false; return }
    if (remaining > 0 || firedRef.current) return
    firedRef.current = true
    sound.restDone()
    haptic.done()
    setFinished(true)
    const t = setTimeout(() => { setSt(null); setFinished(false) }, 3200)
    return () => clearTimeout(t)
  }, [remaining, st])

  const start = useCallback((sec: number) => {
    firedRef.current = false
    setFinished(false)
    setSt({ endAt: Date.now() + Math.max(1, sec) * 1000, total: Math.max(1, sec) })
  }, [])

  const adjust = useCallback((d: number) => {
    if (!st) return
    firedRef.current = false
    setFinished(false)
    const endAt = Math.max(Date.now() + 1000, st.endAt + d * 1000)
    setSt({ endAt, total: Math.max(1, Math.round((endAt - (st.endAt - st.total * 1000)) / 1000)) })
    setNow(Date.now())
  }, [st])

  const skip = useCallback(() => { setSt(null); setFinished(false); firedRef.current = false }, [])

  return { active: !!st, remaining, total: st?.total ?? 0, finished, start, adjust, skip }
}
