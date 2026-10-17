// ─────────────────────────────────────────────────────────────────────────────
// Progress-photo helpers. Photos live ONLY in IndexedDB (db.photos) as Blobs.
// Nothing here ever touches the network. Object URLs created by the hooks below
// are revoked automatically on cleanup.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import type { Photo, Pose } from '../db/types'
import { uid } from './ids'
import { isoDate, parseIso } from '../engine/schedule'

export const POSES: Pose[] = ['front', 'side', 'back']
export const POSE_LABEL: Record<Pose, string> = { front: 'Front', side: 'Side', back: 'Back' }
export const isPose = (v: unknown): v is Pose => v === 'front' || v === 'side' || v === 'back'

/** Long side of the stored photo / thumbnail, in px. */
export const MAX_LONG = 1920
export const THUMB_LONG = 320

// ── Last-used pose (not secret, localStorage) ───────────────────────────────
const LAST_POSE_KEY = 'sculpt.photos.lastPose'
export function getLastPose(): Pose {
  try { const v = localStorage.getItem(LAST_POSE_KEY); if (isPose(v)) return v } catch { /* private mode */ }
  return 'front'
}
export function setLastPose(p: Pose) { try { localStorage.setItem(LAST_POSE_KEY, p) } catch { /* ignore */ } }

// ── Queries ─────────────────────────────────────────────────────────────────
/** All photos, oldest → newest. `undefined` while loading. */
export function usePhotos(): Photo[] | undefined {
  return useLiveQuery(() => db.photos.orderBy('takenAt').toArray(), [])
}
export function usePosePhotos(pose: Pose | 'all'): Photo[] | undefined {
  const all = usePhotos()
  return useMemo(() => (all && pose !== 'all' ? all.filter(p => p.pose === pose) : all), [all, pose])
}
export const byPose = (photos: Photo[], pose: Pose) => photos.filter(p => p.pose === pose)
export const latestOf = (photos: Photo[], pose: Pose): Photo | undefined => {
  let best: Photo | undefined
  for (const p of photos) if (p.pose === pose && (!best || p.takenAt > best.takenAt)) best = p
  return best
}

export async function savePhoto(photo: Photo) { await db.photos.put(photo) }
export async function deletePhoto(id: string) { await db.photos.delete(id) }

// ── Encoding ────────────────────────────────────────────────────────────────
export interface Encoded { blob: Blob; width: number; height: number }

/**
 * Draw a frame (video / image / bitmap) onto a canvas scaled so its long side is
 * ≤ maxLong, optionally un-mirroring it, and export as JPEG.
 */
export function encodeFrame(src: CanvasImageSource, srcW: number, srcH: number, maxLong: number, quality: number, mirrored = false): Promise<Encoded> {
  const scale = Math.min(1, maxLong / Math.max(srcW, srcH))
  const width = Math.max(1, Math.round(srcW * scale)), height = Math.max(1, Math.round(srcH * scale))
  const c = document.createElement('canvas')
  c.width = width; c.height = height
  const ctx = c.getContext('2d')
  if (!ctx) return Promise.reject(new Error('canvas unavailable'))
  if (mirrored) { ctx.translate(width, 0); ctx.scale(-1, 1) }
  ctx.drawImage(src, 0, 0, width, height)
  return new Promise((res, rej) => c.toBlob(b => (b ? res({ blob: b, width, height }) : rej(new Error('encode failed'))), 'image/jpeg', quality))
}

/**
 * Build a full Photo record from a frame. `mirrored` = the preview the user saw
 * was mirrored (front camera); the stored blob is flipped back to reality.
 */
export async function buildPhoto(src: CanvasImageSource, srcW: number, srcH: number, pose: Pose, mirrored: boolean): Promise<Photo> {
  const full = await encodeFrame(src, srcW, srcH, MAX_LONG, 0.9, mirrored)
  const thumb = await encodeFrame(src, srcW, srcH, THUMB_LONG, 0.75, mirrored)
  return { id: uid(), date: isoDate(), takenAt: Date.now(), pose, blob: full.blob, thumb: thumb.blob, width: full.width, height: full.height, mirrored }
}

/** Decode a picked file (library upload). Modern browsers honour EXIF orientation here. */
export async function decodeFile(file: File): Promise<{ src: CanvasImageSource; width: number; height: number; release: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      // Explicitly honour EXIF orientation – older Safari ignores it by default, so library uploads from an iPhone came in rotated.
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { src: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() }
    } catch { /* fall through to <img> */ }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i); i.onerror = () => rej(new Error('decode failed')); i.src = url
    })
    return { src: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) }
  } catch (e) { URL.revokeObjectURL(url); throw e }
}

// ── Object URLs (always revoked) ────────────────────────────────────────────
export function useObjectUrl(blob: Blob | undefined | null): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) { setUrl(undefined); return }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

/** Object URLs for a list of photos (keyed by id); created together, revoked together. */
export function useObjectUrls(photos: Photo[] | undefined, field: 'blob' | 'thumb' = 'blob'): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!photos?.length) { setUrls({}); return }
    const next: Record<string, string> = {}
    for (const p of photos) next[p.id] = URL.createObjectURL(p[field])
    setUrls(next)
    return () => { for (const u of Object.values(next)) URL.revokeObjectURL(u) }
  }, [photos, field])
  return urls
}

// ── Grouping / stats ────────────────────────────────────────────────────────
export interface MonthGroup { key: string; label: string; photos: Photo[] }

export function monthLabel(key: string): string {
  return parseIso(`${key}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

/** Newest month first; photos within a month newest first. */
export function groupByMonth(photos: Photo[]): MonthGroup[] {
  const map = new Map<string, Photo[]>()
  for (const p of [...photos].sort((a, b) => b.takenAt - a.takenAt)) {
    const key = p.date.slice(0, 7)
    const arr = map.get(key)
    if (arr) arr.push(p); else map.set(key, [p])
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([key, ps]) => ({ key, label: monthLabel(key), photos: ps }))
}

/** Consecutive days (ending today or yesterday) with at least one photo. */
export function photoStreak(photos: Photo[], today = isoDate()): number {
  const days = new Set(photos.map(p => p.date))
  if (!days.size) return 0
  const d = parseIso(today)
  if (!days.has(isoDate(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(isoDate(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}

export const dayOfMonth = (iso: string) => Number(iso.slice(8, 10))
export const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
