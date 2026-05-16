import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { DesktopHeader } from '@/components/layout/DesktopHeader'
import { AccountShell } from '@/components/layout/AccountSidebar'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <>
      <DesktopHeader activePath="/account" />
      <AccountShell>{children}</AccountShell>
      <MobileBottomNav />
    </>
  )
}
