import Dexie, { type EntityTable } from 'dexie'
import type { BodyWeight, ExerciseState, Measurement, NutritionDay, PR, Photo, Program, Settings, WorkoutSession } from './types'

export interface ProgramRow extends Program { id: 'program' }

export class SculptDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>
  program!: EntityTable<ProgramRow, 'id'>
  sessions!: EntityTable<WorkoutSession, 'id'>
  exerciseStates!: EntityTable<ExerciseState, 'exerciseId'>
  prs!: EntityTable<PR, 'id'>
  bodyWeights!: EntityTable<BodyWeight, 'id'>
  measurements!: EntityTable<Measurement, 'id'>
  photos!: EntityTable<Photo, 'id'>
  nutrition!: EntityTable<NutritionDay, 'date'>

  constructor(name = 'sculpt') {
    super(name)
    this.version(1).stores({
      settings: 'id',
      program: 'id',
      sessions: 'id, date, status, dayId, [status+date]',
      exerciseStates: 'exerciseId',
      prs: 'id, exerciseId, date',
      bodyWeights: 'id, date',
      measurements: 'id, date',
      photos: 'id, date, pose, takenAt, [pose+takenAt]',
      nutrition: 'date',
    })
  }
}

export const db = new SculptDB()
