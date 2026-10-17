import type { ExerciseState, PR, SessionExercise, WorkoutSession } from '../db/types'
import { getExercise } from '../data/exercises'
import { effectiveLoadKg, evaluateSets } from './progression'
import { formatLoad } from './units'
import type { Units } from '../db/types'

/** Detect PRs for a completed exercise against the PREVIOUS state. */
export function detectPRs(session: WorkoutSession, ex: SessionExercise, prev: ExerciseState | undefined, units: Units): PR[] {
  const def = getExercise(ex.exerciseId)
  const o = evaluateSets(ex, session.bodyweightKg)
  const prs: PR[] = []
  if (!o.bestSet || o.workingLoad == null) return prs
  const mk = (type: PR['type'], value: number, detail: string): PR => ({
    id: `${session.id}-${ex.exerciseId}-${type}`, exerciseId: ex.exerciseId, type, value, detail, date: session.date, sessionId: session.id,
  })
  if (ex.loadMode === 'height') {
    if (prev?.bestLoad != null && o.workingLoad > prev.bestLoad) prs.push(mk('height', o.workingLoad, `${o.workingLoad} cm box`))
    return prs
  }
  if (ex.loadMode === 'bell') {
    if (prev?.bestLoad != null && o.workingLoad > prev.bestLoad) prs.push(mk('bell', o.workingLoad, `${formatLoad(o.workingLoad, units)} bell × ${o.bestSet.reps}`))
    return prs
  }
  // Only count PRs once there is something to beat (not the calibration session).
  if (prev?.calibrated && prev.history.length > 0) {
    const eff = effectiveLoadKg(ex.loadMode, o.bestSet.load, session.bodyweightKg)
    if (o.bestE1rm != null && prev.bestE1rm != null && o.bestE1rm > prev.bestE1rm + 0.01) {
      prs.push(mk('e1rm', o.bestE1rm, `${formatLoad(eff, units)} × ${o.bestSet.reps} @${o.bestSet.rir} → e1RM ${formatLoad(Math.round(o.bestE1rm * 10) / 10, units)}`))
    }
    if (ex.loadMode !== 'assisted' && prev.bestLoad != null && o.workingLoad > prev.bestLoad + 0.01) {
      prs.push(mk('load', o.workingLoad, `${formatLoad(o.workingLoad, units)} – heaviest ${def.shortName} yet`))
    }
  }
  return prs
}
