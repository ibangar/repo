import { Segmented } from '../ui'
import type { Pose } from '../../db/types'
import { POSES, POSE_LABEL, setLastPose } from '../../lib/photos'

const options = POSES.map(p => ({ value: p, label: POSE_LABEL[p] }))

export function PoseSelector({ value, onChange, accent = true }: { value: Pose; onChange: (p: Pose) => void; accent?: boolean }) {
  return <Segmented<Pose> value={value} onChange={p => { setLastPose(p); onChange(p) }} options={options} accent={accent} />
}
