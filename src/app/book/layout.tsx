import { DesktopHeader } from '@/components/layout/DesktopHeader'

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DesktopHeader activePath="/book" />
      {children}
    </>
  )
}
