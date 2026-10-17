import type { Program, ProgramDay } from '../db/types'

const rest = (id: string, name: string): ProgramDay => ({
  id, name, subtitle: 'Recovery. Walk, stretch, eat your protein.', focus: 'rest', exercises: [],
})

/** The default weekly program, exactly as specified. Index = program day. */
export const DEFAULT_PROGRAM: Program = {
  version: 1,
  days: [
    {
      id: 'd1', name: 'Push', subtitle: 'Upper chest, side delts, triceps', focus: 'push',
      exercises: [
        { id: 'd1e1', exerciseId: 'inclineDbPress', sets: 4, repMin: 6, repMax: 10 },
        { id: 'd1e2', exerciseId: 'flatBbBench', sets: 3, repMin: 6, repMax: 10 },
        { id: 'd1e3', exerciseId: 'seatedDbShoulderPress', sets: 3, repMin: 8, repMax: 10 },
        { id: 'd1e4', exerciseId: 'lateralRaise', sets: 4, repMin: 12, repMax: 20 },
        { id: 'd1e5', exerciseId: 'cableFly', sets: 3, repMin: 12, repMax: 15 },
        { id: 'd1e6', exerciseId: 'ohCableTricepsExt', sets: 3, repMin: 10, repMax: 12 },
      ],
    },
    {
      id: 'd2', name: 'Glutes + Leg Strength', subtitle: 'Heavy hips, strong legs, no quad volume', focus: 'glutes',
      exercises: [
        { id: 'd2e1', exerciseId: 'bbHipThrust', sets: 4, repMin: 8, repMax: 12 },
        { id: 'd2e2', exerciseId: 'backSquat', sets: 4, repMin: 4, repMax: 6 },
        { id: 'd2e3', exerciseId: 'rdl', sets: 3, repMin: 6, repMax: 8 },
        { id: 'd2e4', exerciseId: 'bulgarianSplitSquat', sets: 3, repMin: 8, repMax: 8, note: 'Each side. Forward torso lean.' },
        { id: 'd2e5', exerciseId: 'cableHipAbduction', sets: 2, repMin: 15, repMax: 15 },
      ],
    },
    {
      id: 'd3', name: 'Pull + Arms', subtitle: 'Back width, rear delts, biceps', focus: 'pull',
      exercises: [
        { id: 'd3e1', exerciseId: 'pullUp', sets: 4, repMin: 6, repMax: 10, note: 'Assisted or weighted as needed.' },
        { id: 'd3e2', exerciseId: 'chestSupportedRow', sets: 3, repMin: 8, repMax: 12 },
        { id: 'd3e3', exerciseId: 'rearDeltFly', sets: 3, repMin: 15, repMax: 15 },
        { id: 'd3e4', exerciseId: 'inclineDbCurl', sets: 3, repMin: 10, repMax: 12 },
        { id: 'd3e5', exerciseId: 'hammerCurl', sets: 2, repMin: 12, repMax: 12 },
      ],
    },
    rest('d4', 'Rest'),
    {
      id: 'd5', name: 'Upper', subtitle: 'Upper chest, delts, arm superset', focus: 'upper',
      exercises: [
        { id: 'd5e1', exerciseId: 'inclineBbPress', sets: 3, repMin: 8, repMax: 8 },
        { id: 'd5e2', exerciseId: 'dip', sets: 3, repMin: 8, repMax: 10 },
        { id: 'd5e3', exerciseId: 'lateralRaise', sets: 4, repMin: 15, repMax: 20 },
        { id: 'd5e4', exerciseId: 'pecDeck', sets: 3, repMin: 12, repMax: 12 },
        { id: 'd5e5', exerciseId: 'cableCurl', sets: 3, repMin: 12, repMax: 12, supersetGroup: 'arms', restSec: 75 },
        { id: 'd5e6', exerciseId: 'tricepsPushdown', sets: 3, repMin: 12, repMax: 12, supersetGroup: 'arms', restSec: 75 },
      ],
    },
    {
      id: 'd6', name: 'Glutes + Power', subtitle: 'Heavy pulls, explosive hips', focus: 'power',
      exercises: [
        { id: 'd6e1', exerciseId: 'bbHipThrust', sets: 3, repMin: 10, repMax: 12 },
        { id: 'd6e2', exerciseId: 'trapBarDeadlift', sets: 3, repMin: 3, repMax: 5 },
        { id: 'd6e3', exerciseId: 'boxJump', sets: 4, repMin: 3, repMax: 3 },
        { id: 'd6e4', exerciseId: 'kbSwing', sets: 3, repMin: 15, repMax: 15 },
        { id: 'd6e5', exerciseId: 'cableGluteKickback', sets: 2, repMin: 15, repMax: 15 },
      ],
    },
    rest('d7', 'Rest'),
  ],
}

export const WARMUP_CHECKLIST: { id: string; label: string; detail: string; seconds: number }[] = [
  { id: 'cardio', label: 'Easy cardio', detail: 'Bike, row or incline walk until you\'re warm', seconds: 180 },
  { id: 'hips', label: 'Hip circles + leg swings', detail: '10 each direction, each leg', seconds: 60 },
  { id: 'glutes', label: 'Glute bridges', detail: '15 slow reps, 1 s squeeze at the top', seconds: 60 },
  { id: 'shoulders', label: 'Arm circles + band pull-aparts', detail: '15 small, 15 big, 15 pull-aparts', seconds: 60 },
  { id: 'thoracic', label: 'Cat-cow + thoracic rotations', detail: '8 each', seconds: 60 },
  { id: 'squat', label: 'Bodyweight squats', detail: '10 slow, full depth', seconds: 45 },
]
