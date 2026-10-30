export function hasInsufficientEvidence(analysis) {
  return Boolean(analysis && (!analysis.is_wall_visible || analysis.needs_more_evidence))
}
