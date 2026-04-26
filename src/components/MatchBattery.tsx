/**
 * MatchBattery — visual battery indicator for job match strength.
 * Replaces text badges like "Strong Match" with an intuitive 4-bar battery.
 *
 * Bars:  4 green  = Strong Match  (≥70)
 *        3 blue   = Good Match    (55–69)
 *        2 yellow = Possible Match(40–54)
 *        1 red    = Weak Match    (<40)  — rarely shown (dashboard filters ≥40)
 */

type MatchBatteryProps = {
  score: number
  /** 'full' shows label text beside battery; 'icon' shows battery only */
  variant?: 'full' | 'icon'
}

export function MatchBattery({ score, variant = 'full' }: MatchBatteryProps) {
  const bars  = score >= 70 ? 4 : score >= 55 ? 3 : score >= 40 ? 2 : 1
  const label = score >= 70 ? 'Strong Match' : score >= 55 ? 'Good Match' : score >= 40 ? 'Possible Match' : 'Weak Match'

  // Colours per tier
  const fill   = score >= 70 ? '#22c55e' : score >= 55 ? '#3b82f6' : score >= 40 ? '#eab308' : '#ef4444'
  const border = score >= 70 ? '#86efac' : score >= 55 ? '#93c5fd' : score >= 40 ? '#fde047' : '#fca5a5'
  const text   = score >= 70 ? 'text-green-700' : score >= 55 ? 'text-blue-700' : score >= 40 ? 'text-yellow-700' : 'text-red-600'

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {/* SVG battery — 4 bars inside a shell + tip nub */}
      <svg width="30" height="14" viewBox="0 0 30 14" fill="none" aria-label={label}>
        {/* Shell */}
        <rect x="0.5" y="0.5" width="25" height="13" rx="2.5" stroke={border} strokeWidth="1.2" fill="white" />
        {/* Tip */}
        <rect x="26" y="4.5" width="3" height="5" rx="1" fill={border} />
        {/* 4 segments — each 5px wide, 1px gap */}
        {[0, 1, 2, 3].map(i => (
          <rect
            key={i}
            x={2 + i * 6}
            y="2.5"
            width="5"
            height="9"
            rx="1"
            fill={i < bars ? fill : '#e5e7eb'}
          />
        ))}
      </svg>

      {variant === 'full' && (
        <span className={`text-xs font-semibold ${text}`}>{label}</span>
      )}
    </div>
  )
}
