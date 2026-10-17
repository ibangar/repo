import type { BodyWeight, ExerciseState, Measurement } from '../db/types'
import { daysBetween } from './schedule'

export interface WeeklyWeight {
  /** Monday of the week (YYYY-MM-DD) */
  weekStart: string
  avgKg: number
  n: number
}

function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = (dt.getDay() + 6) % 7 // Mon = 0
  dt.setDate(dt.getDate() - dow)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** Group weigh-ins into weekly averages, oldest first. */
export function weeklyWeights(entries: BodyWeight[]): WeeklyWeight[] {
  const map = new Map<string, { sum: number; n: number }>()
  for (const e of entries) {
    const k = mondayOf(e.date)
    const cur = map.get(k) ?? { sum: 0, n: 0 }
    cur.sum += e.kg; cur.n++
    map.set(k, cur)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, v]) => ({ weekStart, avgKg: v.sum / v.n, n: v.n }))
}

/** Exponential moving average trend line (alpha 0.3). */
export function trendLine(points: { kg: number }[], alpha = 0.3): number[] {
  const out: number[] = []
  let ema: number | null = null
  for (const p of points) { ema = ema == null ? p.kg : alpha * p.kg + (1 - alpha) * ema; out.push(ema) }
  return out
}

export type TrendDirection = 'up' | 'down' | 'flat'

export interface WeightTrend {
  direction: TrendDirection
  /** Consecutive weeks moving in `direction`. */
  streak: number
  /** kg per week over the last 4 weeks (linear regression). */
  slopeKgPerWeek: number
  /** True when 3+ consecutive weekly increases/decreases. */
  alert: 'trimPortions' | 'eatMore' | null
}

export function weightTrend(weekly: WeeklyWeight[], minDeltaKg = 0.1): WeightTrend {
  if (weekly.length < 2) return { direction: 'flat', streak: 0, slopeKgPerWeek: 0, alert: null }
  let streak = 0
  let direction: TrendDirection = 'flat'
  for (let i = weekly.length - 1; i > 0; i--) {
    const d = weekly[i].avgKg - weekly[i - 1].avgKg
    const dir: TrendDirection = d > minDeltaKg ? 'up' : d < -minDeltaKg ? 'down' : 'flat'
    if (streak === 0) { direction = dir; if (dir === 'flat') break; streak = 1; continue }
    if (dir === direction) streak++; else break
  }
  const last = weekly.slice(-4)
  let slope = 0
  if (last.length >= 2) {
    const n = last.length, xs = last.map((_, i) => i), ys = last.map(w => w.avgKg)
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n
    const num = xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0)
    const den = xs.reduce((acc, x) => acc + (x - mx) ** 2, 0)
    slope = den === 0 ? 0 : num / den
  }
  const alert = streak >= 3 ? (direction === 'up' ? 'trimPortions' : direction === 'down' ? 'eatMore' : null) : null
  return { direction, streak, slopeKgPerWeek: slope, alert }
}

/**
 * Maintenance calories. Without an intake figure we fall back to a bodyweight
 * heuristic (≈ 31 kcal/kg for someone lifting 5×/week eating at maintenance).
 * With a typical intake and a weight trend we can back out the real number:
 * each kg of bodyweight ≈ 7700 kcal.
 */
export function maintenanceEstimate(bodyweightKg: number, typicalIntakeKcal: number | undefined, slopeKgPerWeek: number): { kcal: number; basis: 'heuristic' | 'trend'; dailyBalance: number } {
  const dailyBalance = Math.round((slopeKgPerWeek * 7700) / 7)
  if (typicalIntakeKcal && typicalIntakeKcal > 800) {
    return { kcal: Math.round((typicalIntakeKcal - dailyBalance) / 10) * 10, basis: 'trend', dailyBalance }
  }
  return { kcal: Math.round((bodyweightKg * 31) / 10) * 10, basis: 'heuristic', dailyBalance }
}

/** Has this lift's e1RM failed to improve for `days` (default 21) with ≥3 sessions in that window? */
export function isStalled(state: ExerciseState, today: string, days = 21): boolean {
  const pts = state.history.filter(h => h.e1rm != null && h.outcome !== 'deload')
  if (pts.length < 3) return false
  const windowPts = pts.filter(p => daysBetween(p.date, today) <= days)
  if (windowPts.length < 3) return false
  const before = pts.filter(p => daysBetween(p.date, today) > days)
  const baseline = before.length ? Math.max(...before.map(p => p.e1rm!)) : windowPts[0].e1rm!
  const best = Math.max(...windowPts.map(p => p.e1rm!))
  return best <= baseline * 1.005
}

export type MeasureKey = 'chest' | 'shoulders' | 'upperArm' | 'waist' | 'hips' | 'thigh'
export const MEASURE_KEYS: MeasureKey[] = ['chest', 'shoulders', 'upperArm', 'waist', 'hips', 'thigh']
export const MEASURE_LABELS: Record<MeasureKey, string> = {
  chest: 'Chest', shoulders: 'Shoulders', upperArm: 'Upper arm', waist: 'Waist', hips: 'Hips / glutes', thigh: 'Mid-thigh',
}
/** What "good" looks like for each tape measure given the goals. */
export const MEASURE_GOAL: Record<MeasureKey, 'up' | 'steady' | 'steadyOrDown'> = {
  chest: 'up', shoulders: 'up', upperArm: 'up', waist: 'steadyOrDown', hips: 'up', thigh: 'steady',
}

export function measurementDelta(first: Measurement | undefined, last: Measurement | undefined, key: MeasureKey): number | null {
  const a = first?.[key], b = last?.[key]
  if (a == null || b == null) return null
  return Math.round((b - a) * 10) / 10
}

/** Verdict for a tape change against the goal. */
export function measurementVerdict(key: MeasureKey, delta: number | null): 'good' | 'neutral' | 'watch' | null {
  if (delta == null) return null
  const goal = MEASURE_GOAL[key]
  const tol = 1 // cm
  if (goal === 'up') return delta > tol ? 'good' : delta < -tol ? 'watch' : 'neutral'
  if (goal === 'steady') return Math.abs(delta) <= tol * 1.5 ? 'good' : delta > 0 ? 'watch' : 'neutral'
  return delta <= tol ? 'good' : 'watch'
}
