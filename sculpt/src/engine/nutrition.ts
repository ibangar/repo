export interface ProteinTargets {
  perKg: number
  dailyG: number
  perMealG: number
  rangeLowG: number
  rangeHighG: number
}

export function proteinTargets(bodyweightKg: number, perKg = 1.8): ProteinTargets {
  const clamped = Math.min(2.2, Math.max(1.6, perKg))
  const daily = Math.round(bodyweightKg * clamped)
  return {
    perKg: clamped, dailyG: daily, perMealG: Math.round(daily / 2),
    rangeLowG: Math.round(bodyweightKg * 1.6), rangeHighG: Math.round(bodyweightKg * 2.2),
  }
}

/** Half a bar of Tony's Chocolonely (90 g bar) is part of the plan. */
export const CHOCOLATE = { label: "Half a bar of Tony's", grams: 90, kcal: 250 }
