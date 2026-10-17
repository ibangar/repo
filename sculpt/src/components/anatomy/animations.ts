import type { View } from '../../db/types'
import type { Anchor, EquipmentDef, Pose } from './Figure'

/* ────────────────────────────────────────────────────────────────────────────
 * Keyframe registry. One entry per `animation` key used in data/exercises.ts.
 * Angles follow the conventions documented in Figure.tsx. `t` runs 0..1 over
 * one rep; `peak` marks the moment of peak contraction (glow + "END" label).
 * ──────────────────────────────────────────────────────────────────────────── */
export interface Keyframe { t: number; pose: Pose }
export interface ExerciseAnimationDef {
  view: View
  keyframes: Keyframe[]
  equipment: EquipmentDef[]
  durationMs: number
  ease?: 'inOut' | 'linear' | 'out'
  loop: 'pingpong' | 'cycle'
  anchor?: Anchor
  anchorY?: number
  peak?: number
  /** The loop wraps with a discontinuity (e.g. a jump) – fade through the wrap. */
  snap?: boolean
  labels?: { start: string; end: string }
}

const REST: Pose = { torsoLean: 0, hipFlex: 0, kneeFlex: 0, shoulderFlex: 0, elbowFlex: 0 }
const P = (o: Partial<Pose>): Pose => ({ ...REST, ...o })
const K = (t: number, o: Partial<Pose>): Keyframe => ({ t, pose: P(o) })

/** Standard rep shape: start → (concentric) → peak hold → (slower eccentric) → start. */
function rep(start: Partial<Pose>, end: Partial<Pose>, opts: { up?: number; hold?: number } = {}): { keyframes: Keyframe[]; peak: number } {
  const up = opts.up ?? 0.4, hold = opts.hold ?? 0.12
  return { keyframes: [K(0, start), K(up, end), K(up + hold, end), K(1, start)], peak: up + hold / 2 }
}
/** Rep that starts at the top (presses / squats): top → slow eccentric → bottom → fast concentric → top. */
function repFromTop(top: Partial<Pose>, bottom: Partial<Pose>, opts: { down?: number; hold?: number } = {}): { keyframes: Keyframe[]; peak: number } {
  const down = opts.down ?? 0.45, hold = opts.hold ?? 0.08
  return { keyframes: [K(0, top), K(down, bottom), K(down + hold, bottom), K(0.9, top), K(1, top)], peak: 0.93 }
}

// ── seated / lying set-ups reused by several lifts ──
const INCLINE_SEAT = { torsoLean: -60, hipFlex: 30, kneeFlex: 90, x: 20 }
const INCLINE_BENCH: EquipmentDef = { kind: 'bench', variant: 'incline', x: 52, y: 147, angle: -60 }
const SUPINE = { torsoLean: -90, hipFlex: -17, kneeFlex: 73, x: 40 }
const FLAT_BENCH: EquipmentDef = { kind: 'bench', variant: 'flat', x: 28, y: 139, w: 84 }
const SEATED_FRONT = { hipFlex: 90, kneeFlex: 90 }
const SEAT: EquipmentDef = { kind: 'bench', variant: 'seat', x: 84, y: 136 }

export const ANIMATIONS: Record<string, ExerciseAnimationDef> = {
  /* ───────────── PUSH ───────────── */
  inclineDbPress: {
    view: 'side', loop: 'cycle', durationMs: 2800, equipment: [INCLINE_BENCH, { kind: 'dumbbells' }],
    ...repFromTop({ ...INCLINE_SEAT, shoulderFlex: 92, elbowFlex: 4, armDepth: 20 }, { ...INCLINE_SEAT, shoulderFlex: -48, elbowFlex: 102, armDepth: 20 }),
    labels: { start: 'LOCKOUT', end: 'PRESS' },
  },
  inclineBbPress: {
    view: 'side', loop: 'cycle', durationMs: 2800, equipment: [INCLINE_BENCH, { kind: 'barbell' }],
    ...repFromTop({ ...INCLINE_SEAT, shoulderFlex: 95, elbowFlex: 4, armDepth: 15 }, { ...INCLINE_SEAT, shoulderFlex: -45, elbowFlex: 110, armDepth: 15 }),
  },
  flatBbBench: {
    view: 'side', loop: 'cycle', durationMs: 2800, equipment: [FLAT_BENCH, { kind: 'barbell' }],
    ...repFromTop({ ...SUPINE, shoulderFlex: 80, elbowFlex: 5 }, { ...SUPINE, shoulderFlex: -75, elbowFlex: 160 }),
  },
  dbBench: {
    view: 'side', loop: 'cycle', durationMs: 2800, equipment: [FLAT_BENCH, { kind: 'dumbbells' }],
    ...repFromTop({ ...SUPINE, shoulderFlex: 80, elbowFlex: 5, armDepth: 10 }, { ...SUPINE, shoulderFlex: -80, elbowFlex: 150, armDepth: 10 }),
  },
  seatedDbShoulderPress: {
    view: 'front', loop: 'cycle', durationMs: 2600, equipment: [SEAT, { kind: 'dumbbells' }],
    ...rep({ ...SEATED_FRONT, shoulderAbd: 80, elbowFlex: 95 }, { ...SEATED_FRONT, shoulderAbd: 168, elbowFlex: 4 }),
  },
  lateralRaise: {
    view: 'front', loop: 'cycle', durationMs: 2400, equipment: [{ kind: 'dumbbells' }],
    ...rep({ shoulderAbd: 8, elbowFlex: 12, kneeFlex: 4 }, { shoulderAbd: 92, elbowFlex: 12, kneeFlex: 4 }, { up: 0.38, hold: 0.1 }),
  },
  cableFly: {
    view: 'front', loop: 'cycle', durationMs: 2800,
    equipment: [{ kind: 'cable', anchor: [14, 28], to: 'handR', stack: 'left' }, { kind: 'cable', anchor: [186, 28], to: 'handL', stack: 'right' }],
    ...rep({ shoulderAbd: 86, elbowFlex: 15, shoulderFlex: 0, kneeFlex: 6 }, { shoulderAbd: -18, elbowFlex: 18, shoulderFlex: 62, kneeFlex: 6 }),
  },
  dbFly: {
    view: 'front', loop: 'cycle', durationMs: 2800, equipment: [{ kind: 'bench', variant: 'flatBehind', x: 88, y: 36, w: 24, h: 136 }, { kind: 'dumbbells' }],
    ...repFromTop({ hipFlex: 60, kneeFlex: 90, shoulderAbd: 10, elbowFlex: 25, shoulderFlex: 65 }, { hipFlex: 60, kneeFlex: 90, shoulderAbd: 88, elbowFlex: 20, shoulderFlex: 0 }),
  },
  pecDeck: {
    view: 'front', loop: 'cycle', durationMs: 2600, equipment: [SEAT, { kind: 'pecDeck' }],
    ...rep({ ...SEATED_FRONT, shoulderAbd: 85, elbowFlex: 90 }, { ...SEATED_FRONT, shoulderAbd: 12, elbowFlex: 163, shoulderFlex: 68 }),
  },
  dip: {
    view: 'side', loop: 'cycle', durationMs: 2600, anchor: 'hand', anchorY: 92, equipment: [{ kind: 'dipBars' }],
    ...repFromTop({ torsoLean: 15, hipFlex: 20, kneeFlex: 70, shoulderFlex: 15, elbowFlex: 0 }, { torsoLean: 30, hipFlex: 25, kneeFlex: 75, shoulderFlex: -70, elbowFlex: 100 }),
  },
  ohCableTricepsExt: {
    view: 'side', loop: 'cycle', durationMs: 2400, anchor: 'footNear',
    equipment: [{ kind: 'cable', anchor: [22, 176], to: 'hands', attachment: 'rope', stack: 'left' }],
    ...rep({ torsoLean: 25, legSplit: 12, kneeFlex: 10, hipFlex: 12, shoulderFlex: 185, elbowFlex: 120, x: 10 }, { torsoLean: 25, legSplit: 12, kneeFlex: 10, hipFlex: 12, shoulderFlex: 185, elbowFlex: 8, x: 10 }),
  },
  tricepsPushdown: {
    view: 'side', loop: 'cycle', durationMs: 2200,
    equipment: [{ kind: 'cable', anchor: [166, 22], to: 'hands', attachment: 'rope', stack: 'right' }],
    ...rep({ torsoLean: 15, hipFlex: 12, kneeFlex: 8, legSplit: 6, shoulderFlex: 15, elbowFlex: 100, x: -10 }, { torsoLean: 15, hipFlex: 12, kneeFlex: 8, legSplit: 6, shoulderFlex: 15, elbowFlex: 8, x: -10 }),
  },
  skullCrusher: {
    view: 'side', loop: 'cycle', durationMs: 2600, equipment: [FLAT_BENCH, { kind: 'ezBar' }],
    ...rep({ ...SUPINE, shoulderFlex: 108, elbowFlex: 112 }, { ...SUPINE, shoulderFlex: 108, elbowFlex: 5 }, { up: 0.4, hold: 0.1 }),
  },

  /* ───────────── GLUTES / LEGS ───────────── */
  bbHipThrust: {
    view: 'side', loop: 'cycle', durationMs: 3000, equipment: [{ kind: 'bench', variant: 'hipThrust', x: 14, y: 146, w: 56, h: 8 }, { kind: 'barbell' }],
    ...rep(
      { torsoLean: -42, hipFlex: 83, kneeFlex: 125, shoulderFlex: 2, elbowFlex: 0, neck: 20, x: 35 },
      { torsoLean: -85, hipFlex: 2, kneeFlex: 87, shoulderFlex: 2, elbowFlex: 0, neck: 25, squeeze: 1, x: 35 },
      { up: 0.38, hold: 0.18 },
    ),
    labels: { start: 'HIPS DOWN', end: 'SQUEEZE' },
  },
  backSquat: {
    view: 'side', loop: 'cycle', durationMs: 3200, equipment: [{ kind: 'barbell' }],
    ...repFromTop(
      { torsoLean: 5, hipFlex: 5, kneeFlex: 5, shoulderFlex: -35, elbowFlex: 210, armDepth: 45 },
      { torsoLean: 40, hipFlex: 115, kneeFlex: 110, ankle: 35, shoulderFlex: -35, elbowFlex: 210, armDepth: 45, neck: -10 },
    ),
    labels: { start: 'STAND', end: 'DRIVE UP' },
  },
  frontSquat: {
    view: 'side', loop: 'cycle', durationMs: 3200, equipment: [{ kind: 'barbell' }],
    ...repFromTop(
      { torsoLean: 3, hipFlex: 3, kneeFlex: 3, shoulderFlex: 110, elbowFlex: 170, armDepth: 30 },
      { torsoLean: 25, hipFlex: 115, kneeFlex: 120, ankle: 30, shoulderFlex: 110, elbowFlex: 170, armDepth: 30 },
    ),
  },
  rdl: {
    view: 'side', loop: 'cycle', durationMs: 3200, equipment: [{ kind: 'barbell' }],
    ...repFromTop(
      { torsoLean: 0, hipFlex: 0, kneeFlex: 8, ankle: 8, shoulderFlex: 0, elbowFlex: 0, squeeze: 1 },
      { torsoLean: 85, hipFlex: 100, kneeFlex: 25, ankle: 10, shoulderFlex: 85, elbowFlex: 0, neck: 5 },
    ),
    labels: { start: 'SQUEEZE', end: 'HINGE' },
  },
  trapBarDeadlift: {
    view: 'side', loop: 'cycle', durationMs: 3000, equipment: [{ kind: 'trapBar' }],
    ...rep(
      { torsoLean: 55, hipFlex: 110, kneeFlex: 75, ankle: 20, shoulderFlex: 55, elbowFlex: 0, neck: -10 },
      { torsoLean: 0, hipFlex: 0, kneeFlex: 0, shoulderFlex: 0, elbowFlex: 0, squeeze: 1 },
      { up: 0.4, hold: 0.12 },
    ),
    labels: { start: 'SET', end: 'LOCKOUT' },
  },
  bulgarianSplitSquat: {
    view: 'side', loop: 'cycle', durationMs: 3000, anchor: 'footNear', equipment: [{ kind: 'bench', variant: 'flat', x: 40, y: 146, w: 40, h: 8 }, { kind: 'dumbbells' }],
    ...repFromTop(
      { torsoLean: 20, hipFlex: 23.5, legSplit: 11.5, kneeFlex: 50, kneeSplit: -30, ankle: 10, shoulderFlex: 20, elbowFlex: 0, x: 20, squeeze: 1 },
      { torsoLean: 35, hipFlex: 62, legSplit: 32, kneeFlex: 99, kneeSplit: -24, ankle: 16, shoulderFlex: 35, elbowFlex: 0, x: 20 },
    ),
  },
  reverseLunge: {
    view: 'side', loop: 'cycle', durationMs: 3000, anchor: 'footNear', equipment: [{ kind: 'dumbbells' }],
    ...repFromTop(
      { torsoLean: 0, hipFlex: 0, kneeFlex: 0, shoulderFlex: 0, elbowFlex: 0 },
      { torsoLean: 15, hipFlex: 40, legSplit: 45, kneeFlex: 90.5, kneeSplit: 14.5, ankle: 18, ankleSplit: 17, shoulderFlex: 15, elbowFlex: 0 },
    ),
  },
  stepUp: {
    view: 'side', loop: 'cycle', durationMs: 3000, anchor: 'footNear', equipment: [{ kind: 'box', x: 95, w: 40, h: 40 }, { kind: 'dumbbells' }],
    ...rep(
      { torsoLean: 10, hipFlex: 50, legSplit: 40, kneeFlex: 52.5, kneeSplit: 42.5, ankle: 12.5, ankleSplit: 2.5, shoulderFlex: 10, elbowFlex: 0, lift: 40, x: 15 },
      { torsoLean: 0, hipFlex: 10, legSplit: -10, kneeFlex: 20, kneeSplit: -20, ankle: 0, shoulderFlex: 0, elbowFlex: 0, lift: 40, x: 15, squeeze: 1 },
    ),
  },
  cableHipAbduction: {
    view: 'front', loop: 'cycle', durationMs: 2400,
    equipment: [{ kind: 'cable', anchor: [12, 178], to: 'ankleR', attachment: 'cuff', stack: 'left' }],
    ...rep({ legSplit: 4, kneeFlex: 3, shoulderAbd: 14, elbowFlex: 10, x: 6 }, { legSplit: 42, kneeFlex: 3, shoulderAbd: 14, elbowFlex: 10, x: 6, squeeze: 1 }),
  },
  machineAbduction: {
    view: 'front', loop: 'cycle', durationMs: 2600, equipment: [SEAT, { kind: 'abductionPads' }],
    ...rep({ ...SEATED_FRONT, legAbd: 5, shoulderAbd: 15, elbowFlex: 25 }, { ...SEATED_FRONT, legAbd: 38, shoulderAbd: 15, elbowFlex: 25, squeeze: 1 }),
  },
  cableGluteKickback: {
    view: 'side', loop: 'cycle', durationMs: 2600, anchor: 'footFar',
    equipment: [{ kind: 'frame', x: 170 }, { kind: 'cable', anchor: [176, 176], to: 'ankleNear', attachment: 'cuff', stack: 'right' }],
    ...rep(
      { torsoLean: 25, hipFlex: 30, legSplit: 5, kneeFlex: 15, kneeSplit: 10, shoulderFlex: 70, elbowFlex: 25 },
      { torsoLean: 25, hipFlex: 2.5, legSplit: -22.5, kneeFlex: 7.5, kneeSplit: 2.5, shoulderFlex: 70, elbowFlex: 25, squeeze: 1 },
      { up: 0.4, hold: 0.16 },
    ),
    labels: { start: 'KNEE FORWARD', end: 'KICK + SQUEEZE' },
  },
  boxJump: {
    view: 'side', loop: 'cycle', durationMs: 3400, anchor: 'footNear', snap: true, peak: 0.52, equipment: [{ kind: 'box', x: 112, w: 40, h: 40 }],
    keyframes: [
      K(0, { x: -20 }),
      K(0.1, { x: -20 }),
      K(0.3, { x: -20, torsoLean: 35, hipFlex: 80, kneeFlex: 70, ankle: 25, shoulderFlex: -45, elbowFlex: 20 }),
      K(0.42, { x: 2, lift: 38, torsoLean: 8, hipFlex: 45, kneeFlex: 45, ankle: -15, shoulderFlex: 130, elbowFlex: 10 }),
      K(0.52, { x: 30, lift: 40, torsoLean: 25, hipFlex: 70, kneeFlex: 65, ankle: 20, shoulderFlex: 50, elbowFlex: 20 }),
      K(0.7, { x: 30, lift: 40 }),
      K(1, { x: 30, lift: 40 }),
    ],
    labels: { start: 'LOAD', end: 'LAND SOFT' },
  },
  kbSwing: {
    view: 'side', loop: 'cycle', durationMs: 2200, equipment: [{ kind: 'kettlebell' }],
    keyframes: [
      K(0, { torsoLean: 65, hipFlex: 85, kneeFlex: 25, ankle: 5, shoulderFlex: 40, elbowFlex: 5 }),
      K(0.4, { torsoLean: -3, hipFlex: 0, kneeFlex: 0, shoulderFlex: 88, elbowFlex: 5, squeeze: 1 }),
      K(0.5, { torsoLean: -3, hipFlex: 0, kneeFlex: 0, shoulderFlex: 88, elbowFlex: 5, squeeze: 1 }),
      K(0.9, { torsoLean: 65, hipFlex: 85, kneeFlex: 25, ankle: 5, shoulderFlex: 40, elbowFlex: 5 }),
      K(1, { torsoLean: 65, hipFlex: 85, kneeFlex: 25, ankle: 5, shoulderFlex: 40, elbowFlex: 5 }),
    ],
    peak: 0.45, labels: { start: 'HIKE', end: 'SNAP HIPS' },
  },

  /* ───────────── PULL / ARMS ───────────── */
  pullUp: {
    view: 'back', loop: 'cycle', durationMs: 3000, anchor: 'hand', anchorY: 170, equipment: [{ kind: 'pullupBar' }],
    ...rep({ shoulderAbd: 160, elbowFlex: 5, hipFlex: 15, kneeFlex: 70 }, { shoulderAbd: 60, elbowFlex: 125, hipFlex: 20, kneeFlex: 80 }, { up: 0.4, hold: 0.1 }),
    labels: { start: 'DEAD HANG', end: 'CHIN OVER' },
  },
  latPulldown: {
    view: 'back', loop: 'cycle', durationMs: 2800, equipment: [SEAT, { kind: 'cable', anchor: [100, 4], to: 'hands', attachment: 'bar', stack: 'none' }],
    ...rep({ ...SEATED_FRONT, shoulderAbd: 150, elbowFlex: 8 }, { ...SEATED_FRONT, shoulderAbd: 60, elbowFlex: 120, torsoLean: -12 }),
  },
  chestSupportedRow: {
    view: 'side', loop: 'cycle', durationMs: 2600, equipment: [{ kind: 'bench', variant: 'rowIncline', x: 94, y: 108, angle: 45 }, { kind: 'dumbbells' }],
    ...rep({ torsoLean: 45, hipFlex: 45, kneeFlex: 20, ankle: 20, shoulderFlex: 45, elbowFlex: 0, x: -10 }, { torsoLean: 45, hipFlex: 45, kneeFlex: 20, ankle: 20, shoulderFlex: -15, elbowFlex: 62, x: -10 }),
  },
  dbRow: {
    view: 'side', loop: 'cycle', durationMs: 2600, equipment: [{ kind: 'bench', variant: 'flat', x: 112, y: 130, w: 50 }, { kind: 'dumbbells', side: 'near' }],
    ...rep(
      { torsoLean: 60, hipFlex: 60, legSplit: 8, kneeFlex: 15, ankle: 15, shoulderFlex: 60, armSplit: 0, elbowFlex: 0, elbowSplit: 0, x: -15 },
      { torsoLean: 60, hipFlex: 60, legSplit: 8, kneeFlex: 15, ankle: 15, shoulderFlex: 0, armSplit: -60, elbowFlex: 55, elbowSplit: 55, x: -15 },
    ),
  },
  rearDeltFly: {
    view: 'back', loop: 'cycle', durationMs: 2600, equipment: [{ kind: 'dumbbells' }],
    ...rep({ ...SEATED_FRONT, torsoLean: 35, shoulderAbd: 14, elbowFlex: 15, shoulderFlex: 20 }, { ...SEATED_FRONT, torsoLean: 35, shoulderAbd: 94, elbowFlex: 15, shoulderFlex: 0 }),
  },
  facePull: {
    view: 'front', loop: 'cycle', durationMs: 2600, equipment: [{ kind: 'cable', anchor: [100, 22], to: 'hands', attachment: 'rope', stack: 'none' }],
    ...rep({ shoulderAbd: 15, shoulderFlex: 78, elbowFlex: 10, kneeFlex: 6 }, { shoulderAbd: 86, shoulderFlex: 0, elbowFlex: 118, faDepth: 65, kneeFlex: 6 }),
  },
  inclineDbCurl: {
    view: 'side', loop: 'cycle', durationMs: 2600, equipment: [{ kind: 'bench', variant: 'incline', x: 50, y: 146, angle: -50 }, { kind: 'dumbbells' }],
    ...rep({ torsoLean: -50, hipFlex: 40, kneeFlex: 90, shoulderFlex: -50, elbowFlex: 10, x: 20 }, { torsoLean: -50, hipFlex: 40, kneeFlex: 90, shoulderFlex: -46, elbowFlex: 132, x: 20 }),
  },
  hammerCurl: {
    view: 'front', loop: 'cycle', durationMs: 2400, equipment: [{ kind: 'dumbbells' }],
    ...rep({ shoulderAbd: 6, elbowFlex: 10, kneeFlex: 4 }, { shoulderAbd: 6, elbowFlex: 128, faDepth: 30, kneeFlex: 4 }),
  },
  cableCurl: {
    view: 'side', loop: 'cycle', durationMs: 2400, equipment: [{ kind: 'cable', anchor: [176, 178], to: 'hands', stack: 'right' }],
    ...rep({ torsoLean: 3, hipFlex: 3, kneeFlex: 4, shoulderFlex: 5, elbowFlex: 12, x: -12 }, { torsoLean: 3, hipFlex: 3, kneeFlex: 4, shoulderFlex: 14, elbowFlex: 136, x: -12 }),
  },
}

export function getAnimation(key: string): ExerciseAnimationDef {
  return ANIMATIONS[key] ?? ANIMATIONS.backSquat
}

const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3)

/** Pose at normalised time t (0..1) for a definition. */
export function poseAt(def: ExerciseAnimationDef, t: number): Pose {
  const kfs = def.keyframes
  if (t <= kfs[0].t) return kfs[0].pose
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1]
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t
      const u = span <= 0 ? 1 : (t - a.t) / span
      const e = def.ease === 'linear' ? u : def.ease === 'out' ? easeOut(u) : easeInOut(u)
      return lerp(a.pose, b.pose, e)
    }
  }
  return kfs[kfs.length - 1].pose
}

function lerp(a: Pose, b: Pose, t: number): Pose {
  const A = a as unknown as Record<string, number | undefined>, B = b as unknown as Record<string, number | undefined>
  const out: Record<string, number> = {}
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const av = A[k] ?? 0, bv = B[k] ?? 0
    out[k] = av + (bv - av) * t
  }
  return out as unknown as Pose
}

/** 0..1 bell curve around the peak – drives the muscle glow. */
export function glowAt(def: ExerciseAnimationDef, t: number): number {
  const peak = def.peak ?? 0.5
  const d = Math.min(Math.abs(t - peak), Math.abs(t - peak + 1), Math.abs(t - peak - 1))
  return Math.max(0, 1 - d / 0.4)
}
