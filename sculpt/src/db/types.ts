// ─────────────────────────────────────────────────────────────────────────────
// Core domain types. All weights are stored in KG internally; lengths in CM.
// Conversion to the user's display unit happens at the edge (engine/units.ts).
// ─────────────────────────────────────────────────────────────────────────────

export type Units = 'kg' | 'lb'

export type MuscleGroup =
  | 'upperChest' | 'chest'
  | 'frontDelts' | 'sideDelts' | 'rearDelts'
  | 'triceps' | 'biceps' | 'forearms'
  | 'lats' | 'upperBack' | 'traps' | 'lowerBack'
  | 'abs' | 'obliques'
  | 'glutes' | 'quads' | 'hamstrings' | 'adductors' | 'abductors' | 'calves'

/** Buckets used for the weekly-volume dashboard. */
export type VolumeGroup = 'chest' | 'delts' | 'back' | 'arms' | 'glutes' | 'quads' | 'hamstrings'

export type MovementPattern =
  | 'inclinePress' | 'horizontalPress' | 'verticalPress'
  | 'lateralRaise' | 'chestFly' | 'tricepsExtension'
  | 'hipThrust' | 'squat' | 'hipHinge' | 'lunge' | 'hipAbduction' | 'gluteKickback'
  | 'verticalPull' | 'horizontalRow' | 'rearDeltFly' | 'curl' | 'dip'
  | 'jump' | 'swing'

export type Equipment =
  | 'barbell' | 'dumbbells' | 'cables' | 'trapBar' | 'hipThrustBench' | 'pecDeck'
  | 'dipStation' | 'kettlebells' | 'plyoBox' | 'smith' | 'bench' | 'pullupBar'
  | 'machine' | 'bodyweight' | 'ezBar' | 'band'

/**
 * How the exercise is loaded.
 *  weight     – external load (barbell / dumbbell / cable stack)
 *  bodyweight – pull-ups / dips with no added load
 *  assisted   – pull-ups / dips with assistance (band or machine), value = kg of assistance
 *  added      – pull-ups / dips with extra load (belt / dumbbell), value = kg added
 *  height     – box jumps: value = box height in cm
 *  bell       – kettlebell swings: value = bell weight in kg
 */
export type LoadMode = 'weight' | 'bodyweight' | 'assisted' | 'added' | 'height' | 'bell'

/** Determines the weight jump used by double progression. */
export type IncrementClass =
  | 'upperCompound'   // +2.5 kg / +5 lb
  | 'lowerCompound'   // +5 kg / +10 lb
  | 'dumbbell'        // smallest dumbbell jump
  | 'isolation'       // smallest plate / cable step
  | 'kettlebell'      // next bell
  | 'box'             // next box height
  | 'bodyweight'      // pull-ups / dips – mode dependent

export type ExerciseCategory = 'compound' | 'isolation' | 'power' | 'bodyweight'

export type GoalTag = 'glutes' | 'upper' | 'legStrength' | 'power'

export type View = 'side' | 'front' | 'back'

export interface ExerciseDef {
  id: string
  name: string
  shortName: string
  pattern: MovementPattern
  category: ExerciseCategory
  equipment: Equipment[]
  incrementClass: IncrementClass
  loadModes: LoadMode[]
  defaultLoadMode: LoadMode
  primary: MuscleGroup[]
  secondary: MuscleGroup[]
  volumeGroups: VolumeGroup[]
  /** Default rest between sets in seconds. */
  restSec: number
  unilateral?: boolean
  goalTag: GoalTag
  description: string
  cues: string[]
  mistakes: string[]
  /** Key into the animation registry (components/anatomy/animations). */
  animation: string
  /** Default camera for the animation + body map. */
  view: View
}

// ── Program ──────────────────────────────────────────────────────────────────

export interface ProgramExercise {
  /** Stable id within the program (survives swaps). */
  id: string
  exerciseId: string
  sets: number
  repMin: number
  repMax: number
  /** Overrides the exercise default rest. */
  restSec?: number
  /** Exercises sharing a group are performed as a superset. */
  supersetGroup?: string
  note?: string
}

export type DayFocus = 'push' | 'glutes' | 'pull' | 'rest' | 'upper' | 'power'

export interface ProgramDay {
  id: string
  name: string
  subtitle: string
  focus: DayFocus
  exercises: ProgramExercise[]
}

export interface Program {
  /** Exactly 7 entries, index = program day (0 = Day 1). */
  days: ProgramDay[]
  version: number
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface Increments {
  /** Smallest plate you can add to ONE side of a bar (kg). Bar jumps = 2× this. */
  smallestPlateKg: number
  /** Smallest jump between dumbbells (kg). */
  dumbbellStepKg: number
  /** Smallest jump on cable / machine stacks (kg). */
  cableStepKg: number
  /** Jump between kettlebells (kg). */
  kettlebellStepKg: number
  /** Jump between box heights (cm). */
  boxStepCm: number
}

export interface Settings {
  id: 'settings'
  onboarded: boolean
  name: string
  units: Units
  bodyweightKg: number
  heightCm: number
  equipment: Equipment[]
  increments: Increments
  /** Deload every N weeks (6–8). */
  deloadEvery: number
  /** ISO date (YYYY-MM-DD) of program Day 1, week 1. */
  programStartDate: string
  /** Days the schedule has been shifted forward (missed-day handling). */
  scheduleOffset: number
  /** 0 = Sunday … 6 = Saturday */
  weighInDay: number
  weighInHour: number
  /** Protein target multiplier, g per kg bodyweight (1.6–2.2). */
  proteinPerKg: number
  /** Optional: what you typically eat per day; enables maintenance adjustment. */
  typicalIntakeKcal?: number
  mealTimes: [string, string]
  trainsFasted: boolean
  selfieReminder: boolean
  passcodeHash?: string
  lockEnabled: boolean
  blurThumbs: boolean
  soundOn: boolean
  vibrateOn: boolean
  /** Percentage to drop after two consecutive misses (5–10). */
  missDropPct: number
  /** ISO date when the current training block started (for the 8–12 week check-in). */
  blockStartDate: string
  /** ISO dates on which the user dismissed a reminder prompt. */
  dismissedPrompts: Record<string, string>
}

// ── Workout logging ───────────────────────────────────────────────────────────

export interface SetLog {
  index: number
  /** For unilateral work. */
  side?: 'L' | 'R'
  /** What the app told you to do (kg / cm / assist-kg depending on loadMode). */
  prescribedLoad: number | null
  prescribedReps: number
  /** What you actually did. */
  load: number | null
  reps: number | null
  rir: number
  done: boolean
  /** Power lifts: did every rep feel explosive? */
  explosive?: boolean
  completedAt?: number
  isPR?: boolean
  isWarmup?: boolean
}

export interface SessionExercise {
  programExerciseId: string
  exerciseId: string
  /** If swapped in, the original exercise id. */
  swappedFrom?: string
  skipped?: boolean
  loadMode: LoadMode
  supersetGroup?: string
  repMin: number
  repMax: number
  restSec: number
  /** True when this exercise has no history yet and the user picks the weight. */
  calibration: boolean
  /** Human-readable reason for the prescription (e.g. "+2.5 kg – you hit 10/10/10/10"). */
  prescriptionNote?: string
  warmups: SetLog[]
  sets: SetLog[]
  /** Snapshot of last session for "last time" display. */
  lastTime?: { date: string; sets: { load: number | null; reps: number | null; rir: number }[] }
}

export interface PR {
  id: string
  exerciseId: string
  type: 'e1rm' | 'load' | 'reps' | 'height' | 'bell'
  value: number
  /** Context, e.g. "80 kg × 9 @2" */
  detail: string
  date: string
  sessionId: string
}

export interface SessionSummary {
  volumeKg: number
  setsDone: number
  durationSec: number
  prs: PR[]
}

export type SessionStatus = 'active' | 'completed' | 'abandoned'

export interface WorkoutSession {
  id: string
  /** YYYY-MM-DD local date. */
  date: string
  dayId: string
  dayName: string
  dayIndex: number
  weekNumber: number
  isDeload: boolean
  status: SessionStatus
  startedAt: number
  completedAt?: number
  exercises: SessionExercise[]
  summary?: SessionSummary
  bodyweightKg: number
}

// ── Per-exercise progression state ───────────────────────────────────────────

export interface HistoryPoint {
  date: string
  sessionId: string
  loadMode: LoadMode
  /** Working load used (kg / cm / assist-kg). */
  load: number
  bestReps: number
  bestRir: number
  /** Estimated 1RM (kg) using Epley on reps + RIR. Null for power lifts. */
  e1rm: number | null
  outcome: 'hitTop' | 'inRange' | 'missedBottom' | 'deload' | 'power'
  /** Total reps × load (kg) across working sets. */
  volumeKg: number
}

export interface ExerciseState {
  exerciseId: string
  loadMode: LoadMode
  /** Next prescribed working load (kg / cm / assist-kg). Null until calibrated. */
  currentLoad: number | null
  /** Target reps for the next session (double progression aims for +1). */
  targetReps: number | null
  calibrated: boolean
  consecutiveMisses: number
  bestE1rm: number | null
  bestLoad: number | null
  history: HistoryPoint[]
  updatedAt: number
}

// ── Body / nutrition / photos ────────────────────────────────────────────────

export interface BodyWeight {
  id: string
  date: string
  kg: number
}

export interface Measurement {
  id: string
  date: string
  /** cm */
  chest?: number
  shoulders?: number
  upperArm?: number
  waist?: number
  hips?: number
  thigh?: number
  note?: string
}

export type Pose = 'front' | 'side' | 'back'

export interface Photo {
  id: string
  date: string
  takenAt: number
  pose: Pose
  blob: Blob
  thumb: Blob
  width: number
  height: number
  mirrored: boolean
}

export interface NutritionDay {
  /** YYYY-MM-DD, primary key */
  date: string
  meal1Protein: boolean
  meal2Protein: boolean
  water: boolean
  sleep: boolean
  chocolate: boolean
  trainedFasted: boolean
  note?: string
}
