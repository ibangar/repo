let enabled = true
export function setHaptics(on: boolean) { enabled = on }
export function vibrate(pattern: number | number[] = 12) {
  if (!enabled) return
  try { navigator.vibrate?.(pattern) } catch { /* unsupported */ }
}
export const haptic = {
  tap: () => vibrate(8),
  success: () => vibrate([20, 40, 30]),
  warn: () => vibrate([40, 60, 40, 60, 40]),
  done: () => vibrate([60, 80, 60, 80, 120]),
}
