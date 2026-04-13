export const colors = {
  // Backgrounds - warm near-black, not cold pure black
  bg: {
    base: '#0a0a09',
    surface1: '#111110',
    surface2: '#181816',
    surface3: '#1f1f1d',
    surface4: '#262624',
    overlay: 'rgba(10,10,9,0.85)',
  },

  // Borders - white at varying opacities
  border: {
    subtle: 'rgba(255,255,255,0.04)',
    default: 'rgba(255,255,255,0.08)',
    active: 'rgba(255,255,255,0.14)',
    strong: 'rgba(255,255,255,0.24)',
  },

  // Accents - amber primary, cyan data, red danger
  accent: {
    amber: '#e8a045',
    amberDim: '#e8a04580',
    amberGlow: '#e8a04518',
    cyan: '#00d4aa',
    cyanDim: '#00d4aa80',
    cyanGlow: '#00d4aa12',
    red: '#ff4d4d',
    redGlow: '#ff4d4d18',
  },

  // Text
  text: {
    primary: '#f2f2f0',
    secondary: '#888884',
    muted: '#444440',
    amber: '#e8a045',
    cyan: '#00d4aa',
    red: '#ff4d4d',
  },

  // Score colors (used in score bars and badges)
  score: {
    high: '#00d4aa',
    mid: '#e8a045',
    low: '#ff4d4d',
  },

  // Badge colors
  badge: {
    tier1: '#00d4aa',
    tier2: '#7c6af7',
    tier3: '#e8a045',
    tier4: '#ff4d4d',
    neutral: '#444440',
  },
} as const

export const typography = {
  fonts: {
    display: '"Syne", sans-serif',
    body: '"Inter", sans-serif',
    mono: '"JetBrains Mono", monospace',
  },
  sizes: {
    xs: '11px',
    sm: '13px',
    md: '15px',
    lg: '17px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '48px',
    '5xl': '64px',
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
  },
  tracking: {
    tight: '-0.03em',
    normal: '-0.01em',
    wide: '0.06em',
    wider: '0.10em',
  },
  leading: {
    tight: 1.2,
    normal: 1.5,
    loose: 1.7,
  },
} as const

export const spacing = {
  // 4px base unit
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const

export const radii = {
  sm: '5px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '22px',
  full: '9999px',
} as const

export const shadows = {
  amberGlow: '0 0 20px rgba(232,160,69,0.12), 0 0 60px rgba(232,160,69,0.06)',
  cyanGlow: '0 0 20px rgba(0,212,170,0.12), 0 0 60px rgba(0,212,170,0.06)',
  redGlow: '0 0 20px rgba(255,77,77,0.12)',
  card: '0 1px 0 rgba(255,255,255,0.04) inset',
  winnerCard: '0 0 0 1px rgba(232,160,69,0.3), 0 0 30px rgba(232,160,69,0.08)',
} as const

export const transitions = {
  fast: '80ms ease-out',
  normal: '160ms ease-out',
  slow: '280ms ease-out',
  spring: { type: 'spring', stiffness: 380, damping: 28 } as const,
  springFast: { type: 'spring', stiffness: 500, damping: 32 } as const,
  springSlow: { type: 'spring', stiffness: 260, damping: 24 } as const,
} as const
