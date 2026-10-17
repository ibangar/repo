import { useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { Pose } from '../../db/types'
import { Button, Empty, PageHeader, Pill } from '../../components/ui'
import { IconCamera, IconEye, IconEyeOff, IconFlame, IconLock, IconPlay, IconSwap } from '../../components/ui/Icons'
import { updateSettings, useSettings } from '../../hooks/useSettings'
import { haptic } from '../../lib/haptics'
import { groupByMonth, photoStreak, POSE_LABEL, POSES, usePhotos } from '../../lib/photos'
import { PhotoTile } from '../../components/photos/PhotoTile'
import { PhotoViewer } from '../../components/photos/PhotoViewer'
import '../../components/photos/photos.css'

type Filter = Pose | 'all'

export default function Photos() {
  const nav = useNavigate()
  const settings = useSettings()
  const all = usePhotos()
  const [filter, setFilter] = useState<Filter>('all')
  const [viewer, setViewer] = useState<number | null>(null)

  const shown = useMemo(() => (all ? (filter === 'all' ? all : all.filter(p => p.pose === filter)) : []), [all, filter])
  /** Viewer order = display order (newest first). */
  const ordered = useMemo(() => [...shown].sort((a, b) => b.takenAt - a.takenAt), [shown])
  const groups = useMemo(() => groupByMonth(shown), [shown])
  const streak = useMemo(() => (all ? photoStreak(all) : 0), [all])
  const closeViewer = useCallback(() => setViewer(null), [])

  if (!settings || !all) return <div className="page" />
  const blur = settings.blurThumbs

  return (
    <div className="page">
      <PageHeader
        title="Progress photos"
        subtitle={<span className="ph-privacy"><IconLock /> Stored only on this phone</span>}
        right={all.length > 0 && (
          <button className={`ph-iconbtn ${blur ? 'ph-iconbtn--on' : ''}`} style={{ background: blur ? undefined : 'var(--surface-2)' }}
            onClick={() => { haptic.tap(); void updateSettings({ blurThumbs: !blur }) }} aria-pressed={blur} aria-label={blur ? 'Show thumbnails' : 'Blur thumbnails'}>
            {blur ? <IconEyeOff /> : <IconEye />}
          </button>
        )}
      />

      {all.length === 0 ? (
        <Empty icon={<IconCamera size={40} />} title="No photos yet"
          body="Same spot, same light, same poses – front, side and back. Your future self will thank you."
          action={<Button variant="primary" size="lg" onClick={() => nav('/photos/capture')}><IconCamera size={20} /> Take the first one</Button>} />
      ) : (
        <div className="stack-lg">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Pill><span className="num">{`${all.length} photo${all.length === 1 ? '' : 's'}`}</span></Pill>
            {streak >= 2 ? <Pill tone="accent"><IconFlame size={14} /><span className="num">{`${streak}-day streak`}</span></Pill> : <Pill>{streak === 1 ? 'Shot today – keep it going' : 'Shoot today to start a streak'}</Pill>}
            {blur && <Pill tone="good">Hold a tile to peek</Pill>}
          </div>

          <div className="grid-2">
            <Button variant="subtle" onClick={() => nav('/photos/compare')}><IconSwap size={20} /> Compare</Button>
            <Button variant="subtle" onClick={() => nav('/photos/timelapse')}><IconPlay size={18} /> Timelapse</Button>
          </div>

          <div className="chip-row" role="tablist">
            {(['all', ...POSES] as Filter[]).map(f => (
              <button key={f} role="tab" aria-selected={filter === f} className={`chip ${filter === f ? 'chip--on' : ''}`} onClick={() => { haptic.tap(); setFilter(f) }}>
                {f === 'all' ? 'All' : POSE_LABEL[f]}
                <span style={{ marginLeft: 6, opacity: 0.7, fontSize: 12 }} className="num">{f === 'all' ? all.length : all.filter(p => p.pose === f).length}</span>
              </button>
            ))}
          </div>

          {shown.length === 0 && <Empty title={`No ${filter} photos`} body="Switch pose in the camera to add one." />}

          <AnimatePresence initial={false}>
            {groups.map(g => (
              <motion.section key={g.key} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="ph-month">
                  <h2 className="subtitle">{g.label}</h2>
                  <span className="ph-month__count num">{g.photos.length}</span>
                </div>
                <div className="ph-grid">
                  {g.photos.map((p, i) => (
                    <PhotoTile key={p.id} photo={p} blur={blur} index={i} onOpen={() => { haptic.tap(); setViewer(ordered.findIndex(x => x.id === p.id)) }} />
                  ))}
                </div>
              </motion.section>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Portaled: `.page` keeps a transform from its entrance animation, which would otherwise become the fixed-position containing block. */}
      {viewer === null && createPortal(
        <motion.button className="ph-fab" aria-label="Take a photo" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.15 }} onClick={() => { haptic.tap(); nav('/photos/capture') }}>
          <IconCamera />
        </motion.button>,
        document.body,
      )}

      {viewer !== null && ordered.length > 0 && (
        <PhotoViewer photos={ordered} index={Math.min(viewer, ordered.length - 1)} onIndex={setViewer} onClose={closeViewer} />
      )}
    </div>
  )
}
