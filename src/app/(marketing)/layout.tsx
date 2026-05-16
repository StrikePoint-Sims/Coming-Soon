import { DesktopHeader } from '@/components/layout/DesktopHeader'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DesktopHeader />
      {children}
    </>
  )
}
