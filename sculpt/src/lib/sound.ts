let ctx: AudioContext | null = null
let enabled = true
export function setSound(on: boolean) { enabled = on }

function getCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    // iOS reports a non-standard 'interrupted' state after screen lock / a call; anything that isn't running needs resume().
    if (ctx.state !== 'running') ctx.resume().catch(() => { /* not allowed yet – next gesture will retry */ })
    return ctx
  } catch { return null }
}

/** Call from a user gesture once so iOS lets us play later. */
export function primeAudio() { getCtx() }

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', gain = 0.25) {
  const c = getCtx(); if (!c) return
  const o = c.createOscillator(), g = c.createGain()
  o.type = type; o.frequency.value = freq
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(c.destination); o.start(at); o.stop(at + dur + 0.02)
}

export const sound = {
  tick: () => { if (!enabled) return; const c = getCtx(); if (c) tone(880, c.currentTime, 0.06, 'square', 0.08) },
  restDone: () => {
    if (!enabled) return; const c = getCtx(); if (!c) return
    const t = c.currentTime
    tone(660, t, 0.15); tone(880, t + 0.16, 0.15); tone(1320, t + 0.32, 0.35, 'sine', 0.3)
  },
  pr: () => {
    if (!enabled) return; const c = getCtx(); if (!c) return
    const t = c.currentTime
    ;[523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.09, 0.3, 'triangle', 0.22))
  },
  complete: () => {
    if (!enabled) return; const c = getCtx(); if (!c) return
    const t = c.currentTime
    ;[392, 523, 659, 784].forEach((f, i) => tone(f, t + i * 0.12, 0.5, 'sine', 0.25))
  },
}
