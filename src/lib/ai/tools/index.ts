import { tool, jsonSchema } from 'ai'
import type { ToolSet } from 'ai'

// ── Tool definition type ──────────────────────────────────────────────────────

export interface AgentTool {
  definition: {
    name: string
    description: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input_schema: Record<string, any>
  }
  execute: (input: Record<string, unknown>) => Promise<string>
}

// ── Tool registry ─────────────────────────────────────────────────────────────
// Tools are added here as backend capabilities come online (week by week).
// Financial/access tools must not be registered until their backing systems are tested.

const registry = new Map<string, AgentTool>()

export function registerTool(t: AgentTool): void {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parameters: jsonSchema<Record<string, unknown>>(agentTool.definition.input_schema as any),
      execute: (input: Record<string, unknown>) =>
        agentTool.execute({ thread_id: threadId, ...input }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }
  return result as ToolSet
}
