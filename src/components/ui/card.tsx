interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-6 ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: CardProps) {
  return <div className={`mb-4 ${className}`}>{children}</div>
}

export function CardTitle({ children, className = '' }: CardProps) {
  return (
    <h2 className={`font-playfair text-xl font-semibold text-white ${className}`}>
      {children}
    </h2>
  )
}
