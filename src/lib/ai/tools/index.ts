import { tool } from 'ai'
import type { ToolSet } from 'ai'
import type { z } from 'zod'

// ── Tool definition type ──────────────────────────────────────────────────────

export interface AgentTool<TSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  definition: {
    name: string
    description: string
    parameters: TSchema
  }
  execute: (input: z.infer<TSchema> & { thread_id: string }) => Promise<string>
}

// ── Tool registry ─────────────────────────────────────────────────────────────
// Tools are added here as backend capabilities come online (week by week).
// Financial/access tools must not be registered until their backing systems are tested.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new Map<string, AgentTool<any>>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerTool(t: AgentTool<any>): void {
  registry.set(t.definition.name, t)
}

// Returns a Vercel AI SDK tool map. threadId is injected so tools always have it,
// even if the model omits it from its tool call.
export function getRegisteredTools(threadId: string): ToolSet {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, any> = {}
  for (const [name, agentTool] of registry.entries()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result[name] = tool({
      description: agentTool.definition.description,
      parameters: agentTool.definition.parameters,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      execute: (input: any) => agentTool.execute({ thread_id: threadId, ...input }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }
  return result as ToolSet
}
