import type { Increments, Units } from '../../db/types'
import { CM_PER_IN, fromDisplay, lbToKg, toDisplay } from '../../engine/units'
import { Stepper } from '../ui'
import { StepperBox, StepperRow } from './Rows'

const r = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d

/** Bodyweight stepper in display units, writes kg. */
export function BodyweightStepper({ kg, units, onChange, fill }: { kg: number; units: Units; onChange: (kg: number) => void; fill?: boolean }) {
  return (
    <StepperBox fill={fill}><Stepper value={r(toDisplay(kg, units), 1)} step={0.1} decimals={1} min={units === 'kg' ? 30 : 66} max={units === 'kg' ? 250 : 550} suffix={units}
      onChange={v => { if (v != null) onChange(r(fromDisplay(v, units), 3)) }} /></StepperBox>
  )
}

/** Height: cm when metric, ft + in when imperial. Writes cm. */
export function HeightInput({ cm, units, onChange, fill }: { cm: number; units: Units; onChange: (cm: number) => void; fill?: boolean }) {
  if (units === 'kg') {
    return <StepperBox fill={fill}><Stepper value={Math.round(cm)} step={1} min={120} max={230} suffix="cm" onChange={v => { if (v != null) onChange(v) }} /></StepperBox>
  }
  const totalIn = cm / CM_PER_IN
  let ft = Math.floor(totalIn / 12), inch = Math.round(totalIn - ft * 12)
  if (inch === 12) { ft += 1; inch = 0 }
  const set = (f: number, i: number) => onChange(r((f * 12 + i) * CM_PER_IN, 2))
  return (
    <div className="grid-2" style={{ gap: 8, width: fill ? '100%' : 'auto' }}>
      <StepperBox fill width={160}><Stepper value={ft} step={1} min={3} max={8} suffix="ft" onChange={v => { if (v != null) set(v, inch) }} /></StepperBox>
      <StepperBox fill width={160}><Stepper value={inch} step={1} min={0} max={11} suffix="in" onChange={v => { if (v != null) set(ft, v) }} /></StepperBox>
    </div>
  )
}

export const INCREMENT_DEFAULTS: Record<Units, Increments> = {
  kg: { smallestPlateKg: 1.25, dumbbellStepKg: 2, cableStepKg: 2.5, kettlebellStepKg: 4, boxStepCm: 5 },
  lb: { smallestPlateKg: r(lbToKg(2.5), 4), dumbbellStepKg: r(lbToKg(5), 4), cableStepKg: r(lbToKg(5), 4), kettlebellStepKg: r(lbToKg(8), 4), boxStepCm: r(2 * CM_PER_IN, 2) },
}

type IncKey = keyof Increments
const FIELDS: { key: IncKey; label: string; hint: string; stepKg: number; stepLb: number; maxKg: number }[] = [
  { key: 'smallestPlateKg', label: 'Smallest plate', hint: 'Per side. Bar jumps are 2× this.', stepKg: 0.25, stepLb: 0.5, maxKg: 10 },
  { key: 'dumbbellStepKg', label: 'Dumbbell jump', hint: 'Gap between dumbbells on the rack', stepKg: 0.5, stepLb: 1, maxKg: 10 },
  { key: 'cableStepKg', label: 'Cable / machine step', hint: 'Smallest stack increment', stepKg: 0.5, stepLb: 1, maxKg: 15 },
  { key: 'kettlebellStepKg', label: 'Kettlebell jump', hint: 'Gap between bells', stepKg: 1, stepLb: 2, maxKg: 16 },
  { key: 'boxStepCm', label: 'Box height step', hint: 'Gap between box heights', stepKg: 1, stepLb: 1, maxKg: 30 },
]

/** The five increment steppers in display units; writes kg / cm. */
export function IncrementFields({ inc, units, onChange }: { inc: Increments; units: Units; onChange: (inc: Increments) => void }) {
  const lb = units === 'lb'
  return (
    <>
      {FIELDS.map(f => {
        const isLen = f.key === 'boxStepCm'
        const stored = inc[f.key]
        const shown = isLen ? (lb ? stored / CM_PER_IN : stored) : toDisplay(stored, units)
        const suffix = isLen ? (lb ? 'in' : 'cm') : units
        const toStored = (v: number) => isLen ? (lb ? v * CM_PER_IN : v) : fromDisplay(v, units)
        const max = isLen ? (lb ? 12 : f.maxKg) : (lb ? Math.round(toDisplay(f.maxKg, 'lb')) : f.maxKg)
        return (
          <StepperRow key={f.key} label={f.label} hint={f.hint} value={r(shown, 2)} decimals={2} step={lb ? f.stepLb : f.stepKg} min={lb ? f.stepLb : f.stepKg} max={max} suffix={suffix}
            onChange={v => { if (v != null) onChange({ ...inc, [f.key]: r(toStored(v), 4) }) }} />
        )
      })}
    </>
  )
}
