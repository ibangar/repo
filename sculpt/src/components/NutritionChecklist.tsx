/** STUB – replaced by the progress module. Keep this prop interface. */
export function NutritionChecklist({ date, compact }: { date: string; compact?: boolean }) {
  return <div className="card small">Nutrition checklist for {date}{compact ? ' (compact)' : ''}</div>
}
export default NutritionChecklist
