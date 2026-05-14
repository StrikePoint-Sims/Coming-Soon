import { env } from '@/env'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SendEmailParams {
  to: { email: string; name?: string }[]
  subject: string
  htmlContent: string
  textContent?: string
  templateId?: number
  params?: Record<string, unknown>
  tags?: string[]
}

interface SendSmsParams {
  to: string // E.164 format
  content: string
  tag?: string
}

interface ContactUpsertParams {
  email: string
  attributes?: Record<string, unknown>
  listIds?: number[]
  updateEnabled?: boolean
}

// ── Client ────────────────────────────────────────────────────────────────────

class BrevoClient {
  private readonly apiKey: string
  private readonly senderEmail: string
  private readonly senderName: string
  private readonly smsSender: string

  constructor() {
    this.apiKey = env.BREVO_API_KEY ?? ''
    this.senderEmail = env.BREVO_TRANSACTIONAL_SENDER_EMAIL ?? ''
    this.senderName = env.BREVO_TRANSACTIONAL_SENDER_NAME
    this.smsSender = env.BREVO_SMS_SENDER
  }

  private async request<T>(path: string, options: RequestInit): Promise<T> {
    const res = await fetch(`https://api.brevo.com/v3${path}`, {
      ...options,
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Brevo API ${res.status}: ${body}`)
    }
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  async sendEmail(params: SendEmailParams): Promise<{ messageId: string }> {
    return this.request('/smtp/email', {
      method: 'POST',
      body: JSON.stringify({
        sender: { email: this.senderEmail, name: this.senderName },
        ...params,
      }),
    })
  }

  async sendSms(params: SendSmsParams): Promise<void> {
    await this.request('/transactionalSMS/sms', {
      method: 'POST',
      body: JSON.stringify({
        sender: this.smsSender,
        recipient: params.to,
        content: params.content,
        tag: params.tag,
      }),
    })
  }

  async upsertContact(params: ContactUpsertParams): Promise<void> {
    await this.request('/contacts', {
      method: 'POST',
      body: JSON.stringify({
        email: params.email,
        attributes: params.attributes ?? {},
        listIds: params.listIds ?? [],
        updateEnabled: params.updateEnabled ?? true,
      }),
    })
  }
}

export const brevo = new BrevoClient()
