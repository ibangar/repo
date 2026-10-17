import type { ExerciseDef, ExerciseState, Increments, LoadMode, ProgramDay, ProgramExercise, SessionExercise, SetLog, Units, WorkoutSession } from '../db/types'
import { getExercise } from '../data/exercises'
import { roundLoad } from './increments'

export interface PrescribeContext {
  increments: Increments
  units: Units
  bodyweightKg: number
  isDeload: boolean
}

/** Deload: ~40% fewer sets (never below 1) and ~10% lighter. */
export const deloadSets = (sets: number) => Math.max(1, Math.round(sets * 0.6))
export const deloadLoad = (load: number) => load * 0.9

/**
 * Ramp-up sets for the first compound lift of the day:
 * 50% × 8 and 75% × 4 of the working weight, rounded to real increments.
 */
export function rampUps(workingKg: number, def: ExerciseDef, inc: Increments, units: Units, mode: LoadMode = 'weight'): SetLog[] {
  if (mode !== 'weight' || workingKg <= 0) return []
  const plan: [number, number][] = [[0.5, 8], [0.75, 4]]
  const out: SetLog[] = []
  for (const [pct, reps] of plan) {
    const load = roundLoad(workingKg * pct, def, inc, units, mode)
    if (load <= 0 || load >= workingKg) continue
    if (out.length && out[out.length - 1].load === load) continue
    out.push({ index: out.length, prescribedLoad: load, prescribedReps: reps, load, reps, rir: 5, done: false, isWarmup: true })
  }
  return out
}

function buildSets(count: number, load: number | null, reps: number, unilateral: boolean | undefined, mode: LoadMode): SetLog[] {
  const sets: SetLog[] = []
  const power = mode === 'height' || mode === 'bell'
  for (let i = 0; i < count; i++) {
    if (unilateral) {
      sets.push({ index: sets.length, side: 'L', prescribedLoad: load, prescribedReps: reps, load, reps: null, rir: 2, done: false })
      sets.push({ index: sets.length, side: 'R', prescribedLoad: load, prescribedReps: reps, load, reps: null, rir: 2, done: false })
    } else {
      sets.push({ index: i, prescribedLoad: load, prescribedReps: reps, load, reps: null, rir: 2, done: false, ...(power ? { explosive: true } : {}) })
    }
  }
  return sets
}

/** Default starting values when there's no history (calibration). */
export function calibrationDefault(mode: LoadMode, inc: Increments): number | null {
  if (mode === 'height') return 50
  if (mode === 'bell') return Math.max(inc.kettlebellStepKg, 16)
  if (mode === 'bodyweight') return 0
  return null
}

export function prescribeExercise(
  pe: ProgramExercise,
  state: ExerciseState | undefined,
  ctx: PrescribeContext,
  opts: { firstCompound: boolean; exerciseId?: string; swappedFrom?: string } = { firstCompound: false },
): SessionExercise {
  const exerciseId = opts.exerciseId ?? pe.exerciseId
  const def = getExercise(exerciseId)
  const mode: LoadMode = state?.loadMode ?? def.defaultLoadMode
  const calibration = !state?.calibrated
  const setCount = ctx.isDeload ? deloadSets(pe.sets) : pe.sets

  let load: number | null
  let note: string | undefined
  if (calibration) {
    load = calibrationDefault(mode, ctx.increments)
    note = mode === 'weight' || mode === 'added' || mode === 'assisted'
      ? `Calibration: pick a weight that leaves 2 reps in the tank at ${pe.repMax} reps.`
      : mode === 'height' ? 'Calibration: pick a box you can land on softly.'
        : mode === 'bell' ? 'Calibration: pick a bell you can swing crisply for all reps.'
          : 'Calibration: see how many clean reps you get.'
  } else {
    load = state!.currentLoad
    if (ctx.isDeload && load != null && (mode === 'weight' || mode === 'added')) load = roundLoad(deloadLoad(load), def, ctx.increments, ctx.units, mode)
    note = ctx.isDeload ? `Deload: ${setCount} set${setCount > 1 ? 's' : ''}, 10% lighter. Move well, leave the ego at home.` : undefined
  }

  const targetReps = ctx.isDeload ? pe.repMin : (state?.targetReps ?? pe.repMin)
  const reps = Math.min(pe.repMax, Math.max(pe.repMin, targetReps))
  const sets = buildSets(setCount, load, reps, def.unilateral, mode)
  const warmups = opts.firstCompound && !calibration && load != null && mode === 'weight' ? rampUps(load, def, ctx.increments, ctx.units, mode) : []

  const last = state?.history.at(-1)
  const lastTime = last ? {
    date: last.date,
    sets: [{ load: last.load, reps: last.bestReps, rir: last.bestRir }],
  } : undefined

  return {
    programExerciseId: pe.id, exerciseId, swappedFrom: opts.swappedFrom, loadMode: mode,
    supersetGroup: pe.supersetGroup, repMin: pe.repMin, repMax: pe.repMax,
    restSec: pe.restSec ?? def.restSec, calibration, prescriptionNote: note, warmups, sets, lastTime,
  }
}

export interface BuildSessionInput {
  day: ProgramDay
  dayIndex: number
  weekNumber: number
  isDeload: boolean
  date: string
  states: Map<string, ExerciseState>
  lastSessions: Map<string, WorkoutSession>
  ctx: Omit<PrescribeContext, 'isDeload'>
}

/** Build a full session document for today (not yet persisted). */
export function buildSession(input: BuildSessionInput): WorkoutSession {
  const ctx: PrescribeContext = { ...input.ctx, isDeload: input.isDeload }
  let firstCompoundDone = false
  const exercises: SessionExercise[] = input.day.exercises.map(pe => {
    const def = getExercise(pe.exerciseId)
    const first = !firstCompoundDone && def.category === 'compound'
    if (first) firstCompoundDone = true
    const se = prescribeExercise(pe, input.states.get(pe.exerciseId), ctx, { firstCompound: first })
    // Richer "last time": the full set list from the most recent completed session.
    const lastSession = input.lastSessions.get(pe.exerciseId)
    const lastEx = lastSession?.exercises.find(e => e.exerciseId === pe.exerciseId && !e.skipped)
    if (lastSession && lastEx) {
      const done = lastEx.sets.filter(s => s.done && !s.isWarmup)
      if (done.length) se.lastTime = { date: lastSession.date, sets: done.map(s => ({ load: s.load, reps: s.reps, rir: s.rir })) }
    }
    return se
  })
  return {
    id: `${input.date}-${input.day.id}-${Math.random().toString(36).slice(2, 8)}`,
    date: input.date, dayId: input.day.id, dayName: input.day.name, dayIndex: input.dayIndex,
    weekNumber: input.weekNumber, isDeload: input.isDeload, status: 'active', startedAt: Date.now(),
    exercises, bodyweightKg: input.ctx.bodyweightKg,
  }
}

/** Replace an exercise in an active session with a same-pattern alternative. */
export function swapExercise(session: WorkoutSession, programExerciseId: string, newExerciseId: string, state: ExerciseState | undefined, ctx: PrescribeContext, programExercise: ProgramExercise): WorkoutSession {
  const idx = session.exercises.findIndex(e => e.programExerciseId === programExerciseId)
  if (idx < 0) return session
  const old = session.exercises[idx]
  // Ramp-ups belong to the first (non-skipped) compound lift of the day, whichever exercise fills that slot.
  const firstCompoundIdx = session.exercises.findIndex(e => !e.skipped && getExercise(e.exerciseId).category === 'compound')
  const firstCompound = idx === firstCompoundIdx || old.warmups.length > 0
  const next = prescribeExercise(programExercise, state, ctx, { firstCompound, exerciseId: newExerciseId, swappedFrom: old.swappedFrom ?? old.exerciseId })
  const exercises = [...session.exercises]
  exercises[idx] = next
  return { ...session, exercises }
}
