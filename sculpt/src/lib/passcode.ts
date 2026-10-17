// ─────────────────────────────────────────────────────────────────────────────
// Passcode helpers – canonical version (photos/lock module). Shared with Settings.
//
//   await setPasscode('1234')    hashes `salt + code` with SHA-256 and stores
//                                `salt:hex` in settings.passcodeHash, enables the
//                                lock (lockEnabled: true) and remembers the code
//                                length in localStorage (for keypad auto-submit –
//                                the length is NOT secret, the code never is).
//   await verifyPasscode('1234') → true when the code matches the stored hash.
//   await clearPasscode()        removes the hash and disables the lock.
//   lockNow()                    locks the app immediately (LockGate re-renders).
//   useLock()                    → { locked, lockNow, unlock } for "Lock now" buttons.
//   getPasscodeLength()          4–6, or null when unknown (manual submit).
//   isValidPasscode(code)        4–6 digits.
//
// Lock session state lives in sessionStorage so a cold start is always locked
// and the app re-locks after being hidden for > 60 s (see screens/Lock.tsx).
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react'
import { getSettings, updateSettings } from '../db/repo'

export const PASSCODE_MIN = 4
export const PASSCODE_MAX = 6
export const RELOCK_AFTER_MS = 60_000

const LEN_KEY = 'sculpt.passcodeLength'
const UNLOCKED_KEY = 'sculpt.lock.unlocked'
const HIDDEN_AT_KEY = 'sculpt.lockedAt'

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')

async function sha256Hex(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure hashing is unavailable in this context')
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

export function isValidPasscode(code: string): boolean {
  return /^\d+$/.test(code) && code.length >= PASSCODE_MIN && code.length <= PASSCODE_MAX
}

/** `salt:hex` */
export async function hashPasscode(code: string, salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer)): Promise<string> {
  return `${salt}:${await sha256Hex(salt + code)}`
}

export async function verifyAgainst(code: string, stored: string | undefined): Promise<boolean> {
  if (!stored) return false
  const [salt, hex] = stored.split(':')
  if (!salt || !hex) return false
  try { return (await sha256Hex(salt + code)) === hex } catch { return false }
}

export async function setPasscode(code: string): Promise<void> {
  if (!isValidPasscode(code)) throw new Error(`Passcode must be ${PASSCODE_MIN}–${PASSCODE_MAX} digits`)
  const passcodeHash = await hashPasscode(code)
  try { localStorage.setItem(LEN_KEY, String(code.length)) } catch { /* ignore */ }
  await updateSettings({ passcodeHash, lockEnabled: true })
  unlock() // the owner just set it – don't lock them out of the screen they're on
}

export async function verifyPasscode(code: string): Promise<boolean> {
  const s = await getSettings()
  return verifyAgainst(code, s.passcodeHash)
}

export async function clearPasscode(): Promise<void> {
  try { localStorage.removeItem(LEN_KEY) } catch { /* ignore */ }
  await updateSettings({ passcodeHash: undefined, lockEnabled: false })
  unlock()
}

export function getPasscodeLength(): number | null {
  try {
    const n = Number(localStorage.getItem(LEN_KEY))
    return n >= PASSCODE_MIN && n <= PASSCODE_MAX ? n : null
  } catch { return null }
}

// ── Session lock state (tiny external store) ────────────────────────────────
const ss = {
  get: (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v) } catch { /* ignore */ } },
  del: (k: string) => { try { sessionStorage.removeItem(k) } catch { /* ignore */ } },
}

let locked = ss.get(UNLOCKED_KEY) !== '1' // cold start ⇒ locked
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export function isLocked() { return locked }
export function lockNow() { locked = true; ss.del(UNLOCKED_KEY); emit() }
export function unlock() { locked = false; ss.set(UNLOCKED_KEY, '1'); ss.del(HIDDEN_AT_KEY); emit() }

/** Called by LockGate on visibilitychange. */
export function noteHidden() { ss.set(HIDDEN_AT_KEY, String(Date.now())) }
export function noteVisible() {
  const at = Number(ss.get(HIDDEN_AT_KEY))
  ss.del(HIDDEN_AT_KEY)
  if (at && Date.now() - at > RELOCK_AFTER_MS) lockNow()
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }

/** `{ locked, lockNow, unlock }` – `locked` is the raw session state (ignores lockEnabled). */
export function useLock() {
  const isLockedNow = useSyncExternalStore(subscribe, isLocked, isLocked)
  return { locked: isLockedNow, lockNow, unlock }
}
