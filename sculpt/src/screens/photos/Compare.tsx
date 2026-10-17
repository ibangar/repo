import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import type { Photo, Pose } from '../../db/types'
import { Button, Empty, PageHeader, Pill, Segmented } from '../../components/ui'
import { IconCamera, IconChevronDown, IconChevronLeft, IconChevronRight, IconSwap } from '../../components/ui/Icons'
import { PoseSelector } from '../../components/photos/PoseSelector'
import { fmtDate } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { byPose, fmtTime, getLastPose, POSE_LABEL, useObjectUrl, usePhotos } from '../../lib/photos'
import { daysBetween } from '../../engine/schedule'
import '../../components/photos/photos.css'

type Mode = 'side' | 'slider'

export default function Compare() {
  const photos = usePhotos()
  const [params, setParams] = useSearchParams()
  const [mode, setMode] = useState<Mode>('side')
  const [pose, setPose] = useState<Pose>(getLastPose)
  const [aId, setAId] = useState<string | null>(params.get('a'))
  const [bId, setBId] = useState<string | null>(params.get('b'))
  const seeded = useRef(false)

  // Query params from the viewer pick the pose on first load.
  useEffect(() => {
    if (!photos || seeded.current) return
    seeded.current = true
    const seed = photos.find(p => p.id === params.get('a')) ?? photos.find(p => p.id === params.get('b'))
    if (seed) setPose(seed.pose)
    if (params.has('a') || params.has('b')) setParams({}, { replace: true })
  }, [photos, params, setParams])

  const list = useMemo(() => (photos ? byPose(photos, pose) : []), [photos, pose])
  // Defaults: A = earliest, B = latest – but never the same photo as the one the user explicitly chose.
  const chosenA = list.find(p => p.id === aId), chosenB = list.find(p => p.id === bId)
  const first = list[0], last = list[list.length - 1]
  const rawA = chosenA ?? (chosenB && first?.id === chosenB.id && list.length > 1 ? list[1] : first)
  const rawB = chosenB ?? (chosenA && last?.id === chosenA.id && list.length > 1 ? list[list.length - 2] : last)
  // Keep "before" before "after" unless the user explicitly picked both sides.
  const flip = !!rawA && !!rawB && !(chosenA && chosenB) && rawA.takenAt > rawB.takenAt
  const a = flip ? rawB : rawA, b = flip ? rawA : rawB
  const urlA = useObjectUrl(a?.blob), urlB = useObjectUrl(b?.blob)

  if (!photos) return <div className="page" />

  const choosePose = (p: Pose) => { setPose(p); setAId(null); setBId(null) }
  const swap = () => { haptic.tap(); setAId(b?.id ?? null); setBId(a?.id ?? null) }
  const days = a && b ? Math.abs(daysBetween(a.date, b.date)) : 0

  return (
    <div className="page stack-lg">
      <PageHeader back="/photos" title="Compare" subtitle="Before and after, side by side or with a slider." />
      <PoseSelector value={pose} onChange={choosePose} />

      {list.length === 0 ? (
        <Empty icon={<IconCamera size={36} />} title={`No ${POSE_LABEL[pose].toLowerCase()} photos yet`} body="Take two photos of this pose to compare them." />
      ) : (
        <>
          <Segmented<Mode> value={mode} onChange={setMode} options={[{ value: 'side', label: 'Side by side' }, { value: 'slider', label: 'Slider' }]} />

          <div className="cmp-pickers">
            <Picker label="A · before" tone="a" list={list} value={a} onChange={p => setAId(p.id)} />
            <Button variant="subtle" icon onClick={swap} aria-label="Swap A and B" title="Swap A/B"><IconSwap size={20} /></Button>
            <Picker label="B · after" tone="b" list={list} value={b} onChange={p => setBId(p.id)} />
          </div>

          {list.length === 1 && <p className="small center">Only one {POSE_LABEL[pose].toLowerCase()} photo so far – take another to see the change.</p>}

          {a && b && (mode === 'side'
            ? <SideBySide a={a} b={b} urlA={urlA} urlB={urlB} />
            : <Slider a={a} b={b} urlA={urlA} urlB={urlB} />)}

          <div className="cmp-days">
            <Pill tone={days > 0 ? 'accent' : 'default'}><span className="num">{days}</span> day{days === 1 ? '' : 's'} apart</Pill>
          </div>
        </>
      )}
    </div>
  )
}

function Picker({ label, tone, list, value, onChange }: { label: string; tone: 'a' | 'b'; list: Photo[]; value: Photo | undefined; onChange: (p: Photo) => void }) {
  const dupDays = new Set(list.map(p => p.date).filter((d, i, arr) => arr.indexOf(d) !== i))
  return (
    <label className="field">
      <span className="label row" style={{ gap: 6 }}><span className={`cmp-tag__k cmp-tag__k--${tone}`}>{tone.toUpperCase()}</span>{label}</span>
      <span className="cmp-select">
        <select value={value?.id ?? ''} onChange={e => { haptic.tap(); const p = list.find(x => x.id === e.target.value); if (p) onChange(p) }}>
          {list.map(p => <option key={p.id} value={p.id}>{fmtDate(p.date, { day: 'numeric', month: 'short', year: '2-digit' })}{dupDays.has(p.date) ? ` ${fmtTime(p.takenAt)}` : ''}</option>)}
        </select>
        <IconChevronDown />
      </span>
    </label>
  )
}

function Tag({ k, photo, right }: { k: 'a' | 'b'; photo: Photo; right?: boolean }) {
  return <span className={`cmp-tag ${right ? 'cmp-tag--right' : ''}`}><span className={`cmp-tag__k cmp-tag__k--${k}`}>{k.toUpperCase()}</span>{fmtDate(photo.date, { day: 'numeric', month: 'short' })}</span>
}

function SideBySide({ a, b, urlA, urlB }: { a: Photo; b: Photo; urlA?: string; urlB?: string }) {
  return (
    <motion.div className="cmp-side" key="side" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="stack" style={{ gap: 8 }}>
        <div className="cmp-side__img">{urlA && <img src={urlA} alt={`A ${a.date}`} />}<Tag k="a" photo={a} /></div>
        <div className="center small">{fmtDate(a.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <div className="cmp-side__img">{urlB && <img src={urlB} alt={`B ${b.date}`} />}<Tag k="b" photo={b} /></div>
        <div className="center small">{fmtDate(b.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </div>
    </motion.div>
  )
}

function Slider({ a, b, urlA, urlB }: { a: Photo; b: Photo; urlA?: string; urlB?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(50)
  const [drag, setDrag] = useState(false)

  const place = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r || !r.width) return
    setX(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)))
  }
  const down = (e: RPointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); setDrag(true); place(e.clientX); haptic.tap() }
  const move = (e: RPointerEvent<HTMLDivElement>) => { if (drag) place(e.clientX) }
  const up = () => setDrag(false)

  return (
    <motion.div key="slider" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="stack" style={{ gap: 8 }}>
      <div ref={ref} className={`cmp-frame ${drag ? 'cmp-frame--drag' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        role="slider" aria-label="Reveal after photo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(x)}>
        {urlA && <img src={urlA} alt={`A ${a.date}`} />}
        {urlB && <img src={urlB} alt={`B ${b.date}`} style={{ clipPath: `inset(0 0 0 ${x}%)` }} />}
        <Tag k="a" photo={a} />
        <Tag k="b" photo={b} right />
        <div className="cmp-handle" style={{ left: `${x}%` }}>
          <div className="cmp-handle__knob"><IconChevronLeft /><IconChevronRight /></div>
        </div>
      </div>
      <div className="small center">Drag the handle – left is A, right reveals B</div>
    </motion.div>
  )
}
