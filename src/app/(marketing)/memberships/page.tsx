import './memberships.css'
import type { Metadata } from 'next'
import { MembershipsClient } from './MembershipsClient'

export const metadata: Metadata = {
  title: 'Memberships | StrikePoint Sims',
  description:
    'Compare Practice, Standard, and Elite memberships at StrikePoint Sims. Unlimited off-peak access, included peak hours, and annual pricing.',
}

export default function MembershipsPage() {
  return <MembershipsClient />
}
