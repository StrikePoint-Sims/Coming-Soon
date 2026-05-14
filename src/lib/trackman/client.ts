import { env } from '@/env'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TrackmanShotData {
  shotNumber: number
  clubType: string
  ballSpeedMph: number
  clubSpeedMph: number
  carryYards: number
  totalYards: number
  launchAngleDeg: number
  spinRpm: number
}

export interface TrackmanSessionData {
  sessionId: string
  trackmanUserId: string
  startsAt: string
  endsAt: string | null
  shots: TrackmanShotData[]
}

// ── Client ────────────────────────────────────────────────────────────────────

class TrackmanConnectClient {
  private readonly apiKey: string | undefined

  constructor() {
    this.apiKey = env.TRACKMAN_CONNECT_API_KEY
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    if (!this.apiKey) {
      throw new Error('TRACKMAN_CONNECT_API_KEY not configured')
    }
    const res = await fetch(`https://connect.trackman.com${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    })
    if (!res.ok) {
      throw new Error(`Trackman Connect API ${res.status}: ${path}`)
    }
    return res.json() as Promise<T>
  }

  async getSessionData(trackmanUserId: string, sessionId: string): Promise<TrackmanSessionData> {
    return this.request<TrackmanSessionData>(
      `/api/v1/users/${trackmanUserId}/sessions/${sessionId}`,
    )
  }

  async getShotHistory(trackmanUserId: string, params?: {
    since?: string
    limit?: number
  }): Promise<TrackmanSessionData[]> {
    const qs = new URLSearchParams()
    if (params?.since) qs.set('since', params.since)
    if (params?.limit) qs.set('limit', String(params.limit))
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return this.request<TrackmanSessionData[]>(
      `/api/v1/users/${trackmanUserId}/sessions${query}`,
    )
  }
}

export const trackman = new TrackmanConnectClient()
