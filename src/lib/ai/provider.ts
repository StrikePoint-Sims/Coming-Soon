import { env } from '@/env'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'

export function getModel() {
  if (env.AI_PROVIDER === 'google') {
    if (!env.GOOGLE_AI_API_KEY) throw new Error('GOOGLE_AI_API_KEY is required when AI_PROVIDER=google')
    const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_AI_API_KEY })
    return google('gemini-2.0-flash')
  }
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic')
  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })
  return anthropic('claude-sonnet-4-6')
}
