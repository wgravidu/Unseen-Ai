export function shouldAskForMoreEvidence(analysis) {
  return Boolean(
    analysis &&
    analysis.is_wall_visible &&
    (analysis.needs_more_evidence || analysis.confidence < 0.7),
  )
}
