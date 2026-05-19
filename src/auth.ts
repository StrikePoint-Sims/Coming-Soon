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
        const safeUrl = url.replace(/"/g, '&quot;')
        await brevo.sendEmail({
          to: [{ email }],
          subject: 'Sign in to StrikePoint Sims',
          htmlContent: `
            <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0">
              Your secure StrikePoint Sims sign-in link expires in 24 hours.
            </div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,Arial,sans-serif;color:#f5f1e8">
              <tr>
                <td align="center" style="padding:56px 20px">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:separate;border-spacing:0">
                    <tr>
                      <td style="padding:0 0 22px">
                        <table role="presentation" cellspacing="0" cellpadding="0">
                          <tr>
                            <td style="width:42px;height:42px;border:1px solid rgba(169,120,69,0.45);border-radius:999px;background:rgba(61,90,42,0.28);color:#A6BA78;font-family:Georgia,serif;font-size:18px;font-weight:700;text-align:center;vertical-align:middle">
                              SP
                            </td>
                            <td style="padding-left:12px;color:#f5f1e8;font-size:18px;font-weight:700;letter-spacing:-0.01em">
                              StrikePoint<br><span style="color:rgba(245,241,232,0.72);font-weight:500">Sims</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="border:1px solid rgba(169,120,69,0.22);border-radius:10px;background:linear-gradient(135deg,rgba(61,90,42,0.16),rgba(169,120,69,0.08));padding:34px">
                        <div style="color:#A97845;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:18px">
                          Secure sign in
                        </div>
                        <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:0.98;font-weight:700;color:#fff">
                          Sign in to your account
                        </h1>
                        <p style="margin:0 0 28px;color:rgba(255,255,255,0.68);font-size:15px;line-height:1.65">
                          Use the secure link below to access your StrikePoint account. This link expires in 24 hours and can only be used once.
                        </p>
                        <a href="${safeUrl}" style="display:block;background:#4A6E34;border:1px solid rgba(166,186,120,0.55);border-radius:8px;color:#fff;text-decoration:none;text-align:center;padding:16px 22px;font-size:14px;font-weight:800;letter-spacing:0.02em">
                          Sign in to StrikePoint Sims
                        </a>
                        <p style="margin:24px 0 0;color:rgba(255,255,255,0.42);font-size:12px;line-height:1.55">
                          If you did not request this, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:18px 4px 0;color:rgba(255,255,255,0.36);font-size:12px;line-height:1.5">
                        StrikePoint Sims account access
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          `,
          textContent: `Sign in to StrikePoint Sims: ${url}\n\nThis link expires in 24 hours and can only be used once. If you did not request this, you can ignore this email.`,
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
