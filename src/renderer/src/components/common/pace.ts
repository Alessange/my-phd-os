/** Human sentence for a pace difference in percentage points (work − time). */
export const describePace = (paceDifference: number): string => {
  const points = Math.round(Math.abs(paceDifference))
  if (points === 0) return 'Exactly on pace'
  const unit = points === 1 ? 'point' : 'points'
  return paceDifference > 0 ? `${points} ${unit} ahead of pace` : `${points} ${unit} behind pace`
}
