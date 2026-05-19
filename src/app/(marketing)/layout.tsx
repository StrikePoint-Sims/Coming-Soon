import { DesktopHeader } from '@/components/layout/DesktopHeader'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DesktopHeader />
      {children}
      <MobileBottomNav />
    </>
  )
}
