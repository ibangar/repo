import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import type { Photo } from '../../db/types'
import { Button, Pill, Sheet } from '../ui'
import { IconChevronLeft, IconChevronRight, IconX } from '../ui/Icons'
import { fmtDate } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { deletePhoto, fmtTime, POSE_LABEL, useObjectUrl } from '../../lib/photos'

const SWIPE = 70

/** Full-screen viewer with left/right swipe between `photos`. */
export function PhotoViewer({ photos, index, onIndex, onClose }: { photos: Photo[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const nav = useNavigate()
  const [dir, setDir] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const photo = photos[index]
  const url = useObjectUrl(photo?.blob)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  })

  useEffect(() => { if (photos.length === 0) onClose(); else if (index > photos.length - 1) onIndex(photos.length - 1) }, [photos.length, index, onClose, onIndex])

  if (!photo) return null

  const go = (d: number) => {
    const n = index + d
    if (n < 0 || n >= photos.length) return
    haptic.tap(); setDir(d); onIndex(n)
  }
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE || info.velocity.x < -500) go(1)
    else if (info.offset.x > SWIPE || info.velocity.x > 500) go(-1)
  }
  const remove = async () => {
    await deletePhoto(photo.id)
    haptic.success()
    setConfirm(false)
  }

  return createPortal(
    <div className="ph-viewer" role="dialog" aria-modal="true" aria-label="Photo">
      <div className="ph-viewer__bar">
        <button className="ph-iconbtn" onClick={() => { haptic.tap(); onClose() }} aria-label="Close"><IconX /></button>
        <div className="stack center" style={{ gap: 2, alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{fmtDate(photo.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
          <div className="ph-viewer__counter">{fmtTime(photo.takenAt)} · {index + 1} / {photos.length}</div>
        </div>
        <Pill><span className={`ph-tile__pose ph-pose--${photo.pose}`} style={{ position: 'static', boxShadow: 'none' }} />{POSE_LABEL[photo.pose]} pose</Pill>
      </div>

      <div className="ph-viewer__stage">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.img
            key={photo.id} src={url} alt="" draggable={false} custom={dir}
            variants={{ enter: (d: number) => ({ x: d * 120, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: -d * 120, opacity: 0 }) }}
            initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.55} onDragEnd={onDragEnd}
            style={{ opacity: url ? 1 : 0 }}
          />
        </AnimatePresence>
        {index > 0 && <button className="ph-iconbtn" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.7 }} onClick={() => go(-1)} aria-label="Previous"><IconChevronLeft /></button>}
        {index < photos.length - 1 && <button className="ph-iconbtn" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.7 }} onClick={() => go(1)} aria-label="Next"><IconChevronRight /></button>}
      </div>

      <div className="ph-viewer__foot">
        <div className="row" style={{ gap: 8 }}>
          <Button variant="upper" block size="sm" onClick={() => nav(`/photos/compare?a=${photo.id}`)}>Compare as A</Button>
          <Button variant="primary" block size="sm" onClick={() => nav(`/photos/compare?b=${photo.id}`)}>Compare as B</Button>
        </div>
        <Button variant="danger" block size="sm" onClick={() => setConfirm(true)}>Delete photo</Button>
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Delete this photo?">
        <p className="body">It's only stored on this phone – once it's gone, it's gone.</p>
        <div className="stack mt-16">
          <Button variant="danger" block size="lg" onClick={remove}>Delete</Button>
          <Button variant="subtle" block onClick={() => setConfirm(false)}>Keep it</Button>
        </div>
      </Sheet>
    </div>,
    document.body,
  )
}
