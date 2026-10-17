// ─────────────────────────────────────────────────────────────────────────────
// Pure aggregation helpers for the Progress module. No DB access – feed them
// arrays straight from Dexie live queries. Unit tested in stats.test.ts.
// ─────────────────────────────────────────────────────────────────────────────
import type { BodyWeight, ExerciseState, HistoryPoint, Measurement, PR, Program, Settings, VolumeGroup, WorkoutSession } from '../db/types'
import { getExercise } from '../data/exercises'
import { effectiveLoadKg } from '../engine/progression'
import { addDays, daysBetween, parseIso, isoDate, scheduleFor } from '../engine/schedule'
import { MEASURE_KEYS, measurementDelta, measurementVerdict, type MeasureKey } from '../engine/trends'

export const VOLUME_GROUPS: VolumeGroup[] = ['chest', 'delts', 'back', 'arms', 'glutes', 'quads', 'hamstrings']

/** The lifts whose e1RM we track on the dashboard, in display order. */
export const KEY_LIFTS = ['bbHipThrust', 'backSquat', 'flatBbBench', 'inclineDbPress', 'trapBarDeadlift', 'rdl', 'pullUp']
/** Compound lifts whose stall matters for the fasted-training prompt. */
export const STALL_LIFTS = ['bbHipThrust', 'backSquat', 'flatBbBench', 'inclineDbPress', 'trapBarDeadlift', 'rdl']

/** Monday (YYYY-MM-DD) of the week containing `iso`. */
export function mondayOf(iso: string): string {
  const d = parseIso(iso)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return isoDate(d)
}

/** Week starts (Mondays) for the last `n` weeks ending with the current one, oldest first. */
export function lastWeekStarts(today: string, n: number): string[] {
  const cur = mondayOf(today)
  return Array.from({ length: n }, (_, i) => addDays(cur, -7 * (n - 1 - i)))
}

const isTrainingDay = (date: string, settings: Settings, program: Program) => {
  const day = scheduleFor(date, settings, program).day
  return day.focus !== 'rest' && day.exercises.length > 0
}

export interface StreakStats {
  /** Consecutive scheduled training days completed (rest days don't break it). */
  streak: number
  totalWorkouts: number
  weekDone: number
  weekPlanned: number
}

export function streakStats(sessions: WorkoutSession[], settings: Settings, program: Program, today: string): StreakStats {
  const completed = sessions.filter(s => s.status === 'completed')
  const doneDates = new Set(completed.map(s => s.date))
  let streak = 0
  // Today only counts if it's done; an unfinished today never breaks the streak.
  let date = doneDates.has(today) ? today : addDays(today, -1)
  const floor = settings.programStartDate
  for (let i = 0; i < 400 && date >= floor; i++) {
    if (isTrainingDay(date, settings, program)) {
      if (doneDates.has(date)) streak++
      else break
    }
    date = addDays(date, -1)
  }
  const mon = mondayOf(today)
  let weekPlanned = 0, weekDone = 0
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i)
    if (isTrainingDay(d, settings, program)) weekPlanned++
    if (doneDates.has(d)) weekDone++
  }
  return { streak, totalWorkouts: completed.length, weekDone, weekPlanned }
}

export interface HeatCell { date: string; count: number; future: boolean }

/** 7 rows (Mon..Sun) × `weeks` columns, oldest column first. */
export function heatmapCells(sessions: WorkoutSession[], today: string, weeks = 12): HeatCell[][] {
  const counts = new Map<string, number>()
  for (const s of sessions) if (s.status === 'completed') counts.set(s.date, (counts.get(s.date) ?? 0) + 1)
  const starts = lastWeekStarts(today, weeks)
  return starts.map(ws => Array.from({ length: 7 }, (_, r) => {
    const date = addDays(ws, r)
    return { date, count: counts.get(date) ?? 0, future: date > today }
  }))
}

export type GroupTotals = Record<VolumeGroup, number>
const zeroGroups = (): GroupTotals => ({ chest: 0, delts: 0, back: 0, arms: 0, glutes: 0, quads: 0, hamstrings: 0 })

export interface WeekVolume { weekStart: string; volume: GroupTotals; hardSets: GroupTotals }

/**
 * Σ sets × reps × effective load per volume group, per Mon–Sun week.
 * A set counts toward every volumeGroup of its exercise; 'height' mode is skipped.
 */
export function weeklyVolume(sessions: WorkoutSession[], today: string, weeks = 8): WeekVolume[] {
  const starts = lastWeekStarts(today, weeks)
  const byWeek = new Map<string, WeekVolume>(starts.map(ws => [ws, { weekStart: ws, volume: zeroGroups(), hardSets: zeroGroups() }]))
  for (const s of sessions) {
    if (s.status !== 'completed') continue
    const wk = byWeek.get(mondayOf(s.date))
    if (!wk) continue
    for (const ex of s.exercises) {
      if (ex.skipped || ex.loadMode === 'height') continue
      let def
      try { def = getExercise(ex.exerciseId) } catch { continue }
      for (const set of ex.sets) {
        if (!set.done || set.isWarmup || !set.reps) continue
        const eff = effectiveLoadKg(ex.loadMode, set.load, s.bodyweightKg)
        if (eff == null) continue
        for (const g of def.volumeGroups) {
          wk.volume[g] += eff * set.reps
          wk.hardSets[g] += 1
        }
      }
    }
  }
  return starts.map(ws => byWeek.get(ws)!)
}

export interface E1rmPoint { date: string; value: number; isBest: boolean; load: number; reps: number }

/** e1RM history (or raw load for power lifts), nulls removed, best flagged. */
export function liftSeries(state: ExerciseState): { points: E1rmPoint[]; isLoadOnly: boolean } {
  const isLoadOnly = state.loadMode === 'height' || state.loadMode === 'bell'
  const pts = state.history
    .map(h => ({ date: h.date, value: isLoadOnly ? h.load : h.e1rm, load: h.load, reps: h.bestReps }))
    .filter((p): p is { date: string; value: number; load: number; reps: number } => p.value != null)
  const best = pts.length ? Math.max(...pts.map(p => p.value)) : 0
  let flagged = false
  const points = pts.map(p => {
    const isBest = !flagged && p.value === best
    if (isBest) flagged = true
    return { ...p, isBest }
  })
  return { points, isLoadOnly }
}

/** % change between the latest value and the last value ≥ 28 days earlier (or the first point). */
export function fourWeekChange(points: E1rmPoint[], today: string): number | null {
  if (points.length < 2) return null
  const last = points[points.length - 1]
  const cutoff = addDays(today, -28)
  const older = points.filter(p => p.date <= cutoff)
  const base = older.length ? older[older.length - 1] : points[0]
  if (base === last || base.value === 0) return null
  return Math.round(((last.value - base.value) / base.value) * 1000) / 10
}

export function groupPRsByMonth(prs: PR[]): { month: string; label: string; items: PR[] }[] {
  const sorted = [...prs].sort((a, b) => b.date.localeCompare(a.date))
  const out: { month: string; label: string; items: PR[] }[] = []
  for (const pr of sorted) {
    const month = pr.date.slice(0, 7)
    let g = out[out.length - 1]
    if (!g || g.month !== month) {
      g = { month, label: parseIso(pr.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), items: [] }
      out.push(g)
    }
    g.items.push(pr)
  }
  return out
}

// ── Body ──────────────────────────────────────────────────────────────────────

export interface WeighInStatus { nextDate: string; doneThisWeek: boolean; dueToday: boolean; overdue: boolean }

export function weighInStatus(settings: Pick<Settings, 'weighInDay'>, weights: BodyWeight[], today: string): WeighInStatus {
  const mon = mondayOf(today)
  const doneThisWeek = weights.some(w => w.date >= mon && w.date <= addDays(mon, 6))
  // weighInDay: 0 = Sunday … 6 = Saturday; our week runs Mon..Sun
  const offset = (settings.weighInDay + 6) % 7
  const dueThisWeek = addDays(mon, offset)
  const nextDate = doneThisWeek ? addDays(dueThisWeek, 7) : dueThisWeek
  return { nextDate, doneThisWeek, dueToday: !doneThisWeek && dueThisWeek === today, overdue: !doneThisWeek && dueThisWeek < today }
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface GoalRow {
  key: MeasureKey
  first: number | null
  last: number | null
  delta: number | null
  verdict: 'good' | 'neutral' | 'watch' | null
}

export const MEASURE_GOAL_CAPTION: Record<MeasureKey, string> = {
  chest: 'Fuller upper chest ↑', shoulders: 'Wider side delts ↑', upperArm: 'Bigger arms ↑',
  waist: 'Waist steady – staying lean', hips: 'Rounder, fuller glutes ↑', thigh: 'Strong, not bigger – roughly the same',
}

export function goalRows(first: Measurement | undefined, last: Measurement | undefined): GoalRow[] {
  return MEASURE_KEYS.map(key => {
    const delta = measurementDelta(first, last, key)
    return { key, first: first?.[key] ?? null, last: last?.[key] ?? null, delta, verdict: measurementVerdict(key, delta) }
  })
}

// ── Nutrition ─────────────────────────────────────────────────────────────────

export interface TimelineSegment { kind: 'fast' | 'meal' | 'treat' | 'sleep'; startH: number; endH: number; label: string }

const toH = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h + (m || 0) / 60 }

/** A 24 h horizontal eating pattern: fasting window, two meals, Tony's after dinner. */
export function eatingTimeline(mealTimes: [string, string]): TimelineSegment[] {
  const m1 = toH(mealTimes[0]), m2 = toH(mealTimes[1])
  const mealLen = 1
  const segs: TimelineSegment[] = [
    { kind: 'sleep', startH: 0, endH: 6.5, label: 'Sleep' },
    { kind: 'fast', startH: 6.5, endH: m1, label: 'Fasted (train here)' },
    { kind: 'meal', startH: m1, endH: m1 + mealLen, label: 'Meal 1' },
    { kind: 'fast', startH: m1 + mealLen, endH: m2, label: '' },
    { kind: 'meal', startH: m2, endH: m2 + mealLen, label: 'Meal 2' },
    { kind: 'treat', startH: m2 + mealLen, endH: m2 + mealLen + 0.5, label: "Tony's" },
    { kind: 'fast', startH: m2 + mealLen + 0.5, endH: 23, label: '' },
    { kind: 'sleep', startH: 23, endH: 24, label: '' },
  ]
  return segs.filter(s => s.endH > s.startH)
}

export function fastingHours(mealTimes: [string, string]): number {
  const m1 = toH(mealTimes[0]), m2 = toH(mealTimes[1])
  const eatingWindow = m2 + 1 + 0.5 - m1
  return Math.round((24 - eatingWindow) * 10) / 10
}

// ── Check-in ──────────────────────────────────────────────────────────────────

export function blockWeek(blockStartDate: string, today: string): number {
  return Math.max(1, Math.floor(daysBetween(blockStartDate, today) / 7) + 1)
}

export interface LiftCompare { exerciseId: string; start: number | null; now: number | null; deltaPct: number | null; isLoadOnly: boolean }

/** e1RM (or load for power lifts) at the first session on/after `blockStart` vs the best since. */
export function liftComparison(state: ExerciseState | undefined, blockStart: string): LiftCompare | null {
  if (!state) return null
  const isLoadOnly = state.loadMode === 'height' || state.loadMode === 'bell'
  const val = (h: HistoryPoint) => (isLoadOnly ? h.load : h.e1rm)
  const pts = state.history.filter(h => val(h) != null)
  if (!pts.length) return null
  const since = pts.filter(h => h.date >= blockStart)
  const startPt = since[0] ?? pts[pts.length - 1]
  const start = val(startPt)
  const now = since.length ? Math.max(...since.map(h => val(h)!)) : val(pts[pts.length - 1])
  const deltaPct = start && now != null && since.length > 1 ? Math.round(((now - start) / start) * 1000) / 10 : null
  return { exerciseId: state.exerciseId, start, now, deltaPct, isLoadOnly }
}

export interface VerdictInput {
  lifts: LiftCompare[]
  goals: GoalRow[]
  weightStartKg: number | null
  weightNowKg: number | null
  weeks: number
  units: 'kg' | 'lb'
}

/** Friendly one-paragraph summary of the block. */
export function checkinVerdict(v: VerdictInput): string {
  const bits: string[] = []
  const ht = v.lifts.find(l => l.exerciseId === 'bbHipThrust')
  if (ht?.deltaPct != null && ht.deltaPct > 0) bits.push(`Hip thrust +${ht.deltaPct}%`)
  const otherUp = v.lifts.filter(l => l.exerciseId !== 'bbHipThrust' && l.deltaPct != null && l.deltaPct >= 3)
  if (otherUp.length) bits.push(`${otherUp.length} other lift${otherUp.length > 1 ? 's' : ''} up`)
  const hips = v.goals.find(g => g.key === 'hips')
  if (hips?.delta != null && hips.delta > 0) bits.push(`hips +${hips.delta} cm`)
  const waist = v.goals.find(g => g.key === 'waist')
  if (waist?.verdict === 'good') bits.push('waist steady')
  const arm = v.goals.find(g => g.key === 'upperArm')
  if (arm?.delta != null && arm.delta > 0) bits.push(`arms +${arm.delta} cm`)
  let weightNote = ''
  if (v.weightStartKg != null && v.weightNowKg != null) {
    const d = Math.round((v.weightNowKg - v.weightStartKg) * 10) / 10
    weightNote = Math.abs(d) <= 0.7 ? 'Bodyweight basically flat' : d > 0 ? `Bodyweight up ${d} kg` : `Bodyweight down ${Math.abs(d)} kg`
  }
  if (!bits.length && !weightNote) return `Week ${v.weeks} of the block. Log a few more sessions, a weigh-in and a tape measure and I'll write the story here.`
  const lead = bits.length ? bits.join(', ') : weightNote
  const tail = bits.length && weightNote ? ` ${weightNote}.` : ''
  const closer = bits.length >= 2 ? ' The recomp is working – strength up, shape changing, waist holding.' : bits.length === 1 ? ' Keep stacking weeks; the rest follows.' : ' Strength is the lever – keep the lifts climbing.'
  return `${lead}.${tail}${closer}`
}
