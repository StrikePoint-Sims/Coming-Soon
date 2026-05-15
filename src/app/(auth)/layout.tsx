import './auth.css'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logohorizontal.png" alt="StrikePoint Sims" className="auth-logo" />
        {children}
      </div>
    </div>
  )
}
