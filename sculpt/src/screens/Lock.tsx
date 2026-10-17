import type { ReactNode } from 'react'
import type { Settings } from '../db/types'

/**
 * Passcode gate. Implemented by the photos module (screens/photos/LockScreen).
 * This stub passes everything through until that module lands.
 */
export function LockGate({ children }: { settings: Settings; children: ReactNode }) {
  return <>{children}</>
}
