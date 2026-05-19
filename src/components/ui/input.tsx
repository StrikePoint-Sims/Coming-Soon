import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.6)]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            h-11 w-full rounded-lg border bg-[#1a1a1a] px-4 text-sm text-white
            placeholder:text-[rgba(255,255,255,0.3)]
            border-[rgba(255,255,255,0.12)]
            focus:border-[#A97845] focus:outline-none focus:ring-1 focus:ring-[#A97845]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-600 focus:border-red-500 focus:ring-red-500' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-[rgba(255,255,255,0.4)]">{hint}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'
