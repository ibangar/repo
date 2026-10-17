import type { ExerciseDef, Increments, LoadMode, Units } from '../db/types'
import { kgToLb, roundLoadKg, roundToStep } from './units'

/**
 * Smallest achievable jump for an exercise, in KG. Barbell jumps are 2× the
 * smallest plate because you load both sides.
 */
export function smallestStepKg(def: ExerciseDef, inc: Increments, mode: LoadMode = def.defaultLoadMode): number {
  if (mode === 'height') return inc.boxStepCm
  if (mode === 'bell') return inc.kettlebellStepKg
  if (mode === 'assisted') return inc.cableStepKg
  if (mode === 'added') return inc.smallestPlateKg
  switch (def.incrementClass) {
    case 'upperCompound':
    case 'lowerCompound':
      return def.equipment.includes('smith') || def.equipment.includes('barbell') || def.equipment.includes('trapBar') || def.equipment.includes('ezBar')
        ? inc.smallestPlateKg * 2
        : inc.cableStepKg
    case 'dumbbell': return inc.dumbbellStepKg
    case 'isolation': return def.equipment.includes('ezBar') ? inc.smallestPlateKg * 2 : inc.cableStepKg
    case 'kettlebell': return inc.kettlebellStepKg
    case 'box': return inc.boxStepCm
    case 'bodyweight': return inc.smallestPlateKg
  }
}

/**
 * The jump applied when double progression says "go up".
 *  upper compounds +2.5 kg / +5 lb, lower compounds +5 kg / +10 lb,
 *  everything else the smallest available jump.
 */
export function progressionJumpKg(def: ExerciseDef, inc: Increments, units: Units, mode: LoadMode = def.defaultLoadMode): number {
  if (mode === 'height' || mode === 'bell' || mode === 'assisted' || mode === 'added') return smallestStepKg(def, inc, mode)
  switch (def.incrementClass) {
    case 'upperCompound': return units === 'kg' ? 2.5 : 5 * 0.45359237
    case 'lowerCompound': return units === 'kg' ? 5 : 10 * 0.45359237
    default: return smallestStepKg(def, inc, mode)
  }
}

/** Round a load to what the user can actually put on the bar / rack, in kg. */
export function roundLoad(kg: number, def: ExerciseDef, inc: Increments, units: Units, mode: LoadMode = def.defaultLoadMode): number {
  const stepKg = smallestStepKg(def, inc, mode)
  if (mode === 'height') return Math.max(0, roundToStep(kg, stepKg))
  // Increments are stored in kg but the user thinks in display units; when in lb
  // the stored kg step is an exact conversion of their lb step, so round in display units.
  const stepDisplay = units === 'kg' ? stepKg : Math.round(kgToLb(stepKg) * 100) / 100
  return Math.max(0, roundLoadKg(kg, stepDisplay, units))
}
