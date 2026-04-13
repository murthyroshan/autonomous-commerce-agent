'use client'
import { motion, HTMLMotionProps } from 'framer-motion'
import { forwardRef } from 'react'
import { transitions } from '@/design-system/tokens'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'size'> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
}

const styles: Record<Variant, string> = {
  primary: 'bg-[#e8a045] text-[#0a0a09] font-medium hover:bg-[#f0ae52]',
  secondary:
    'bg-[rgba(255,255,255,0.06)] text-[#f2f2f0] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.09)]',
  ghost:
    'bg-transparent text-[#888884] hover:text-[#f2f2f0] hover:bg-[rgba(255,255,255,0.04)]',
  danger:
    'bg-[rgba(255,77,77,0.12)] text-[#ff4d4d] border border-[rgba(255,77,77,0.2)] hover:bg-[rgba(255,77,77,0.18)]',
}

const sizes: Record<Size, string> = {
  sm: 'h-7 px-3 text-[12px] rounded-[6px]',
  md: 'h-9 px-4 text-[13px] rounded-[8px]',
  lg: 'h-11 px-6 text-[14px] rounded-[10px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'secondary', size = 'md', loading, icon, children, className = '', disabled, ...props },
    ref
  ) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        transition={transitions.springFast}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2
          font-[500] tracking-[-0.01em] cursor-pointer
          transition-colors duration-[80ms]
          disabled:opacity-40 disabled:cursor-not-allowed
          select-none outline-none
          focus-visible:ring-2 focus-visible:ring-[#e8a045]
          focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a09]
          ${styles[variant]} ${sizes[size]} ${className}
        `}
        {...props}
      >
        {loading ? (
          <span className="dot-pulse flex items-center gap-0">
            <span />
            <span />
            <span />
          </span>
        ) : (
          <>
            {icon && <span className="w-4 h-4">{icon}</span>}
            {children}
          </>
        )}
      </motion.button>
    )
  }
)
Button.displayName = 'Button'
