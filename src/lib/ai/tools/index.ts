import type Anthropic from '@anthropic-ai/sdk'

// ── Tool definition type ──────────────────────────────────────────────────────

// Sealed, server-side context handed to every tool. LLM-supplied versions of
// these fields are ignored — the registry overwrites them with the trusted
// values from the request handler.
export interface ToolContext {
  threadId: string
  userId: string | null
}

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
  execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<string>
}

// ── Tool registry ─────────────────────────────────────────────────────────────

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

/** Executes a tool call by name, injecting the trusted server context. */
export async function executeToolCall(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  const t = registry.get(name)
  if (!t) return JSON.stringify({ error: `Unknown tool: ${name}` })
  // Strip any context-shaped keys the model tried to set. The trusted values
  // come from `ctx`, never from the LLM.
  const cleaned: Record<string, unknown> = { ...input }
  delete cleaned['thread_id']
  delete cleaned['user_id']
  return t.execute(cleaned, ctx)
}
