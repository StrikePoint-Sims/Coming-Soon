import { DesktopHeader } from '@/components/layout/DesktopHeader'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DesktopHeader activePath="/book" />
      {children}
      <MobileBottomNav />
    </>
  )
}
