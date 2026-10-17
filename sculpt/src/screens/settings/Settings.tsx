import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, PageHeader, Pill, Segmented, Stepper, ToggleRow } from '../../components/ui'
import { IconDownload, IconLock, IconRotate } from '../../components/ui/Icons'
import { Group, Row, StackedRow, StepperRow, TextRow, ConfirmSheet, DayPicker, DAY_LABELS_LONG, fmtHour, StepperBox } from '../../components/settings/Rows'
import { BodyweightStepper, HeightInput, IncrementFields, INCREMENT_DEFAULTS } from '../../components/settings/BodyFields'
import { ExercisePicker } from '../../components/settings/ExercisePicker'
import { PasscodeSheet } from '../../components/settings/PasscodeSheet'
import { InstallHint } from '../../components/settings/InstallHint'
import { useProgram, useSettings, updateSettings } from '../../hooks/useSettings'
import { resetCalibration, switchUnits } from '../../db/repo'
import { db } from '../../db/schema'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Settings as SettingsT, Units } from '../../db/types'
import { formatLoad } from '../../engine/units'
import { shiftForward } from '../../engine/schedule'
import { fmtDate } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { clearPasscode, setPasscode } from '../../lib/passcode'
import { useLock } from '../Lock'
import { getExercise } from '../../data/exercises'

export default function Settings() {
  const settings = useSettings()
  const program = useProgram()
  const nav = useNavigate()
  const states = useLiveQuery(() => db.exerciseStates.toArray(), [])
  const { lockNow } = useLock()
  const [resetOpen, setResetOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState<string | null>(null)
  const [passMode, setPassMode] = useState<'set' | 'verify' | null>(null)
  const [erase, setErase] = useState<0 | 1 | 2>(0)
  const [shifted, setShifted] = useState(false)

  if (!settings) return <div className="page" />
  const s = settings
  const set = (p: Partial<SettingsT>) => { void updateSettings(p) }

  const calibratedIds = new Set((states ?? []).filter(x => x.calibrated).map(x => x.exerciseId))
  const programIds = new Set((program?.days ?? []).flatMap(d => d.exercises.map(e => e.exerciseId)))
  // Offer calibrated exercises first; fall back to the program's exercises when nothing is calibrated yet.
  const resettable = calibratedIds.size ? calibratedIds : programIds

  const doShift = () => { set({ scheduleOffset: shiftForward(s).scheduleOffset }); haptic.success(); setShifted(true); setTimeout(() => setShifted(false), 1800) }

  const eraseAll = async () => {
    setErase(0)
    await db.delete()
    try { localStorage.removeItem('sculpt.passcodeLength'); localStorage.removeItem('sculpt.installHintDismissed') } catch { /* ignore */ }
    await db.open()
    window.location.href = import.meta.env.BASE_URL + (import.meta.env.VITE_TARGET === 'artifact' ? '#/' : '')
  }

  return (
    <div className="page">
      <PageHeader eyebrow={s.name ? `Hey ${s.name}` : 'Sculpt'} title="Settings" big />
      <InstallHint />
      <div className="stack-lg stagger">
        <Group title="Profile">
          <TextRow label="Name" value={s.name} placeholder="Your name" onCommit={v => set({ name: v.trim() })} />
          <StackedRow label="Units" hint="Everything is stored in kilograms. Switching adopts that unit's plate jumps and re-rounds your working weights.">
            <Segmented accent value={s.units} onChange={(u: Units) => { if (u !== s.units) void switchUnits(u, INCREMENT_DEFAULTS[u]) }} options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]} />
          </StackedRow>
          <div className="list-item" style={{ flexWrap: 'wrap' }}>
            <div className="grow" style={{ minWidth: 110 }}><div style={{ fontWeight: 700 }}>Bodyweight</div><div className="small">Latest weigh-in updates this too</div></div>
            <BodyweightStepper kg={s.bodyweightKg} units={s.units} onChange={kg => set({ bodyweightKg: kg })} />
          </div>
          {s.units === 'lb' ? (
            <StackedRow label="Height"><HeightInput fill cm={s.heightCm} units={s.units} onChange={cm => set({ heightCm: cm })} /></StackedRow>
          ) : (
            <div className="list-item" style={{ flexWrap: 'wrap' }}>
              <div className="grow" style={{ minWidth: 110 }}><div style={{ fontWeight: 700 }}>Height</div></div>
              <HeightInput cm={s.heightCm} units={s.units} onChange={cm => set({ heightCm: cm })} />
            </div>
          )}
        </Group>

        <Group title="Training">
          <StackedRow label="Deload every" hint="A lighter week on this cadence.">
            <Segmented accent value={String(s.deloadEvery)} onChange={v => set({ deloadEvery: Number(v) })} options={[6, 7, 8].map(n => ({ value: String(n), label: `${n} weeks` }))} />
          </StackedRow>
          <StepperRow label="Miss drop" hint="Load cut after two missed sessions" value={s.missDropPct} step={0.5} min={5} max={10} decimals={1} suffix="%" onChange={v => { if (v != null) set({ missDropPct: v }) }} />
          <StackedRow label="Program start date" hint={`Day 1 of week 1. ${s.scheduleOffset ? `Shifted ${s.scheduleOffset} day${s.scheduleOffset === 1 ? '' : 's'} forward.` : ''}`}>
            <div className="row" style={{ gap: 8 }}>
              <input type="date" className="input" value={s.programStartDate} onChange={e => { if (e.target.value) set({ programStartDate: e.target.value, scheduleOffset: 0 }) }} />
              {s.scheduleOffset > 0 && <Button size="sm" variant="ghost" onClick={() => set({ scheduleOffset: 0 })}>Reset shift</Button>}
            </div>
          </StackedRow>
          <Row label="Shift schedule forward 1 day" hint="Missed today? Do it tomorrow and push the rest.">
            <Button size="sm" variant={shifted ? 'good' : 'subtle'} onClick={doShift}>{shifted ? 'Shifted ✓' : 'Shift'}</Button>
          </Row>
          <Row label="Edit program" hint="Days, exercises, sets and rep ranges" chevron onClick={() => nav('/settings/program')} />
          <Row label="Reset calibration" hint={calibratedIds.size ? `${calibratedIds.size} exercise${calibratedIds.size === 1 ? '' : 's'} calibrated` : 'Nothing calibrated yet'} chevron onClick={() => setResetOpen(true)} />
        </Group>

        <Group title="Increments" hint="Smallest jumps your gym allows. Bar jumps are 2× the plate.">
          <IncrementFields inc={s.increments} units={s.units} onChange={inc => set({ increments: inc })} />
        </Group>

        <Group title="Nutrition">
          <StepperRow label="Protein target" hint={`${Math.round(s.proteinPerKg * s.bodyweightKg)} g per day at your bodyweight`} value={s.proteinPerKg} step={0.1} min={1.6} max={2.2} decimals={1} suffix="g/kg" onChange={v => { if (v != null) set({ proteinPerKg: v }) }} />
          <StackedRow label="Meal times">
            <div className="grid-2">
              <label className="field"><span className="tiny">Meal 1</span><input type="time" className="input" value={s.mealTimes[0]} onChange={e => set({ mealTimes: [e.target.value, s.mealTimes[1]] })} /></label>
              <label className="field"><span className="tiny">Meal 2</span><input type="time" className="input" value={s.mealTimes[1]} onChange={e => set({ mealTimes: [s.mealTimes[0], e.target.value] })} /></label>
            </div>
          </StackedRow>
          <ToggleRow label="I train fasted" hint="Workouts before Meal 1" on={s.trainsFasted} onChange={v => set({ trainsFasted: v })} />
          <StepperRow label="Typical intake" hint="Optional. Enables maintenance adjustments." value={s.typicalIntakeKcal ?? null} allowEmpty step={50} min={1000} max={6000} suffix="kcal" onChange={v => set({ typicalIntakeKcal: v ?? undefined })} />
        </Group>

        <Group title="Reminders">
          <StackedRow label="Weigh-in" hint={`${DAY_LABELS_LONG[s.weighInDay]} at ${fmtHour(s.weighInHour)}`}>
            <DayPicker value={s.weighInDay} onChange={d => set({ weighInDay: d })} />
            <div className="row-between"><span className="small">Hour</span><StepperBox width={176}><Stepper value={s.weighInHour} min={0} max={23} suffix=":00" onChange={v => { if (v != null) set({ weighInHour: v }) }} /></StepperBox></div>
          </StackedRow>
          <ToggleRow label="Progress-photo reminder" hint="Nudge for a selfie on weigh-in day" on={s.selfieReminder} onChange={v => set({ selfieReminder: v })} />
        </Group>

        <Group title="Privacy">
          <ToggleRow label="App passcode" hint={s.lockEnabled ? 'Required when the app opens' : 'Lock the app with a 4–6 digit code'} on={s.lockEnabled}
            onChange={on => setPassMode(on ? 'set' : 'verify')} />
          <ToggleRow label="Blur photo thumbnails" hint="Hide progress photos in lists until tapped" on={s.blurThumbs} onChange={v => set({ blurThumbs: v })} />
          {s.lockEnabled && (
            <Row label="Lock now" hint="Ask for the passcode immediately">
              <Button size="sm" variant="subtle" onClick={() => { haptic.tap(); lockNow() }}><IconLock size={16} /> Lock</Button>
            </Row>
          )}
        </Group>

        <Group title="Feedback">
          <ToggleRow label="Sound" hint="Rest timer, PRs and session complete" on={s.soundOn} onChange={v => set({ soundOn: v })} />
          <ToggleRow label="Vibration" hint="Haptic taps and celebrations" on={s.vibrateOn} onChange={v => set({ vibrateOn: v })} />
        </Group>

        <Group title="Data">
          <Row label="Export / Import" hint="Backups, restore and storage" chevron onClick={() => nav('/settings/data')}>
            <IconDownload size={20} style={{ color: 'var(--muted)' }} />
          </Row>
          <Row label="Erase everything" hint="Deletes all sessions, photos and settings on this device" danger onClick={() => setErase(1)}>
            <IconRotate size={20} style={{ color: 'var(--bad)' }} />
          </Row>
        </Group>

        <Group title="About">
          <Row label="Sculpt 1.0" hint="All data stays on this device. No account, no cloud, no analytics." />
          <div className="list-item"><div className="row" style={{ flexWrap: 'wrap', gap: 6 }}><Pill tone="accent">🍑 Glutes first</Pill><Pill tone="upper">Upper body</Pill><Pill tone="gold">Strong legs</Pill><Pill tone="good">Stay lean</Pill></div></div>
        </Group>
      </div>

      <ExercisePicker open={resetOpen} onClose={() => setResetOpen(false)} title="Reset calibration" only={resettable.size ? resettable : undefined}
        subtitle={def => { const st = states?.find(x => x.exerciseId === def.id); return st?.currentLoad != null ? `Current ${formatLoad(st.currentLoad, s.units)} · best e1RM ${formatLoad(st.bestE1rm, s.units)}` : 'Not calibrated' }}
        onPick={def => { setResetOpen(false); setResetTarget(def.id) }} />
      <ConfirmSheet open={!!resetTarget} onClose={() => setResetTarget(null)} danger confirmLabel="Reset" title={resetTarget ? `Reset ${getExercise(resetTarget).shortName}?` : ''}
        body="Progression history for this exercise is wiped and it re-enters calibration next session. Sessions and PRs stay."
        onConfirm={async () => { if (resetTarget) { await resetCalibration(resetTarget); haptic.success() } setResetTarget(null) }} />

      <PasscodeSheet open={passMode != null} mode={passMode ?? 'set'} onClose={() => setPassMode(null)}
        onDone={async code => {
          if (passMode === 'set') { await setPasscode(code); await updateSettings({ lockEnabled: true }); haptic.success() }
          else { await clearPasscode(); await updateSettings({ lockEnabled: false }) }
          setPassMode(null)
        }} />

      <ConfirmSheet open={erase === 1} onClose={() => setErase(0)} danger title="Erase everything?" confirmLabel="Continue"
        body="This removes every session, PR, weigh-in, measurement, photo and setting from this device. There is no undo. Export a backup first." onConfirm={() => setErase(2)} />
      <ConfirmSheet open={erase === 2} onClose={() => setErase(0)} danger title="Last chance" confirmLabel="Yes, erase it all" cancelLabel="Keep my data"
        body={<><IconLock size={18} style={{ display: 'inline', verticalAlign: -3, marginRight: 6 }} />Really erase everything? The app restarts with a fresh onboarding{s.programStartDate ? ` (your program started ${fmtDate(s.programStartDate)})` : ''}.</>}
        onConfirm={eraseAll} />
    </div>
  )
}
