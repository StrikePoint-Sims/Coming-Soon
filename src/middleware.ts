import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const { auth } = NextAuth(authConfig)

// /book (root) is public — auth is enforced in the server action at confirm time.
// /book/:id sub-pages (confirmed booking receipts) do require auth.
const PROTECTED_PREFIXES = ['/account', '/book/', '/dashboard']
const WAIVER_REQUIRED_PREFIXES = ['/book/']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const session = await auth()

  if (!session?.user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const requiresWaiver = WAIVER_REQUIRED_PREFIXES.some((p) => pathname.startsWith(p))
  if (requiresWaiver) {
    const res = NextResponse.next()
    if (session.user.id) res.headers.set('x-user-id', session.user.id)
    return res
  }

  return NextResponse.next()
}

export const config = {
  // /book (exact) is intentionally excluded — it's public
  matcher: ['/account/:path*', '/book/:path+', '/dashboard/:path*'],
}
