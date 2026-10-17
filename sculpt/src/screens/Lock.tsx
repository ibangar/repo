import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import type { Settings } from '../db/types'
import { IconLock } from '../components/ui/Icons'
import { Keypad } from '../components/photos/Keypad'
import { haptic } from '../lib/haptics'
import { getPasscodeLength, noteHidden, noteVisible, PASSCODE_MAX, PASSCODE_MIN, unlock, useLock, verifyAgainst } from '../lib/passcode'
import '../components/photos/photos.css'

export { useLock, lockNow } from '../lib/passcode'

/**
 * Passcode gate. App.tsx wraps the whole shell in it. When `lockEnabled` and a
 * passcode hash exist, the app is locked on cold start and after being hidden
 * for > 60 s; while locked NOTHING else renders. Settings can call `lockNow()`
 * (also exposed via `useLock()`).
 */
export function LockGate({ settings, children }: { settings: Settings; children: ReactNode }) {
  const { locked } = useLock()
  const gated = settings.lockEnabled && !!settings.passcodeHash

  // Lock disabled → keep the session marked unlocked so enabling it later doesn't lock the owner out mid-flow.
  useEffect(() => { if (!gated) unlock() }, [gated])

  useEffect(() => {
    if (!gated) return
    const onVis = () => { if (document.visibilityState === 'hidden') noteHidden(); else noteVisible() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', noteHidden)
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', noteHidden) }
  }, [gated])

  if (gated && locked) return <LockScreen hash={settings.passcodeHash!} />
  return <>{children}</>
}

function LockScreen({ hash }: { hash: string }) {
  const expected = getPasscodeLength()
  const [code, setCode] = useState('')
  const [bad, setBad] = useState(false)
  const [busy, setBusy] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const dots = expected ?? Math.max(PASSCODE_MIN, code.length)

  const submit = useCallback(async (c: string) => {
    if (busy || c.length < PASSCODE_MIN) return
    setBusy(true)
    const ok = await verifyAgainst(c, hash)
    if (ok) { haptic.success(); unlock(); return }
    haptic.warn()
    setBad(true); setAttempts(a => a + 1)
    setTimeout(() => { setBad(false); setCode(''); setBusy(false) }, 450)
  }, [busy, hash])

  const onDigit = (d: string) => {
    if (bad || busy) return
    const max = expected ?? PASSCODE_MAX
    if (code.length >= max) return
    const next = code + d
    setCode(next)
    if (expected && next.length === expected) void submit(next)
  }

  return (
    <div className="lock" role="dialog" aria-modal="true" aria-label="Locked">
      <motion.div className="lock__mark" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
        <IconLock />
      </motion.div>
      <div className="stack center" style={{ gap: 6, alignItems: 'center' }}>
        <div className="eyebrow">Sculpt</div>
        <h1 className="title-lg">Enter passcode</h1>
        <div className="lock__hint">{attempts > 0 && !bad ? 'Wrong passcode – try again' : 'Your photos stay hidden until you unlock'}</div>
      </div>
      <motion.div className={`lock__dots ${bad ? 'lock__dots--bad' : ''}`} animate={bad ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }} transition={{ duration: 0.45 }} aria-label={`${code.length} of ${dots} digits`}>
        {Array.from({ length: dots }, (_, i) => <span key={i} className={`lock__dot ${i < code.length ? 'lock__dot--on' : ''}`} />)}
      </motion.div>
      <Keypad onDigit={onDigit} onDelete={() => setCode(c => c.slice(0, -1))} onSubmit={() => void submit(code)} showSubmit={!expected} disabled={busy} />
    </div>
  )
}
