import { useEffect, useState } from 'react'
import { Sheet } from '../ui'
import { IconChevronLeft, IconCheck } from '../ui/Icons'
import { haptic } from '../../lib/haptics'
import { verifyPasscode } from '../../lib/passcode'

type Mode = 'set' | 'verify'
const MIN = 4, MAX = 6

/**
 * Keypad sheet. `set` asks for a 4–6 digit code twice; `verify` checks against the stored hash.
 * Calls onDone(code) only on success.
 */
export function PasscodeSheet({ open, onClose, mode, onDone }: { open: boolean; onClose: () => void; mode: Mode; onDone: (code: string) => void | Promise<void> }) {
  const [code, setCode] = useState('')
  const [first, setFirst] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) { setCode(''); setFirst(null); setError(null); setBusy(false) } }, [open, mode])

  const fail = (msg: string) => { setError(msg); setShake(s => s + 1); haptic.warn(); setCode('') }

  const submit = async () => {
    if (code.length < MIN || busy) return
    if (mode === 'set') {
      if (first == null) { setFirst(code); setCode(''); setError(null); haptic.tap(); return }
      if (first !== code) { setFirst(null); fail('Codes didn’t match. Start again.'); return }
      setBusy(true); await onDone(code); return
    }
    setBusy(true)
    const ok = await verifyPasscode(code)
    setBusy(false)
    if (!ok) { fail('Wrong code.'); return }
    haptic.success()
    await onDone(code)
  }

  const press = (d: string) => {
    if (code.length >= MAX) return
    haptic.tap(); setError(null)
    setCode(c => c + d)
  }

  const title = mode === 'verify' ? 'Enter your passcode' : first == null ? 'Choose a passcode' : 'Repeat the passcode'
  const hint = mode === 'verify' ? 'Required to turn the lock off.' : '4 to 6 digits. There is no recovery – if you forget it, you lose access to your photos.'

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="body" style={{ marginBottom: 18 }}>{hint}</p>
      <div key={shake} className={`row ${shake ? 'shake' : ''}`} style={{ justifyContent: 'center', gap: 14, minHeight: 28, marginBottom: 6 }} aria-label={`${code.length} digits entered`}>
        {Array.from({ length: MAX }).map((_, i) => (
          <span key={i} style={{
            width: 14, height: 14, borderRadius: '50%', transition: 'all 0.15s var(--ease-spring)',
            background: i < code.length ? 'var(--accent)' : 'transparent',
            border: `2px solid ${i < code.length ? 'var(--accent)' : i < MIN ? 'var(--line-strong)' : 'var(--line)'}`,
            transform: i < code.length ? 'scale(1.15)' : 'none', boxShadow: i < code.length ? '0 0 10px var(--accent-soft)' : 'none',
          }} />
        ))}
      </div>
      <div className="small center" style={{ minHeight: 20, color: error ? 'var(--bad)' : undefined }}>{error ?? (code.length >= MIN ? 'Tap ✓ to continue' : ' ')}</div>
      <div className="grid-3" style={{ marginTop: 14, gap: 10 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => <Key key={d} label={d} onClick={() => press(d)} />)}
        <Key label={<IconChevronLeft size={24} />} subtle onClick={() => { haptic.tap(); setCode(c => c.slice(0, -1)) }} aria="Delete" />
        <Key label="0" onClick={() => press('0')} />
        <Key label={<IconCheck size={24} />} accent disabled={code.length < MIN || busy} onClick={submit} aria="Confirm" />
      </div>
    </Sheet>
  )
}

function Key({ label, onClick, subtle, accent, disabled, aria }: { label: React.ReactNode; onClick: () => void; subtle?: boolean; accent?: boolean; disabled?: boolean; aria?: string }) {
  return (
    <button className="btn" aria-label={aria} disabled={disabled} onClick={onClick}
      style={{ minHeight: 60, fontSize: 24, fontWeight: 800, borderRadius: 16, background: accent ? 'var(--grad-glutes)' : subtle ? 'transparent' : 'var(--surface-2)', color: accent ? '#fff' : undefined }}>
      {label}
    </button>
  )
}
