import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'
import { db } from '../../db/schema'
import type { Photo, Pose } from '../../db/types'
import { EXERCISE_MAP } from '../../data/exercises'
import { formatLoad, toDisplay } from '../../engine/units'
import { weeklyWeights, weightTrend } from '../../engine/trends'
import { useSettings, updateSettings } from '../../hooks/useSettings'
import { useTodayDate } from '../../hooks/useToday'
import { Button, Card, PageHeader, Pill, Sheet } from '../../components/ui'
import { IconArrowDown, IconArrowUp, IconCamera, IconChevronRight, IconMinus, IconRotate, IconScale } from '../../components/ui/Icons'
import { GoalsCard } from '../../components/progress/GoalsCard'
import { fmtDate } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { blockWeek, checkinVerdict, goalRows, KEY_LIFTS, liftComparison, type LiftCompare } from '../../lib/stats'

const POSES: Pose[] = ['front', 'side', 'back']

export default function CheckIn() {
  const settings = useSettings()
  const today = useTodayDate()
  const states = useLiveQuery(() => db.exerciseStates.toArray(), [])
  const weights = useLiveQuery(() => db.bodyWeights.orderBy('date').toArray(), [])
  const measurements = useLiveQuery(() => db.measurements.orderBy('date').toArray(), [])
  const photos = useLiveQuery(() => db.photos.orderBy('takenAt').toArray(), [])
  const [confirm, setConfirm] = useState(false)

  if (!settings || !states || !weights || !measurements || !photos) return <div className="page" />
  const units = settings.units
  const start = settings.blockStartDate
  const week = blockWeek(start, today)

  // lifts
  const lifts = KEY_LIFTS.map(id => liftComparison(states.find(s => s.exerciseId === id), start)).filter((l): l is LiftCompare => !!l)

  // measurements: first on/after start (else earliest) vs latest
  const mSince = measurements.filter(m => m.date >= start)
  const firstM = mSince[0] ?? measurements[0]
  const lastM = measurements[measurements.length - 1]
  const goals = goalRows(firstM, lastM !== firstM ? lastM : undefined)

  // weight
  const wSince = weights.filter(w => w.date >= start)
  const wStart = wSince[0] ?? weights[0]
  const wNow = weights[weights.length - 1]
  const wt = weightTrend(weeklyWeights(weights))
  const wDelta = wStart && wNow && wStart !== wNow ? Math.round(toDisplay(wNow.kg - wStart.kg, units) * 10) / 10 : null

  const verdict = checkinVerdict({ lifts, goals, weightStartKg: wStart?.kg ?? null, weightNowKg: wNow?.kg ?? null, weeks: week, units })

  // photos per pose
  const pairs = POSES.map(pose => {
    const list = photos.filter(p => p.pose === pose)
    const first = list.find(p => p.date >= start) ?? null
    const last = list.length ? list[list.length - 1] : null
    return { pose, first, last: last && last !== first ? last : null }
  })
  const anyPhotos = pairs.some(p => p.first)

  const startBlock = async () => {
    await updateSettings({ blockStartDate: today })
    haptic.success()
    setConfirm(false)
  }

  return (
    <div className="page stack-lg">
      <PageHeader back="/progress" eyebrow={`Since ${fmtDate(start, { day: 'numeric', month: 'long' })}`} title={`Week ${week} of your block`}
        right={<Pill tone={week >= 8 ? 'gold' : 'default'}>{week >= 12 ? 'Check-in time' : week >= 8 ? 'Check-in window' : `${8 - week} wk to check-in`}</Pill>} />

      <div className="stagger stack-lg">
        {/* ── Verdict ── */}
        <Card glow>
          <div className="eyebrow">The verdict</div>
          <motion.p className="subtitle" style={{ marginTop: 8, lineHeight: 1.35 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>{verdict}</motion.p>
        </Card>

        {/* ── Photos ── */}
        <Card>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <div><div className="eyebrow">Photos</div><div className="subtitle" style={{ marginTop: 2 }}>Start vs now</div></div>
            <Link to="/photos" className="row small" style={{ gap: 4 }}><IconCamera size={14} /> All photos</Link>
          </div>
          {anyPhotos ? (
            <div className="grid-3">
              {pairs.map(p => <PhotoPair key={p.pose} pose={p.pose} first={p.first} last={p.last} />)}
            </div>
          ) : <p className="body">No photos in this block yet. Take a front, side and back set and they'll appear here beside the latest.</p>}
        </Card>

        {/* ── Lifts ── */}
        <Card>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Key lifts · e1RM</div>
          {lifts.length === 0 && <p className="body">No lift history yet.</p>}
          {lifts.map((l, i) => {
            const def = EXERCISE_MAP[l.exerciseId]
            const hip = l.exerciseId === 'bbHipThrust'
            const fmt = (v: number | null) => (v == null ? '—' : def.defaultLoadMode === 'height' ? `${Math.round(v)} cm` : formatLoad(v, units))
            const d = l.deltaPct
            const Arrow = d == null || Math.abs(d) < 0.5 ? IconMinus : d > 0 ? IconArrowUp : IconArrowDown
            return (
              <motion.div key={l.exerciseId} className="list-item" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                style={hip ? { background: 'var(--accent-soft)', borderRadius: 12, padding: '10px 12px', margin: '4px -4px', boxShadow: '0 0 24px rgba(255,77,125,0.25)', borderBottom: 0 } : undefined}>
                <div className="grow">
                  <div style={{ fontWeight: 800, color: hip ? 'var(--accent)' : undefined }}>{def.shortName}</div>
                  <div className="tiny num">{fmt(l.start)} → <b style={{ color: 'var(--text)' }}>{fmt(l.now)}</b></div>
                </div>
                <div className="row num" style={{ gap: 2, fontWeight: 900, color: d == null ? 'var(--muted)' : d > 0 ? 'var(--good)' : d < 0 ? 'var(--bad)' : 'var(--muted)' }}>
                  <Arrow size={16} /> {d == null ? '—' : `${d > 0 ? '+' : ''}${d}%`}
                </div>
              </motion.div>
            )
          })}
        </Card>

        {/* ── Measurements ── */}
        <Card>
          <div className="row-between" style={{ marginBottom: 6 }}>
            <div className="eyebrow">Tape</div>
            {firstM && lastM && firstM !== lastM && <span className="tiny">{fmtDate(firstM.date, { day: 'numeric', month: 'short' })} → {fmtDate(lastM.date, { day: 'numeric', month: 'short' })}</span>}
          </div>
          {firstM && lastM && firstM !== lastM
            ? <GoalsCard rows={goals} units={units} compact />
            : <p className="body">Two tape measurements in this block and the deltas appear here. <Link to="/progress/body" className="accent">Measure now</Link>.</p>}
        </Card>

        {/* ── Weight ── */}
        <Card>
          <div className="row">
            <span style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--accent-2-soft)', color: 'var(--accent-2)', flex: 'none' }}><IconScale size={20} /></span>
            <div className="grow">
              <div className="eyebrow">Weight</div>
              {wStart && wNow ? (
                <div className="row" style={{ alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                  <span className="num small">{formatLoad(wStart.kg, units)}</span>
                  <IconChevronRight size={14} style={{ color: 'var(--muted)' }} />
                  <span className="num" style={{ fontWeight: 900, fontSize: 20 }}>{formatLoad(wNow.kg, units)}</span>
                  {wDelta != null && <span className="num small" style={{ color: Math.abs(wDelta) <= 0.7 ? 'var(--good)' : 'var(--text-2)' }}>{wDelta > 0 ? '+' : ''}{wDelta} {units}</span>}
                </div>
              ) : <div className="small" style={{ marginTop: 2 }}>No weigh-ins yet.</div>}
            </div>
            <Pill tone={wt.direction === 'flat' ? 'good' : 'default'}>{wt.direction === 'flat' ? 'trend flat' : `trending ${wt.direction} · ${wt.streak} wk`}</Pill>
          </div>
        </Card>

        <Button variant="ghost" block onClick={() => setConfirm(true)}><IconRotate size={18} /> Start a new block</Button>
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Start a new block?">
        <div className="stack-lg">
          <p className="body">Today becomes the new start date for the 8–12 week check-in. Your history stays – only the comparison window moves.</p>
          <Button variant="primary" size="lg" block onClick={startBlock}>Start block from today</Button>
          <Button variant="subtle" block onClick={() => setConfirm(false)}>Not yet</Button>
        </div>
      </Sheet>
    </div>
  )
}

function useThumb(p: Photo | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!p) { setUrl(null); return }
    const u = URL.createObjectURL(p.thumb)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [p])
  return url
}

function PhotoPair({ pose, first, last }: { pose: Pose; first: Photo | null; last: Photo | null }) {
  const a = useThumb(first), b = useThumb(last)
  const href = useMemo(() => (first && last ? `/photos/compare?a=${first.id}&b=${last.id}` : '/photos'), [first, last])
  const Thumb = ({ url, label, date }: { url: string | null; label: string; date?: string }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ aspectRatio: '3 / 4', borderRadius: 8, overflow: 'hidden', background: 'var(--surface-2)' }}>
        {url ? <img src={url} alt={`${pose} ${label}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}><IconCamera size={16} style={{ color: 'var(--muted)' }} /></div>}
      </div>
      <div className="tiny center" style={{ marginTop: 3 }}>{date ? fmtDate(date, { day: 'numeric', month: 'short' }) : label}</div>
    </div>
  )
  return (
    <Link to={href} className="stack" style={{ gap: 6 }}>
      <div className="eyebrow center" style={{ fontSize: 10 }}>{pose}</div>
      <div className="row" style={{ gap: 4 }}>
        <Thumb url={a} label="start" date={first?.date} />
        <Thumb url={b} label="now" date={last?.date} />
      </div>
    </Link>
  )
}
