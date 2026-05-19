'use client'

import { useState } from 'react'
import { createSupportRequest } from '../actions'

interface SupportActionsProps {
  name: string
  email: string
  phone: string
}

export function SupportActions({ name, email, phone }: SupportActionsProps) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    const result = await createSupportRequest(new FormData(event.currentTarget))
    setSubmitting(false)

    if ('error' in result) {
      setError(result.error)
      return
    }

    setSent(true)
    setMessage('')
  }

  function openChat() {
    window.dispatchEvent(new CustomEvent('strikepoint:open-chat'))
  }

  return (
    <>
      <button type="button" className="dash-btn ghost dash-btn-full" onClick={() => setOpen(true)}>
        Contact Support
      </button>
      <button type="button" className="dash-btn primary dash-btn-full" onClick={openChat}>
        Chat with our AI
      </button>

      {open && (
        <div className="st-support-modal" role="dialog" aria-modal="true" aria-labelledby="support-title">
          <button className="st-support-backdrop" type="button" aria-label="Close support form" onClick={() => setOpen(false)} />
          <form className="st-support-dialog" onSubmit={event => void handleSubmit(event)}>
            <div className="dash-section-header">
              <span className="dash-section-label gold" id="support-title">CONTACT SUPPORT</span>
              <button type="button" className="st-support-close" onClick={() => setOpen(false)} aria-label="Close support form">x</button>
            </div>

            {sent ? (
              <div className="st-support-success">
                <p className="st-waiver-status valid">Message sent.</p>
                <p className="st-info-body">We have your request and will follow up as soon as we can.</p>
                <button type="button" className="dash-btn primary dash-btn-full" onClick={() => setOpen(false)}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="st-form-row">
                  <div className="st-form-group">
                    <label className="st-form-label" htmlFor="support-name">Name</label>
                    <input id="support-name" className="st-form-input" name="name" defaultValue={name} />
                  </div>
                  <div className="st-form-group">
                    <label className="st-form-label" htmlFor="support-phone">Phone</label>
                    <input id="support-phone" className="st-form-input" name="phone" defaultValue={phone} />
                  </div>
                </div>
                <div className="st-form-group">
                  <label className="st-form-label" htmlFor="support-email">Email</label>
                  <input id="support-email" className="st-form-input" name="email" type="email" defaultValue={email} />
                </div>
                <div className="st-form-group">
                  <label className="st-form-label" htmlFor="support-message">Message</label>
                  <textarea
                    id="support-message"
                    className="st-form-input st-support-textarea"
                    name="message"
                    value={message}
                    onChange={event => setMessage(event.target.value)}
                    placeholder="What can we help with?"
                    required
                  />
                </div>
                {error && <p className="st-support-error">{error}</p>}
                <button type="submit" className="dash-btn primary dash-btn-full" disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send Message'}
                </button>
              </>
            )}
          </form>
        </div>
      )}
    </>
  )
}
