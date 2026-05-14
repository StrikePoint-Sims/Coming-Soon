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
    async signIn({ user }) {
      if (!user.email) return false
      return true
    },
  },
  providers: [],
}
