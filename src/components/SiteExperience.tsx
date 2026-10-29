'use client'

import { usePathname } from 'next/navigation'
import { ChatWidget } from '@/components/chat/ChatWidget'
import { PostHogProvider } from '@/components/PostHogProvider'
import { PrivacyConsent } from '@/components/PrivacyConsent'
import { Providers } from '@/components/Providers'

export function SiteExperience({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // The holding page is self-contained. Retain the existing app experience elsewhere.
  if (pathname === '/') return <>{children}</>
  return <Providers><PostHogProvider>{children}<ChatWidget /><PrivacyConsent /></PostHogProvider></Providers>
}
