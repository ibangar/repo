/**
 * Epley estimated 1RM. We feed it reps + RIR so a set of 8 @ RIR 2 is treated
 * as a 10-rep max – a truer estimate of what you could actually lift once.
 */
export function epley(loadKg: number, reps: number, rir = 0): number {
  const effective = Math.max(1, reps + Math.max(0, rir))
  if (effective === 1) return loadKg
  return loadKg * (1 + effective / 30)
}

/** Inverse Epley: the load you could lift for `reps` given an e1RM. */
export function loadForReps(e1rm: number, reps: number): number {
  if (reps <= 1) return e1rm
  return e1rm / (1 + reps / 30)
}
