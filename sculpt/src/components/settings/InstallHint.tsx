import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Button, Card } from '../ui'
import { IconX } from '../ui/Icons'

interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

// Capture the Chromium install prompt as early as this module loads.
let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e as BeforeInstallPromptEvent; listeners.forEach(l => l()) })
  window.addEventListener('appinstalled', () => { deferredPrompt = null; listeners.forEach(l => l()) })
}

const DISMISS_KEY = 'sculpt.installHintDismissed'

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}
const isIOS = () => typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/** Shown at the top of Settings when the app runs in a browser tab instead of from the Home Screen. */
export function InstallHint() {
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false } })
  const [, bump] = useState(0)
  useEffect(() => { const l = () => bump(n => n + 1); listeners.add(l); return () => { listeners.delete(l) } }, [])
  if (isStandalone()) return null
  const ios = isIOS()
  const dismiss = () => { setDismissed(true); try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ } }
  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') deferredPrompt = null
    bump(n => n + 1)
  }
  return (
    <AnimatePresence initial={false}>
      {!dismissed && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginBottom: 0 }} style={{ marginBottom: 16, overflow: 'hidden' }}>
          <Card glow upper>
            <div className="row-between" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <div className="eyebrow" style={{ color: 'var(--accent-2)' }}>Install Sculpt</div>
                <div className="subtitle mt-8">Add it to your Home Screen</div>
                {ios ? (
                  <p className="body mt-8">Tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>. You get a full-screen app, the lock screen and offline access.</p>
                ) : (
                  <p className="body mt-8">Runs full-screen, works offline and keeps your data from being cleared with browser history.</p>
                )}
                {!ios && (
                  deferredPrompt
                    ? <Button variant="upper" className="mt-16" onClick={install}>Install app</Button>
                    : <p className="small mt-8">Use your browser menu → <b>Install app</b> / <b>Add to Home screen</b>.</p>
                )}
              </div>
              <button aria-label="Dismiss" onClick={dismiss} style={{ color: 'var(--muted)', minWidth: 36, minHeight: 36, display: 'grid', placeItems: 'center' }}><IconX size={20} /></button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
