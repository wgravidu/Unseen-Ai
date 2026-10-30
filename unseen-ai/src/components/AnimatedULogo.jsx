const U_PATH =
  'M44 26 V104 C44 142 66 164 100 164 C134 164 156 142 156 104 V26'

export default function AnimatedULogo() {
  return (
    <svg
      className="u-logo"
      viewBox="0 0 200 190"
      role="img"
      aria-label="UNSEEN AI logo"
    >
      <defs>
        <linearGradient id="uStroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a5f3fc" />
          <stop offset="45%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <filter id="uGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle className="u-seed" cx="100" cy="26" r="3.2" />
      <path
        className="u-path u-path-glow"
        d={U_PATH}
        pathLength="100"
        filter="url(#uGlow)"
      />
      <path className="u-path u-path-core" d={U_PATH} pathLength="100" />
      <circle className="u-cap u-cap-left" cx="44" cy="26" r="3.6" />
      <circle className="u-cap u-cap-right" cx="156" cy="26" r="3.6" />
    </svg>
  )
}
