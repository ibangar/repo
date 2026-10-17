import type { DayFocus, ExerciseDef, Increments, LoadMode, ProgramDay, SessionExercise, Units, WorkoutSession } from '../../db/types'
import { getExercise } from '../../data/exercises'
import { smallestStepKg } from '../../engine/increments'
import { deloadSets } from '../../engine/prescription'
import { CM_PER_IN, formatCm, formatLoad, fromDisplay, toDisplay } from '../../engine/units'

export const isPowerMode = (m: LoadMode) => m === 'height' || m === 'bell'

/** Unit label for the load field of a given mode. */
export function loadUnit(mode: LoadMode, units: Units): string {
  if (mode === 'height') return units === 'kg' ? 'cm' : 'in'
  return units
}

/** Format a stored load (kg / cm / assist-kg) for its load mode. */
export function fmtModeLoad(value: number | null | undefined, mode: LoadMode, units: Units, withUnit = true): string {
  if (mode === 'bodyweight') return 'BW'
  if (value == null || Number.isNaN(value)) return '—'
  if (mode === 'height') return withUnit ? formatCm(value, units) : String(units === 'kg' ? Math.round(value) : Math.round(value / CM_PER_IN))
  const s = formatLoad(value, units, withUnit)
  if (mode === 'assisted') return `−${s}`
  if (mode === 'added') return `+${s}`
  return s
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d

/** Stepper step (in display units) + decimals for an exercise/mode. */
export function displayStep(def: ExerciseDef, inc: Increments, mode: LoadMode, units: Units): { step: number; decimals: number } {
  const kg = smallestStepKg(def, inc, mode)
  let step = mode === 'height' ? (units === 'kg' ? kg : kg / CM_PER_IN) : toDisplay(kg, units)
  step = round(step, 2)
  if (step <= 0) step = 1
  const decimals = Number.isInteger(step) ? 0 : Number.isInteger(step * 10) ? 1 : 2
  return { step, decimals }
}

export function toDisp(v: number | null, mode: LoadMode, units: Units): number | null {
  if (v == null) return null
  if (mode === 'height') return units === 'kg' ? Math.round(v) : round(v / CM_PER_IN, 1)
  return round(toDisplay(v, units), 2)
}
export function fromDisp(v: number, mode: LoadMode, units: Units): number {
  if (mode === 'height') return units === 'kg' ? v : round(v * CM_PER_IN, 1)
  return round(fromDisplay(v, units), 3)
}

/** Working-set progress for a session (skipped exercises excluded). */
export function setsProgress(session: WorkoutSession | undefined | null): { done: number; total: number } {
  let done = 0, total = 0
  for (const ex of session?.exercises ?? []) {
    if (ex.skipped) continue
    total += ex.sets.length
    done += ex.sets.filter(s => s.done).length
  }
  return { done, total }
}

/** ≈ sets × (rest + 40 s) across the day. */
export function estDurationSec(day: ProgramDay, isDeload: boolean): number {
  let sec = 0
  for (const pe of day.exercises) {
    const def = getExercise(pe.exerciseId)
    const sets = (isDeload ? deloadSets(pe.sets) : pe.sets) * (def.unilateral ? 2 : 1)
    sec += sets * ((pe.restSec ?? def.restSec) + 40)
  }
  return sec
}

export const FOCUS_SHORT: Record<DayFocus, string> = { push: 'Push', glutes: 'Glutes', pull: 'Pull', rest: 'Rest', upper: 'Upper', power: 'Power' }
export const FOCUS_EMOJI: Record<DayFocus, string> = { push: '💪', glutes: '🍑', pull: '🔙', rest: '🌿', upper: '💪', power: '⚡' }

export type Tone = 'glutes' | 'upper' | 'power' | 'rest'
export function focusTone(focus: DayFocus): Tone {
  if (focus === 'glutes') return 'glutes'
  if (focus === 'power') return 'power'
  if (focus === 'rest') return 'rest'
  return 'upper'
}
export const isGluteFocus = (focus: DayFocus) => focus === 'glutes' || focus === 'power'

export function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const setKey = (exIdx: number, setIdx: number) => `${exIdx}:${setIdx}`

/** A card = one exercise, or the exercises sharing a supersetGroup. */
export interface CardGroup { key: string; exIdxs: number[]; superset: boolean }

export function groupExercises(session: WorkoutSession): CardGroup[] {
  const groups: CardGroup[] = []
  const byGroup = new Map<string, CardGroup>()
  session.exercises.forEach((ex, i) => {
    if (ex.supersetGroup) {
      const g = byGroup.get(ex.supersetGroup)
      if (g) { g.exIdxs.push(i); g.superset = true; return }
      const ng: CardGroup = { key: `ss-${ex.supersetGroup}`, exIdxs: [i], superset: false }
      byGroup.set(ex.supersetGroup, ng); groups.push(ng); return
    }
    groups.push({ key: ex.programExerciseId, exIdxs: [i], superset: false })
  })
  return groups
}

export interface SetRef { exIdx: number; setIdx: number }

/** Sets of a card in render order – supersets alternate A1, B1, A2, B2 … */
export function orderedSets(session: WorkoutSession, group: CardGroup): SetRef[] {
  const active = group.exIdxs.filter(i => !session.exercises[i].skipped)
  if (!group.superset || active.length < 2) {
    return active.flatMap(exIdx => session.exercises[exIdx].sets.map((_, setIdx) => ({ exIdx, setIdx })))
  }
  const max = Math.max(...active.map(i => session.exercises[i].sets.length))
  const out: SetRef[] = []
  for (let s = 0; s < max; s++) for (const exIdx of active) if (session.exercises[exIdx].sets[s]) out.push({ exIdx, setIdx: s })
  return out
}

/** First incomplete working set in render order. */
export function nextIncomplete(session: WorkoutSession, groups = groupExercises(session)): SetRef | null {
  for (const g of groups) for (const r of orderedSets(session, g)) if (!session.exercises[r.exIdx].sets[r.setIdx].done) return r
  return null
}

export function countIncomplete(session: WorkoutSession): number {
  let n = 0
  for (const ex of session.exercises) if (!ex.skipped) n += ex.sets.filter(s => !s.done).length
  return n
}

/** Whether finishing a set of this exercise should start the rest timer (supersets rest after the B set). */
export function restsAfter(session: WorkoutSession, exIdx: number, groups = groupExercises(session)): boolean {
  const g = groups.find(x => x.exIdxs.includes(exIdx))
  if (!g || !g.superset) return true
  const active = g.exIdxs.filter(i => !session.exercises[i].skipped)
  return active[active.length - 1] === exIdx
}

/** Index of the first non-skipped compound lift (the one that gets ramp-up sets). */
export function firstCompoundIdx(session: WorkoutSession): number {
  return session.exercises.findIndex(e => !e.skipped && getExercise(e.exerciseId).category === 'compound')
}

export function describeMode(mode: LoadMode): { label: string; hint: string } {
  switch (mode) {
    case 'bodyweight': return { label: 'Bodyweight', hint: 'No added load, no assistance.' }
    case 'assisted': return { label: 'Assisted', hint: 'Band or machine – log the assistance.' }
    case 'added': return { label: 'Weighted', hint: 'Belt or dumbbell – log the added load.' }
    case 'height': return { label: 'Box height', hint: '' }
    case 'bell': return { label: 'Bell', hint: '' }
    default: return { label: 'Weight', hint: '' }
  }
}

export function modeSwitchNote(mode: LoadMode, repMax: number): string {
  if (mode === 'assisted') return `Assisted: pick the assistance that leaves 2 reps in the tank at ${repMax} reps.`
  if (mode === 'added') return `Weighted: pick an added load that leaves 2 reps in the tank at ${repMax} reps.`
  return 'Bodyweight: see how many clean reps you get.'
}

export const exerciseFor = (ex: SessionExercise) => getExercise(ex.exerciseId)
