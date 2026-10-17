import { useId, type ReactNode } from 'react'
import type { MuscleGroup, View } from '../../db/types'

/* ────────────────────────────────────────────────────────────────────────────
 * Procedural muscular figure rig.
 *
 * All joint angles are in degrees. Convention for the SIDE camera (figure faces
 * +x / right): a segment's absolute angle `a` is measured from "straight down",
 * positive = swings forward. 0 = down, 90 = forward, 180 = up, −90 = back.
 *
 *   torsoLean     forward lean of the pelvis/lower torso (−90 = lying supine)
 *   spineCurve    extra forward flexion of the upper torso at the waist
 *   neck          forward flexion of the head
 *   hipFlex       hip flexion (0 = thigh in line with torso, 90 = thigh ⟂ torso)
 *   kneeFlex      knee flexion (0 = straight)
 *   ankle         dorsiflexion (toes up) – negative = plantar flexion
 *   shoulderFlex  shoulder flexion (0 = arm hanging along torso, 180 = overhead)
 *   shoulderAbd   abduction – used by the FRONT/BACK cameras (0 = arm down, 90 = out)
 *   elbowFlex     elbow flexion (0 = straight)
 *   *Split        per-side offsets: near/right = base + split, far = base − split
 *                 (FRONT/BACK cameras: the split applies to the right side only)
 *   legAbd        hip abduction for FRONT/BACK cameras
 *   armDepth      out-of-plane angle of the arms → foreshortens them (side view)
 *   faDepth       out-of-plane angle of the forearms (frontal views)
 *   x / lift      root translate: horizontal offset and height of the anchor above the floor
 *   squeeze       0..1 glute contraction (bulges + lifts the glutes)
 * ──────────────────────────────────────────────────────────────────────────── */
export interface Pose {
  torsoLean: number
  spineCurve?: number
  neck?: number
  hipFlex: number
  kneeFlex: number
  ankle?: number
  shoulderFlex: number
  shoulderAbd?: number
  elbowFlex: number
  armSplit?: number
  legSplit?: number
  kneeSplit?: number
  ankleSplit?: number
  elbowSplit?: number
  abdSplit?: number
  legAbd?: number
  armDepth?: number
  faDepth?: number
  x?: number
  lift?: number
  squeeze?: number
}

export type Anchor = 'foot' | 'footNear' | 'footFar' | 'hand' | 'hip'

export type EquipmentDef =
  | { kind: 'barbell' | 'ezBar' | 'kettlebell' | 'trapBar' }
  | { kind: 'dumbbells'; side?: 'near' | 'far' | 'both' }
  | { kind: 'bench'; variant: 'flat' | 'incline' | 'hipThrust' | 'seat' | 'rowIncline' | 'flatBehind' | 'block'; x: number; y: number; w?: number; h?: number; angle?: number }
  | { kind: 'cable'; anchor: [number, number]; to: 'hands' | 'handNear' | 'handFar' | 'ankleNear' | 'handR' | 'handL' | 'ankleR' | 'both'; stack?: 'left' | 'right' | 'none'; attachment?: 'handle' | 'rope' | 'bar' | 'cuff' }
  | { kind: 'box'; x: number; w: number; h: number }
  | { kind: 'pullupBar' }
  | { kind: 'dipBars' }
  | { kind: 'pecDeck' }
  | { kind: 'abductionPads' }
  | { kind: 'frame'; x: number }
  | { kind: 'smithRails'; x: number }

export interface FigureProps {
  pose: Pose
  view: View
  /** Muscle → intensity 0..1 */
  highlight?: Partial<Record<MuscleGroup, number>>
  /** 0..1 multiplier applied to the highlight (pulses with the rep). */
  glow?: number
  equipment?: EquipmentDef[]
  anchor?: Anchor
  /** Height above the floor of the anchor point for `anchor: 'hand'`. */
  anchorY?: number
  /** 'skin' = anatomical render, 'chart' = dark body-map style. */
  mode?: 'skin' | 'chart'
  /** Draw a subtle floor shadow. */
  shadow?: boolean
  className?: string
  style?: React.CSSProperties
  viewBox?: string
  children?: ReactNode
}

export const VIEW_W = 200
export const VIEW_H = 200
export const FLOOR_Y = 184
export const CX = 100

export const DEFAULT_POSE: Required<Pose> = {
  torsoLean: 0, spineCurve: 0, neck: 0, hipFlex: 0, kneeFlex: 0, ankle: 0, shoulderFlex: 0, shoulderAbd: 0, elbowFlex: 0,
  armSplit: 0, legSplit: 0, kneeSplit: 0, ankleSplit: 0, elbowSplit: 0, abdSplit: 0, legAbd: 0, armDepth: 0, faDepth: 0, x: 0, lift: 0, squeeze: 0,
}

export function fullPose(p: Pose): Required<Pose> { return { ...DEFAULT_POSE, ...p } }

export function lerpPose(a: Pose, b: Pose, t: number): Required<Pose> {
  const A = fullPose(a), B = fullPose(b)
  const out = { ...A }
  for (const k of Object.keys(DEFAULT_POSE) as (keyof Pose)[]) out[k] = A[k] + (B[k] - A[k]) * t
  return out
}

/* ── geometry ───────────────────────────────────────────────────────────── */
const L = { torsoLo: 22, torsoUp: 26, neck: 7, head: 9.5, ua: 27, fa: 25, hand: 3.5, thigh: 42, shank: 40, footF: 15, footB: 4, footH: 5 }
const rad = (d: number) => (d * Math.PI) / 180
const dir = (a: number) => ({ x: Math.sin(rad(a)), y: Math.cos(rad(a)) })
const add = (p: Pt, d: { x: number; y: number }, l: number): Pt => ({ x: p.x + d.x * l, y: p.y + d.y * l })
const f1 = (n: number) => Math.round(n * 10) / 10

type Pt = { x: number; y: number }
type P2 = [number, number]

/** Closed smooth path through points (Catmull–Rom → cubic Bézier). */
function blob(pts: P2[]): string {
  const n = pts.length
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C${f1(c1x)} ${f1(c1y)} ${f1(c2x)} ${f1(c2y)} ${f1(p2[0])} ${f1(p2[1])}`
  }
  return d + 'Z'
}
/** Mirror a right-half outline (ordered bottom → top) into a full symmetric outline. */
function sym(right: P2[]): P2[] {
  const left = right.slice(1, -1).reverse().map(([x, y]) => [-x, y] as P2)
  return [...right, ...left]
}
/** Flip authoring coords (y up) into SVG coords (y down). */
const flip = (pts: P2[]): P2[] => pts.map(([x, y]) => [x, -y])
const mir = (pts: P2[]): P2[] => pts.map(([x, y]) => [-x, y])
function rr(x: number, y: number, w: number, h: number, r: number) {
  return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`
}

/* ── shapes: SIDE camera (local coords, +y distal along the segment) ──────── */
// Torso: +y hip→shoulder, +x posterior, −x anterior.
const S = {
  torsoLo: blob([[-6, -9], [-8.5, -2], [-9, 6], [-8.5, 14], [-8.6, 22], [-9, 27], [9, 27], [7, 20], [6.5, 14], [8, 8], [13, 2], [13.5, -5], [9, -10], [1, -11]]),
  glutes: blob([[6.5, 10], [12.5, 7.5], [15.5, 1], [14, -6.5], [9, -10.5], [3, -9.5], [2, -2], [3.5, 6]]),
  abs: blob([[-8.6, 2], [-9.2, 10], [-9.3, 20], [-8.6, 26], [-5.6, 26], [-5.8, 18], [-6, 10], [-6.4, 2]]),
  absLines: 'M-9 8.5 L-6 8.5 M-9.1 14.5 L-6 14.5 M-9.2 20.5 L-6 20.5 M-7.6 3 L-7.6 25',
  obliques: blob([[-6, 6], [-3, 8], [-2.6, 20], [-5, 25], [-8.4, 23], [-8.5, 12]]),
  lowerBack: blob([[1.5, 10], [6.3, 12], [7.5, 20], [8.5, 27], [1.5, 27], [0.5, 18]]),
  torsoUp: blob([[-9, 18], [-10, 26], [-13.5, 32], [-13.6, 38], [-11, 43], [-7, 46.5], [-3, 48], [4, 48.5], [9, 46], [12, 41], [12.5, 34], [11, 26], [9, 18]]),
  chest: blob([[-9, 26], [-13, 30], [-13.8, 36], [-11.5, 39.5], [-8, 38], [-7, 31]]),
  upperChest: blob([[-11.5, 38], [-12.6, 41], [-10, 44], [-6.5, 45.2], [-6, 41.5], [-8, 38.5]]),
  lats: blob([[5, 22], [10, 26], [12.3, 33], [11, 39], [7, 38], [4, 30]]),
  upperBack: blob([[6, 38], [11.5, 40], [11.2, 45], [7, 46.5], [4, 44]]),
  traps: blob([[-2.5, 46], [3, 47.5], [9, 45.8], [7.5, 48.8], [0, 49.6], [-3.5, 48]]),
  neck: blob([[-3.5, -1], [-3.2, 7], [3.2, 7], [3.8, -1]]),
  head: blob([[-8.5, 4], [-9.2, 8], [-9.6, 12], [-8.2, 16], [-5, 19], [0, 19.6], [6, 18.2], [9, 13], [8.6, 6], [5, 1], [0, -0.3]]),
  hair: blob([[-6.2, 17.2], [-1, 19.9], [5.2, 19.1], [9.2, 14.2], [9.8, 8], [7.2, 10], [3.5, 15], [-2.5, 16.4]]),
  // Upper arm: +x anterior.
  ua: blob([[-7, 0], [-6.5, 8], [-5.8, 16], [-4, 27], [4, 27], [6, 16], [6.5, 8], [7, 0], [4.5, -5], [0, -6.5], [-4.5, -5]]),
  rearDelts: blob([[-7.4, 0.5], [-6.2, 6], [-2.6, 8], [-2, -1], [-4.2, -5]]),
  sideDelts: blob([[-3.2, -6.4], [3.2, -6.4], [4.2, -1], [3.2, 8], [-3.2, 8], [-4.2, -1]]),
  frontDelts: blob([[2, -1], [4.5, -5], [7.4, 0.5], [6.2, 6], [2.6, 8]]),
  biceps: blob([[1.5, 8], [5.5, 10], [6.4, 17], [4, 24], [1, 21]]),
  triceps: blob([[-1.5, 7], [-5.5, 9], [-6.3, 18], [-4, 25], [-1.5, 21]]),
  fa: blob([[-4.5, 0], [-5.3, 7], [-4, 16], [-2.7, 25], [2.7, 25], [4, 16], [5.3, 7], [4.5, 0]]),
  forearms: blob([[-3, 1.5], [-4.7, 8], [-3, 17], [0, 15], [3, 17], [4.7, 8], [3, 1.5]]),
  // Thigh: +x anterior.
  thigh: blob([[-9, 0], [-9.2, 10], [-8.2, 22], [-6, 34], [-4.6, 42], [4.6, 42], [6.2, 36], [8.6, 22], [9.6, 10], [8, 0]]),
  quads: blob([[1, 2], [8, 6], [9.3, 20], [7, 34], [2.6, 38.5], [1, 24]]),
  hamstrings: blob([[-1, 4], [-7.6, 6], [-8.9, 20], [-6.6, 34], [-2, 38], [-1.6, 22]]),
  shank: blob([[-4, 0], [-7, 8], [-6.6, 16], [-4, 28], [-2.6, 40], [2.6, 40], [3.6, 28], [4.2, 14], [4.6, 4], [3.6, 0]]),
  calves: blob([[-2, 1], [-7.1, 8], [-6.9, 18], [-4, 28], [-1, 24], [0, 10]]),
  // Foot: origin ankle, +y toward toes, +x up (sole at −x).
  foot: blob([[1.2, -4], [-3.5, -4.6], [-5, -2], [-5, 13], [-4, 15.6], [-1, 15], [0.5, 6], [1.6, 0]]),
}

/* ── shapes: FRONT / BACK cameras (authored y-up, converted) ─────────────── */
const torsoHalf: P2[] = [[0, -11], [6, -10], [12, -5], [14.5, 3], [14, 10], [12.5, 19], [13, 26], [16.5, 32], [18.5, 40], [17.5, 45], [11, 48], [5, 50], [0, 50.5]]
const F = {
  torso: blob(flip(sym(torsoHalf))),
  neck: rr(-4.5, -57, 9, 10, 2.5),
  headD: 'M0 -75.6c5 0 9 4.8 9 11c0 6.6 -4.2 11.2 -9 11.2s-9 -4.6 -9 -11.2c0 -6.2 4 -11 9 -11Z',
  hair: blob(flip([[-9, 66], [-8, 72], [-3, 76], [3, 76], [8, 72], [9, 66], [5.5, 68.5], [0, 70], [-5.5, 68.5]])),
  hairBack: blob(flip([[-9.2, 62], [-9, 72], [-3, 76], [3, 76], [9, 72], [9.2, 62], [5, 58], [-5, 58]])),
  // front torso
  chestR: blob(flip([[1.5, 27.5], [2, 40.5], [12, 41.5], [17.5, 36.5], [16, 30], [9, 27]])),
  upperChestR: blob(flip([[2.5, 38], [2.5, 41.6], [12, 42], [17, 37.5], [13, 36], [6, 36.5]])),
  abs: [rr(1.3, -36, 4.6, 5.5, 1.6), rr(1.3, -29.5, 4.6, 6, 1.6), rr(1.3, -22.5, 4.6, 6, 1.6), rr(1, -15.5, 5, 7, 2),
    rr(-5.9, -36, 4.6, 5.5, 1.6), rr(-5.9, -29.5, 4.6, 6, 1.6), rr(-5.9, -22.5, 4.6, 6, 1.6), rr(-6, -15.5, 5, 7, 2)].join(''),
  obliquesR: blob(flip([[6.5, 8], [11.5, 12], [12.8, 23], [9.5, 27], [6.6, 24]])),
  trapsFrontR: blob(flip([[4.5, 47.5], [10.5, 47.5], [16.5, 45], [13.5, 48], [7, 50.5], [4.5, 50.5]])),
  abductorsR: blob(flip([[9, 2], [14.5, 5], [15, -3], [12, -7], [9, -4]])),
  // back torso
  traps: blob(flip([[0, 52], [9, 49], [16, 45.5], [8, 37], [0, 30], [-8, 37], [-16, 45.5], [-9, 49]])),
  upperBackR: blob(flip([[2, 44], [9, 45], [14, 38], [9, 33], [2, 31]])),
  latsR: blob(flip([[7, 36], [17, 38.5], [18.5, 31], [15, 22], [8, 16], [2.5, 22], [3, 32]])),
  lowerBack: blob(flip([[1, 8], [6, 9], [8, 20], [6, 30], [1, 30]])) + blob(flip([[-1, 8], [-6, 9], [-8, 20], [-6, 30], [-1, 30]])),
  glutesR: blob(flip([[1, 8], [9, 10], [15, 5], [16.5, -3], [12, -10.5], [4, -12.5], [0.5, -6], [0.5, 2]])),
  // limbs (right side, +x outward, +y distal)
  thigh: blob([[-7.5, 0], [-8, 10], [-6.5, 26], [-4.5, 42], [4.5, 42], [7, 30], [9.5, 12], [9, 0]]),
  quads: blob([[-4, 5], [-6, 20], [-4, 36], [0, 39], [4, 36], [7, 20], [6, 5], [0, 2.5]]),
  quadLines: 'M0 6 L0 36 M-3.5 12 L-2 34 M3.5 12 L2 34',
  adductors: blob([[-7.5, 1], [-8, 12], [-6, 24], [-4.5, 10], [-4, 2]]),
  hamstrings: blob([[-4, 5], [-6.5, 22], [-4, 38], [0, 40], [4, 38], [6.5, 22], [4, 5], [0, 3]]),
  hamLine: 'M0 8 L0 36',
  shank: blob([[-5, 0], [-6.5, 10], [-5, 24], [-3, 40], [3, 40], [4.5, 24], [6, 10], [5, 0]]),
  calvesFront: blob([[-2, 2], [-6.5, 10], [-5, 22], [-1, 18], [0, 6]]),
  calvesBack: blob([[-5, 3], [-6.5, 12], [-4, 24], [0, 22], [4, 24], [6.5, 12], [5, 3], [0, 1]]),
  foot: blob([[-4, 0], [-5, 3], [-3.5, 5.6], [3.5, 5.6], [5, 3], [4, 0]]),
  ua: blob([[-6, 0], [-5.5, 9], [-4, 27], [4, 27], [6, 17], [7, 7], [6.5, 0], [4, -5.5], [0, -7], [-4, -5.5]]),
  deltInner: blob([[-6, -5], [-6.5, 3], [-2, 7], [1, 1], [0, -6.5]]),
  sideDelts: blob([[0.5, -7], [5, -5], [7.5, 2], [6.5, 8], [2, 8], [1, 0]]),
  biceps: blob([[-4.5, 9], [-5.5, 17], [-3.8, 25], [0, 24], [1, 15], [-1, 9]]),
  tricepsLat: blob([[2, 9], [6, 14], [5, 22], [3, 25], [2, 18]]),
  triceps: blob([[-4, 9], [-5, 18], [-3.5, 26], [3, 26], [5.5, 17], [4, 9], [0, 8]]),
  fa: blob([[-4.5, 0], [-5.5, 8], [-3, 25], [3, 25], [5.5, 8], [4.5, 0]]),
  forearms: blob([[-3.5, 1], [-4.8, 8], [-2.5, 18], [2.5, 18], [4.8, 8], [3.5, 1]]),
}
const FM = { // mirrored copies for the left side of frontal torso muscles
  chestL: blob(flip(mir([[1.5, 27.5], [2, 40.5], [12, 41.5], [17.5, 36.5], [16, 30], [9, 27]]))),
  upperChestL: blob(flip(mir([[2.5, 38], [2.5, 41.6], [12, 42], [17, 37.5], [13, 36], [6, 36.5]]))),
  obliquesL: blob(flip(mir([[6.5, 8], [11.5, 12], [12.8, 23], [9.5, 27], [6.6, 24]]))),
  trapsFrontL: blob(flip(mir([[4.5, 47.5], [10.5, 47.5], [16.5, 45], [13.5, 48], [7, 50.5], [4.5, 50.5]]))),
  abductorsL: blob(flip(mir([[9, 2], [14.5, 5], [15, -3], [12, -7], [9, -4]]))),
  upperBackL: blob(flip(mir([[2, 44], [9, 45], [14, 38], [9, 33], [2, 31]]))),
  latsL: blob(flip(mir([[7, 36], [17, 38.5], [18.5, 31], [15, 22], [8, 16], [2.5, 22], [3, 32]]))),
  glutesL: blob(flip(mir([[1, 8], [9, 10], [15, 5], [16.5, -3], [12, -10.5], [4, -12.5], [0.5, -6], [0.5, 2]]))),
}

/* ── skeleton ───────────────────────────────────────────────────────────── */
interface Arm { shoulder: Pt; elbow: Pt; wrist: Pt; hand: Pt; aUa: number; aFa: number; kUa: number; kFa: number }
interface Leg { hip: Pt; knee: Pt; ankle: Pt; toe: Pt; heel: Pt; soleHeel: Pt; soleToe: Pt; aThigh: number; aShank: number; aFoot: number; kThigh: number; kShank: number }
export interface Skeleton {
  view: View
  hip: Pt; waist: Pt; shoulder: Pt; neckBase: Pt; neckTop: Pt; head: Pt
  aTorso: number; aUpper: number; aNeck: number; torsoScale: number
  arms: Arm[]   // side: [near, far]  frontal: [right, left]
  legs: Leg[]
  floorY: number
}

function sideArm(p: Required<Pose>, shoulder: Pt, aUpper: number, s: number): Arm {
  const flex = p.shoulderFlex + s * p.armSplit
  const elb = p.elbowFlex + s * p.elbowSplit
  const k = Math.max(0.2, Math.cos(rad(p.armDepth)))
  const aUa = aUpper - 180 + flex
  const aFa = aUa + elb
  const elbow = add(shoulder, dir(aUa), L.ua * k)
  const wrist = add(elbow, dir(aFa), L.fa * k)
  const hand = add(wrist, dir(aFa), L.hand * k)
  return { shoulder, elbow, wrist, hand, aUa, aFa, kUa: k, kFa: k }
}
function sideLeg(p: Required<Pose>, hip: Pt, lean: number, s: number): Leg {
  const hf = p.hipFlex + s * p.legSplit
  const kf = p.kneeFlex + s * p.kneeSplit
  const aThigh = -lean + hf
  const aShank = aThigh - kf
  const aFoot = aShank + 90 + p.ankle + s * p.ankleSplit
  const knee = add(hip, dir(aThigh), L.thigh)
  const ankle = add(knee, dir(aShank), L.shank)
  const fd = dir(aFoot)
  // local +x of the foot (up) in world: rotate(-aFoot) applied to (1,0) = (cos a, −sin a)
  const up = { x: Math.cos(rad(aFoot)), y: -Math.sin(rad(aFoot)) }
  const toe = add(ankle, fd, L.footF)
  const heel = add(ankle, fd, -L.footB)
  const soleHeel = add(heel, up, -L.footH)
  const soleToe = add(toe, up, -L.footH)
  return { hip, knee, ankle, toe, heel, soleHeel, soleToe, aThigh, aShank, aFoot, kThigh: 1, kShank: 1 }
}

function frontalArm(p: Required<Pose>, shoulder: Pt, s: number, isRight: boolean): Arm {
  const abd = p.shoulderAbd + (isRight ? p.abdSplit : 0)
  const flex = p.shoulderFlex + (isRight ? p.armSplit : 0)
  const elb = p.elbowFlex + (isRight ? p.elbowSplit : 0)
  const kUa = Math.max(0.15, Math.cos(rad(flex)))
  const kFa = Math.max(0.15, Math.cos(rad(flex)) * Math.cos(rad(p.faDepth)))
  const aUa = abd, aFa = abd + elb
  const d1 = { x: s * Math.sin(rad(aUa)), y: Math.cos(rad(aUa)) }
  const d2 = { x: s * Math.sin(rad(aFa)), y: Math.cos(rad(aFa)) }
  const elbow = add(shoulder, d1, L.ua * kUa)
  const wrist = add(elbow, d2, L.fa * kFa)
  const hand = add(wrist, d2, L.hand * kFa)
  return { shoulder, elbow, wrist, hand, aUa, aFa, kUa, kFa }
}
function frontalLeg(p: Required<Pose>, hipJ: Pt, s: number, isRight: boolean): Leg {
  // Frontal cameras: legSplit = extra ABDUCTION of the right leg, kneeSplit = extra knee flexion of the right leg.
  const hf = p.hipFlex
  const kf = p.kneeFlex + (isRight ? p.kneeSplit : 0)
  const abd = Math.max(-4, p.legAbd + (isRight ? p.legSplit : 0))
  const aThigh = abd
  const kThigh = Math.max(0.18, Math.cos(rad(hf)))
  const kShank = Math.max(0.18, Math.cos(rad(hf - kf)))
  const d1 = { x: s * Math.sin(rad(aThigh)), y: Math.cos(rad(aThigh)) }
  const aShank = abd * 0.4
  const d2 = { x: s * Math.sin(rad(aShank)), y: Math.cos(rad(aShank)) }
  const knee = add(hipJ, d1, L.thigh * kThigh)
  const ankle = add(knee, d2, L.shank * kShank)
  const sole = { x: ankle.x, y: ankle.y + L.footH }
  return { hip: hipJ, knee, ankle, toe: sole, heel: sole, soleHeel: sole, soleToe: sole, aThigh, aShank, aFoot: 0, kThigh, kShank }
}

export function computeSkeleton(view: View, pose: Pose, anchor: Anchor = 'foot', anchorY = 0): Skeleton {
  const p = fullPose(pose)
  const lean = p.torsoLean
  const hip0: Pt = { x: 0, y: 0 }
  let sk: Skeleton
  if (view === 'side') {
    const aTorso = 180 - lean
    const aUpper = aTorso - p.spineCurve
    const aNeck = aUpper - p.neck
    const waist = add(hip0, dir(aTorso), L.torsoLo)
    const upTop = add(waist, dir(aUpper), L.torsoUp)
    // shoulder joint sits slightly posterior on the upper torso: local (3, 21) from the waist
    const post = { x: Math.cos(rad(aUpper)), y: -Math.sin(rad(aUpper)) }
    const shoulder = add(add(waist, dir(aUpper), 21), post, 3)
    const neckBase = upTop
    const neckTop = add(neckBase, dir(aNeck), L.neck)
    const head = add(neckTop, dir(aNeck), L.head)
    const arms = [sideArm(p, shoulder, aUpper, 1), sideArm(p, shoulder, aUpper, -1)]
    const legs = [sideLeg(p, hip0, lean, 1), sideLeg(p, hip0, lean, -1)]
    sk = { view, hip: hip0, waist, shoulder, neckBase, neckTop, head, aTorso, aUpper, aNeck, torsoScale: 1, arms, legs, floorY: FLOOR_Y }
  } else {
    const sy = Math.max(0.3, Math.cos(rad(Math.abs(lean))))
    const H = L.torsoLo + L.torsoUp
    const waist = { x: 0, y: -L.torsoLo * sy }
    const shoulder = { x: 0, y: -(H - 2) * sy }
    const neckBase = { x: 0, y: -H * sy }
    const neckTop = { x: 0, y: -(H + L.neck) * sy }
    const head = { x: 0, y: -(H + L.neck + L.head) * sy }
    const sR = { x: 19, y: shoulder.y }, sL = { x: -19, y: shoulder.y }
    const hR = { x: 9, y: 0 }, hL = { x: -9, y: 0 }
    const arms = [frontalArm(p, sR, 1, true), frontalArm(p, sL, -1, false)]
    const legs = [frontalLeg(p, hR, 1, true), frontalLeg(p, hL, -1, false)]
    sk = { view, hip: hip0, waist, shoulder, neckBase, neckTop, head, aTorso: 180, aUpper: 180, aNeck: 180, torsoScale: sy, arms, legs, floorY: FLOOR_Y }
  }
  // ── anchoring / grounding ──
  let dx = CX + p.x, dy = FLOOR_Y - p.lift
  const lowest = (ls: Leg[]) => Math.max(...ls.flatMap(l => [l.soleHeel.y, l.soleToe.y, l.ankle.y + (view === 'side' ? 0 : L.footH)]))
  if (anchor === 'hand') {
    const h = sk.arms[0].hand
    dx -= h.x; dy = FLOOR_Y - anchorY - h.y
  } else if (anchor === 'hip') {
    dy = FLOOR_Y - p.lift
  } else {
    const ls = anchor === 'footNear' ? [sk.legs[0]] : anchor === 'footFar' ? [sk.legs[1]] : sk.legs
    const ref = anchor === 'footFar' ? sk.legs[1] : sk.legs[0]
    dy -= lowest(ls)
    if (view === 'side') dx -= ref.ankle.x
  }
  const sh = (pt: Pt): Pt => ({ x: pt.x + dx, y: pt.y + dy })
  const shArm = (a: Arm): Arm => ({ ...a, shoulder: sh(a.shoulder), elbow: sh(a.elbow), wrist: sh(a.wrist), hand: sh(a.hand) })
  const shLeg = (l: Leg): Leg => ({ ...l, hip: sh(l.hip), knee: sh(l.knee), ankle: sh(l.ankle), toe: sh(l.toe), heel: sh(l.heel), soleHeel: sh(l.soleHeel), soleToe: sh(l.soleToe) })
  return { ...sk, hip: sh(sk.hip), waist: sh(sk.waist), shoulder: sh(sk.shoulder), neckBase: sh(sk.neckBase), neckTop: sh(sk.neckTop), head: sh(sk.head), arms: sk.arms.map(shArm), legs: sk.legs.map(shLeg) }
}

/* ── colours ────────────────────────────────────────────────────────────── */
const LOWER: Set<string> = new Set(['glutes', 'quads', 'hamstrings', 'adductors', 'abductors', 'calves'])
const accentFor = (m: string) => (LOWER.has(m) ? 'var(--accent)' : 'var(--accent-2)')

/* ── component ──────────────────────────────────────────────────────────── */
export function Figure({ pose, view, highlight = {}, glow = 1, equipment = [], anchor, anchorY = 0, mode = 'skin', shadow = false, className, style, viewBox, children }: FigureProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const g = (n: string) => `url(#${uid}${n})`
  const defaultAnchor: Anchor = anchor ?? 'foot'
  const sk = computeSkeleton(view, pose, defaultAnchor, anchorY)
  const p = fullPose(pose)
  const chart = mode === 'chart'
  const pulse = 0.6 + 0.4 * Math.max(0, Math.min(1, glow))

  /** A muscle region: optional glow + fill. */
  const M = (id: MuscleGroup, d: string, opts: { far?: boolean; lines?: string; fill?: string } = {}) => {
    const k = Math.max(0, Math.min(1, (highlight[id] ?? 0))) * (chart ? 1 : pulse)
    const col = accentFor(id)
    const baseFill = opts.fill ?? (chart ? (opts.far ? '#20222f' : '#262838') : g(opts.far ? 'mFar' : 'm'))
    return (
      <g key={id + (opts.far ? 'f' : '')}>
        {k > 0.02 && <path d={d} fill="none" stroke={col} strokeWidth={chart ? 3.5 : 4.5} strokeLinejoin="round" opacity={0.42 * k} />}
        {k > 0.02 && <path d={d} fill="none" stroke={col} strokeWidth={1.4} strokeLinejoin="round" opacity={0.6 * k} />}
        <path data-muscle={id} d={d} fill={baseFill} stroke={chart ? '#3b3e55' : 'rgba(80,36,22,0.42)'} strokeWidth={0.5} strokeLinejoin="round" />
        {k > 0.02 && <path d={d} fill={col} opacity={0.3 + 0.55 * k} />}
        {opts.lines && <path d={opts.lines} fill="none" stroke={chart ? '#3b3e55' : 'rgba(80,36,22,0.35)'} strokeWidth={0.5} strokeLinecap="round" />}
      </g>
    )
  }
  const skinFill = (far?: boolean) => (chart ? (far ? '#191b26' : '#1e2030') : g(far ? 'skinFar' : 'skin'))
  const rim = chart ? '#454a66' : 'rgba(255,226,205,0.32)'
  const silhouette = (d: string, far?: boolean, extra?: React.SVGProps<SVGPathElement>) => (
    <path d={d} fill={skinFill(far)} stroke={rim} strokeWidth={0.7} strokeLinejoin="round" {...extra} />
  )
  const tr = (pt: Pt, a: number, extra = '') => `translate(${f1(pt.x)} ${f1(pt.y)}) rotate(${f1(-a)}) ${extra}`

  // ── side-view limb renderers ──
  const sideArmEl = (a: Arm, far: boolean) => (
    <g key={far ? 'armF' : 'armN'}>
      <g transform={tr(a.shoulder, a.aUa, `scale(1 ${f1(a.kUa)})`)}>
        {silhouette(S.ua, far)}
        {M('triceps', S.triceps, { far })}
        {M('biceps', S.biceps, { far })}
        {M('rearDelts', S.rearDelts, { far })}
        {M('frontDelts', S.frontDelts, { far })}
        {M('sideDelts', S.sideDelts, { far })}
      </g>
      <g transform={tr(a.elbow, a.aFa, `scale(1 ${f1(a.kFa)})`)}>
        {silhouette(S.fa, far)}
        {M('forearms', S.forearms, { far })}
        <circle cx={0} cy={28} r={3.7} fill={skinFill(far)} stroke={rim} strokeWidth={0.7} />
      </g>
    </g>
  )
  const sideLegEl = (l: Leg, far: boolean) => (
    <g key={far ? 'legF' : 'legN'}>
      <g transform={tr(l.hip, l.aThigh)}>
        {silhouette(S.thigh, far)}
        {M('hamstrings', S.hamstrings, { far })}
        {M('quads', S.quads, { far })}
      </g>
      <g transform={tr(l.knee, l.aShank)}>
        {silhouette(S.shank, far)}
        {M('calves', S.calves, { far })}
        <ellipse cx={3.2} cy={1.5} rx={2.6} ry={3.2} fill={skinFill(far)} stroke={chart ? '#3b3e55' : 'rgba(80,36,22,0.3)'} strokeWidth={0.5} />
      </g>
      <g transform={tr(l.ankle, l.aFoot)}>{silhouette(S.foot, far)}</g>
    </g>
  )
  const sideTorsoEl = () => {
    const sq = 1 + 0.09 * p.squeeze
    return (
      <g key="torso">
        <g transform={tr(sk.hip, sk.aTorso)}>
          {silhouette(S.torsoLo)}
          {M('lowerBack', S.lowerBack)}
          {M('obliques', S.obliques)}
          {M('abs', S.abs, { lines: S.absLines })}
          <g transform={`translate(8 0) scale(${f1(sq)}) translate(-8 ${f1(-1.2 * p.squeeze)})`}>{M('glutes', S.glutes)}</g>
        </g>
        <g transform={tr(sk.waist, sk.aUpper, 'translate(0 -22)')}>
          {silhouette(S.torsoUp)}
          {M('lats', S.lats)}
          {M('upperBack', S.upperBack)}
          {M('traps', S.traps)}
          {M('chest', S.chest)}
          {M('upperChest', S.upperChest)}
        </g>
        <g transform={tr(sk.neckBase, sk.aNeck)}>{silhouette(S.neck)}</g>
        <g transform={tr(sk.neckTop, sk.aNeck)}>
          {silhouette(S.head)}
          <path d={S.hair} fill={chart ? '#2b2e42' : '#2a1a15'} />
          <ellipse cx={3} cy={10} rx={1.6} ry={2.4} fill={skinFill()} stroke={rim} strokeWidth={0.5} />
        </g>
      </g>
    )
  }

  // ── frontal renderers ──
  const back = view === 'back'
  const frontalArmEl = (a: Arm, s: number) => (
    <g key={s > 0 ? 'armR' : 'armL'}>
      <g transform={`translate(${f1(a.shoulder.x)} ${f1(a.shoulder.y)}) rotate(${f1(-s * a.aUa)}) scale(${s} ${f1(a.kUa)})`}>
        {silhouette(F.ua)}
        {back ? M('triceps', F.triceps) : M('biceps', F.biceps)}
        {!back && M('triceps', F.tricepsLat)}
        {back ? M('rearDelts', F.deltInner) : M('frontDelts', F.deltInner)}
        {M('sideDelts', F.sideDelts)}
      </g>
      <g transform={`translate(${f1(a.elbow.x)} ${f1(a.elbow.y)}) rotate(${f1(-s * a.aFa)}) scale(${s} ${f1(a.kFa)})`}>
        {silhouette(F.fa)}
        {M('forearms', F.forearms)}
        <circle cx={0} cy={28.5} r={3.7} fill={skinFill()} stroke={rim} strokeWidth={0.7} />
      </g>
    </g>
  )
  const frontalLegEl = (l: Leg, s: number) => (
    <g key={s > 0 ? 'legR' : 'legL'}>
      <g transform={`translate(${f1(l.hip.x)} ${f1(l.hip.y)}) rotate(${f1(-s * l.aThigh)}) scale(${s} ${f1(l.kThigh)})`}>
        {silhouette(F.thigh)}
        {back ? M('hamstrings', F.hamstrings, { lines: F.hamLine }) : M('quads', F.quads, { lines: F.quadLines })}
        {!back && M('adductors', F.adductors)}
        {!back && <ellipse cx={0} cy={41} rx={3} ry={2.4} fill={skinFill()} stroke={chart ? '#3b3e55' : 'rgba(80,36,22,0.3)'} strokeWidth={0.5} />}
      </g>
      <g transform={`translate(${f1(l.knee.x)} ${f1(l.knee.y)}) rotate(${f1(-s * l.aShank)}) scale(${s} ${f1(l.kShank)})`}>
        {silhouette(F.shank)}
        {M('calves', back ? F.calvesBack : F.calvesFront)}
      </g>
      <g transform={`translate(${f1(l.ankle.x)} ${f1(l.ankle.y)}) scale(${s} 1)`}>{silhouette(F.foot)}</g>
    </g>
  )
  const frontalTorsoEl = () => {
    const sq = 1 + 0.08 * p.squeeze
    return (
      <g key="torso" transform={`translate(${f1(sk.hip.x)} ${f1(sk.hip.y)}) scale(1 ${f1(sk.torsoScale)})`}>
        {silhouette(F.torso)}
        {back ? (
          <>
            {M('lowerBack', F.lowerBack)}
            {M('lats', F.latsR)}{M('lats', FM.latsL)}
            {M('upperBack', F.upperBackR)}{M('upperBack', FM.upperBackL)}
            {M('traps', F.traps)}
            <g transform={`translate(8 1) scale(${f1(sq)}) translate(-8 ${f1(-1 - 1.2 * p.squeeze)})`}>{M('glutes', F.glutesR)}</g>
            <g transform={`translate(-8 1) scale(${f1(sq)}) translate(8 ${f1(-1 - 1.2 * p.squeeze)})`}>{M('glutes', FM.glutesL)}</g>
          </>
        ) : (
          <>
            {M('obliques', F.obliquesR)}{M('obliques', FM.obliquesL)}
            {M('abs', F.abs)}
            {M('abductors', F.abductorsR)}{M('abductors', FM.abductorsL)}
            {M('traps', F.trapsFrontR)}{M('traps', FM.trapsFrontL)}
            {M('chest', F.chestR)}{M('chest', FM.chestL)}
            {M('upperChest', F.upperChestR)}{M('upperChest', FM.upperChestL)}
          </>
        )}
        {silhouette(F.neck)}
        {silhouette(F.headD)}
        <path d={back ? F.hairBack : F.hair} fill={chart ? '#2b2e42' : '#2a1a15'} />
        {!back && <>
          <ellipse cx={-9.2} cy={-65} rx={1.5} ry={2.4} fill={skinFill()} stroke={rim} strokeWidth={0.5} />
          <ellipse cx={9.2} cy={-65} rx={1.5} ry={2.4} fill={skinFill()} stroke={rim} strokeWidth={0.5} />
        </>}
      </g>
    )
  }

  // ── equipment ──
  const metal = g('metal'), plate = g('plate'), pad = g('pad'), frame = chart ? '#2b2e42' : '#1b1c27'
  const hands = sk.arms.map(a => a.hand)
  const near = hands[0], far = hands[1]
  const mid = { x: (near.x + far.x) / 2, y: (near.y + far.y) / 2 }
  const handAngle = sk.arms[0].aFa
  const eqBehind: ReactNode[] = [], eqFront: ReactNode[] = []
  const plateSide = (c: Pt, r: number, key: string, front = true) => (
    <g key={key}>
      <circle cx={c.x} cy={c.y} r={r} fill={plate} stroke="#4b4f68" strokeWidth={0.8} />
      <circle cx={c.x} cy={c.y} r={r * 0.62} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.8} />
      <circle cx={c.x} cy={c.y} r={2.2} fill={front ? '#9ea3bf' : '#5d6079'} />
    </g>
  )
  const dumbbellSide = (c: Pt, key: string, far = false) => (
    <g key={key} opacity={far ? 0.8 : 1}>
      <circle cx={c.x} cy={c.y} r={5.2} fill={plate} stroke="#4b4f68" strokeWidth={0.7} />
      <circle cx={c.x} cy={c.y} r={1.6} fill="#9ea3bf" />
    </g>
  )
  const dumbbellFront = (c: Pt, a: number, key: string) => (
    <g key={key} transform={`translate(${f1(c.x)} ${f1(c.y)}) rotate(${f1(a)})`}>
      <rect x={-7} y={-1.4} width={14} height={2.8} rx={1.2} fill={metal} />
      <rect x={-9.5} y={-4} width={4} height={8} rx={1.4} fill={plate} stroke="#4b4f68" strokeWidth={0.6} />
      <rect x={5.5} y={-4} width={4} height={8} rx={1.4} fill={plate} stroke="#4b4f68" strokeWidth={0.6} />
    </g>
  )
  const stack = (x: number, top: number, key: string) => (
    <g key={key}>
      <rect x={x - 7} y={top} width={14} height={FLOOR_Y - top} rx={2} fill={frame} stroke="#2e3144" strokeWidth={0.6} />
      {Array.from({ length: Math.floor((FLOOR_Y - top - 8) / 6) }, (_, i) => (
        <rect key={i} x={x - 5.5} y={FLOOR_Y - 6 - i * 6} width={11} height={4} rx={1} fill={i < 4 ? '#3a3d55' : '#2a2c3d'} />
      ))}
      <rect x={x - 1} y={top - 6} width={2} height={FLOOR_Y - top + 6} fill="#555a78" />
    </g>
  )
  const cableLine = (a: Pt, b: Pt, key: string) => <line key={key} x1={f1(a.x)} y1={f1(a.y)} x2={f1(b.x)} y2={f1(b.y)} stroke="#8f94b3" strokeWidth={1.1} strokeLinecap="round" />
  const pulley = (c: Pt, key: string) => <g key={key}><circle cx={c.x} cy={c.y} r={3.4} fill="#2a2d40" stroke="#6a6f8d" strokeWidth={1} /><circle cx={c.x} cy={c.y} r={1} fill="#9ea3bf" /></g>
  const benchLegs = (x1: number, x2: number, top: number) => (
    <>
      <rect x={x1 + 4} y={top} width={4} height={FLOOR_Y - top} fill={frame} />
      <rect x={x2 - 8} y={top} width={4} height={FLOOR_Y - top} fill={frame} />
      <rect x={x1} y={FLOOR_Y - 3} width={14} height={3} rx={1} fill={frame} />
      <rect x={x2 - 14} y={FLOOR_Y - 3} width={14} height={3} rx={1} fill={frame} />
    </>
  )

  for (const [i, e] of equipment.entries()) {
    const key = `eq${i}`
    switch (e.kind) {
      case 'barbell':
      case 'trapBar':
      case 'ezBar': {
        if (view === 'side') {
          eqBehind.push(plateSide(far, e.kind === 'ezBar' ? 6.5 : 10.5, key + 'b', false))
          eqFront.push(plateSide(near, e.kind === 'ezBar' ? 6.5 : 10.5, key + 'f'))
          if (e.kind === 'trapBar') eqFront.push(<path key={key + 't'} d={`M${f1(near.x - 10)} ${f1(near.y - 10)} h20 l6 10 l-6 10 h-20 l-6 -10 z`} fill="none" stroke="#6a6f8d" strokeWidth={1.4} strokeLinejoin="round" />)
        } else {
          const y = mid.y
          eqFront.push(
            <g key={key}>
              <rect x={CX - 46} y={y - 1.5} width={92} height={3} rx={1.2} fill={metal} />
              <rect x={CX - 56} y={y - 9} width={9} height={18} rx={2} fill={plate} stroke="#4b4f68" strokeWidth={0.7} />
              <rect x={CX + 47} y={y - 9} width={9} height={18} rx={2} fill={plate} stroke="#4b4f68" strokeWidth={0.7} />
            </g>,
          )
        }
        break
      }
      case 'dumbbells': {
        const side = e.side ?? 'both'
        if (view === 'side') {
          if (side !== 'near') eqBehind.push(dumbbellSide(far, key + 'b', true))
          if (side !== 'far') eqFront.push(dumbbellSide(near, key + 'f'))
        } else {
          const ang = (a: Arm, s: number) => (Math.atan2(Math.cos(rad(a.aFa)), s * Math.sin(rad(a.aFa))) * 180) / Math.PI + 90
          if (side !== 'far') eqFront.push(dumbbellFront(near, ang(sk.arms[0], 1), key + 'r'))
          if (side !== 'near') eqFront.push(dumbbellFront(far, ang(sk.arms[1], -1), key + 'l'))
        }
        break
      }
      case 'kettlebell': {
        const c = view === 'side' ? near : mid
        const a = handAngle
        eqFront.push(
          <g key={key} transform={`translate(${f1(c.x)} ${f1(c.y)}) rotate(${f1(-a)})`}>
            <path d="M-4.5 2 a4.5 4.5 0 0 1 9 0" fill="none" stroke="#8f94b3" strokeWidth={2} />
            <circle cx={0} cy={9.5} r={7.2} fill={plate} stroke="#4b4f68" strokeWidth={0.8} />
            <circle cx={-2} cy={7.5} r={2} fill="rgba(255,255,255,0.08)" />
          </g>,
        )
        break
      }
      case 'bench': {
        const w = e.w ?? 70, h = e.h ?? 7
        if (e.variant === 'flatBehind') {
          eqBehind.push(
            <g key={key}>
              <rect x={e.x} y={e.y} width={w} height={h} rx={4} fill={pad} stroke="#3a3d52" strokeWidth={0.6} />
              <rect x={e.x + 3} y={e.y + 3} width={w - 6} height={h - 6} rx={3} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            </g>,
          )
        } else if (e.variant === 'flat') {
          eqBehind.push(
            <g key={key}>
              {benchLegs(e.x, e.x + w, e.y + h)}
              <rect x={e.x} y={e.y} width={w} height={h} rx={2.5} fill={pad} stroke="#3a3d52" strokeWidth={0.6} />
              <rect x={e.x + 2} y={e.y + 1} width={w - 4} height={1.2} rx={0.6} fill="rgba(255,255,255,0.07)" />
            </g>,
          )
        } else if (e.variant === 'incline' || e.variant === 'rowIncline') {
          const ang = e.angle ?? -60
          const row = e.variant === 'rowIncline'
          eqBehind.push(
            <g key={key}>
              {row ? <><rect x={e.x + 17} y={e.y} width={6} height={FLOOR_Y - e.y} fill={frame} /><rect x={e.x + 4} y={FLOOR_Y - 3} width={32} height={3} rx={1} fill={frame} /></> : benchLegs(e.x - 14, e.x + 36, e.y + 6)}
              {!row && <rect x={e.x - 12} y={e.y} width={34} height={7} rx={2.5} fill={pad} stroke="#3a3d52" strokeWidth={0.6} />}
              <g transform={`translate(${e.x + 20} ${e.y + 2}) rotate(${ang})`}>
                <rect x={-3.5} y={-54} width={8} height={56} rx={2.5} fill={pad} stroke="#3a3d52" strokeWidth={0.6} />
                <rect x={-2} y={-52} width={1.2} height={52} fill="rgba(255,255,255,0.07)" />
              </g>
            </g>,
          )
        } else if (e.variant === 'seat') {
          eqBehind.push(
            <g key={key}>
              <rect x={e.x + 12} y={e.y + 6} width={6} height={FLOOR_Y - e.y - 6} fill={frame} />
              <rect x={e.x} y={FLOOR_Y - 3} width={30} height={3} rx={1} fill={frame} />
              <rect x={e.x} y={e.y} width={32} height={7} rx={2.5} fill={pad} stroke="#3a3d52" strokeWidth={0.6} />
              <rect x={e.x + 10} y={e.y - 46} width={9} height={47} rx={3} fill={pad} stroke="#3a3d52" strokeWidth={0.6} />
            </g>,
          )
        } else if (e.variant === 'hipThrust' || e.variant === 'block') {
          eqBehind.push(
            <g key={key}>
              <rect x={e.x} y={e.y} width={w} height={FLOOR_Y - e.y} rx={3} fill={frame} stroke="#2e3144" strokeWidth={0.6} />
              <rect x={e.x} y={e.y} width={w} height={h} rx={2.5} fill={pad} stroke="#3a3d52" strokeWidth={0.6} />
              <rect x={e.x + 2} y={e.y + 1} width={w - 4} height={1.2} rx={0.6} fill="rgba(255,255,255,0.07)" />
            </g>,
          )
        }
        break
      }
      case 'cable': {
        const a = { x: e.anchor[0], y: e.anchor[1] }
        const targets: Pt[] = []
        const legR = sk.legs[0]
        if (e.to === 'hands' || e.to === 'both') targets.push(near, far)
        if (e.to === 'handNear' || e.to === 'handR') targets.push(near)
        if (e.to === 'handFar' || e.to === 'handL') targets.push(far)
        if (e.to === 'ankleNear' || e.to === 'ankleR') targets.push(legR.ankle)
        const stackSide = e.stack ?? (a.x < CX ? 'left' : 'right')
        if (stackSide !== 'none') {
          const sx = stackSide === 'left' ? a.x - 11 : a.x + 11
          eqBehind.push(stack(sx, Math.min(a.y - 8, FLOOR_Y - 80), key + 's'))
          eqBehind.push(<rect key={key + 'arm'} x={Math.min(sx, a.x)} y={a.y - 1.5} width={Math.abs(sx - a.x)} height={3} fill="#3a3d55" />)
        }
        eqBehind.push(pulley(a, key + 'p'))
        if (e.to === 'hands' && e.attachment === 'bar') {
          eqBehind.push(cableLine(a, mid, key + 'c'))
          eqFront.push(<line key={key + 'bar'} x1={f1(near.x - 22)} y1={f1(near.y)} x2={f1(far.x + 22)} y2={f1(far.y)} stroke="#8f94b3" strokeWidth={2.4} strokeLinecap="round" />)
        } else {
          targets.forEach((t, j) => {
            eqBehind.push(cableLine(a, t, key + 'c' + j))
            if (e.attachment === 'cuff') eqFront.push(<rect key={key + 'cuff' + j} x={t.x - 4.5} y={t.y - 3} width={9} height={6} rx={2} fill="#3a3d55" stroke="#8f94b3" strokeWidth={0.8} />)
            else if (e.attachment === 'rope') eqFront.push(<circle key={key + 'r' + j} cx={t.x} cy={t.y} r={2.4} fill="#2a2d40" stroke="#8f94b3" strokeWidth={1} />)
            else eqFront.push(<rect key={key + 'h' + j} x={t.x - 1.5} y={t.y - 5} width={3} height={10} rx={1.2} fill="#8f94b3" />)
          })
        }
        break
      }
      case 'box':
        eqBehind.push(
          <g key={key}>
            <rect x={e.x} y={FLOOR_Y - e.h} width={e.w} height={e.h} rx={3} fill={frame} stroke="#2e3144" strokeWidth={0.6} />
            <rect x={e.x} y={FLOOR_Y - e.h} width={e.w} height={4} rx={2} fill="#3a3d55" />
            <path d={`M${e.x + 6} ${FLOOR_Y - e.h + 10} h${e.w - 12} M${e.x + 6} ${FLOOR_Y - e.h + 18} h${e.w - 12}`} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          </g>,
        )
        break
      case 'pullupBar':
        eqBehind.push(
          <g key={key}>
            <rect x={CX - 60} y={near.y - 2} width={120} height={4} rx={2} fill={metal} />
            <rect x={CX - 58} y={0} width={5} height={near.y} fill={frame} />
            <rect x={CX + 53} y={0} width={5} height={near.y} fill={frame} />
          </g>,
        )
        break
      case 'dipBars':
        eqBehind.push(
          <g key={key}>
            <rect x={near.x - 2.5} y={near.y} width={5} height={FLOOR_Y - near.y} fill={frame} />
            <rect x={near.x - 20} y={FLOOR_Y - 3} width={40} height={3} rx={1} fill={frame} />
            <circle cx={near.x} cy={near.y} r={3.6} fill={metal} stroke="#6a6f8d" strokeWidth={0.8} />
          </g>,
        )
        break
      case 'pecDeck':
        eqBehind.push(
          <g key={key}>
            <rect x={CX - 9} y={sk.shoulder.y - 20} width={18} height={70} rx={5} fill={pad} stroke="#3a3d52" strokeWidth={0.6} />
            <rect x={CX - 3} y={sk.shoulder.y - 42} width={6} height={30} fill={frame} />
            <rect x={CX - 48} y={sk.shoulder.y - 46} width={96} height={5} rx={2} fill={frame} />
          </g>,
        )
        sk.arms.forEach((a, j) => {
          const mfa = { x: (a.elbow.x + a.hand.x) / 2, y: (a.elbow.y + a.hand.y) / 2 }
          const s = j === 0 ? 1 : -1
          eqFront.push(
            <g key={key + j}>
              <line x1={f1(CX + s * 44)} y1={f1(sk.shoulder.y - 42)} x2={f1(mfa.x + s * 5)} y2={f1(mfa.y)} stroke="#555a78" strokeWidth={2.2} />
              <rect x={mfa.x + (s > 0 ? 2 : -8)} y={mfa.y - 13} width={6} height={26} rx={2.5} fill={pad} stroke="#4b4f68" strokeWidth={0.7} />
            </g>,
          )
        })
        break
      case 'abductionPads':
        sk.legs.forEach((l, j) => {
          const s = j === 0 ? 1 : -1
          eqFront.push(<rect key={key + j} x={l.knee.x + (s > 0 ? 4 : -10)} y={l.knee.y - 12} width={6} height={24} rx={2.5} fill={pad} stroke="#4b4f68" strokeWidth={0.7} />)
        })
        break
      case 'frame':
        eqBehind.push(<g key={key}><rect x={e.x - 2.5} y={20} width={5} height={FLOOR_Y - 20} fill={frame} /><rect x={e.x - 14} y={FLOOR_Y - 3} width={28} height={3} rx={1} fill={frame} /></g>)
        break
      case 'smithRails':
        eqBehind.push(<g key={key}><rect x={e.x - 1.5} y={10} width={3} height={FLOOR_Y - 10} fill="#2e3144" /><rect x={e.x + 20} y={10} width={3} height={FLOOR_Y - 10} fill="#2e3144" /><rect x={e.x - 6} y={8} width={32} height={4} rx={1.5} fill={frame} /></g>)
        break
    }
  }

  // ── body assembly ──
  const body = view === 'side'
    ? [sideArmEl(sk.arms[1], true), sideLegEl(sk.legs[1], true), sideTorsoEl(), sideLegEl(sk.legs[0], false), sideArmEl(sk.arms[0], false)]
    : [frontalLegEl(sk.legs[1], -1), frontalLegEl(sk.legs[0], 1), frontalTorsoEl(), frontalArmEl(sk.arms[1], -1), frontalArmEl(sk.arms[0], 1)]

  const lift = p.lift
  const shadowRx = Math.max(10, 32 - lift * 0.35)

  return (
    <svg viewBox={viewBox ?? `0 0 ${VIEW_W} ${VIEW_H}`} className={className} style={style} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}skin`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9a5f44" /><stop offset="0.45" stopColor="#d6977a" /><stop offset="0.8" stopColor="#efc0a2" /><stop offset="1" stopColor="#d9a082" />
        </linearGradient>
        <linearGradient id={`${uid}skinFar`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6d402c" /><stop offset="0.5" stopColor="#9c6448" /><stop offset="1" stopColor="#b17d60" />
        </linearGradient>
        <linearGradient id={`${uid}m`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(255,228,205,0.22)" /><stop offset="0.55" stopColor="rgba(140,70,45,0.08)" /><stop offset="1" stopColor="rgba(90,38,22,0.38)" />
        </linearGradient>
        <linearGradient id={`${uid}mFar`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(255,228,205,0.1)" /><stop offset="1" stopColor="rgba(60,22,12,0.45)" />
        </linearGradient>
        <linearGradient id={`${uid}metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8d92ad" /><stop offset="0.5" stopColor="#4f536b" /><stop offset="1" stopColor="#2c2f40" />
        </linearGradient>
        <radialGradient id={`${uid}plate`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#3b3e55" /><stop offset="1" stopColor="#15161f" />
        </radialGradient>
        <linearGradient id={`${uid}pad`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#363a52" /><stop offset="1" stopColor="#23263a" />
        </linearGradient>
      </defs>
      {children}
      {shadow && <ellipse cx={sk.hip.x} cy={FLOOR_Y + 2.5} rx={shadowRx} ry={3.2} fill="rgba(0,0,0,0.55)" opacity={Math.max(0.15, 0.55 - lift * 0.01)} />}
      {eqBehind}
      {body}
      {eqFront}
    </svg>
  )
}

export default Figure
