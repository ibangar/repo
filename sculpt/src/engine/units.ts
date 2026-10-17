import type { Units } from '../db/types'

export const KG_PER_LB = 0.45359237
export const CM_PER_IN = 2.54

export const kgToLb = (kg: number) => kg / KG_PER_LB
export const lbToKg = (lb: number) => lb * KG_PER_LB

export function toDisplay(kg: number, units: Units): number {
  return units === 'kg' ? kg : kgToLb(kg)
}
export function fromDisplay(value: number, units: Units): number {
  return units === 'kg' ? value : lbToKg(value)
}

/** Round `value` to the nearest multiple of `step` (step > 0). */
export function roundToStep(value: number, step: number): number {
  if (step <= 0) return value
  const r = Math.round(value / step) * step
  // kill floating noise (e.g. 62.50000000001)
  return Math.round(r * 1000) / 1000
}

/**
 * Round a KG load to the nearest achievable value in the user's display unit.
 * `stepDisplay` is the smallest achievable jump expressed in display units.
 */
export function roundLoadKg(kg: number, stepDisplay: number, units: Units): number {
  const disp = toDisplay(kg, units)
  const rounded = roundToStep(disp, stepDisplay)
  return Math.round(fromDisplay(rounded, units) * 1000) / 1000
}

export function formatLoad(kg: number | null | undefined, units: Units, withUnit = true): string {
  if (kg == null || Number.isNaN(kg)) return '—'
  const v = toDisplay(kg, units)
  const s = Number.isInteger(v) ? String(v) : (Math.round(v * 100) / 100).toString()
  return withUnit ? `${s} ${units}` : s
}

export function formatCm(cm: number | null | undefined, units: Units): string {
  if (cm == null) return '—'
  if (units === 'kg') return `${Math.round(cm)} cm`
  return `${Math.round(cm / CM_PER_IN)} in`
}

export const unitLabel = (units: Units) => units
