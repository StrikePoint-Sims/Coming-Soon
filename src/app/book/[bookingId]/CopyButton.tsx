'use client'

import { useState } from 'react'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable
    }
  }

  return (
    <button type="button" onClick={() => void copy()} className="conf-copy" aria-label="Copy confirmation number">
      {copied ? (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9l4 4 6-8"/>
        </svg>
      ) : (
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="6" width="10" height="10" rx="2"/>
          <path d="M3 12V4a1 1 0 011-1h8"/>
        </svg>
      )}
    </button>
  )
}
