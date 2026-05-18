import type { NextAuthConfig } from 'next-auth'

// Edge-compatible config — no nodemailer, no DB adapter.
// Used by middleware. Full config with Email provider lives in auth.ts.
export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    verifyRequest: '/login/check-email',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token['userId'] = user.id
      return token
    },
    async session({ session, token }) {
      if (token['userId']) session.user.id = token['userId'] as string
      return session
    },
    async signIn({ user, account }) {
      // Phone OTP goes through Credentials provider — user may not have email yet
      if (account?.provider === 'credentials') return true
      if (!user.email) return false
      return true
    },
    async redirect({ url, baseUrl }) {
      return normalizeAuthRedirect(url, baseUrl)
    },
  },
  providers: [],
}

function normalizeAuthRedirect(raw: string, baseUrl: string): string {
  try {
    const url = new URL(raw, baseUrl)
    const pathname = url.pathname.toLowerCase()

    if (
      pathname.startsWith('/management') ||
      pathname.startsWith('/accounting') ||
      pathname === '/dashboard' ||
      pathname.startsWith('/dashboard/')
    ) {
      return `${baseUrl}/account`
    }

    if (
      pathname === '/booking' ||
      pathname === '/booking.html' ||
      pathname === '/book.html' ||
      pathname.startsWith('/booking/')
    ) {
      return `${baseUrl}/book`
    }

    if (url.origin === baseUrl || url.hostname.endsWith('strikepointsims.com')) {
      return `${baseUrl}${url.pathname}${url.search}${url.hash}`
    }

    return `${baseUrl}/account`
  } catch {
    return `${baseUrl}/account`
  }
}
