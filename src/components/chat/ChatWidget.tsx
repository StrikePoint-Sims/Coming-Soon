'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage } from '@/lib/ai/agent'

interface Message {
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
}

const GREETING: Message = {
  role: 'assistant',
  content:
    "Hey! I'm Striker, your StrikePoint Sims assistant. I can answer questions about pricing, memberships, how our Trackman bays work, and more. What can I help you with?",
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [threadId, setThreadId] = useState<string | undefined>()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [open, messages])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const pendingMsg: Message = { role: 'assistant', content: '', pending: true }

    setMessages((prev) => [...prev, userMsg, pendingMsg])
    setInput('')
    setLoading(true)

    // Build full history for the API (exclude the pending placeholder)
    const history: ChatMessage[] = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, threadId }),
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (!data) continue

          try {
            const event = JSON.parse(data) as { type: string; text?: string; threadId?: string; fullText?: string }

            if (event.type === 'delta' && event.text) {
              assistantText += event.text
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.pending) {
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: assistantText,
                    pending: true,
                  }
                }
                return updated
              })
            }

            if (event.type === 'done') {
              if (event.threadId) setThreadId(event.threadId)
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.pending) {
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: event.fullText ?? assistantText,
                    pending: false,
                  }
                }
                return updated
              })
            }
          } catch {
            // Malformed SSE line — skip
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.pending) {
          updated[updated.length - 1] = {
            role: 'assistant',
            content:
              "Sorry, I'm having trouble connecting right now. Please try again or email us directly.",
            pending: false,
          }
        }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, threadId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  return (
    <>
      {/* Launcher button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close chat' : 'Open chat with Striker'}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#1B4332',
          color: '#D4AF37',
          border: '2px solid #D4AF37',
          fontSize: '24px',
          cursor: 'pointer',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}
      >
        {open ? '✕' : '⛳'}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: '92px',
            right: '24px',
            width: '360px',
            maxWidth: 'calc(100vw - 48px)',
            height: '480px',
            maxHeight: 'calc(100vh - 120px)',
            backgroundColor: '#111',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9998,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              backgroundColor: '#1B4332',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderBottom: '1px solid #2a3a2a',
            }}
          >
            <span style={{ fontSize: '20px' }}>⛳</span>
            <div>
              <div style={{ fontWeight: 600, color: '#D4AF37', fontSize: '14px' }}>Striker</div>
              <div style={{ fontSize: '11px', color: '#aaa' }}>StrikePoint Sims Support</div>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '8px 12px',
                    borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    backgroundColor: msg.role === 'user' ? '#1B4332' : '#1e1e1e',
                    color: msg.role === 'user' ? '#D4AF37' : '#eee',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    border: msg.role === 'assistant' ? '1px solid #2a2a2a' : 'none',
                    opacity: msg.pending ? 0.7 : 1,
                  }}
                >
                  {msg.content || (msg.pending ? '…' : '')}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: '12px',
              borderTop: '1px solid #2a2a2a',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Striker anything…"
              disabled={loading}
              style={{
                flex: 1,
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '8px',
                color: '#eee',
                padding: '8px 12px',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                backgroundColor: '#1B4332',
                border: '1px solid #D4AF37',
                borderRadius: '8px',
                color: '#D4AF37',
                padding: '8px 14px',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !input.trim() ? 0.5 : 1,
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {loading ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
