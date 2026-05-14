export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logohorizontal.png" alt="StrikePoint Sims" className="h-9 mx-auto" />
        </div>
        {children}
      </div>
    </div>
  )
}
