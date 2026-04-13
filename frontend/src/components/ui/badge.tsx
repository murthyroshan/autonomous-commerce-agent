interface BadgeProps {
  label: string
  color?: string
  icon?: React.ReactNode
  note?: string
  size?: 'sm' | 'md'
}

export function Badge({ label, color = '#888884', icon, note, size = 'sm' }: BadgeProps) {
  const bg = `${color}18`
  const text = color
  const bdr = `${color}30`

  return (
    <span
      title={note}
      style={{ background: bg, color: text, borderColor: bdr }}
      className={`
        inline-flex items-center gap-1 border rounded-full font-mono
        tracking-[0.04em] uppercase
        ${size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'}
      `}
    >
      {icon && <span className="w-3 h-3">{icon}</span>}
      {label}
    </span>
  )
}
