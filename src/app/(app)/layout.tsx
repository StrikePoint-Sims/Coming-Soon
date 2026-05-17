import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { DesktopHeader } from '@/components/layout/DesktopHeader'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { SiteFooter } from '@/components/layout/SiteFooter'
import './app-shell.css'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <>
      <DesktopHeader activePath="/account" />
      <main className="app-shell">
        {children}
      </main>
      <SiteFooter />
      <MobileBottomNav />
    </>
  )
}
