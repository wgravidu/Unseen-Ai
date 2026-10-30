const RADIUS = 84
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function IntroProgressRing({ progress, label = 'Initializing UNSEEN AI' }) {
  const clamped = Math.min(1, Math.max(0, progress))
  const percent = Math.round(clamped * 100)
  return (
    <div
      className="intro-ring"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <linearGradient id="ringStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="55%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <circle className="ring-track" cx="100" cy="100" r={RADIUS} />
        <circle
          className="ring-progress"
          cx="100"
          cy="100"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
        />
      </svg>
      <span className="ring-percent" aria-hidden="true">{percent}%</span>
    </div>
  )
}
