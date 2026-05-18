'use client'

import { useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react'

interface DesktopUserMenuProps {
  initial: string
  label: string
}

export function DesktopUserMenu({ initial, label }: DesktopUserMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  return (
    <div className="dh-user-menu" ref={menuRef}>
      <button
        type="button"
        className="dh-user-pill"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span className="dh-user-avatar" aria-hidden="true">{initial}</span>
        {label}
      </button>

      {open && (
        <div className="dh-user-dropdown" role="menu">
          <a href="/account" className="dh-user-menu-item" role="menuitem">Account</a>
          <a href="/account/bookings" className="dh-user-menu-item" role="menuitem">My bookings</a>
          <a href="/account/guests" className="dh-user-menu-item" role="menuitem">Guests and waivers</a>
          <a href="/account/settings" className="dh-user-menu-item" role="menuitem">Settings</a>
          <button
            type="button"
            className="dh-user-menu-item is-danger"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: '/' })}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
