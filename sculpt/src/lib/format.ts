import { parseIso } from '../engine/schedule'

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
  return parseIso(iso).toLocaleDateString(undefined, opts)
}
export function fmtDateShort(iso: string): string { return fmtDate(iso, { day: 'numeric', month: 'short' }) }
export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60)
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`
  return `${m}:${String(s).padStart(2, '0')}`
}
export function fmtMinutes(sec: number): string {
  const m = Math.round(sec / 60)
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
}
export function relativeDay(iso: string, today: string): string {
  const d = Math.round((parseIso(iso).getTime() - parseIso(today).getTime()) / 86_400_000)
  if (d === 0) return 'Today'
  if (d === -1) return 'Yesterday'
  if (d === 1) return 'Tomorrow'
  if (d < 0 && d > -7) return `${-d} days ago`
  return fmtDate(iso)
}
export const round1 = (n: number) => Math.round(n * 10) / 10
