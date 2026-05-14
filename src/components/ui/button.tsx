import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, children, className = '', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      primary: 'bg-[#1B4332] text-[#D4AF37] border border-[#D4AF37] hover:bg-[#2a5c46] focus-visible:ring-[#D4AF37]',
      ghost: 'bg-transparent text-[rgba(255,255,255,0.7)] border border-[rgba(255,255,255,0.12)] hover:border-[rgba(255,255,255,0.3)] hover:text-white',
      danger: 'bg-red-900 text-red-200 border border-red-700 hover:bg-red-800',
    }

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-5 text-sm',
      lg: 'h-12 px-7 text-base',
    }

    return (
      <button
        ref={ref}
        disabled={disabled ?? loading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {loading ? <span className="opacity-60">…</span> : children}
      </button>
    )
  },
)

Button.displayName = 'Button'
