import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { Photo } from '../../db/types'
import { IconEye } from '../ui/Icons'
import { dayOfMonth, useObjectUrl } from '../../lib/photos'
import { haptic } from '../../lib/haptics'

const HOLD_MS = 250

/** Grid thumbnail. With `blur` on, press-and-hold peeks at the photo; a quick tap opens it. */
export function PhotoTile({ photo, blur, onOpen, index }: { photo: Photo; blur: boolean; onOpen: () => void; index: number }) {
  const url = useObjectUrl(photo.thumb)
  const [peek, setPeek] = useState(false)
  const downAt = useRef(0)
  const timer = useRef<number | null>(null)

  const release = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setPeek(false)
  }
  const onPointerDown = () => {
    downAt.current = Date.now()
    if (!blur) return
    timer.current = window.setTimeout(() => { haptic.tap(); setPeek(true) }, HOLD_MS)
  }
  const onClick = () => {
    if (blur && Date.now() - downAt.current > HOLD_MS) return // that was a peek, not a tap
    onOpen()
  }

  return (
    <motion.button
      className={`ph-tile ${blur ? 'ph-tile--blur' : ''} ${peek ? 'ph-tile--peek' : ''}`}
      initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: Math.min(index, 11) * 0.035, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onPointerDown={onPointerDown} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}
      onContextMenu={e => e.preventDefault()}
      onClick={onClick}
      aria-label={`${photo.pose} photo, ${photo.date}`}
    >
      {url && <img src={url} alt="" draggable={false} />}
      <span className={`ph-tile__pose ph-pose--${photo.pose}`} />
      <span className="ph-tile__day num">{dayOfMonth(photo.date)}</span>
      {blur && !peek && <span className="ph-tile__peek"><IconEye /></span>}
    </motion.button>
  )
}
