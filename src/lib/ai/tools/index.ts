import type Anthropic from '@anthropic-ai/sdk'

// ── Tool definition type ──────────────────────────────────────────────────────

export interface AgentTool {
  definition: {
    name: string
    description: string
    input_schema: {
      type: 'object'
      properties?: Record<string, unknown>
      required?: string[]
    }
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

/** Returns tool definitions in Anthropic SDK format. */
export function getToolDefinitions(): Anthropic.Tool[] {
  return Array.from(registry.values()).map((t) => ({
    name: t.definition.name,
    description: t.definition.description,
    input_schema: t.definition.input_schema,
  }))
}

/** Executes a tool call by name, injecting threadId. */
export async function executeToolCall(
  name: string,
  input: Record<string, unknown>,
  threadId: string,
): Promise<string> {
  const t = registry.get(name)
  if (!t) return JSON.stringify({ error: `Unknown tool: ${name}` })
  return t.execute({ thread_id: threadId, ...input })
}
