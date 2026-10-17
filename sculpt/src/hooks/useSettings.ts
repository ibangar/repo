import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { DEFAULT_SETTINGS } from '../db/defaults'
import { DEFAULT_PROGRAM } from '../data/program'
import type { Program, Settings } from '../db/types'
import { updateSettings } from '../db/repo'

/** Live settings (merged over defaults). `undefined` while loading. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => {
    const s = await db.settings.get('settings')
    return s ? { ...DEFAULT_SETTINGS, ...s, increments: { ...DEFAULT_SETTINGS.increments, ...s.increments } } : DEFAULT_SETTINGS
  }, [])
}

export function useProgram(): Program | undefined {
  return useLiveQuery(async () => (await db.program.get('program')) ?? DEFAULT_PROGRAM, [])
}

export { updateSettings }
