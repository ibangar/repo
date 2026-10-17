/**
 * Backup & restore. JSON carries every table except photo blobs (photo metadata
 * only). The ZIP adds `photos/<id>.jpg` + `photos/<id>.thumb.jpg` per photo.
 */
import JSZip from 'jszip'
import { db } from '../db/schema'
import type { BodyWeight, ExerciseState, Measurement, NutritionDay, PR, Photo, Program, Settings, WorkoutSession } from '../db/types'
import { isoDate } from '../engine/schedule'

export const BACKUP_SCHEMA = 1

export type PhotoMeta = Omit<Photo, 'blob' | 'thumb'> & { blobBytes?: number; thumbBytes?: number }

export interface BackupData {
  settings?: Settings
  program?: Program
  sessions: WorkoutSession[]
  exerciseStates: ExerciseState[]
  prs: PR[]
  bodyWeights: BodyWeight[]
  measurements: Measurement[]
  nutrition: NutritionDay[]
  photos: PhotoMeta[]
}

export interface Backup {
  app: 'sculpt'
  schema: number
  exportedAt: string
  data: BackupData
}

export type ImportMode = 'replace' | 'merge'

export interface ImportReport {
  mode: ImportMode
  settings: boolean
  program: boolean
  sessions: number
  exerciseStates: number
  prs: number
  bodyWeights: number
  measurements: number
  nutrition: number
  photos: number
  /** Photo records in the file that had no image data (JSON-only import). */
  photosSkipped: number
}

const stripPhoto = (p: Photo): PhotoMeta => {
  const { blob, thumb, ...meta } = p
  return { ...meta, blobBytes: blob?.size, thumbBytes: thumb?.size }
}

export async function exportJson(): Promise<Backup> {
  const [settings, program, sessions, exerciseStates, prs, bodyWeights, measurements, nutrition, photos] = await Promise.all([
    db.settings.get('settings'), db.program.get('program'), db.sessions.toArray(), db.exerciseStates.toArray(),
    db.prs.toArray(), db.bodyWeights.toArray(), db.measurements.toArray(), db.nutrition.toArray(), db.photos.toArray(),
  ])
  let prog: Program | undefined
  if (program) { const { id: _id, ...rest } = program; prog = rest }
  return {
    app: 'sculpt', schema: BACKUP_SCHEMA, exportedAt: new Date().toISOString(),
    data: { settings, program: prog, sessions, exerciseStates, prs, bodyWeights, measurements, nutrition, photos: photos.map(stripPhoto) },
  }
}

export async function exportZip(onProgress?: (pct: number) => void): Promise<Blob> {
  const backup = await exportJson()
  const zip = new JSZip()
  zip.file('data.json', JSON.stringify(backup), { compression: 'DEFLATE' })
  const folder = zip.folder('photos')!
  // Add blobs one record at a time so we never hold more than the cursor's row.
  await db.photos.each(p => {
    if (p.blob) folder.file(`${p.id}.jpg`, p.blob, { compression: 'STORE', binary: true })
    if (p.thumb) folder.file(`${p.id}.thumb.jpg`, p.thumb, { compression: 'STORE', binary: true })
  })
  return zip.generateAsync({ type: 'blob', streamFiles: true }, m => onProgress?.(m.percent))
}

export function backupFilename(ext: 'json' | 'zip'): string {
  return `sculpt-backup-${isoDate()}.${ext}`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url) }, 4000)
}

export function canShareFiles(): boolean {
  try {
    if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false
    return navigator.canShare({ files: [new File([new Blob(['x'])], 'probe.json', { type: 'application/json' })] })
  } catch { return false }
}

export async function shareBlob(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type || (filename.endsWith('.zip') ? 'application/zip' : 'application/json') })
  try {
    await navigator.share({ files: [file], title: 'Sculpt backup' })
    return true
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return false
    throw e
  }
}

/** Photos: count + total bytes of originals and thumbnails. */
export async function photoFootprint(): Promise<{ count: number; bytes: number }> {
  let count = 0, bytes = 0
  await db.photos.each(p => { count++; bytes += (p.blob?.size ?? 0) + (p.thumb?.size ?? 0) })
  return { count, bytes }
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0, v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${u[i]}`
}

function assertBackup(x: unknown): asserts x is Backup {
  if (!x || typeof x !== 'object') throw new Error('Not a Sculpt backup (unreadable JSON).')
  const b = x as Partial<Backup>
  if (b.app !== 'sculpt') throw new Error('Not a Sculpt backup (missing app marker).')
  if (typeof b.schema !== 'number' || b.schema > BACKUP_SCHEMA) throw new Error(`Backup schema ${String(b.schema)} is newer than this app supports.`)
  if (!b.data || typeof b.data !== 'object') throw new Error('Backup has no data section.')
}

async function isZip(file: File): Promise<boolean> {
  if (/\.zip$/i.test(file.name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') return true
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  return head[0] === 0x50 && head[1] === 0x4b
}

/**
 * Import a `.json` or `.zip` backup. All zip reading happens BEFORE the Dexie
 * transaction (IndexedDB transactions auto-commit while awaiting non-IDB work).
 */
export async function importFile(file: File, mode: ImportMode, onProgress?: (msg: string) => void): Promise<ImportReport> {
  let backup: Backup
  const blobs = new Map<string, { blob?: Blob; thumb?: Blob }>()

  if (await isZip(file)) {
    onProgress?.('Opening archive…')
    const zip = await JSZip.loadAsync(file)
    const dataEntry = zip.file('data.json')
    if (!dataEntry) throw new Error('Archive has no data.json.')
    const parsed: unknown = JSON.parse(await dataEntry.async('string'))
    assertBackup(parsed)
    backup = parsed
    const entries = Object.values(zip.files).filter(f => !f.dir && f.name.startsWith('photos/'))
    let i = 0
    for (const entry of entries) {
      i++
      onProgress?.(`Reading photo ${i}/${entries.length}…`)
      const base = entry.name.slice('photos/'.length)
      const thumbMatch = /^(.+)\.thumb\.jpe?g$/i.exec(base)
      const fullMatch = /^(.+)\.jpe?g$/i.exec(base)
      const blob = await entry.async('blob')
      const typed = new Blob([blob], { type: 'image/jpeg' })
      if (thumbMatch) {
        const rec = blobs.get(thumbMatch[1]) ?? {}; rec.thumb = typed; blobs.set(thumbMatch[1], rec)
      } else if (fullMatch) {
        const rec = blobs.get(fullMatch[1]) ?? {}; rec.blob = typed; blobs.set(fullMatch[1], rec)
      }
    }
  } else {
    onProgress?.('Reading file…')
    const parsed: unknown = JSON.parse(await file.text())
    assertBackup(parsed)
    backup = parsed
  }

  const d = backup.data
  const arr = <T,>(v: T[] | undefined): T[] => Array.isArray(v) ? v : []
  const sessions = arr(d.sessions), exerciseStates = arr(d.exerciseStates), prs = arr(d.prs)
  const bodyWeights = arr(d.bodyWeights), measurements = arr(d.measurements), nutrition = arr(d.nutrition)
  const photoMetas = arr(d.photos)

  const photos: Photo[] = []
  let photosSkipped = 0
  for (const meta of photoMetas) {
    const b = blobs.get(meta.id)
    if (!b?.blob) { photosSkipped++; continue }
    const { blobBytes: _bb, thumbBytes: _tb, ...rest } = meta
    photos.push({ ...rest, blob: b.blob, thumb: b.thumb ?? b.blob })
  }

  onProgress?.('Writing to database…')
  const tables = [db.settings, db.program, db.sessions, db.exerciseStates, db.prs, db.bodyWeights, db.measurements, db.nutrition, db.photos]
  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') await Promise.all(tables.map(t => t.clear()))
    if (d.settings) await db.settings.put({ ...d.settings, id: 'settings' })
    if (d.program) { const { id: _id, ...p } = d.program as Program & { id?: string }; await db.program.put({ id: 'program', ...p }) }
    if (sessions.length) await db.sessions.bulkPut(sessions)
    if (exerciseStates.length) await db.exerciseStates.bulkPut(exerciseStates)
    if (prs.length) await db.prs.bulkPut(prs)
    if (bodyWeights.length) await db.bodyWeights.bulkPut(bodyWeights)
    if (measurements.length) await db.measurements.bulkPut(measurements)
    if (nutrition.length) await db.nutrition.bulkPut(nutrition)
    if (photos.length) await db.photos.bulkPut(photos)
  })

  return {
    mode, settings: !!d.settings, program: !!d.program,
    sessions: sessions.length, exerciseStates: exerciseStates.length, prs: prs.length, bodyWeights: bodyWeights.length,
    measurements: measurements.length, nutrition: nutrition.length, photos: photos.length, photosSkipped,
  }
}

export interface StorageInfo { usage: number; quota: number; persisted: boolean; supported: boolean }

export async function storageInfo(): Promise<StorageInfo> {
  const out: StorageInfo = { usage: 0, quota: 0, persisted: false, supported: false }
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate()
      out.usage = e.usage ?? 0; out.quota = e.quota ?? 0; out.supported = true
    }
    if (navigator.storage?.persisted) out.persisted = await navigator.storage.persisted()
  } catch { /* unsupported */ }
  return out
}

export async function requestPersistence(): Promise<boolean> {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : false } catch { return false }
}
