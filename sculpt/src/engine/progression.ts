import type { ExerciseDef, ExerciseState, HistoryPoint, Increments, LoadMode, SessionExercise, SetLog, Units } from '../db/types'
import { epley } from './epley'
import { progressionJumpKg, roundLoad, smallestStepKg } from './increments'

export interface ProgressionContext {
  increments: Increments
  units: Units
  bodyweightKg: number
  /** 5–10 */
  missDropPct: number
  isDeload: boolean
  date: string
  sessionId: string
}

export const emptyState = (exerciseId: string, loadMode: LoadMode): ExerciseState => ({
  exerciseId, loadMode, currentLoad: null, targetReps: null, calibrated: false,
  consecutiveMisses: 0, bestE1rm: null, bestLoad: null, history: [], updatedAt: Date.now(),
})

/** Working sets actually completed with a rep count. */
export const doneSets = (sets: SetLog[]) => sets.filter(s => s.done && !s.isWarmup && s.reps != null && s.reps > 0)

/**
 * The load that matters for an e1RM. For pull-ups / dips the load is your
 * bodyweight plus added weight (or minus assistance).
 */
export function effectiveLoadKg(mode: LoadMode, load: number | null, bodyweightKg: number): number | null {
  switch (mode) {
    case 'weight': case 'bell': return load
    case 'bodyweight': return bodyweightKg
    case 'added': return bodyweightKg + (load ?? 0)
    case 'assisted': return Math.max(1, bodyweightKg - (load ?? 0))
    case 'height': return null
  }
}

export interface SetOutcome {
  allHitTop: boolean
  anyMissedBottom: boolean
  allExplosive: boolean
  bestSet: SetLog | null
  bestE1rm: number | null
  /** Modal working load (the weight you actually used). */
  workingLoad: number | null
  volumeKg: number
}

export function evaluateSets(ex: SessionExercise, bodyweightKg: number): SetOutcome {
  const sets = doneSets(ex.sets)
  if (sets.length === 0) {
    return { allHitTop: false, anyMissedBottom: false, allExplosive: false, bestSet: null, bestE1rm: null, workingLoad: null, volumeKg: 0 }
  }
  // "Hit the top at RIR 1-2": every set reached repMax with at least 1 rep in reserve.
  // RIR 0 means you had to grind to failure, so the weight isn't ready to go up yet.
  const allHitTop = sets.every(s => (s.reps ?? 0) >= ex.repMax && s.rir >= 1)
  const anyMissedBottom = sets.some(s => (s.reps ?? 0) < ex.repMin)
  const allExplosive = sets.every(s => s.explosive === true)

  let bestSet: SetLog | null = null
  let bestE1rm: number | null = null
  let volumeKg = 0
  const loadCounts = new Map<number, number>()
  for (const s of sets) {
    const eff = effectiveLoadKg(ex.loadMode, s.load, bodyweightKg)
    if (s.load != null) loadCounts.set(s.load, (loadCounts.get(s.load) ?? 0) + 1)
    if (eff != null && ex.loadMode !== 'height') volumeKg += eff * (s.reps ?? 0)
    if (eff != null && ex.loadMode !== 'height' && ex.loadMode !== 'bell') {
      const e = epley(eff, s.reps ?? 0, s.rir)
      if (bestE1rm == null || e > bestE1rm) { bestE1rm = e; bestSet = s }
    } else if (!bestSet || (s.reps ?? 0) > (bestSet.reps ?? 0)) {
      bestSet = s
    }
  }
  // Modal load; ties resolved toward the heavier weight.
  let workingLoad: number | null = null
  let best = -1
  for (const [load, n] of loadCounts) if (n > best || (n === best && load > (workingLoad ?? -Infinity))) { best = n; workingLoad = load }
  if (workingLoad == null && ex.loadMode === 'bodyweight') workingLoad = 0
  return { allHitTop, anyMissedBottom, allExplosive, bestSet, bestE1rm, workingLoad, volumeKg }
}

export interface ProgressionResult {
  state: ExerciseState
  /** Human readable explanation for the next session. */
  note: string
  outcome: HistoryPoint['outcome']
}

/**
 * Apply the double-progression rules to a completed exercise and return the
 * next state. Pure – does not touch the database.
 */
export function applyProgression(def: ExerciseDef, ex: SessionExercise, prev: ExerciseState | undefined, ctx: ProgressionContext): ProgressionResult {
  const state: ExerciseState = prev ? { ...prev, history: [...prev.history] } : emptyState(def.id, ex.loadMode)
  state.loadMode = ex.loadMode
  state.updatedAt = Date.now()
  const o = evaluateSets(ex, ctx.bodyweightKg)

  if (!o.bestSet || o.workingLoad == null) {
    return { state, note: 'No sets logged – nothing changed.', outcome: 'inRange' }
  }

  const round = (kg: number, mode: LoadMode = ex.loadMode) => roundLoad(kg, def, ctx.increments, ctx.units, mode)
  const bestReps = o.bestSet.reps ?? 0
  const point: HistoryPoint = {
    date: ctx.date, sessionId: ctx.sessionId, loadMode: ex.loadMode, load: o.workingLoad,
    bestReps, bestRir: o.bestSet.rir, e1rm: o.bestE1rm, outcome: 'inRange', volumeKg: o.volumeKg,
  }
  if (o.bestE1rm != null && (state.bestE1rm == null || o.bestE1rm > state.bestE1rm)) state.bestE1rm = o.bestE1rm
  if (ex.loadMode !== 'assisted' && (state.bestLoad == null || o.workingLoad > state.bestLoad)) state.bestLoad = o.workingLoad

  // ── Deload sessions never move the needle ──
  if (ctx.isDeload) {
    point.outcome = 'deload'
    state.history.push(point)
    if (!state.calibrated) { state.calibrated = true; state.currentLoad = o.workingLoad; state.targetReps = ex.repMin }
    return { state, note: 'Deload week – weights unchanged.', outcome: 'deload' }
  }

  // ── Power lifts: progress only when every rep was explosive ──
  if (ex.loadMode === 'height' || ex.loadMode === 'bell') {
    point.outcome = 'power'
    state.calibrated = true
    const allDoneExplosive = o.allExplosive && doneSets(ex.sets).length >= ex.sets.filter(s => !s.isWarmup).length
    if (allDoneExplosive) {
      const step = smallestStepKg(def, ctx.increments, ex.loadMode)
      state.currentLoad = round(o.workingLoad + step)
      state.consecutiveMisses = 0
      state.history.push(point)
      const label = ex.loadMode === 'height' ? 'box' : 'bell'
      return { state, note: `Every rep explosive → next ${label} up.`, outcome: 'power' }
    }
    state.currentLoad = o.workingLoad
    state.history.push(point)
    return { state, note: 'Stay here until every rep feels explosive.', outcome: 'power' }
  }

  // ── Double progression ──
  state.calibrated = true
  const jump = progressionJumpKg(def, ctx.increments, ctx.units, ex.loadMode)

  if (o.allHitTop) {
    point.outcome = 'hitTop'
    state.consecutiveMisses = 0
    state.targetReps = ex.repMin
    const repsStr = doneSets(ex.sets).map(s => s.reps).join('/')
    switch (ex.loadMode) {
      case 'bodyweight': {
        // Graduated from bodyweight → add load next time.
        state.loadMode = 'added'
        state.currentLoad = round(jump, 'added')
        state.history.push(point)
        return { state, note: `You hit ${repsStr} at bodyweight → add ${fmt(state.currentLoad, ctx.units)} next time.`, outcome: 'hitTop' }
      }
      case 'assisted': {
        const next = round(o.workingLoad - jump, 'assisted')
        if (next <= 0) {
          state.loadMode = 'bodyweight'; state.currentLoad = 0
          state.history.push(point)
          return { state, note: `You hit ${repsStr} → try unassisted next time.`, outcome: 'hitTop' }
        }
        state.currentLoad = next
        state.history.push(point)
        return { state, note: `You hit ${repsStr} → less assistance (${fmt(next, ctx.units)}).`, outcome: 'hitTop' }
      }
      default: {
        state.currentLoad = round(o.workingLoad + jump)
        state.history.push(point)
        return { state, note: `You hit ${repsStr} at RIR ${o.bestSet.rir}+ → +${fmt(state.currentLoad - o.workingLoad, ctx.units)}.`, outcome: 'hitTop' }
      }
    }
  }

  if (o.anyMissedBottom) {
    point.outcome = 'missedBottom'
    state.consecutiveMisses = (prev?.consecutiveMisses ?? 0) + 1
    if (state.consecutiveMisses >= 2) {
      state.consecutiveMisses = 0
      const pct = Math.min(10, Math.max(5, ctx.missDropPct)) / 100
      switch (ex.loadMode) {
        case 'bodyweight': {
          state.loadMode = 'assisted'
          state.currentLoad = round(Math.max(jump, ctx.bodyweightKg * pct), 'assisted')
          state.targetReps = ex.repMin
          state.history.push(point)
          return { state, note: `Missed the bottom twice → use ${fmt(state.currentLoad, ctx.units)} of assistance.`, outcome: 'missedBottom' }
        }
        case 'assisted': {
          state.currentLoad = round(o.workingLoad + Math.max(jump, ctx.bodyweightKg * pct), 'assisted')
          state.targetReps = ex.repMin
          state.history.push(point)
          return { state, note: `Missed the bottom twice → more assistance (${fmt(state.currentLoad, ctx.units)}).`, outcome: 'missedBottom' }
        }
        case 'added': {
          const next = round(o.workingLoad * (1 - pct), 'added')
          if (next <= 0 || o.workingLoad - next < jump) {
            state.loadMode = 'bodyweight'; state.currentLoad = 0
          } else state.currentLoad = next
          state.targetReps = ex.repMin
          state.history.push(point)
          return { state, note: `Missed the bottom twice → lighter (${state.loadMode === 'bodyweight' ? 'bodyweight' : fmt(state.currentLoad, ctx.units)}).`, outcome: 'missedBottom' }
        }
        default: {
          let next = round(o.workingLoad * (1 - pct))
          if (next >= o.workingLoad) next = round(o.workingLoad - smallestStepKg(def, ctx.increments, ex.loadMode))
          state.currentLoad = Math.max(0, next)
          state.targetReps = ex.repMin
          state.history.push(point)
          return { state, note: `Missed the bottom twice → −${Math.round(pct * 100)}% to ${fmt(state.currentLoad, ctx.units)}.`, outcome: 'missedBottom' }
        }
      }
    }
    state.currentLoad = o.workingLoad
    state.targetReps = ex.repMin
    state.history.push(point)
    return { state, note: `Missed the bottom of the range once. Same weight – nail ${ex.repMin}+ next time.`, outcome: 'missedBottom' }
  }

  // In range: keep the weight, aim for +1 rep.
  point.outcome = 'inRange'
  state.consecutiveMisses = 0
  state.currentLoad = o.workingLoad
  const minReps = Math.min(...doneSets(ex.sets).map(s => s.reps ?? 0))
  state.targetReps = Math.min(ex.repMax, Math.max(ex.repMin, minReps + 1))
  state.history.push(point)
  return { state, note: `Same weight – aim for ${state.targetReps} reps on every set.`, outcome: 'inRange' }
}

function fmt(kg: number, units: Units) {
  const v = units === 'kg' ? kg : kg / 0.45359237
  const s = Math.round(v * 100) / 100
  return `${s} ${units}`
}
