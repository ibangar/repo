import type { Settings } from './types'
import { isoDate } from '../engine/schedule'

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  onboarded: false,
  name: '',
  units: 'kg',
  bodyweightKg: 75,
  heightCm: 178,
  equipment: ['barbell', 'dumbbells', 'cables', 'trapBar', 'hipThrustBench', 'pecDeck', 'dipStation', 'kettlebells', 'plyoBox', 'bench', 'pullupBar', 'smith', 'machine'],
  increments: { smallestPlateKg: 1.25, dumbbellStepKg: 2, cableStepKg: 2.5, kettlebellStepKg: 4, boxStepCm: 5 },
  deloadEvery: 7,
  programStartDate: isoDate(),
  scheduleOffset: 0,
  weighInDay: 1,
  weighInHour: 15,
  proteinPerKg: 1.8,
  mealTimes: ['15:45', '18:30'],
  trainsFasted: true,
  selfieReminder: true,
  lockEnabled: false,
  blurThumbs: false,
  soundOn: true,
  vibrateOn: true,
  missDropPct: 7.5,
  blockStartDate: isoDate(),
  dismissedPrompts: {},
}
