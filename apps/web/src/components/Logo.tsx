interface LogoProps {
  variant?: 'light' | 'dark'
  withTagline?: boolean
  className?: string
}

const ARC_COLORS = ['#8fdbb4', '#5fc795', '#3fae7f', '#2a8a63', '#1f6b4c']

function arcPath(index: number): string {
  const radius = 17
  const start = -90 + index * 72 + 5
  const end = start + 62
  const point = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180
    return [24 + radius * Math.cos(radians), 24 + radius * Math.sin(radians)]
  }
  const [x1, y1] = point(start)
  const [x2, y2] = point(end)
  return `M ${x1?.toFixed(2)} ${y1?.toFixed(2)} A ${radius} ${radius} 0 0 1 ${x2?.toFixed(2)} ${y2?.toFixed(2)}`
}

export function LogoMark({ className = 'h-11 w-11' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Símbolo VIVASS">
      <circle cx="24" cy="24" r="2.6" fill="#c3eeda" />
      {ARC_COLORS.map((color, index) => (
        <path
          key={color}
          d={arcPath(index)}
          fill="none"
          stroke={color}
          strokeWidth="4.4"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}

export function Logo({ variant = 'dark', withTagline = true, className = '' }: LogoProps) {
  const titleColor = variant === 'light' ? 'text-white' : 'text-forest-900'
  const taglineColor = variant === 'light' ? 'text-leaf-200' : 'text-ink-600'

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoMark />
      <div className="leading-tight">
        <div className={`text-lg font-extrabold tracking-[0.22em] ${titleColor}`}>
          VIVASS
        </div>
        {withTagline ? (
          <div className={`text-[11px] font-medium ${taglineColor}`}>
            Educação integrada
          </div>
        ) : null}
      </div>
    </div>
  )
}
