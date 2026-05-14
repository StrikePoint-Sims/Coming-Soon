import { env } from '@/env'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OpenpathCredential {
  credentialId: string
  code: string
  validFrom: string // ISO 8601
  validTo: string
  status: 'active' | 'inactive' | 'expired'
}

export interface OpenpathDoorStatus {
  doorId: string
  online: boolean
  lastSeenAt: string
}

// ── Client ────────────────────────────────────────────────────────────────────

class OpenpathClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly orgId: string
  private readonly mockMode: boolean

  constructor() {
    this.baseUrl = env.OPENPATH_API_BASE_URL ?? ''
    this.apiKey = env.OPENPATH_API_KEY ?? ''
    this.orgId = env.OPENPATH_ORG_ID ?? ''
    this.mockMode = env.OPENPATH_MOCK_MODE
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    if (this.mockMode) {
      throw new Error(`OpenPath mock: no fixture for ${path}`)
    }
    const res = await fetch(`${this.baseUrl}/orgs/${this.orgId}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    })
    if (!res.ok) {
      throw new Error(`OpenPath API ${res.status}: ${path}`)
    }
    return res.json() as Promise<T>
  }

  async createCredential(params: {
    doorId: string
    validFrom: string
    validTo: string
    label: string
    idempotencyKey: string
  }): Promise<OpenpathCredential> {
    if (this.mockMode) {
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      return {
        credentialId: `mock_cred_${params.idempotencyKey}`,
        code,
        validFrom: params.validFrom,
        validTo: params.validTo,
        status: 'active',
      }
    }
    return this.request<OpenpathCredential>('/credentials', {
      method: 'POST',
      headers: { 'Idempotency-Key': params.idempotencyKey },
      body: JSON.stringify(params),
    })
  }

  async revokeCredential(credentialId: string): Promise<void> {
    if (this.mockMode) return
    await this.request(`/credentials/${credentialId}`, { method: 'DELETE' })
  }

  async unlockDoor(doorId: string): Promise<void> {
    if (this.mockMode) {
      console.log(`[OpenPath MOCK] Remote unlock: door ${doorId}`)
      return
    }
    await this.request(`/doors/${doorId}/unlock`, { method: 'POST' })
  }

  async getDoorStatus(doorId: string): Promise<OpenpathDoorStatus> {
    if (this.mockMode) {
      return { doorId, online: true, lastSeenAt: new Date().toISOString() }
    }
    return this.request<OpenpathDoorStatus>(`/doors/${doorId}`)
  }
}

export const openpath = new OpenpathClient()
