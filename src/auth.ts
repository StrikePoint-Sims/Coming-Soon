import NextAuth from 'next-auth'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import Email from 'next-auth/providers/email'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import Apple from 'next-auth/providers/apple'
import { db } from '@/db'
import { users } from '@/db/schema'
import { authAccounts, authSessions, authVerificationTokens } from '@/db/schema/auth'
import { nanoid } from '@/lib/utils'
import { brevo } from '@/lib/brevo/client'
import { env } from '@/env'
import { eq } from 'drizzle-orm'
import { authConfig } from './auth.config'
import { verifyLoginToken } from '@/lib/auth/otp'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: authAccounts,
    sessionsTable: authSessions,
    verificationTokensTable: authVerificationTokens,
  }),

  providers: [
    // OAuth providers — only active when env vars are present
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? [Google({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET })]
      : []),
    ...(env.APPLE_ID && env.APPLE_SECRET
      ? [Apple({ clientId: env.APPLE_ID, clientSecret: env.APPLE_SECRET })]
      : []),

    // OTP phone sign-in: client passes a short-lived HMAC token obtained from /api/auth/otp/verify
    Credentials({
      credentials: { loginToken: { type: 'text' } },
      authorize: async (credentials) => {
        const token = credentials?.loginToken as string | undefined
        if (!token) return null
        const userId = verifyLoginToken(token, env.AUTH_SECRET)
        if (!userId) return null
        const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
        return user ?? null
      },
    }),

    // Dev-only bypass — upserts user by email, no auth required
    ...(process.env.NODE_ENV === 'development' ? [
      Credentials({
        id: 'dev-bypass',
        credentials: { email: { type: 'text' } },
        authorize: async (credentials) => {
          const email = credentials?.email as string | undefined
          if (!email) return null
          const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1)
          if (existing) return existing
          const [created] = await db.insert(users).values({
            id: nanoid(),
            email,
            name: email.split('@')[0],
          }).returning()
          return created ?? null
        },
      }),
    ] : []),

    Email({
      server: { host: 'localhost', port: 25, auth: { user: '', pass: '' } },
      from: env.BREVO_TRANSACTIONAL_SENDER_EMAIL ?? '',
      sendVerificationRequest: async ({ identifier: email, url }) => {
        await brevo.sendEmail({
          to: [{ email }],
          subject: 'Sign in to StrikePoint Sims',
          htmlContent: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
              <img src="${env.NEXT_PUBLIC_APP_URL}/logo.png" alt="StrikePoint Sims" height="36" style="margin-bottom:32px">
              <h2 style="margin:0 0 16px;font-size:20px;color:#111">Sign in to your account</h2>
              <p style="color:#555;margin:0 0 28px;line-height:1.6">
                Click the button below to sign in. This link expires in 24 hours and can only be used once.
              </p>
              <a href="${url}" style="display:inline-block;background:#1B4332;color:#D4AF37;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px">
                Sign in to StrikePoint Sims
              </a>
              <p style="margin:28px 0 0;font-size:13px;color:#999;line-height:1.5">
                If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          `,
          tags: ['magic-link'],
        })
      },
    }),
  ],

  events: {
    async createUser({ user }) {
      if (!user.email) return
      await brevo.upsertContact({
        email: user.email,
        attributes: { FIRSTNAME: user.name ?? '' },
        updateEnabled: true,
      }).catch(console.error)
    },
    async signIn({ user, isNewUser }) {
      if (isNewUser) return
      if (user.email) {
        await brevo.upsertContact({ email: user.email, updateEnabled: true }).catch(console.error)
      }
    },
  },
})

// ── Helper: get current session user from DB ──────────────────────────────────

export async function getCurrentUser() {
  const session = await auth()
  if (!session?.user?.id) return null
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1)
  return user ?? null
}
